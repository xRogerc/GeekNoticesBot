import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { ArticleCard } from "./index";
import { FollowListDialog } from "@/components/follow-list-dialog";
import { ImageUploader } from "@/components/image-uploader";

export const Route = createFileRoute("/me")({
  ssr: false,
  component: MyProfile,
});

function MyProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tab, setTab] = useState<"posts" | "reposts">("posts");
  const [followDialog, setFollowDialog] = useState<"followers" | "following" | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["follow-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user!.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user!.id),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const name = displayName.trim();
      if (name.length < 2) throw new Error("Nome muito curto");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name, bio: bio.trim() || null, avatar_url: avatarUrl.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: articles } = useQuery({
    queryKey: ["my-articles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, excerpt, cover_image_url, category, created_at, published, is_nsfw, profiles!articles_author_profile_fkey(display_name)")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const deleteArticle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notícia excluída");
      qc.invalidateQueries({ queryKey: ["my-articles", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: reposts } = useQuery({
    queryKey: ["my-reposts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reposts")
        .select("created_at, articles(id, title, slug, excerpt, cover_image_url, category, created_at, author_id, is_nsfw, profiles!articles_author_profile_fkey(display_name, avatar_url))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => r.articles).filter(Boolean);
    },
  });

  const removeRepost = useMutation({
    mutationFn: async (articleId: string) => {
      const { error } = await supabase.from("reposts").delete().eq("article_id", articleId).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Republicação removida");
      qc.invalidateQueries({ queryKey: ["my-reposts", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!ready) return null;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Você não está logado</h1>
        <Link to="/auth" className="mt-4 inline-block text-cyan-glow hover:underline">Entrar →</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          {editing ? (
            <div className="h-24 w-24 shrink-0">
              <ImageUploader
                value={avatarUrl || null}
                onChange={(url) => setAvatarUrl(url ?? "")}
                bucket="avatars"
                shape="avatar"
                userId={user.id}
              />
            </div>
          ) : profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full border border-border object-cover" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-neon-gradient" />
          )}
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nome de exibição"
                  className="w-full px-3 py-2 rounded-md bg-input border border-border focus:border-primary focus:outline-none font-display text-lg"
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  placeholder="Conte um pouco sobre você..."
                  className="w-full min-h-20 px-3 py-2 rounded-md bg-input border border-border focus:border-primary focus:outline-none text-sm"
                />
                <p className="text-xs text-muted-foreground">{bio.length}/280</p>
              </div>
            ) : (
              <>
                <h1 className="font-display text-3xl font-black">{profile?.display_name ?? user.email}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {profile?.bio ? (
                  <p className="mt-3 text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <button type="button" onClick={() => setFollowDialog("followers")} className="hover:text-cyan-glow transition-colors">
                    <span className="font-bold text-foreground">{counts?.followers ?? 0}</span> <span className="text-muted-foreground">seguidores</span>
                  </button>
                  <button type="button" onClick={() => setFollowDialog("following")} className="hover:text-cyan-glow transition-colors">
                    <span className="font-bold text-foreground">{counts?.following ?? 0}</span> <span className="text-muted-foreground">seguindo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neon-gradient text-primary-foreground font-semibold shadow-neon disabled:opacity-50 text-sm"
              >
                <Save className="h-4 w-4" /> Salvar
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setDisplayName(profile?.display_name ?? "");
                  setBio(profile?.bio ?? "");
                  setAvatarUrl(profile?.avatar_url ?? "");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:border-primary text-sm"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:border-primary text-sm"
            >
              <Pencil className="h-4 w-4" /> Editar perfil
            </button>
          )}
          <Link
            to="/u/$id"
            params={{ id: user.id }}
            className="text-xs text-cyan-glow hover:underline text-center"
          >
            Ver perfil público →
          </Link>
        </div>
      </div>

      <div className="mt-10 flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={
            "px-4 py-2 font-display font-bold text-sm -mb-px border-b-2 transition-colors " +
            (tab === "posts" ? "border-primary text-cyan-glow" : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          Minhas notícias <span className="ml-1 text-xs text-muted-foreground">({articles?.length ?? 0})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("reposts")}
          className={
            "px-4 py-2 font-display font-bold text-sm -mb-px border-b-2 transition-colors " +
            (tab === "reposts" ? "border-primary text-cyan-glow" : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          Republicações <span className="ml-1 text-xs text-muted-foreground">({reposts?.length ?? 0})</span>
        </button>
      </div>
      <div className="mt-6">
        {tab === "posts" ? (
          !articles || articles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">Você ainda não publicou nada.</p>
            <Link to="/write" className="mt-4 inline-block px-4 py-2 rounded-md bg-neon-gradient text-primary-foreground font-semibold shadow-neon">
              Publicar primeira notícia
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((a) => (
              <div key={a.id} className="flex items-center gap-4 rounded-lg border border-border bg-card/60 p-3 hover:border-primary transition-colors">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md">
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-neon-gradient opacity-70" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono tracking-widest text-cyan-glow uppercase">
                    {CATEGORY_LABEL[a.category as keyof typeof CATEGORY_LABEL]}
                  </p>
                  <Link to="/news/$slug" params={{ slug: a.slug }} className="font-display font-bold leading-snug line-clamp-1 hover:text-neon">
                    {a.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    to="/edit/$id"
                    params={{ id: a.id }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border hover:border-primary text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir "${a.title}"?`)) deleteArticle.mutate(a.id);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
          )
        ) : (
          !reposts || reposts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Você ainda não republicou nenhuma notícia.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reposts.map((a: any) => (
                <div key={a.id} className="relative group">
                  <ArticleCard article={a} />
                  <button
                    onClick={() => {
                      if (confirm("Remover republicação?")) removeRepost.mutate(a.id);
                    }}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" /> Remover
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {followDialog && user ? (
        <FollowListDialog userId={user.id} mode={followDialog} onClose={() => setFollowDialog(null)} />
      ) : null}
    </div>
  );
}
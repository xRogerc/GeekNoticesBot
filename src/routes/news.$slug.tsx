import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL } from "@/lib/categories";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Trash2, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { RichContent } from "@/components/rich-content";
import { Repeat2 } from "lucide-react";
import { FollowButton } from "@/components/follow-button";
import { AdSlot } from "@/components/ad-slot";
import { AD_SLOTS } from "@/lib/ads";

export const Route = createFileRoute("/news/$slug")({
  ssr: false,
  component: ArticleView,
});

function ArticleView() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [commentText, setCommentText] = useState("");
  const [revealNsfw, setRevealNsfw] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*, profiles!articles_author_profile_fkey(display_name, avatar_url)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: likesData } = useQuery({
    queryKey: ["likes", article?.id, user?.id],
    enabled: !!article?.id,
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("article_id", article.id),
        user
          ? supabase.from("likes").select("user_id").eq("article_id", article.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, liked: !!mine.data };
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", article?.id],
    enabled: !!article?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, profiles!comments_user_profile_fkey(display_name, avatar_url)")
        .eq("article_id", article.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para curtir");
      if (likesData?.liked) {
        await supabase.from("likes").delete().eq("article_id", article.id).eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ article_id: article.id, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["likes", article?.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para comentar");
      const trimmed = commentText.trim();
      if (trimmed.length < 2) throw new Error("Comentário muito curto");
      if (trimmed.length > 1000) throw new Error("Comentário muito longo");
      const { error } = await supabase.from("comments").insert({
        article_id: article.id,
        user_id: user.id,
        content: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["comments", article?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", article?.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteArticleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("articles").delete().eq("id", article.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notícia excluída");
      navigate({ to: "/" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: repostData } = useQuery({
    queryKey: ["reposts", article?.id, user?.id],
    enabled: !!article?.id,
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("reposts").select("*", { count: "exact", head: true }).eq("article_id", article.id),
        user
          ? supabase.from("reposts").select("user_id").eq("article_id", article.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, reposted: !!mine.data };
    },
  });

  const repostMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para republicar");
      if (repostData?.reposted) {
        const { error } = await supabase.from("reposts").delete().eq("article_id", article.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reposts").insert({ article_id: article.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(repostData?.reposted ? "Republicação removida" : "Republicado no seu perfil");
      qc.invalidateQueries({ queryKey: ["reposts", article?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><div className="h-96 rounded-xl bg-card/60 animate-pulse" /></div>;
  }
  if (error || !article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Notícia não encontrada</h1>
        <Link to="/" className="mt-4 inline-block text-cyan-glow hover:underline">← voltar</Link>
      </div>
    );
  }

  const isAuthor = user?.id === article.author_id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article className="min-w-0">
      <Link to="/category/$slug" params={{ slug: article.category }} className="text-xs font-mono tracking-[0.3em] text-cyan-glow uppercase hover:underline">
        // {CATEGORY_LABEL[article.category as keyof typeof CATEGORY_LABEL]}
      </Link>
      <h1 className="mt-3 font-display text-3xl md:text-5xl font-black leading-tight">{article.title}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>

      {article.is_nsfw ? (
        <div className="mt-4 flex items-center gap-3 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm">
          <span className="font-mono text-xs px-2 py-0.5 rounded border border-destructive text-destructive">+18</span>
          <span className="text-muted-foreground">Esta matéria foi marcada como conteúdo sensível pelo autor.</span>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-4 border-y border-border/60 py-4">
        <Link to="/u/$id" params={{ id: article.author_id }} className="flex items-center gap-3 group">
          {article.profiles?.avatar_url ? (
            <img src={article.profiles.avatar_url} alt="" className="h-10 w-10 rounded-full" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-neon-gradient" />
          )}
          <div>
            <p className="font-semibold group-hover:text-cyan-glow transition-colors">{article.profiles?.display_name ?? "Anônimo"}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(article.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        </Link>
        {isAuthor ? (
          <div className="flex gap-2">
            <Link
              to="/edit/$id"
              params={{ id: article.id }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:border-primary text-sm"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Link>
            <button
              onClick={() => {
                if (confirm("Excluir esta notícia?")) deleteArticleMutation.mutate();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 text-sm"
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </button>
          </div>
        ) : (
          <FollowButton targetId={article.author_id} />
        )}
      </div>

      {article.cover_image_url ? (
        <div className="mt-8 relative rounded-xl overflow-hidden border border-border">
          <img
            src={article.cover_image_url}
            alt=""
            className={
              "w-full aspect-video object-cover " +
              (article.is_nsfw && !revealNsfw ? "blur-2xl scale-110" : "")
            }
          />
          {article.is_nsfw && !revealNsfw ? (
            <button
              type="button"
              onClick={() => setRevealNsfw(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm"
            >
              <span className="px-3 py-1 rounded-md border border-destructive text-destructive font-mono text-xs tracking-widest">
                +18 · CONTEÚDO SENSÍVEL
              </span>
              <span className="text-sm text-foreground">Toque para revelar a imagem</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {article.is_nsfw && !revealNsfw ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            O conteúdo desta matéria está oculto por conter material sensível.
          </p>
          <button
            type="button"
            onClick={() => setRevealNsfw(true)}
            className="mt-4 px-5 py-2.5 rounded-md border-neon font-semibold hover:bg-secondary/60"
          >
            Sou maior de 18 anos — mostrar conteúdo
          </button>
        </div>
      ) : (
        <RichContent html={article.content} className="mt-8 text-lg leading-relaxed" />
      )}

      {/* Actions */}
      <div className="mt-10 flex items-center gap-4 border-t border-border/60 pt-6">
        <button
          onClick={() => (user ? likeMutation.mutate() : navigate({ to: "/auth" }))}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
            likesData?.liked
              ? "border-primary text-neon shadow-neon"
              : "border-border hover:border-primary"
          }`}
        >
          <Heart className={`h-4 w-4 ${likesData?.liked ? "fill-current" : ""}`} />
          <span className="font-semibold">{likesData?.count ?? 0}</span>
        </button>
        <button
          onClick={() => (user ? repostMutation.mutate() : navigate({ to: "/auth" }))}
          disabled={isAuthor}
          title={isAuthor ? "Você não pode republicar a própria notícia" : undefined}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            repostData?.reposted
              ? "border-cyan-glow text-cyan-glow shadow-neon"
              : "border-border hover:border-primary"
          }`}
        >
          <Repeat2 className="h-4 w-4" />
          <span className="font-semibold">{repostData?.count ?? 0}</span>
        </button>
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          <span>{comments?.length ?? 0} comentários</span>
        </div>
      </div>

      {/* Comments */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Comentários</h2>
        {user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commentMutation.mutate();
            }}
            className="mt-4"
          >
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={1000}
              placeholder="Escreva um comentário..."
              className="w-full min-h-24 px-3 py-2 rounded-md bg-input border border-border focus:border-primary focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={commentMutation.isPending}
                className="px-4 py-2 rounded-md bg-neon-gradient text-primary-foreground font-semibold shadow-neon disabled:opacity-50"
              >
                Comentar
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            <Link to="/auth" className="text-cyan-glow hover:underline">Entre</Link> para comentar.
          </p>
        )}

        <div className="mt-6 space-y-4">
          {comments?.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <Link to="/u/$id" params={{ id: c.user_id }} className="flex items-center gap-2 group">
                  {c.profiles?.avatar_url ? (
                    <img src={c.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-neon-gradient" />
                  )}
                  <div>
                    <p className="text-sm font-semibold group-hover:text-cyan-glow transition-colors">{c.profiles?.display_name ?? "Anônimo"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </Link>
                {user?.id === c.user_id ? (
                  <button
                    onClick={() => deleteCommentMutation.mutate(c.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      </section>
      </article>
      {!(article.is_nsfw && !revealNsfw) ? (
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <AdSlot slot={AD_SLOTS.sidebar} format="rectangle" minHeight={600} responsive={false} />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
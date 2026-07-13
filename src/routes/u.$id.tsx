import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArticleCard } from "./index";
import { useState } from "react";
import { FollowButton } from "@/components/follow-button";
import { FollowListDialog } from "@/components/follow-list-dialog";

export const Route = createFileRoute("/u/$id")({
  ssr: false,
  component: PublicProfile,
});

function PublicProfile() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<"posts" | "reposts">("posts");
  const [followDialog, setFollowDialog] = useState<"followers" | "following" | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: articles } = useQuery({
    queryKey: ["user-articles", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, excerpt, cover_image_url, category, created_at, author_id, is_nsfw, profiles!articles_author_profile_fkey(display_name, avatar_url)")
        .eq("author_id", id)
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: reposts } = useQuery({
    queryKey: ["user-reposts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reposts")
        .select("created_at, articles(id, title, slug, excerpt, cover_image_url, category, created_at, author_id, is_nsfw, profiles!articles_author_profile_fkey(display_name, avatar_url))")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => r.articles).filter(Boolean);
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["follow-counts", id],
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-16"><div className="h-40 rounded-xl bg-card/60 animate-pulse" /></div>;
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Perfil não encontrado</h1>
        <Link to="/" className="mt-4 inline-block text-cyan-glow hover:underline">← voltar</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-start gap-4">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full border border-border" />
        ) : (
          <div className="h-20 w-20 rounded-full bg-neon-gradient" />
        )}
        <div className="flex-1">
          <h1 className="font-display text-3xl font-black">{profile.display_name}</h1>
          {profile.bio ? (
            <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground italic">Sem bio ainda.</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <button type="button" onClick={() => setFollowDialog("followers")} className="hover:text-cyan-glow transition-colors">
              <span className="font-bold text-foreground">{counts?.followers ?? 0}</span> <span className="text-muted-foreground">seguidores</span>
            </button>
            <button type="button" onClick={() => setFollowDialog("following")} className="hover:text-cyan-glow transition-colors">
              <span className="font-bold text-foreground">{counts?.following ?? 0}</span> <span className="text-muted-foreground">seguindo</span>
            </button>
          </div>
        </div>
        <FollowButton targetId={id} />
      </div>

      {followDialog ? (
        <FollowListDialog userId={id} mode={followDialog} onClose={() => setFollowDialog(null)} />
      ) : null}

      <div className="mt-10 flex gap-2 border-b border-border">
        <TabButton active={tab === "posts"} onClick={() => setTab("posts")}>
          Publicações <span className="ml-1 text-xs text-muted-foreground">({articles?.length ?? 0})</span>
        </TabButton>
        <TabButton active={tab === "reposts"} onClick={() => setTab("reposts")}>
          Republicações <span className="ml-1 text-xs text-muted-foreground">({reposts?.length ?? 0})</span>
        </TabButton>
      </div>
      <div className="mt-6">
        {tab === "posts" ? (
          !articles || articles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Este autor ainda não publicou nada.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )
        ) : (
          !reposts || reposts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Nenhuma republicação ainda.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reposts.map((a: any) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-4 py-2 font-display font-bold text-sm -mb-px border-b-2 transition-colors " +
        (active ? "border-primary text-cyan-glow" : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
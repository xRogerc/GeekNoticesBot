import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArticleCard } from "../index";
import { Users } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { AD_SLOTS, AD_INTERVAL } from "@/lib/ads";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FollowingFeed,
});

function FollowingFeed() {
  const { data: followingIds } = useQuery({
    queryKey: ["my-following-ids"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", uid);
      if (error) throw error;
      return (data ?? []).map((r) => r.following_id as string);
    },
  });

  const { data: articles, isLoading } = useQuery({
    queryKey: ["following-feed", followingIds],
    enabled: !!followingIds,
    queryFn: async () => {
      if (!followingIds || followingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, excerpt, cover_image_url, category, created_at, author_id, is_nsfw, profiles!articles_author_profile_fkey(display_name, avatar_url)")
        .in("author_id", followingIds)
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Users className="h-6 w-6 text-cyan-glow" />
        <h1 className="font-display text-3xl font-black">Seu <span className="text-neon">feed</span></h1>
      </div>
      <p className="text-muted-foreground -mt-6 mb-8">Notícias dos autores que você segue.</p>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 rounded-xl bg-card/60 animate-pulse" />)}
        </div>
      ) : !followingIds || followingIds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-display text-2xl">Você ainda não segue ninguém</h2>
          <p className="mt-2 text-muted-foreground">Explore o feed principal e siga autores para ver as notícias deles aqui.</p>
          <Link to="/" className="inline-block mt-6 px-5 py-3 rounded-md bg-neon-gradient text-primary-foreground font-semibold shadow-neon">
            Explorar notícias
          </Link>
        </div>
      ) : !articles || articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Os autores que você segue ainda não publicaram nada.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.flatMap((a, i) => {
            const nodes = [<ArticleCard key={a.id} article={a} />];
            if ((i + 1) % AD_INTERVAL === 0) {
              nodes.push(
                <div key={`ad-${i}`} className="rounded-xl border border-border/60 bg-card/40 p-3 flex items-center">
                  <AdSlot slot={AD_SLOTS.feed} format="fluid" layoutKey="-6t+ed+2i-1n-4w" minHeight={220} className="w-full" />
                </div>
              );
            }
            return nodes;
          })}
        </div>
      )}
    </div>
  );
}
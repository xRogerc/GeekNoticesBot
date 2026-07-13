import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABEL, CATEGORIES } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import { ArticleCard } from "./index";
import { AdSlot } from "@/components/ad-slot";
import { AD_SLOTS, AD_INTERVAL } from "@/lib/ads";

export const Route = createFileRoute("/category/$slug")({
  ssr: false,
  component: CategoryPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl">Categoria não encontrada</h1>
      <Link to="/" className="mt-4 inline-block text-cyan-glow hover:underline">← voltar</Link>
    </div>
  ),
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const valid = CATEGORIES.some((c) => c.slug === slug);
  if (!valid) throw notFound();
  const category = slug as Category;

  const { data, isLoading } = useQuery({
    queryKey: ["articles", "category", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, excerpt, cover_image_url, category, created_at, is_nsfw, profiles!articles_author_profile_fkey(display_name)")
        .eq("category", category)
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-cyan-glow font-mono text-xs tracking-[0.3em]">// CATEGORIA</p>
      <h1 className="font-display text-4xl font-black mt-2">
        <span className="text-neon">{CATEGORY_LABEL[category]}</span>
      </h1>
      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-xl bg-card/60 animate-pulse" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma notícia nesta categoria ainda.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.flatMap((a, i) => {
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
    </div>
  );
}
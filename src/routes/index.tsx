import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import heroImg from "@/assets/hero.jpg";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { AD_SLOTS, AD_INTERVAL } from "@/lib/ads";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // debounce title search
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const { data: articles, isLoading } = useQuery({
    queryKey: ["articles", "feed", query, category, activeTags],
    queryFn: async () => {
      let q = supabase
        .from("articles")
        .select("id, title, slug, excerpt, cover_image_url, category, created_at, author_id, tags, is_nsfw, profiles!articles_author_profile_fkey(display_name, avatar_url)")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(60);
      if (query) q = q.ilike("title", `%${query}%`);
      if (category !== "all") q = q.eq("category", category);
      if (activeTags.length > 0) q = q.contains("tags", activeTags);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  // Popular tags derived from the current result set (for quick chips)
  const { data: tagPool } = useQuery({
    queryKey: ["articles", "tag-pool"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("tags")
        .eq("published", true)
        .limit(200);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data as unknown as { tags: string[] | null }[]) ?? []) {
        for (const t of row.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
    },
  });

  function toggleTag(tag: string) {
    setActiveTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  }
  function clearFilters() {
    setRawQuery("");
    setQuery("");
    setCategory("all");
    setActiveTags([]);
  }

  const hasFilters = query.length > 0 || category !== "all" || activeTags.length > 0;

  const featured = articles?.[0];
  const rest = articles?.slice(1) ?? [];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="text-cyan-glow font-mono text-xs md:text-sm tracking-[0.3em] mb-4">// TRANSMISSÃO ATIVA</p>
          <h1 className="font-display text-4xl md:text-6xl font-black leading-tight max-w-3xl">
            As notícias <span className="text-neon">geek</span> escritas por{" "}
            <span className="text-cyan-glow">quem vive</span> a cultura.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Games, cinema, quadrinhos, tech e anime. Publique a sua matéria em minutos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/write" className="px-5 py-3 rounded-md bg-neon-gradient text-primary-foreground font-semibold shadow-neon hover:opacity-90">
              Publicar notícia
            </Link>
            <a href="#feed" className="px-5 py-3 rounded-md border-neon font-semibold hover:bg-secondary/60">
              Ver últimas
            </a>
          </div>
        </div>
      </section>

      {/* Categories strip */}
      <section className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            to="/category/$slug"
            params={{ slug: c.slug }}
            className="px-3 py-1.5 rounded-full text-sm border border-border hover:border-primary hover:text-cyan-glow transition-colors"
          >
            #{c.label}
          </Link>
        ))}
      </section>

      {/* Search & filters */}
      <section id="feed" className="mx-auto max-w-6xl px-4 pt-2 pb-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Buscar por título..."
              className="w-full pl-10 pr-3 py-2.5 rounded-md bg-input border border-border focus:border-primary focus:outline-none"
              aria-label="Buscar notícias"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "all")}
            className="px-3 py-2.5 rounded-md bg-input border border-border focus:border-primary focus:outline-none"
            aria-label="Filtrar por categoria"
          >
            <option value="all">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-md border border-border hover:border-primary hover:text-cyan-glow text-sm"
            >
              <X className="h-4 w-4" /> Limpar
            </button>
          ) : null}
        </div>

        {(tagPool && tagPool.length > 0) || activeTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...activeTags, ...(tagPool ?? [])])).map((tag) => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={
                    "px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider border transition-colors " +
                    (active
                      ? "border-primary bg-primary/20 text-cyan-glow shadow-neon"
                      : "border-border hover:border-primary hover:text-cyan-glow")
                  }
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* Feed */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-xl bg-card/60 animate-pulse" />
            ))}
          </div>
        ) : !articles || articles.length === 0 ? (
          hasFilters ? <NoResults onClear={clearFilters} /> : <EmptyState />
        ) : (
          <>
            {!hasFilters && featured ? <FeaturedCard article={featured} /> : null}
            <div className={(!hasFilters && featured ? "mt-8 " : "") + "grid gap-6 md:grid-cols-2 lg:grid-cols-3"}>
              {(hasFilters ? articles : rest).flatMap((a, i) => {
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
          </>
        )}
      </section>
    </div>
  );
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center">
      <h2 className="font-display text-2xl">Nenhum resultado</h2>
      <p className="mt-2 text-muted-foreground">Tente outro termo ou remova os filtros.</p>
      <button onClick={onClear} className="inline-block mt-6 px-5 py-3 rounded-md border-neon font-semibold">
        Limpar filtros
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center">
      <h2 className="font-display text-2xl">Nenhuma notícia ainda</h2>
      <p className="mt-2 text-muted-foreground">Seja o primeiro a publicar uma notícia para a comunidade.</p>
      <Link to="/write" className="inline-block mt-6 px-5 py-3 rounded-md bg-neon-gradient text-primary-foreground font-semibold shadow-neon">
        Publicar agora
      </Link>
    </div>
  );
}

function FeaturedCard({ article }: { article: any }) {
  return (
    <Link
      to="/news/$slug"
      params={{ slug: article.slug }}
      className="group relative block overflow-hidden rounded-2xl border border-border hover:border-primary shadow-neon transition-all"
    >
      <div className="grid md:grid-cols-2">
        <div className="aspect-video md:aspect-auto md:h-full relative overflow-hidden">
          {article.cover_image_url ? (
            <img
              src={article.cover_image_url}
              alt=""
              className={
                "w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 " +
                (article.is_nsfw ? "blur-2xl scale-110" : "")
              }
            />
          ) : (
            <div className="w-full h-full bg-neon-gradient" />
          )}
          {article.is_nsfw ? <NsfwBadge /> : null}
        </div>
        <div className="p-6 md:p-8 bg-card/80">
          <span className="text-xs font-mono tracking-widest text-cyan-glow uppercase">
            {CATEGORY_LABEL[article.category as keyof typeof CATEGORY_LABEL]} · Em destaque
          </span>
          <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold leading-tight group-hover:text-neon transition-colors">
            {article.title}
          </h2>
          <p className="mt-3 text-muted-foreground line-clamp-3">{article.excerpt}</p>
          <p className="mt-6 text-sm text-muted-foreground">
            por <span className="text-foreground">{article.profiles?.display_name ?? "anônimo"}</span> ·{" "}
            {formatDistanceToNow(new Date(article.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function ArticleCard({ article }: { article: any }) {
  return (
    <Link
      to="/news/$slug"
      params={{ slug: article.slug }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card/60 hover:border-primary hover:shadow-neon transition-all"
    >
      <div className="aspect-video overflow-hidden relative">
        {article.cover_image_url ? (
          <img
            src={article.cover_image_url}
            alt=""
            loading="lazy"
            className={
              "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 " +
              (article.is_nsfw ? "blur-2xl scale-110" : "")
            }
          />
        ) : (
          <div className="w-full h-full bg-neon-gradient opacity-70" />
        )}
        {article.is_nsfw ? <NsfwBadge /> : null}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <span className="text-xs font-mono tracking-widest text-cyan-glow uppercase">
          {CATEGORY_LABEL[article.category as keyof typeof CATEGORY_LABEL]}
        </span>
        <h3 className="mt-2 font-display text-lg font-bold leading-snug line-clamp-2 group-hover:text-neon">
          {article.is_nsfw ? <span className="mr-2 align-middle text-[10px] font-mono px-1.5 py-0.5 rounded border border-destructive/60 text-destructive">+18</span> : null}
          {article.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-3 flex-1">{article.excerpt}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          {article.profiles?.display_name ?? "anônimo"} ·{" "}
          {formatDistanceToNow(new Date(article.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </Link>
  );
}

export function NsfwBadge() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/40 pointer-events-none">
      <span className="px-3 py-1 rounded-md border border-destructive text-destructive bg-background/80 font-mono text-xs tracking-widest shadow-neon">
        +18 · CONTEÚDO SENSÍVEL
      </span>
    </div>
  );
}

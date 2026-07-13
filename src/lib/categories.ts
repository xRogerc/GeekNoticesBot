import type { Database } from "@/integrations/supabase/types";

export type Category = Database["public"]["Enums"]["news_category"];

export const CATEGORIES: { slug: Category; label: string }[] = [
  { slug: "games", label: "Games" },
  { slug: "cinema_tv", label: "Cinema & TV" },
  { slug: "quadrinhos", label: "Quadrinhos" },
  { slug: "tech", label: "Tech" },
  { slug: "anime", label: "Anime" },
];

export const CATEGORY_LABEL: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
) as Record<Category, string>;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
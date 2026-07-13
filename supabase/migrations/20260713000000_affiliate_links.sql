ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS affiliate_links jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS articles_tags_gin_idx ON public.articles USING GIN (tags);
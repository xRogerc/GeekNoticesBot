CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS articles_title_trgm ON public.articles USING gin (title gin_trgm_ops);
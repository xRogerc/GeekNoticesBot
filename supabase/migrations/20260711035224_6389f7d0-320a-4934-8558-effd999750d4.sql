
CREATE TABLE public.reposts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);

GRANT SELECT, INSERT, DELETE ON public.reposts TO authenticated;
GRANT SELECT ON public.reposts TO anon;
GRANT ALL ON public.reposts TO service_role;

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reposts readable by all" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "users repost as self" ON public.reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unrepost own" ON public.reposts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX reposts_user_created_idx ON public.reposts (user_id, created_at DESC);
CREATE INDEX reposts_article_idx ON public.reposts (article_id);

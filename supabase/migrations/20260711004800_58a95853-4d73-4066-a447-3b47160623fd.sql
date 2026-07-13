ALTER TABLE public.articles
  ADD CONSTRAINT articles_author_profile_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
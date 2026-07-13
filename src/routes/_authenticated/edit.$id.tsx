import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArticleForm } from "@/components/article-form";

export const Route = createFileRoute("/_authenticated/edit/$id")({
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ["article-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="h-96 rounded-xl bg-card/60 animate-pulse" /></div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Notícia não encontrada</h1>
        <Link to="/" className="text-cyan-glow hover:underline">← voltar</Link>
      </div>
    );
  }
  if (data.author_id !== user.id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Sem permissão</h1>
        <p className="text-muted-foreground mt-2">Você só pode editar suas próprias notícias.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-black">Editar notícia</h1>
      <div className="mt-8">
        <ArticleForm
          userId={user.id}
          initial={{
            id: data.id,
            title: data.title,
            excerpt: data.excerpt,
            content: data.content,
            cover_image_url: data.cover_image_url ?? "",
            category: data.category,
            tags: ((data as any).tags as string[] | null) ?? [],
            is_nsfw: ((data as any).is_nsfw as boolean | null) ?? false,
            affiliate_links: ((data as any).affiliate_links as { url: string; label: string; platform?: string }[] | null) ?? [],
          }}
        />
      </div>
    </div>
  );
}
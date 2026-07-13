import { createFileRoute } from "@tanstack/react-router";
import { ArticleForm } from "@/components/article-form";

export const Route = createFileRoute("/_authenticated/write")({
  component: WritePage,
});

function WritePage() {
  const { user } = Route.useRouteContext();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-cyan-glow font-mono text-xs tracking-[0.3em]">// NOVA TRANSMISSÃO</p>
      <h1 className="font-display text-3xl md:text-4xl font-black mt-2">Publicar notícia</h1>
      <p className="mt-2 text-muted-foreground">Compartilhe algo bom com a comunidade geek.</p>
      <div className="mt-8">
        <ArticleForm userId={user.id} />
      </div>
    </div>
  );
}
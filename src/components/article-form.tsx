import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, slugify } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import { toast } from "sonner";
import { RichEditor } from "@/components/rich-editor";
import { moderateArticle } from "@/lib/moderation.functions";
import { useServerFn } from "@tanstack/react-start";
import { ImageUploader } from "@/components/image-uploader";

export type ArticleFormValues = {
  id?: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  category: Category;
  tags: string[];
  is_nsfw: boolean;
};

export function ArticleForm({ initial, userId }: { initial?: ArticleFormValues; userId: string }) {
  const [values, setValues] = useState<ArticleFormValues>(
    initial ?? { title: "", excerpt: "", content: "", cover_image_url: "", category: "games", tags: [], is_nsfw: false },
  );
  const [tagsInput, setTagsInput] = useState<string>((initial?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const runModeration = useServerFn(moderateArticle);
  const navigate = useNavigate();
  const isEdit = !!initial?.id;

  function update<K extends keyof ArticleFormValues>(k: K, v: ArticleFormValues[K]) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  function parseTags(input: string): string[] {
    return Array.from(
      new Set(
        input
          .split(/[,\n]/)
          .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
          .filter((t) => t.length > 0 && t.length <= 30),
      ),
    ).slice(0, 10);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (values.title.trim().length < 5) return toast.error("Título muito curto");
    if (values.excerpt.trim().length < 10) return toast.error("Resumo muito curto");
    const plain = values.content.replace(/<[^>]*>/g, "").trim();
    if (plain.length < 30) return toast.error("Conteúdo muito curto");
    const tags = parseTags(tagsInput);
    setSaving(true);
    try {
      let is_nsfw = values.is_nsfw;
      if (!is_nsfw) {
        setChecking(true);
        const check = await runModeration({
          data: {
            title: values.title,
            excerpt: values.excerpt,
            content: values.content,
            cover_image_url: values.cover_image_url,
          },
        }).catch(() => null);
        setChecking(false);
        if (check?.nsfw) {
          is_nsfw = true;
          update("is_nsfw", true);
          toast.warning("Conteúdo marcado como +18 pela moderação automática", {
            description: check.reason || "Detectamos possível conteúdo sensível. Publicamos com selo +18.",
          });
        }
      }
      if (isEdit && initial?.id) {
        const { error } = await supabase
          .from("articles")
          .update({
            title: values.title.trim(),
            excerpt: values.excerpt.trim(),
            content: values.content.trim(),
            cover_image_url: values.cover_image_url.trim() || null,
            category: values.category,
            tags,
            is_nsfw,
          } as never)
          .eq("id", initial.id);
        if (error) throw error;
        toast.success("Notícia atualizada");
        const { data } = await supabase.from("articles").select("slug").eq("id", initial.id).single();
        navigate({ to: "/news/$slug", params: { slug: data!.slug } });
      } else {
        const baseSlug = slugify(values.title);
        const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
        const { data, error } = await supabase
          .from("articles")
          .insert({
            author_id: userId,
            title: values.title.trim(),
            slug: uniqueSlug,
            excerpt: values.excerpt.trim(),
            content: values.content.trim(),
            cover_image_url: values.cover_image_url.trim() || null,
            category: values.category,
            tags,
            is_nsfw,
          } as never)
          .select("slug")
          .single();
        if (error) throw error;
        toast.success("Notícia publicada!");
        navigate({ to: "/news/$slug", params: { slug: data.slug } });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
      setChecking(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-sm font-medium">Título</label>
        <input
          type="text"
          required
          maxLength={140}
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-md bg-input border border-border focus:border-primary focus:outline-none text-lg"
          placeholder="A chamada da sua notícia"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Categoria</label>
          <select
            value={values.category}
            onChange={(e) => update("category", e.target.value as Category)}
            className="mt-1 w-full px-3 py-2 rounded-md bg-input border border-border focus:border-primary focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Imagem de capa</label>
          <div className="mt-1">
            <ImageUploader
              value={values.cover_image_url || null}
              onChange={(url) => update("cover_image_url", url ?? "")}
              bucket="article-covers"
              shape="cover"
              userId={userId}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Resumo</label>
        <textarea
          required
          maxLength={280}
          value={values.excerpt}
          onChange={(e) => update("excerpt", e.target.value)}
          className="mt-1 w-full min-h-20 px-3 py-2 rounded-md bg-input border border-border focus:border-primary focus:outline-none"
          placeholder="Uma linha que resume a notícia (aparece nas listagens)"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Conteúdo</label>
        <div className="mt-1">
          <RichEditor
            value={values.content}
            onChange={(html) => update("content", html)}
            placeholder="Escreva a matéria..."
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Use a barra acima para negrito, itálico, títulos, listas, citações e links.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium">Tags</label>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-md bg-input border border-border focus:border-primary focus:outline-none"
          placeholder="ex: xbox, review, indie (separadas por vírgula, até 10)"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Ajuda a comunidade a encontrar sua matéria na busca.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-md border border-border bg-card/60 p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={values.is_nsfw}
          onChange={(e) => update("is_nsfw", e.target.checked)}
          className="mt-1 h-4 w-4 accent-primary"
        />
        <div>
          <p className="text-sm font-semibold">Conteúdo sensível (+18)</p>
          <p className="text-xs text-muted-foreground">
            Marque se a matéria tem nudez, violência gráfica, spoilers pesados ou linguagem adulta.
            A capa aparece borrada com aviso até o leitor confirmar.
          </p>
        </div>
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-md bg-neon-gradient text-primary-foreground font-semibold shadow-neon disabled:opacity-50"
        >
          {checking ? "Verificando conteúdo..." : saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
import { createServerFn } from "@tanstack/react-start";

export type ModerationResult = {
  nsfw: boolean;
  categories: string[];
  reason: string;
};

type Input = {
  title: string;
  excerpt: string;
  content: string;
  cover_image_url?: string;
};

export const moderateArticle = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => {
    if (!data || typeof data !== "object") throw new Error("Invalid input");
    return {
      title: String(data.title ?? ""),
      excerpt: String(data.excerpt ?? ""),
      content: String(data.content ?? ""),
      cover_image_url: data.cover_image_url ? String(data.cover_image_url) : "",
    };
  })
  .handler(async ({ data }): Promise<ModerationResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { nsfw: false, categories: [], reason: "moderation_unavailable" };
    }

    const plainText = data.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const textBlob = [`TÍTULO: ${data.title}`, `RESUMO: ${data.excerpt}`, `CONTEÚDO: ${plainText.slice(0, 4000)}`].join("\n\n");

    const systemPrompt = `Você é um moderador de conteúdo de um site de notícias geek.
Sua tarefa: decidir se a matéria (texto + imagem de capa) contém conteúdo adulto/sensível que exigiria selo +18.

Considere NSFW:
- Nudez explícita ou parcial, conteúdo sexual, pornografia
- Violência gráfica, gore, sangue explícito, tortura
- Suicídio/automutilação explícitos
- Linguagem sexual explícita ou insultos pesados repetidos

NÃO é NSFW: violência leve típica de games/filmes, palavrões isolados, temas maduros discutidos de forma jornalística, roupas de banho/personagens estilizados sem exposição genital.

Responda APENAS com JSON válido no formato:
{"nsfw": boolean, "categories": ["nudity"|"sexual"|"violence"|"gore"|"self_harm"|"hate"|"language"], "reason": "explicação curta em português"}`;

    const userContent: Array<Record<string, unknown>> = [{ type: "text", text: textBlob }];
    if (data.cover_image_url && /^https?:\/\//i.test(data.cover_image_url)) {
      userContent.push({ type: "image_url", image_url: { url: data.cover_image_url } });
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        console.error("[moderation] gateway error", res.status, await res.text().catch(() => ""));
        return { nsfw: false, categories: [], reason: "moderation_error" };
      }

      const json = await res.json();
      const raw = json?.choices?.[0]?.message?.content ?? "";
      const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((p: any) => p?.text ?? "").join("") : "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return { nsfw: false, categories: [], reason: "no_json" };
      const parsed = JSON.parse(match[0]);
      return {
        nsfw: Boolean(parsed.nsfw),
        categories: Array.isArray(parsed.categories) ? parsed.categories.map(String) : [],
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    } catch (err) {
      console.error("[moderation] failed", err);
      return { nsfw: false, categories: [], reason: "moderation_exception" };
    }
  });
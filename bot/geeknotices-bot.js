import axios from "axios";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import slugify from "slugify";
import { randomUUID } from "crypto";

// ============================================================
// CONFIG
// ============================================================
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // Service Role Key (NUNCA exponha no front)
);

const BUCKET_NAME = "article-covers";

// Criar bucket se não existir
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    if (error) {
      console.error("✗ Erro ao criar bucket:", error.message);
    } else {
      console.log("✓ Bucket criado:", BUCKET_NAME);
    }
  }
}

// 🔥 COLOQUE O ID DO USUÁRIO BOT AQUI (veja bot/README.md para criar)
const AUTHOR_ID = process.env.BOT_AUTHOR_ID || "SEU_USER_ID_AQUI";

// Categorias válidas do enum `news_category` do Geek Notices
const CATEGORIES = ["games", "cinema_tv", "quadrinhos", "tech", "anime"];

// Mapeamento de categorias que a IA pode devolver → enum do banco
const CATEGORY_MAP = {
  games: "games",
  game: "games",
  gaming: "games",
  tech: "tech",
  technology: "tech",
  anime: "anime",
  manga: "anime",
  movies: "cinema_tv",
  cinema: "cinema_tv",
  tv: "cinema_tv",
  cinema_tv: "cinema_tv",
  comics: "quadrinhos",
  quadrinhos: "quadrinhos",
  marvel: "quadrinhos",
  dc: "quadrinhos",
};

// Filtro de viralização — só publica se o título bater com esses termos
const VIRAL_KEYWORDS = [
  // Games
  "gta", "playstation", "xbox", "nintendo", "zelda", "pokemon", "steam", "fortnite",
  "minecraft", "roblox", "valorant", "league of legends", "call of duty", "fifa",
  "ea sports", "ubisoft", "rockstar", "naughty dog", "capcom", "square enix",
  "konami", "sega", "bandai namco", "fromsoftware", "elden ring", "dark souls",
  "resident evil", "metal gear", "halo", "uncharted", "super mario", "kirby",
  "metroid", "digimon", "smash bros", "mario kart", "splatoon", "animal crossing",
  "fire emblem", "xenoblade", "bayonetta", "persona", "megami tensei", "diablo",
  "overwatch", "apex legends", "genshin impact", "honkai", "epic games",
  "epic store", "battle.net", "origin", "gog",
  // Anime & Manga
  "anime", "manga", "naruto", "dragon ball", "bleach", "one piece", "jujutsu kaisen",
  "demon slayer", "attack on titan", "my hero academia", "spy x family",
  "chainsaw man", "tokyo ghoul", "death note", "fullmetal alchemist",
  "hunter x hunter", "sailor moon", "studio ghibli", "hayao miyazaki",
  "one punch man", "frieren", "vinland saga", "berserk", "slam dunk",
  "haikyuu", "doraemon", "boruto", "crunchyroll", "funimation", "shonen jump",
  "webtoon", "bilibili", "vtuber", "hololive", "nijisanji",
  // Filmes & Séries
  "cinema", "filme", "filmes", "série", "séries", "netflix", "disney", "hbo",
  "prime video", "hulu", "paramount", "warner", "pixar", "dreamworks",
  "stranger things", "game of thrones", "house of the dragon", "breaking bad",
  "the mandalorian", "andor", "ahsoka", "the last of us", "the witcher",
  "arcane", "castlevania", "dune", "blade runner", "the matrix", "john wick",
  "fast and furious", "mission impossible", "top gun", "avatar", "jurassic park",
  "indiana jones", "back to the future", "ghostbusters", "terminator", "alien",
  "star trek", "doctor who", "sherlock", "the office", "friends", "seinfeld",
  "the simpsons", "family guy", "south park", "rick and morty",
  // Marvel & DC
  "marvel", "dc", "comics", "quadrinhos", "batman", "superman", "spider-man",
  "homem-aranha", "avengers", "vingadores", "doctor strange", "loki",
  "wandavision", "black panther", "iron man", "captain america", "thor",
  "hulk", "deadpool", "wolverine", "x-men", "guardians of the galaxy",
  "aquaman", "wonder woman", "the flash", "joker", "harley quinn",
  "star wars",
  // Tech & Pop
  "apple", "google", "openai", "chatgpt", "tesla", "spacex", "elon musk",
  "tiktok", "youtube", "twitch", "discord",
  // K-pop
  "blackpink", "bts", "twice", "newjeans", "aespa", "stray kids", "ateez",
  // Estúdios & Plataformas
  "sony", "amazon", "kadokawa", "shueisha", "kodansha",
];
const VIRAL_REGEX = new RegExp(VIRAL_KEYWORDS.join("|"), "i");

// Filtro negativo — rejeita notícias que NÃO são de entretenimento
const REJECT_REGEX =
  /surto|epidemia|doença|vírus|mort[ei]|acidente|governo|eleições|congresso|senado|câmara|imposto|inflação|PIB|dólar|euro|crise econômica|bikini|festa|férias|casamento|divórcio|escândalo sexual|assédio|processo judicial|indiciamento|prisão|tráfico|sequestro|baleado|tiroteio|furto|roubo|outbreak|virus|disease|death|killed|murder|shooting|stabbed|arrested|court|trial|guilty|senate|congress|election|tax|inflation|economy|crisis|politician|president|mayor|governor|diarrhea|ebola|covid|flu|pandemic|quarantine|hospitalized|patient|medical|health|doctor|nurse/i;

// ============================================================
// 1. BUSCAR NOTÍCIAS
// ============================================================
async function getNews() {
  const categories = ["technology", "entertainment", "general", "science"];
  const allArticles = [];

  for (const cat of categories) {
    try {
      const res = await axios.get("https://newsapi.org/v2/top-headlines", {
        params: {
          category: cat,
          language: "en",
          apiKey: process.env.NEWS_API_KEY,
        },
      });
      allArticles.push(...res.data.articles.slice(0, 10));
    } catch (err) {
      console.error(`✗ Erro ao buscar ${cat}:`, err.message);
    }
  }

  return allArticles;
}

// ============================================================
// 2. GERAR ARTIGO
// ============================================================
async function generateArticle(news) {
  const prompt = `
Você é um jornalista profissional escrevendo para o Geek Notícias, um portal de tecnologia e entretenimento em português do Brasil.

Sua tarefa é reescrever a notícia abaixo em português, seguindo o padrão editorial do site.

--- DADOS DA NOTÍCIA ---
Título original: ${news.title}
Descrição: ${news.description ?? ""}
Fonte: ${news.source?.name ?? ""}

--- REGRAS ABSOLUTAS ---
1. O conteúdo DEVE ser baseado EXATAMENTE nos dados acima. NÃO invente informações que não estejam na notícia original.
2. Se a notícia é sobre um filme, descreva ESSE filme. Se é sobre um jogo, descreva ESSE jogo. Se é sobre uma série, descreva ESSA série.
3. NÃO escreva textos genéricos sobre história do streaming, evolução da tecnologia, ou assuntos tangenciais. Foque no assunto DA NOTÍCIA.
4. Use os nomes reais: pessoas, filmes, séries, jogos, empresas mencionados na notícia original.
5. Se a descrição original é curta, expanda com contexto relevante ao assunto específico (não genérico).

--- PADRÃO EDITORIAL ---

**1. TÍTULO**
* Reescreva o título em português, direto e informativo
* Deve refletir fielmente o conteúdo da notícia

**2. LINHA FINA (subtítulo)**
* 1 frase que resume a notícia

**3. ABERTURA (LEAD)**
* 1–2 parágrafos
* Responda quem, o quê, quando, onde e por quê
* Use os dados reais da notícia

**4. DESENVOLVIMENTO**
* Use 2 a 4 seções com <h3><strong>
* O conteúdo de cada seção DEVE estar diretamente relacionado ao assunto da notícia
* Se a notícia tem poucos detalhes, foque na análise do impacto e relevância
* Use listas <ul><li> quando fizer sentido

**5. CONCLUSÃO**
* Síntese do impacto da notícia
* O que vem pela frente

--- FORMATAÇÃO ---
* Parágrafos com <p>
* Subtítulos com <h3><strong>
* Listas com <ul><li>
* Destaque termos importantes em <strong>
* Itálico para títulos de obras em <em>
* NÃO use markdown — use apenas HTML
* NÃO use emojis

--- SAÍDA ---
RETORNE APENAS JSON VÁLIDO (sem markdown, sem \`\`\`):
{
  "title": "título em português",
  "excerpt": "resumo (máx 200 caracteres)",
  "content": "artigo em HTML",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "games | cinema_tv | quadrinhos | tech | anime"
}
`;
* Mínimo: 700 palavras
* Texto denso, mas fluido
* Evitar repetições
* Manter ritmo de leitura agradável

IMPORTANTE:
* O texto deve parecer uma matéria real publicada
* NÃO mencione que é uma IA
* NÃO explique o processo — apenas escreva a notícia
* NÃO use emojis ou gírias
* Tags em minúsculas, sem #

RETORNE APENAS JSON VÁLIDO (sem markdown, sem \`\`\`):
`;

  const response = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ============================================================
// 3. EVITAR DUPLICAÇÃO
// ============================================================
async function alreadyExists(title) {
  const { data } = await supabase
    .from("articles")
    .select("id")
    .ilike("title", `%${title.slice(0, 40)}%`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ============================================================
// 4. GARANTIR SLUG ÚNICO
// ============================================================
async function uniqueSlug(base) {
  let slug = slugify(base, { lower: true, strict: true }).slice(0, 80);
  let i = 0;
  while (true) {
    const candidate = i === 0 ? slug : `${slug}-${i}`;
    const { data } = await supabase.from("articles").select("id").eq("slug", candidate).limit(1);
    if (!data || data.length === 0) return candidate;
    i++;
  }
}

// ============================================================
// 5. UPLOAD DE IMAGEM
// ============================================================
async function uploadImage(url) {
  if (!url) return null;

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const contentType = response.headers["content-type"] || "image/jpeg";
    const ext = contentType.split("/")[1] || "jpg";
    const fileName = `${randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, response.data, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error("✗ Erro upload:", error.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.error("✗ Erro download imagem:", err.message);
    return null;
  }
}

// ============================================================
// 6. SALVAR
// ============================================================
async function saveArticle(article, news) {
  if (await alreadyExists(article.title)) {
    console.log("↺ Duplicado:", article.title);
    return;
  }

  const rawCat = String(article.category || "")
    .toLowerCase()
    .trim();
  const category = CATEGORY_MAP[rawCat] || (CATEGORIES.includes(rawCat) ? rawCat : "tech");

  const slug = await uniqueSlug(article.title);

  // Upload da imagem para o Supabase Storage
  const imageUrl = await uploadImage(news.urlToImage);

  const { error } = await supabase.from("articles").insert({
    author_id: AUTHOR_ID,
    title: article.title,
    slug,
    content: article.content,
    excerpt: (article.excerpt || "").slice(0, 200),
    category,
    tags: Array.isArray(article.tags) ? article.tags.slice(0, 8) : [],
    cover_image_url: imageUrl || `https://source.unsplash.com/featured/?${encodeURIComponent(category)}`,
    published: true,
    is_nsfw: false,
  });

  if (error) {
    console.error("✗ Erro ao salvar:", error.message);
  } else {
    console.log("✓ Publicado:", article.title);
    console.log("  Imagem:", imageUrl ? "upload OK" : "fallback Unsplash");
  }
}

// ============================================================
// 6. PIPELINE
// ============================================================
async function run() {
  if (!AUTHOR_ID || AUTHOR_ID === "SEU_USER_ID_AQUI") {
    console.error("Defina BOT_AUTHOR_ID no .env — veja bot/README.md");
    process.exit(1);
  }

  await ensureBucket();

  const newsList = await getNews();
  console.log(`Encontradas ${newsList.length} notícias.`);

  for (const news of newsList) {
    try {
      // Filtro de viralização
      if (!news.title || !VIRAL_REGEX.test(news.title)) {
        console.log("· Ignorada (fora do filtro viral):", news.title);
        continue;
      }

      // Filtro negativo — rejeita notícias de fora do escopo
      if (REJECT_REGEX.test(news.title)) {
        console.log("· Ignorada (fora do escopo):", news.title);
        continue;
      }

      const article = await generateArticle(news);
      await saveArticle(article, news);
    } catch (err) {
      console.error("✗ Erro geral:", err.message);
    }
  }
}

run();

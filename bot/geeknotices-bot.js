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
  "pc gaming", "nvidia", "amd", "intel", "gpu", "cpu",
  "fsr", "xess", "dlss", "steam deck", "rog ally", "legion go",
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
  // Fontes específicas de entretenimento/tech
  const sources = [
    "ign", "kotaku", "polygon", "the-verge", "techcrunch",
    "ars-technica", "engadget", "gizmodo", "eurogamer", "destructoid",
    "comicbook.com", "screenrant", "hollywoodreporter", "variety",
    "deadline", "collider", "gamerant", "pcgamer", "pcgamesn",
    "vg247", "pushsquare", "nintendolife", "purexbox", "gamesradar",
    "siliconera", "anime-news-network", "thegamer", "dualshockers",
  ];
  // Buscas por tópicos (usa everything endpoint — mais ampla)
  const queries = [
    "video game news", "gaming news", "anime news",
    "movie news", "series news", "entertainment news",
    "technology news", "pop culture",
    "playstation", "xbox", "nintendo", "pc gaming",
    "marvel", "dc comics", "star wars",
    "netflix", "disney plus", "streaming",
    "k-pop", "hololive", "vtuber",
  ];
  const allArticles = [];
  const oneDayAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // 1. Fontes específicas
  for (const src of sources) {
    try {
      const res = await axios.get("https://newsapi.org/v2/top-headlines", {
        params: {
          sources: src,
          language: "en",
          apiKey: process.env.NEWS_API_KEY,
        },
      });
      const recent = res.data.articles.filter((a) => {
        if (!a.publishedAt) return true;
        return new Date(a.publishedAt) >= oneDayAgo;
      });
      if (recent.length > 0) {
        console.log(`  ✓ ${src}: ${recent.length} notícias`);
      }
      allArticles.push(...recent.slice(0, 5));
    } catch (err) {
      // Fontes podem não estar disponíveis no free tier
    }
  }

  // 2. Buscas por tópicos (everything endpoint)
  for (const q of queries) {
    try {
      const res = await axios.get("https://newsapi.org/v2/everything", {
        params: {
          q,
          language: "en",
          sortBy: "publishedAt",
          pageSize: 5,
          apiKey: process.env.NEWS_API_KEY,
        },
      });
      const recent = (res.data.articles || []).filter((a) => {
        if (!a.publishedAt) return true;
        return new Date(a.publishedAt) >= oneDayAgo;
      });
      if (recent.length > 0) {
        console.log(`  ✓ ${q}: ${recent.length} notícias`);
      }
      allArticles.push(...recent.slice(0, 3));
    } catch (err) {
      // free tier pode bloquear everything endpoint
    }
  }

  // Fallback: categorias gerais (apenas se poucas notícias coletadas)
  if (allArticles.length < 10) {
    const categories = ["technology", "entertainment"];
    for (const cat of categories) {
      try {
        const res = await axios.get("https://newsapi.org/v2/top-headlines", {
          params: {
            category: cat,
            language: "en",
            pageSize: 10,
            apiKey: process.env.NEWS_API_KEY,
          },
        });
        const recent = res.data.articles.filter((a) => {
          if (!a.publishedAt) return true;
          return new Date(a.publishedAt) >= oneDayAgo;
        });
        allArticles.push(...recent.slice(0, 10));
      } catch (err) {}
    }
  }

  return allArticles;
}

// ============================================================
// 1.5. BUSCAR CONTEÚDO COMPLETO DA NOTÍCIA
// ============================================================
async function fetchArticleContent(url) {
  if (!url) return "";
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  ];
  for (const ua of userAgents) {
    try {
      const res = await axios.get(url, {
        timeout: 12000,
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        maxRedirects: 5,
      });
      const text = res.data
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 200) {
        return text.slice(0, 6000);
      }
    } catch (err) {
      continue;
    }
  }
  console.log("· Não foi possível buscar conteúdo original:", url);
  return "";
}

// ============================================================
// 2. GERAR ARTIGO
// ============================================================
async function generateArticle(news) {
  const fullContent = await fetchArticleContent(news.url);

  const hasFullContent = fullContent && fullContent.length > 200;

  const prompt = `
Você é um jornalista profissional escrevendo para o Geek Notícias, um portal de tecnologia e entretenimento em português do Brasil. Seu estilo é similar ao CNN Brasil — denso, informativo, com análise e contexto.

Sua tarefa é reescrever a notícia abaixo em português, produzindo um artigo longo e detalhado.

--- DADOS DA NOTÍCIA ---
Título original: ${news.title}
Descrição: ${news.description ?? ""}
Fonte: ${news.source?.name ?? ""}
${hasFullContent ? `\n--- CONTEÚDO COMPLETO DA NOTÍCIA ORIGINAL ---\n${fullContent}\n` : "\n--- NOTA ---\nConteúdo completo indisponível. Use apenas o título e descrição acima. Foque em contexto, histórico e significado da notícia. NÃO invente detalhes.\n"}

--- REGRAS ABSOLUTAS ---
1. O conteúdo DEVE ser baseado EXATAMENTE nos dados acima. NÃO invente informações que não estejam na notícia original.
2. Se a notícia é sobre um filme, descreva ESSE filme. Se é sobre um jogo, descreva ESSE jogo. Se é sobre uma série, descreva ESSA série.
3. Use os nomes reais: pessoas, filmes, séries, jogos, empresas mencionados na notícia original.
4. NÃO preencha espaço com texto vazio ou repetitivo. Cada parágrafo deve agregar informação nova.
5. NÃO copie ou repita títulos de seções — invente títulos específicos e descritivos para cada seção.
6. NÃO invente reação de fãs, opiniões, ou detalhes que não estejam na notícia original.

--- ESTILO EDITORIAL (CNN Brasil) ---

Escreva artigos longos e detalhados (mínimo 400 palavras), com a seguinte estrutura:

**1. TÍTULO**
* Título chamativo em português, direto e informativo
* Deve refletir fielmente o conteúdo da notícia

**2. LINHA FINA (subtítulo)**
* 1-2 frases que resumam a notícia
* Itálico com <em>

**3. ABERTURA (LEAD)**
* 2-3 parágrafos
* Responda quem, o quê, quando, onde e por quê
* Contextualize o leitor imediatamente sobre o assunto
* Use os dados reais da notícia

**4. CONTEXTO E HISTÓRICO**
* 1-2 seções explicando o contexto por trás da notícia
* Explique a origem do assunto, marcos anteriores, evolução
* Use dados, datas e nomes reais quando disponíveis
* Exemplos de títulos: "Origem do projeto", "A obra original e o legado", "Como chegamos até aqui"

**5. DESENVOLVIMENTO**
* 3-5 seções com títulos PRÓPRIOS baseados no assunto
* Cada seção deve abordar um ângulo diferente da notícia
* Inclua detalhes técnicos, números, impactos
* Use listas <ul><li> quando fizer sentido (elencos, especificações, etc.)
* Exemplos de títulos: "Um universo mais sombrio", "Mudanças estratégicas", "Reação do mercado"

**6. ANÁLISE E IMPACTO**
* 1-2 seções sobre o significado da notícia
* Impacto no mercado, na indústria, nos fãs
* Comparação com tendências anteriores
* O que isso significa para o futuro do assunto

**7. CONCLUSÃO**
* Síntese do impacto
* O que vem pela frente
* Feche com perspectiva ou expectativa

--- FORMATAÇÃO HTML ---
* Parágrafos: <p>
* Subtítulos de seção: <h2><strong>
* Subtítulos internos: <h3><strong>
* Listas: <ul><li>
* Destaque termos importantes: <strong>
* Títulos de obras (filmes, jogos, séries, mangás): <em>
* NÃO use markdown (#, *, etc.) — use apenas HTML puro
* NÃO use emojis
* NÃO use <br>

--- EXEMPLO DE ARTIGO BOM ---
Veja como deve ser a estrutura e o estilo do artigo:

<h2><strong>Kagurabachi: mangá vira fenômeno global e conquista público brasileiro</strong></h2>
<em>Obra de Takeru Hokazono ganha destaque como um dos maiores sucessos recentes da nova geração da Shonen Jump</em>
<p>O mangá Kagurabachi, criado por Takeru Hokazono, tornou-se um dos maiores fenômenos recentes da indústria japonesa de quadrinhos, conquistando rapidamente leitores ao redor do mundo — incluindo o Brasil, onde a obra já figura entre as mais comentadas nas comunidades de cultura pop.</p>
<p>Lançado em 2023 na revista Weekly Shonen Jump, da editora Shueisha, o título surgiu inicialmente cercado de curiosidade e até memes nas redes sociais. No entanto, o que parecia apenas um hype momentâneo rapidamente se consolidou como um sucesso legítimo, impulsionado por uma narrativa consistente, estética marcante e sequências de ação intensas.</p>
<h2><strong>Uma história de vingança e legado</strong></h2>
<p>A trama acompanha Chihiro Rokuhira, um jovem espadachim que viveu uma infância tranquila ao lado de seu pai, Kunishige, um renomado ferreiro responsável por criar espadas especiais conhecidas como Lâminas Encantadas. Essas armas foram fundamentais para encerrar uma grande guerra no passado.</p>
<p>A história toma um rumo trágico quando um grupo de feiticeiros invade a casa da família, assassina Kunishige e rouba as lâminas. Único sobrevivente, Chihiro passa a carregar o peso da perda e a missão de recuperar as armas.</p>
<h2><strong>Crescimento e números</strong></h2>
<p>Desde seu lançamento, Kagurabachi acumulou milhões de cópias em circulação e passou a figurar em listas de obras mais promissoras da indústria. O mangá também conquistou premiações importantes, como o Next Manga Award, além de indicações em rankings especializados.</p>
<p>O sucesso comercial e crítico reforça o papel da obra como um dos principais candidatos a liderar a nova geração de títulos da Shonen Jump.</p>
<h2><strong>Conclusão</strong></h2>
<p>Com uma narrativa centrada em vingança, perda e legado, Kagurabachi se consolidou como um dos mangás mais relevantes da atualidade. A obra representa não apenas o sucesso de um novo autor, mas também a renovação de um mercado que segue em constante evolução.</p>

--- SAÍDA ---
RETORNE APENAS JSON VÁLIDO (sem markdown, sem \`\`\`):
{
  "title": "título chamativo em português",
  "excerpt": "resumo em 1-2 frases (máx 200 caracteres)",
  "content": "artigo completo em HTML com todas as seções",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "games | cinema_tv | quadrinhos | tech | anime"
}
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

// Normaliza título para comparação: lowercase, sem acentos, sem pontuação
function normalizeTitle(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Calcula similaridade simples (Jaccard) entre dois conjuntos de palavras
function titleSimilarity(a, b) {
  const wordsA = new Set(normalizeTitle(a).split(" "));
  const wordsB = new Set(normalizeTitle(b).split(" "));
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

async function alreadyExists(title) {
  // Checar similaridade de título (evita temas repetidos)
  const { data: recent } = await supabase
    .from("articles")
    .select("id, title")
    .gte("created_at", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
    .limit(100);

  if (recent) {
    for (const article of recent) {
      if (titleSimilarity(title, article.title) > 0.4) {
        return true;
      }
    }
  }

  return false;
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

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  ];

  for (const ua of userAgents) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: {
          "User-Agent": ua,
          "Accept": "image/*,*/*",
          "Referer": new URL(url).origin + "/",
        },
      });
      const contentType = response.headers["content-type"] || "image/jpeg";
      if (!contentType.startsWith("image/")) continue;
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
      continue;
    }
  }
  console.log("· Imagem indisponível:", url);
  return null;
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
  let imageUrl = await uploadImage(news.urlToImage);

  // Fallback: tentar extrair imagem do conteúdo original
  if (!imageUrl && news.url) {
    try {
      const res = await axios.get(news.url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      const ogImage = res.data.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      if (ogImage && ogImage[1]) {
        imageUrl = await uploadImage(ogImage[1]);
      }
    } catch (err) {}
  }

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

# Geek Notices — Bot de publicação automática

Script Node.js standalone que busca notícias no NewsAPI, reescreve com OpenAI
e publica na tabela `articles` do Geek Notices via Service Role Key.

> ⚠️ Este bot **não roda dentro do app Lovable**. Ele é feito para rodar em uma
> máquina/VPS separada, autenticado direto no banco com a Service Role Key.

## 1. Instalar

```bash
cd bot
npm install
```

## 2. Criar o usuário do bot

O `articles.author_id` referencia `profiles.id`, que referencia `auth.users`.
Por isso o bot precisa de uma conta real no Lovable Cloud.

**Passo a passo (uma vez):**

1. No próprio site Geek Notices, clique em **Entrar** e crie uma conta com
   e-mail tipo `bot@geeknotices.app` e senha forte.
2. Ajuste o perfil (nome de exibição "Geek Notices Bot", avatar, bio).
3. Peça ao Lovable/Você mesmo para rodar no banco:

   ```sql
   select id, display_name from profiles where display_name ilike '%bot%';
   ```

4. Copie o `id` retornado e cole em `BOT_AUTHOR_ID` no `.env`.

## 3. Configurar variáveis

Copie `.env.example` para `.env` e preencha:

```env
OPENAI_API_KEY=sk-...
NEWS_API_KEY=...              # https://newsapi.org
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=eyJ...   # Service Role Key — mantenha SECRETA
BOT_AUTHOR_ID=<uuid do profile>
```

Carregue o `.env` antes de rodar (ex.: `node --env-file=.env geeknotices-bot.js`
no Node ≥ 20).

## 4. Rodar manualmente

```bash
node --env-file=.env geeknotices-bot.js
```

## 5. Automação com cron (a cada 30 min)

```bash
crontab -e
```

Adicione:

```
*/30 * * * * cd /caminho/para/bot && /usr/bin/node --env-file=.env geeknotices-bot.js >> /var/log/geeknotices-bot.log 2>&1
```

## Filtros e estilo

- Só publica notícias cujo título bata com o regex viral
  (`GTA|Marvel|Anime|DC|PlayStation|Xbox|Nintendo|...`).
- Prompt configurado no estilo **IGN / Kotaku** com gatilhos de curiosidade.
- Categorias mapeadas para o enum do banco:
  `games | cinema_tv | quadrinhos | tech | anime`.
- Slug garantido único com sufixo numérico.
- Deduplicação por título (ilike nos primeiros 40 caracteres).
## Contexto

Seu banco é um projeto Supabase externo (não Lovable Cloud), então você mesmo controla as configurações de Storage no dashboard do Supabase — inclusive criar buckets públicos, o que o workspace da Lovable estava bloqueando. Com isso, dá para seguir com o uploader estilo Pinterest normalmente.

## O que você precisa fazer (uma vez, no dashboard do Supabase)

1. Abrir seu projeto no dashboard do Supabase → **Storage** → **New bucket**.
2. Criar dois buckets, ambos marcados como **Public bucket**:
   - `article-covers`
   - `avatars`
3. Deixar as opções de tamanho/MIME no padrão (a validação vai ser feita no cliente: ≤ 8 MB, JPG/PNG/WEBP/GIF).

Me avisa quando estiverem criados que eu sigo com o resto. As policies de `storage.objects` eu crio via migração normal (isso o Supabase externo aceita sem problema).

## O que eu implemento depois que os buckets existirem

**Migração SQL** em `storage.objects`:
- SELECT público para os dois buckets (`bucket_id in ('article-covers','avatars')`).
- INSERT/UPDATE/DELETE só quando `auth.uid()::text = (storage.foldername(name))[1]` — cada usuário só mexe na pasta `<user_id>/…` dele.

**Componente novo `src/components/image-uploader.tsx`**
- Props: `value`, `onChange(url)`, `bucket: "article-covers" | "avatars"`, `shape: "cover" | "avatar"`, `userId`.
- Área grande arredondada com ícone + texto "Arraste, cole (Ctrl+V) ou clique para escolher".
- Drop zone (`onDragOver`/`onDrop`), input file oculto, listener de `paste`.
- Valida tipo (`image/jpeg|png|webp|gif`) e tamanho (≤ 8 MB); erros via `toast`.
- Path: `${userId}/${crypto.randomUUID()}.${ext}`.
- `supabase.storage.from(bucket).upload(...)` com barra de progresso.
- `getPublicUrl` → `onChange(url)`.
- Ao trocar/remover: tenta apagar o arquivo anterior se pertencer ao mesmo bucket + pasta do usuário (best-effort).
- Estados: idle / dragover / uploading (%) / ready (preview + trocar/remover).

**Integrações**
- `src/components/article-form.tsx`: troca o `<input type="url">` de capa por `<ImageUploader shape="cover" bucket="article-covers" …>`. Mantém o mesmo campo no state (`cover_image_url`). Moderação NSFW automática continua rodando no submit.
- `src/routes/me.tsx`: no modo de edição do perfil, troca o `<input>` do avatar por `<ImageUploader shape="avatar" bucket="avatars" …>` renderizado sobre o círculo do avatar.

**Bot**
- Nada muda em `bot/geeknotices-bot.js` — continua salvando URL externa direto em `cover_image_url`.

## Fora do escopo

Crop/recorte, filtros, múltiplas imagens por post, biblioteca de mídia reutilizável, compressão no cliente. Dá pra abordar depois se você quiser.

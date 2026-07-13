import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, RefreshCw } from "lucide-react";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type Bucket = "article-covers" | "avatars";
type Shape = "cover" | "avatar";

export function ImageUploader({
  value,
  onChange,
  bucket,
  shape,
  userId,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  bucket: Bucket;
  shape: Shape;
  userId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const publicPrefix = `/storage/v1/object/public/${bucket}/`;

  const deletePrevious = useCallback(
    async (prevUrl: string | null | undefined) => {
      if (!prevUrl) return;
      const idx = prevUrl.indexOf(publicPrefix);
      if (idx === -1) return;
      const path = prevUrl.slice(idx + publicPrefix.length);
      if (!path.startsWith(`${userId}/`)) return;
      await supabase.storage.from(bucket).remove([path]).catch(() => {});
    },
    [bucket, publicPrefix, userId],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.has(file.type)) {
        toast.error("Formato inválido — use JPG, PNG, WEBP ou GIF");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error("Imagem muito grande (máx. 8 MB)");
        return;
      }
      setUploading(true);
      setProgress(15);
      try {
        const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "jpg").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        setProgress(40);
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (error) throw error;
        setProgress(85);
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        const prev = value;
        onChange(data.publicUrl);
        setProgress(100);
        // best-effort cleanup of previous image
        void deletePrevious(prev);
      } catch (err: any) {
        toast.error(err.message ?? "Falha ao enviar imagem");
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 400);
      }
    },
    [bucket, deletePrevious, onChange, userId, value],
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file && file.type.startsWith("image/")) {
        e.preventDefault();
        void uploadFile(file);
      }
    };
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, [uploadFile]);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void uploadFile(file);
  };

  const isAvatar = shape === "avatar";
  const containerShape = isAvatar
    ? "aspect-square rounded-full"
    : "aspect-[16/9] rounded-xl";

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`relative w-full ${containerShape} overflow-hidden border-2 border-dashed transition-colors outline-none ${
        dragOver ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:border-primary/60"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {value ? (
        <>
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center gap-2 p-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/90 border border-border text-xs font-semibold hover:border-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Trocar
            </button>
            <button
              type="button"
              onClick={async () => {
                const prev = value;
                onChange(null);
                void deletePrevious(prev);
              }}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/90 border border-destructive/40 text-destructive text-xs font-semibold hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground p-4 text-center"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-cyan-glow" />
          ) : (
            <ImagePlus className="h-8 w-8 text-cyan-glow" />
          )}
          <p className="text-sm font-semibold">
            {isAvatar ? "Foto de perfil" : "Imagem de capa"}
          </p>
          <p className="text-xs">
            Arraste, cole (Ctrl+V) ou clique para escolher
          </p>
          <p className="text-[10px] uppercase tracking-widest">JPG · PNG · WEBP · GIF · até 8 MB</p>
        </button>
      )}

      {uploading ? (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-background/60">
          <div
            className="h-full bg-neon-gradient transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
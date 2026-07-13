import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { useEffect } from "react";

type Mode = "followers" | "following";

export function FollowListDialog({
  userId,
  mode,
  onClose,
}: {
  userId: string;
  mode: Mode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ["follow-list", userId, mode],
    queryFn: async () => {
      if (mode === "followers") {
        const { data, error } = await supabase
          .from("follows")
          .select("follower_id, profiles!follows_follower_id_fkey(id, display_name, avatar_url, bio)")
          .eq("following_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data as any[]).map((r) => r.profiles).filter(Boolean);
      }
      const { data, error } = await supabase
        .from("follows")
        .select("following_id, profiles!follows_following_id_fkey(id, display_name, avatar_url, bio)")
        .eq("follower_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => r.profiles).filter(Boolean);
    },
  });

  const title = mode === "followers" ? "Seguidores" : "Seguindo";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-xl border border-border bg-card shadow-neon"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-display font-bold text-lg text-cyan-glow">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary/60" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : !data || data.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {mode === "followers" ? "Nenhum seguidor ainda." : "Ainda não segue ninguém."}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.map((p: any) => (
                <li key={p.id}>
                  <Link
                    to="/u/$id"
                    params={{ id: p.id }}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary/40"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-neon-gradient" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{p.display_name}</p>
                      {p.bio ? (
                        <p className="text-xs text-muted-foreground truncate">{p.bio}</p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
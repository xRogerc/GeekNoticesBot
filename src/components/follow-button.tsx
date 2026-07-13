import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function FollowButton({ targetId, className }: { targetId: string; className?: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: isFollowing } = useQuery({
    queryKey: ["is-following", userId, targetId],
    enabled: !!userId && userId !== targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", userId!)
        .eq("following_id", targetId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("not-authed");
      if (isFollowing) {
        const { error } = await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: targetId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["is-following", userId, targetId] });
      qc.invalidateQueries({ queryKey: ["follow-counts", targetId] });
      qc.invalidateQueries({ queryKey: ["following-feed"] });
    },
    onError: (e: any) => {
      if (e.message === "not-authed") {
        toast.error("Entre para seguir autores");
        navigate({ to: "/auth" });
      } else toast.error(e.message);
    },
  });

  if (userId === targetId) return null;

  const active = !!isFollowing;
  return (
    <button
      type="button"
      onClick={() => (userId ? toggle.mutate() : navigate({ to: "/auth" }))}
      disabled={toggle.isPending}
      className={
        (className ?? "") +
        " inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 " +
        (active
          ? "border border-border hover:border-destructive hover:text-destructive"
          : "bg-neon-gradient text-primary-foreground shadow-neon hover:opacity-90")
      }
    >
      {active ? <><UserMinus className="h-4 w-4" /> Seguindo</> : <><UserPlus className="h-4 w-4" /> Seguir</>}
    </button>
  );
}
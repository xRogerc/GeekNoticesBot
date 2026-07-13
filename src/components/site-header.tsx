import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { Zap, PenSquare, LogOut, User as UserIcon, Menu, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

export function SiteHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setUser(session?.user ?? null);
        router.invalidate();
        if (event !== "SIGNED_OUT") qc.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);

  useEffect(() => {
    if (!user) { setAvatarUrl(null); return; }
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [user]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/70">
      <div className="mx-auto max-w-6xl px-4 flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <Zap className="h-5 w-5 text-cyan-glow" />
          <span className="text-neon">GEEK</span>
          <span className="text-cyan-glow">NOTICES</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {user ? (
            <Link
              to="/feed"
              className="px-3 py-1.5 rounded-md hover:bg-secondary/60 hover:text-cyan-glow transition-colors"
              activeProps={{ className: "text-cyan-glow bg-secondary/60" }}
            >
              Meu feed
            </Link>
          ) : null}
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="px-3 py-1.5 rounded-md hover:bg-secondary/60 hover:text-cyan-glow transition-colors"
              activeProps={{ className: "text-cyan-glow bg-secondary/60" }}
            >
              {c.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/write"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-neon-gradient text-primary-foreground font-semibold text-sm shadow-neon hover:opacity-90"
              >
                <PenSquare className="h-4 w-4" /> Publicar
              </Link>
              <Link
                to="/me"
                className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border hover:border-primary transition-colors"
                aria-label="Meu perfil"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="h-7 w-7 rounded-full bg-neon-gradient inline-flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-primary-foreground" />
                  </span>
                )}
                <span className="text-sm font-semibold">Perfil</span>
              </Link>
              <button onClick={handleSignOut} className="p-2 rounded-md hover:bg-secondary/60" aria-label="Sair">
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="px-4 py-1.5 rounded-md border-neon text-sm font-semibold hover:bg-secondary/60"
            >
              Entrar
            </Link>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="md:hidden border-t border-border/60 bg-background/95 px-4 py-3 space-y-2">
          {user ? (
            <>
              <Link to="/feed" onClick={() => setOpen(false)} className="block px-2 py-2 rounded-md hover:bg-secondary/60">
                Meu feed
              </Link>
              <Link to="/me" onClick={() => setOpen(false)} className="block px-2 py-2 rounded-md hover:bg-secondary/60">
                Meu perfil
              </Link>
            </>
          ) : null}
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="block px-2 py-2 rounded-md hover:bg-secondary/60"
              onClick={() => setOpen(false)}
            >
              {c.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-border/60 flex gap-2">
            {user ? (
              <>
                <Link to="/write" onClick={() => setOpen(false)} className="flex-1 text-center px-3 py-2 rounded-md bg-neon-gradient text-primary-foreground font-semibold text-sm">
                  Publicar
                </Link>
                <button onClick={handleSignOut} className="px-3 py-2 rounded-md border border-border">
                  Sair
                </button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="flex-1 text-center px-3 py-2 rounded-md border-neon font-semibold text-sm">
                Entrar
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
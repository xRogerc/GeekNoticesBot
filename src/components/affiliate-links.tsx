import { ExternalLink } from "lucide-react";

export type AffiliateLink = {
  url: string;
  label: string;
  platform?: string;
};

export function AffiliateLinks({ links }: { links: AffiliateLink[] }) {
  if (!links || links.length === 0) return null;

  return (
    <div className="mt-10 rounded-xl border border-cyan-glow/30 bg-card/60 p-5">
      <h3 className="font-display text-lg font-bold text-cyan-glow">
        Produtos mencionados
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Links de afiliado — ao comprar por aqui, você apoia o Geek Notices.
      </p>
      <div className="mt-4 space-y-2">
        {links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 transition-colors hover:border-cyan-glow/50 hover:bg-cyan-glow/5 group"
          >
            <div className="min-w-0">
              <p className="font-semibold text-sm group-hover:text-cyan-glow transition-colors truncate">
                {link.label}
              </p>
              {link.platform ? (
                <p className="text-xs text-muted-foreground mt-0.5">{link.platform}</p>
              ) : null}
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-cyan-glow transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}

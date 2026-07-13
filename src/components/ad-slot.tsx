import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ADSENSE_ENABLED } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdFormat = "auto" | "fluid" | "rectangle" | "horizontal";

interface AdSlotProps {
  slot: string;
  format?: AdFormat;
  layoutKey?: string;
  className?: string;
  minHeight?: number;
  /** When true, uses full-width responsive layout. */
  responsive?: boolean;
  label?: string;
}

/**
 * Google AdSense slot. Falls back to a discreet placeholder while AdSense
 * is not configured (missing VITE_ADSENSE_CLIENT) or the slot id is empty.
 */
export function AdSlot({
  slot,
  format = "auto",
  layoutKey,
  className,
  minHeight = 120,
  responsive = true,
  label = "Publicidade",
}: AdSlotProps) {
  const pushed = useRef(false);
  const canServe = ADSENSE_ENABLED && !!slot;

  useEffect(() => {
    if (!canServe || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (err) {
      // AdSense script may be blocked; fail silently.
      console.debug("[AdSlot] push failed", err);
    }
  }, [canServe]);

  return (
    <aside
      className={"w-full " + (className ?? "")}
      aria-label={label}
      style={{ minHeight }}
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-1 text-center">
        {label}
      </p>
      {canServe ? (
        <ins
          key={slot}
          className="adsbygoogle block"
          style={{ display: "block", minHeight }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format={format}
          data-ad-layout-key={layoutKey}
          data-full-width-responsive={responsive ? "true" : "false"}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-border/60 bg-card/30 text-xs font-mono uppercase tracking-widest text-muted-foreground/70"
          style={{ minHeight }}
        >
          espaço publicitário
        </div>
      )}
    </aside>
  );
}
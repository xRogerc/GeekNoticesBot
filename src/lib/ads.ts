// Google AdSense configuration.
// Set these in your .env (all public, VITE_ prefix):
//   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
//   VITE_ADSENSE_SLOT_HEADER=1234567890
//   VITE_ADSENSE_SLOT_FOOTER=1234567890
//   VITE_ADSENSE_SLOT_FEED=1234567890
//   VITE_ADSENSE_SLOT_SIDEBAR=1234567890
// While unset, <AdSlot /> renders a discreet placeholder instead of a live ad.

export const ADSENSE_CLIENT: string | undefined =
  (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) || undefined;

export const AD_SLOTS = {
  header: (import.meta.env.VITE_ADSENSE_SLOT_HEADER as string | undefined) ?? "",
  footer: (import.meta.env.VITE_ADSENSE_SLOT_FOOTER as string | undefined) ?? "",
  feed: (import.meta.env.VITE_ADSENSE_SLOT_FEED as string | undefined) ?? "",
  sidebar: (import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR as string | undefined) ?? "",
} as const;

export const ADSENSE_ENABLED = Boolean(ADSENSE_CLIENT);

// Insert an ad card every N articles in a feed grid.
export const AD_INTERVAL = 6;
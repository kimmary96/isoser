"use client";

import { useEffect } from "react";

type AdSlotProps = {
  slotId: string;
  format?: string;
  className?: string;
};

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdSlot({ slotId, format = "auto", className }: AdSlotProps) {
  if (!ADSENSE_CLIENT) {
    return null;
  }

  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers or unapproved inventories can noop here without breaking layout.
    }
  }, []);

  // Future extension point: return null for premium users once is_premium is available here.
  return (
    <div className={className}>
      <ins
        className="adsbygoogle block overflow-hidden"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

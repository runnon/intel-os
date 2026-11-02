"use client";

import { useEffect, useState } from "react";
import { ageLabel, localTime, plainUtc } from "@/lib/age";

// A time a general reader can use: "Nov 1, 6:21 AM · 28h ago" in their own time zone,
// with the exact UTC time on hover. Server render and first paint show the UTC form so
// hydration matches; the local form appears after mount.
export default function When({ iso, ago = true, className = "" }: { iso: string; ago?: boolean; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={plainUtc(iso)} className={className}>
      {now === null ? plainUtc(iso) : `${localTime(iso)}${ago ? ` · ${ageLabel(iso, now)}` : ""}`}
    </time>
  );
}

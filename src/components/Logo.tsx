"use client";

import { useState } from "react";

/**
 * Domain-based logo with a graceful fallback chain:
 *   1. Clearbit Logo API (real logo)  →  2. Google favicon  →  3. initials avatar.
 * Works for both companies (domain resolved via Clearbit autocomplete) and
 * colleges (domain from their website). No key required.
 */
export function Logo({
  domain,
  name,
  size = 40,
  rounded = "rounded-lg",
}: {
  domain?: string | null;
  name: string;
  size?: number;
  rounded?: string;
}) {
  const [stage, setStage] = useState(domain ? 0 : 2);
  const px = { width: size, height: size };

  if (stage >= 2 || !domain) {
    return <Initials name={name} size={size} rounded={rounded} />;
  }
  const src =
    stage === 0
      ? `https://logo.clearbit.com/${domain}`
      : `https://www.google.com/s2/favicons?domain=${domain}&sz=${Math.min(size * 2, 128)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
      style={px}
      className={`${rounded} border bg-white object-contain p-1`}
    />
  );
}

const AVATAR_HUES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Initials({
  name,
  size,
  rounded,
}: {
  name: string;
  size: number;
  rounded: string;
}) {
  const letters = name
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: `color-mix(in oklab, ${hue} 18%, var(--card))`,
        color: `color-mix(in oklab, ${hue} 75%, var(--foreground))`,
      }}
      className={`grid shrink-0 place-items-center border font-bold ${rounded}`}
    >
      {letters || "•"}
    </span>
  );
}

/** College logo from its website URL, with the same fallback chain. */
export function CollegeLogo({
  website,
  name,
  size = 40,
  rounded = "rounded-lg",
}: {
  website?: string | null;
  name: string;
  size?: number;
  rounded?: string;
}) {
  return (
    <Logo domain={domainFromUrl(website)} name={name} size={size} rounded={rounded} />
  );
}

/** Derive a bare domain (no protocol/www/path) from a website URL. */
export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

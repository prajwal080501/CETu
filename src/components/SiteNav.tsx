"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthButtons } from "@/components/AuthButtons";

const LINKS: { href: string; label: string; dot?: boolean }[] = [
  { href: "/colleges", label: "Colleges" },
  { href: "/branches", label: "Branches" },
  { href: "/spot", label: "SPOT", dot: true },
  { href: "/compare", label: "Compare" },
  { href: "/make-my-list", label: "Make My List" },
  { href: "/discuss", label: "Discuss" },
];

export function SiteNav({ clerkEnabled }: { clerkEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Desktop nav */}
      <div className="hidden items-center gap-1 text-sm md:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group relative rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {l.label}
            {l.dot && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Link>
        ))}
        <ThemeToggle />
        {clerkEnabled && (
          <div className="ml-1 flex items-center gap-2">
            <AuthButtons />
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="flex items-center gap-1 md:hidden">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border/60 bg-background/95 shadow-lg backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-0.5 px-3 py-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {l.label}
                {l.dot && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            ))}
            {clerkEnabled && (
              <div className="mt-1 border-t border-border/60 pt-2">
                <AuthButtons />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

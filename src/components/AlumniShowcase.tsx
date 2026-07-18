"use client";

import { useState } from "react";
import { ExternalLink, GraduationCap } from "lucide-react";

export type AlumnusView = {
  name: string;
  achievement: string | null;
  company: string | null;
  role: string | null;
  batchYear: number | null;
  linkedinUrl: string | null;
  photoUrl: string | null;
};

export function AlumniShowcase({ alumni }: { alumni: AlumnusView[] }) {
  if (alumni.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <GraduationCap className="h-5 w-5 text-primary" />
        Notable alumni
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Distinguished graduates of this college.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {alumni.map((a, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border p-3.5">
            <Avatar name={a.name} src={a.photoUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{a.name}</span>
                {a.linkedinUrl && (
                  <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {(a.role || a.company) && (
                <div className="truncate text-xs text-muted-foreground">
                  {[a.role, a.company].filter(Boolean).join(" · ")}
                </div>
              )}
              {a.batchYear && (
                <div className="text-[11px] text-muted-foreground">Batch {a.batchYear}</div>
              )}
              {a.achievement && (
                <div className="mt-1 text-xs leading-snug">{a.achievement}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={48}
        height={48}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-12 w-12 shrink-0 rounded-full border object-cover"
      />
    );
  }
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border bg-primary/10 text-sm font-bold text-primary">
      {initials || "•"}
    </span>
  );
}

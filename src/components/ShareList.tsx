"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import type { FlatResult } from "./PredictorResults";
import type { Chance } from "@/lib/predictor";

const LABEL: Record<Chance, string> = { reach: "Dream", moderate: "Target", safe: "Safe" };
const TAG: Record<Chance, { bg: string; fg: string }> = {
  reach: { bg: "#ffe4e6", fg: "#be123c" },
  moderate: { bg: "#fef3c7", fg: "#b45309" },
  safe: { bg: "#d1fae5", fg: "#047857" },
};

/**
 * Branded, exportable view of the user's college list. Acts as the "viewer":
 * renders a share-ready card (CETu logo, tagline, watermark) and downloads it as
 * a PNG image or a PDF. Styling is a fixed light theme so exports look identical
 * regardless of the viewer's dark/light mode.
 */
export function ShareList({
  list,
  percentile,
  category,
  onClose,
}: {
  list: FlatResult[];
  percentile?: number;
  category?: string;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"" | "png" | "pdf">("");

  async function render(): Promise<string> {
    const { toPng } = await import("html-to-image");
    return toPng(cardRef.current!, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });
  }

  async function downloadPng() {
    setBusy("png");
    try {
      const url = await render();
      const a = document.createElement("a");
      a.href = url;
      a.download = "cetu-my-list.png";
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy("");
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    try {
      const url = await render();
      const img = new Image();
      img.src = url;
      await new Promise((res) => (img.onload = res));
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: img.width > img.height ? "landscape" : "portrait",
        unit: "px",
        format: [img.width, img.height],
      });
      pdf.addImage(url, "PNG", 0, 0, img.width, img.height);
      pdf.save("cetu-my-list.pdf");
    } catch (e) {
      console.error(e);
    } finally {
      setBusy("");
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* toolbar */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Preview &amp; download</span>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPng}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white disabled:opacity-60"
            >
              {busy === "png" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              Image
            </button>
            <button
              onClick={downloadPdf}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white disabled:opacity-60"
            >
              {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              PDF
            </button>
            <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-white hover:bg-white/30">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* the exportable card (fixed light theme) */}
        <div
          ref={cardRef}
          style={{ background: "#ffffff", color: "#0f172a" }}
          className="relative overflow-hidden rounded-2xl"
        >
          {/* watermark layer */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex flex-wrap content-start gap-x-8 gap-y-6 overflow-hidden"
            style={{ transform: "rotate(-24deg) scale(1.4)", opacity: 0.05 }}
          >
            {Array.from({ length: 90 }).map((_, i) => (
              <span key={i} className="whitespace-nowrap text-base font-extrabold">
                CETu
              </span>
            ))}
          </div>

          {/* header */}
          <div
            className="relative flex items-center gap-2 px-5 pt-5"
            style={{ color: "#0f172a" }}
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#4f46e5,#e0a83a)" }}
            >
              C
            </span>
            <div className="leading-tight">
              <div className="text-lg font-bold">
                CET<span style={{ color: "#e0a83a" }}>u</span>
              </div>
              <div className="text-[10px] font-medium" style={{ color: "#64748b" }}>
                The bridge between you and your dream college
              </div>
            </div>
          </div>

          {/* meta */}
          <div className="relative mt-4 px-5">
            <h2 className="text-base font-bold">My MHT-CET College List</h2>
            <p className="mt-0.5 text-xs" style={{ color: "#64748b" }}>
              {percentile != null && <>Percentile {percentile} · </>}
              {category ?? "GOPEN"} · {list.length} choices ·{" "}
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>

          {/* list */}
          <ol className="relative mt-3 space-y-1.5 px-5 pb-3">
            {list.map((r, i) => (
              <li
                key={r.collegeBranchId}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                style={{ background: "#f8fafc" }}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: "#4f46e5" }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.collegeName}</div>
                  <div className="truncate text-[11px]" style={{ color: "#64748b" }}>
                    {r.branchName}
                    {r.city ? ` · ${r.city}` : ""} · {r.viaSeatType} · {r.closingPercentile.toFixed(2)}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: TAG[r.chance].bg, color: TAG[r.chance].fg }}
                >
                  {LABEL[r.chance]}
                </span>
              </li>
            ))}
          </ol>

          {/* footer */}
          <div
            className="relative flex items-center justify-between px-5 py-3 text-[10px]"
            style={{ background: "linear-gradient(90deg,#4f46e5,#e0a83a)", color: "#ffffff" }}
          >
            <span className="font-semibold">cetu.vercel.app</span>
            <span style={{ opacity: 0.9 }}>Estimates from public CAP data — verify officially.</span>
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
}

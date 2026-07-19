"use client";

import { useRef, useState, type ReactNode } from "react";
import { X, Image as ImageIcon, FileText, Loader2 } from "lucide-react";

/**
 * Reusable branded export modal: wraps arbitrary content (a table, a list) in a
 * share-ready CETu card (logo, tagline, tiled watermark, gradient footer) and
 * downloads it as a PNG image or PDF. The card is a fixed light theme so exports
 * look identical regardless of the viewer's dark/light mode. Children should use
 * explicit light-theme colors (not CSS theme vars) for a clean capture.
 */
export function ShareImageModal({
  title,
  subtitle,
  filename = "cetu",
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  filename?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"" | "png" | "pdf">("");

  async function render(): Promise<string> {
    const { toPng } = await import("html-to-image");
    return toPng(cardRef.current!, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
  }
  async function downloadPng() {
    setBusy("png");
    try {
      const url = await render();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
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
      pdf.save(`${filename}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy("");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="my-6 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Preview &amp; download</span>
          <div className="flex items-center gap-2">
            <button onClick={downloadPng} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white disabled:opacity-60">
              {busy === "png" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              Image
            </button>
            <button onClick={downloadPdf} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white disabled:opacity-60">
              {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              PDF
            </button>
            <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-white hover:bg-white/30">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={cardRef} style={{ background: "#ffffff", color: "#0f172a" }} className="relative overflow-hidden rounded-2xl">
          {/* watermark */}
          <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-wrap content-start gap-x-8 gap-y-6 overflow-hidden" style={{ transform: "rotate(-24deg) scale(1.5)", opacity: 0.045 }}>
            {Array.from({ length: 140 }).map((_, i) => (
              <span key={i} className="whitespace-nowrap text-base font-extrabold">CETu</span>
            ))}
          </div>

          {/* header */}
          <div className="relative flex items-center gap-2 px-5 pt-5">
            <span className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#4f46e5,#e0a83a)" }}>C</span>
            <div className="leading-tight">
              <div className="text-lg font-bold">CET<span style={{ color: "#e0a83a" }}>u</span></div>
              <div className="text-[10px] font-medium" style={{ color: "#64748b" }}>
                The bridge between you and your dream college
              </div>
            </div>
          </div>

          {/* title */}
          <div className="relative mt-4 px-5">
            <h2 className="text-base font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs" style={{ color: "#64748b" }}>{subtitle}</p>}
          </div>

          {/* content */}
          <div className="relative mt-3 px-5 pb-3">{children}</div>

          {/* footer */}
          <div className="relative flex items-center justify-between px-5 py-3 text-[10px]" style={{ background: "linear-gradient(90deg,#4f46e5,#e0a83a)", color: "#ffffff" }}>
            <span className="font-semibold">cetu.vercel.app</span>
            <span style={{ opacity: 0.9 }}>Compiled from public CAP data — verify officially.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

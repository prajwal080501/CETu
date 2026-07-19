"use client";

import { useState } from "react";
import { ImageDown } from "lucide-react";
import { ShareImageModal } from "@/components/ShareImageModal";

export interface SeatOffering {
  collegeBranchId: number;
  branchName: string;
  totalIntake: number | null;
  msSeats: number | null;
  aiSeats: number | null;
  minoritySeats: number | null;
  fee: number | null;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Branch-wise seat allocation table with a "Share as image" option that exports
 * a branded CETu card (via ShareImageModal).
 */
export function SeatAllocation({
  offerings,
  totalSeats,
  hasBranchFees,
  collegeName,
}: {
  offerings: SeatOffering[];
  totalSeats: number;
  hasBranchFees: boolean;
  collegeName: string;
}) {
  const [share, setShare] = useState(false);
  const cell = { padding: "5px 10px", textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Sanctioned intake per branch (2025 CAP) with the Maharashtra State /
          All-India / Minority split.
        </p>
        <button
          onClick={() => setShare(true)}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent"
          title="Share this table as a branded image"
        >
          <ImageDown className="h-3.5 w-3.5" />
          Share
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-4 py-2.5 font-medium">Branch</th>
              <th className="px-4 py-2.5 text-right font-medium">Total seats</th>
              <th className="px-4 py-2.5 text-right font-medium">MH State</th>
              <th className="px-4 py-2.5 text-right font-medium">All India</th>
              <th className="px-4 py-2.5 text-right font-medium">Minority</th>
              {hasBranchFees && <th className="px-4 py-2.5 text-right font-medium">Fee/yr</th>}
            </tr>
          </thead>
          <tbody>
            {offerings.map((o) => (
              <tr key={o.collegeBranchId} className="border-t">
                <td className="px-4 py-2">{o.branchName}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{o.totalIntake ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{o.msSeats ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{o.aiSeats ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{o.minoritySeats ?? "—"}</td>
                {hasBranchFees && (
                  <td className="px-4 py-2 text-right tabular-nums">{o.fee != null ? inr(o.fee) : "—"}</td>
                )}
              </tr>
            ))}
            <tr className="border-t bg-muted/30 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{totalSeats.toLocaleString()}</td>
              <td colSpan={hasBranchFees ? 4 : 3} />
            </tr>
          </tbody>
        </table>
      </div>

      {share && (
        <ShareImageModal
          title="Branch-wise seat allocation"
          subtitle={`${collegeName} · 2025 CAP · ${totalSeats.toLocaleString()} total seats`}
          filename="cetu-seat-allocation"
          onClose={() => setShare(false)}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: "11px", width: "100%" }}>
              <thead>
                <tr style={{ background: "#eef2ff" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>Branch</th>
                  <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>Total</th>
                  <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>MH State</th>
                  <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>All India</th>
                  <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>Minority</th>
                  {hasBranchFees && <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>Fee/yr</th>}
                </tr>
              </thead>
              <tbody>
                {offerings.map((o, i) => (
                  <tr key={o.collegeBranchId} style={{ background: i % 2 ? "#f8fafc" : "#ffffff" }}>
                    <td style={{ padding: "5px 10px" }}>{o.branchName}</td>
                    <td style={{ ...cell, fontWeight: 600 }}>{o.totalIntake ?? "—"}</td>
                    <td style={{ ...cell, color: "#64748b" }}>{o.msSeats ?? "—"}</td>
                    <td style={{ ...cell, color: "#64748b" }}>{o.aiSeats ?? "—"}</td>
                    <td style={{ ...cell, color: "#64748b" }}>{o.minoritySeats ?? "—"}</td>
                    {hasBranchFees && <td style={cell}>{o.fee != null ? inr(o.fee) : "—"}</td>}
                  </tr>
                ))}
                <tr style={{ background: "#eef2ff", fontWeight: 700 }}>
                  <td style={{ padding: "6px 10px" }}>Total</td>
                  <td style={cell}>{totalSeats.toLocaleString()}</td>
                  <td colSpan={hasBranchFees ? 4 : 3} />
                </tr>
              </tbody>
            </table>
          </div>
        </ShareImageModal>
      )}
    </>
  );
}

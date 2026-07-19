"use client";

import { useMemo, useState } from "react";
import { ImageDown, SlidersHorizontal, ChevronDown } from "lucide-react";
import { ShareImageModal } from "@/components/ShareImageModal";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
 * Branch-wise seat allocation table with a branch filter and a "Share as image"
 * option (branded export via ShareImageModal). Both operate on the same visible
 * set, so a filtered view exports exactly what's on screen.
 */
export function SeatAllocation({
  offerings,
  hasBranchFees,
  collegeName,
}: {
  offerings: SeatOffering[];
  /** Kept for API compatibility; total is derived from the visible rows. */
  totalSeats?: number;
  hasBranchFees: boolean;
  collegeName: string;
}) {
  const [share, setShare] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const allBranches = useMemo(
    () => [...new Set(offerings.map((o) => o.branchName))].sort(),
    [offerings]
  );
  const visible = offerings.filter((o) => !hidden.has(o.branchName));
  const visibleTotal = visible.reduce((s, o) => s + (o.totalIntake ?? 0), 0);
  const filtered = hidden.size > 0;

  const cell = { padding: "5px 10px", textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Sanctioned intake per branch (2025 CAP) with the Maharashtra State /
          All-India / Minority split.
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Branches ({visible.length}/{allBranches.length})
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show branches</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allBranches.map((b) => (
                <DropdownMenuCheckboxItem
                  key={b}
                  checked={!hidden.has(b)}
                  closeOnClick={false}
                  onCheckedChange={(on) =>
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(b);
                      else next.add(b);
                      return next;
                    })
                  }
                >
                  {b}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

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
            {visible.map((o) => (
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
            {visible.length === 0 && (
              <tr>
                <td colSpan={hasBranchFees ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                  No branches selected.
                </td>
              </tr>
            )}
            <tr className="border-t bg-muted/30 font-semibold">
              <td className="px-4 py-2">{filtered ? "Total (shown)" : "Total"}</td>
              <td className="px-4 py-2 text-right tabular-nums">{visibleTotal.toLocaleString()}</td>
              <td colSpan={hasBranchFees ? 4 : 3} />
            </tr>
          </tbody>
        </table>
      </div>

      {share && (
        <ShareImageModal
          title="Branch-wise seat allocation"
          subtitle={`${collegeName} · 2025 CAP · ${visibleTotal.toLocaleString()} seats${filtered ? " (filtered)" : ""}`}
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
                {visible.map((o, i) => (
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
                  <td style={cell}>{visibleTotal.toLocaleString()}</td>
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

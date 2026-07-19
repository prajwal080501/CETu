import { ClipboardCheck } from "lucide-react";
import { getPredictorMeta } from "@/lib/queries";
import { CapCompanion } from "@/components/CapCompanion";
import { AdmissionCountdown } from "@/components/AdmissionCountdown";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "CAP Guide — MHT-CET Admission Tracker, Timeline & Document Checklist",
  description:
    "Track your MHT-CET CAP admission step by step — live countdown to each round, and a document checklist personalised to your category (caste / NCL / EWS / TFWS / domicile).",
};

export default async function CapPage() {
  const { categories } = await getPredictorMeta();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-sm">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">CAP Guide</h1>
          <p className="text-sm text-muted-foreground">
            Your step-by-step MHT-CET admission companion — timeline, workflow and
            a personalised document checklist.
          </p>
        </div>
      </div>

      {/* Live countdown (alerts) */}
      <AdmissionCountdown />

      {/* Workflow tracker + checklist */}
      <div className="mt-8">
        <CapCompanion
          categories={categories.map((c) => ({ code: c.code, label: c.label }))}
        />
      </div>
    </div>
  );
}

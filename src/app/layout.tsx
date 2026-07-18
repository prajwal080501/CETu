import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/auth";
import { SiteNav } from "@/components/SiteNav";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CETu — MHT-CET Engineering College Research Hub",
    template: "%s · CETu",
  },
  description:
    "Search Maharashtra engineering colleges, explore branches, and check MHT-CET CAP cutoffs by category and seat type (Home University / Other Than Home University / State Level) — all in one place.",
};

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-chart-2 text-sm font-bold text-primary-foreground">
            C
          </span>
          <span className="text-base">
            CET
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              u
            </span>
          </span>
        </Link>
        <SiteNav clerkEnabled={clerkEnabled} />
      </nav>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-2 text-center text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Disclaimer</p>
          <p>
            <strong>CETu</strong> is an independent research and study aid. It is{" "}
            <strong>not affiliated with, endorsed by, or an official portal of</strong>{" "}
            the DTE Maharashtra, the State CET Cell, MHT-CET, any university, or
            any college.
          </p>
          <p>
            All data — cutoffs, seats, ranks, NIRF/NAAC, placements, fees, alumni
            and job-market figures — is compiled from publicly available and
            third-party sources, may contain errors or be out of date, and is
            provided <strong>“as is” for informational purposes only</strong>.
            Cutoff predictions and admission probabilities are{" "}
            <strong>estimates, not guarantees</strong> of admission. Placement,
            fee and salary figures are indicative. Job-market data is sourced from
            third parties (e.g. Adzuna) and reflects open listings, not outcomes.
          </p>
          <p>
            Always verify every detail against the{" "}
            <strong>official CAP portal and the college&rsquo;s own notices</strong>{" "}
            before making any admission or financial decision. CETu accepts no
            liability for decisions made based on this information. All trademarks
            and logos belong to their respective owners.
          </p>
        </div>
      </footer>
    </>
  );
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {clerkEnabled ? (
            <ClerkProvider dynamic>{content}</ClerkProvider>
          ) : (
            content
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}

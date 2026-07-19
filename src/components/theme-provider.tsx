"use client";

import { memo } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

function ThemeProviderBase({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export const ThemeProvider = memo(ThemeProviderBase);

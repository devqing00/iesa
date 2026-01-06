"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SessionProvider } from "@/context/SessionContext";
import { PermissionsProvider } from "@/context/PermissionsContext";
import * as React from "react";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        <PermissionsProvider>{children}</PermissionsProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

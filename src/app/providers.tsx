"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { SessionProvider } from "@/context/SessionContext";
import { PermissionsProvider } from "@/context/PermissionsContext";
import { ToastProvider } from "@/components/ui";
import { Toaster } from "sonner";
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
      <AuthProvider>
        <SessionProvider>
          <PermissionsProvider>
            <ToastProvider>{children}</ToastProvider>
            <Toaster
              position="top-right"
              toastOptions={{
                classNames: {
                  toast: "font-display font-bold text-sm border-[3px] border-navy shadow-[4px_4px_0_0_#000] rounded-2xl",
                  title: "font-display font-black",
                  description: "font-normal",
                  success: "bg-teal text-snow border-navy",
                  error: "bg-coral text-snow border-navy",
                  warning: "bg-sunny text-navy border-navy",
                  info: "bg-lavender text-snow border-navy",
                },
              }}
            />
          </PermissionsProvider>
        </SessionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

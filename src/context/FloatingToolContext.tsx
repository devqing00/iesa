"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

type FloatingToolState = {
  toolId: string | null;
  minimized: boolean;
};

type FloatingToolContextValue = {
  state: FloatingToolState;
  openTool: (toolId: string) => void;
  closeTool: () => void;
  toggleMinimize: () => void;
};

const FloatingToolContext = createContext<FloatingToolContextValue | null>(null);

export function FloatingToolProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FloatingToolState>({ toolId: null, minimized: false });

  const openTool = useCallback((toolId: string) => {
    setState({ toolId, minimized: false });
  }, []);

  const closeTool = useCallback(() => {
    setState({ toolId: null, minimized: false });
  }, []);

  const toggleMinimize = useCallback(() => {
    setState((prev) => ({ ...prev, minimized: !prev.minimized }));
  }, []);

  const value = useMemo(
    () => ({ state, openTool, closeTool, toggleMinimize }),
    [state, openTool, closeTool, toggleMinimize]
  );

  return (
    <FloatingToolContext.Provider value={value}>
      {children}
    </FloatingToolContext.Provider>
  );
}

export function useFloatingTool() {
  const ctx = useContext(FloatingToolContext);
  if (!ctx) throw new Error("useFloatingTool must be used within FloatingToolProvider");
  return ctx;
}

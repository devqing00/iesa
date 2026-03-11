"use client";

import { useFloatingTool } from "@/context/FloatingToolContext";
import MiniStudyTimer from "@/components/dashboard/MiniStudyTimer";

/* ─── Tool registry ─── */
const TOOL_REGISTRY: Record<string, { label: string; icon: React.ReactNode; component: React.ComponentType }> = {
  timer: {
    label: "Study Timer",
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path
          fillRule="evenodd"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    component: MiniStudyTimer,
  },
};

/* ─── Floating popup container ─── */
export default function FloatingToolPopup() {
  const { state, closeTool, toggleMinimize } = useFloatingTool();
  const { toolId, minimized } = state;

  if (!toolId) return null;
  const tool = TOOL_REGISTRY[toolId];
  if (!tool) return null;

  const ToolComponent = tool.component;

  /* Minimized: small round button */
  if (minimized) {
    return (
      <button
        onClick={toggleMinimize}
        className="fixed bottom-24 md:bottom-8 right-4 z-60 w-14 h-14 bg-navy border-[3px] border-lime rounded-full shadow-[4px_4px_0_0_#C8F31D] flex items-center justify-center text-lime press-3 press-lime transition-all"
        aria-label={`Expand ${tool.label}`}
      >
        {tool.icon}
      </button>
    );
  }

  /* Expanded: floating card */
  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 z-60 w-80 bg-snow border-4 border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-navy">
        <div className="flex items-center gap-2 text-lime">
          {tool.icon}
          <span className="font-display font-bold text-sm text-snow">{tool.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMinimize}
            className="p-1.5 rounded-lg hover:bg-snow/10 transition-colors"
            aria-label="Minimize"
          >
            <svg aria-hidden="true" className="w-4 h-4 text-snow" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M3.75 12a.75.75 0 0 1 .75-.75h15a.75.75 0 0 1 0 1.5h-15a.75.75 0 0 1-.75-.75Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={closeTool}
            className="p-1.5 rounded-lg hover:bg-snow/10 transition-colors"
            aria-label="Close"
          >
            <svg aria-hidden="true" className="w-4 h-4 text-snow" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tool content */}
      <div className="p-4">
        <ToolComponent />
      </div>
    </div>
  );
}

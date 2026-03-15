"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
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
  const tool = toolId ? TOOL_REGISTRY[toolId] : null;
  const [position, setPosition] = useState(() => {
    if (typeof window === "undefined") return { x: 16, y: 16 };
    const width = 320;
    const height = 430;
    return {
      x: Math.max(12, window.innerWidth - width - 16),
      y: Math.max(12, window.innerHeight - height - 24),
    };
  });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartPointRef = useRef({ x: 0, y: 0 });
  const dragMovedRef = useRef(false);

  const ToolComponent = tool?.component;

  const getSize = useCallback(
    (isMinimized: boolean) => {
      if (isMinimized) return { width: 56, height: 56 };
      return { width: 320, height: 430 };
    },
    []
  );

  const clampPosition = useCallback(
    (x: number, y: number, isMinimized: boolean) => {
      if (typeof window === "undefined") return { x, y };
      const margin = 12;
      const { width, height } = getSize(isMinimized);
      const maxX = Math.max(margin, window.innerWidth - width - margin);
      const maxY = Math.max(margin, window.innerHeight - height - margin);
      return {
        x: Math.max(margin, Math.min(x, maxX)),
        y: Math.max(margin, Math.min(y, maxY)),
      };
    },
    [getSize]
  );

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y, minimized));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [minimized, clampPosition]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const nextX = e.clientX - dragOffset.x;
      const nextY = e.clientY - dragOffset.y;
      if (
        Math.abs(e.clientX - dragStartPointRef.current.x) > 3 ||
        Math.abs(e.clientY - dragStartPointRef.current.y) > 3
      ) {
        dragMovedRef.current = true;
      }
      setPosition(clampPosition(nextX, nextY, minimized));
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const nextX = touch.clientX - dragOffset.x;
      const nextY = touch.clientY - dragOffset.y;
      if (
        Math.abs(touch.clientX - dragStartPointRef.current.x) > 3 ||
        Math.abs(touch.clientY - dragStartPointRef.current.y) > 3
      ) {
        dragMovedRef.current = true;
      }
      setPosition(clampPosition(nextX, nextY, minimized));
    };

    const stopDrag = () => {
      setDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", stopDrag);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopDrag);
    };
  }, [dragging, dragOffset, minimized, clampPosition]);

  const startDrag = (clientX: number, clientY: number) => {
    const bounded = clampPosition(position.x, position.y, minimized);
    dragStartPointRef.current = { x: clientX, y: clientY };
    dragMovedRef.current = false;
    setDragOffset({ x: clientX - bounded.x, y: clientY - bounded.y });
    setDragging(true);
  };

  const handleMouseDragStart = (e: ReactMouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  };

  const handleTouchDragStart = (e: ReactTouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startDrag(touch.clientX, touch.clientY);
  };

  const handleMinimizedClick = () => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    toggleMinimize();
  };

  if (!tool || !ToolComponent) return null;
  const boundedPosition = clampPosition(position.x, position.y, minimized);

  return (
    <>
      <button
        onClick={handleMinimizedClick}
        onMouseDown={handleMouseDragStart}
        onTouchStart={handleTouchDragStart}
        className={`fixed z-60 w-14 h-14 bg-navy border-[3px] border-lime rounded-full shadow-[4px_4px_0_0_#C8F31D] items-center justify-center text-lime press-3 press-lime transition-all ${
          minimized ? "flex" : "hidden"
        }`}
        style={{ left: `${boundedPosition.x}px`, top: `${boundedPosition.y}px` }}
        aria-label={`Expand ${tool.label}`}
      >
        {tool.icon}
      </button>

      <div
        className={`fixed z-60 w-80 bg-snow border-4 border-navy rounded-3xl shadow-[8px_8px_0_0_#000] overflow-hidden ${
          minimized ? "hidden" : "block"
        }`}
        style={{ left: `${boundedPosition.x}px`, top: `${boundedPosition.y}px` }}
      >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-navy cursor-move touch-none"
        onMouseDown={handleMouseDragStart}
        onTouchStart={handleTouchDragStart}
      >
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
    </>
  );
}

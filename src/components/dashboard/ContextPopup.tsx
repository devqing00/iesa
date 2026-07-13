"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useStudentDashboard } from "@/hooks/useData";

const LAST_SEEN_CONTEXT_KEY = "last_seen_academic_context";

interface LastSeenContext {
  sessionName: string;
  semester: number;
  isExamPeriod: boolean;
}

export function ContextPopup() {
  const { data } = useStudentDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [popupContent, setPopupContent] = useState<{ title: string; message: string; type: "semester" | "exam" | "session" } | null>(null);

  useEffect(() => {
    if (!data?.academicContext) return;

    const currentContext = {
      sessionName: data.academicContext.sessionName,
      semester: data.academicContext.currentSemester,
      isExamPeriod: data.academicContext.isExamPeriod,
    };

    const stored = window.localStorage.getItem(LAST_SEEN_CONTEXT_KEY);
    if (!stored) {
      // First time, just save and don't show popup
      window.localStorage.setItem(LAST_SEEN_CONTEXT_KEY, JSON.stringify(currentContext));
      return;
    }

    try {
      const lastSeen = JSON.parse(stored) as LastSeenContext;

      if (lastSeen.sessionName !== currentContext.sessionName) {
        setPopupContent({
          title: `Welcome to ${currentContext.sessionName}!`,
          message: "A new academic session has begun. Check out your new timetable and upcoming events.",
          type: "session"
        });
        setIsOpen(true);
      } else if (lastSeen.semester !== currentContext.semester) {
        setPopupContent({
          title: `Welcome to Semester ${currentContext.semester}!`,
          message: "The new semester is here. Your timetable has been automatically updated.",
          type: "semester"
        });
        setIsOpen(true);
      } else if (!lastSeen.isExamPeriod && currentContext.isExamPeriod) {
        setPopupContent({
          title: "Exam Period has Started!",
          message: "Focus mode is active. Your dashboard has been decluttered to help you concentrate on your exams. Good luck!",
          type: "exam"
        });
        setIsOpen(true);
      } else if (lastSeen.isExamPeriod && !currentContext.isExamPeriod) {
        setPopupContent({
          title: "Exams are Over!",
          message: "Congratulations on finishing your exams! Take some time to rest and recharge.",
          type: "exam"
        });
        setIsOpen(true);
      }

      // Update storage
      window.localStorage.setItem(LAST_SEEN_CONTEXT_KEY, JSON.stringify(currentContext));
    } catch (e) {
      window.localStorage.setItem(LAST_SEEN_CONTEXT_KEY, JSON.stringify(currentContext));
    }
  }, [data?.academicContext]);

  if (!isOpen || !popupContent) return null;

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <div className="text-center p-4">
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
          popupContent.type === "exam" ? "bg-coral/20 text-coral" : "bg-lime/20 text-lime"
        }`}>
          {popupContent.type === "exam" ? (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          ) : (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.866 8.284 8.284 0 0 0 3 2.48Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
            </svg>
          )}
        </div>
        <h3 className="font-display font-black text-2xl text-navy mb-2">{popupContent.title}</h3>
        <p className="text-sm text-slate mb-6">{popupContent.message}</p>
        <button
          onClick={() => setIsOpen(false)}
          className="w-full bg-navy text-snow font-bold py-3 rounded-xl border-[3px] border-transparent hover:border-lime transition-all"
        >
          Got it!
        </button>
      </div>
    </Modal>
  );
}

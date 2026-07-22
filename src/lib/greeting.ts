/**
 * Time-aware and context-aware greeting utility
 *
 * Returns a contextual greeting based on the current hour and academic calendar.
 * When `isBirthday` is true, returns a birthday-themed greeting.
 */

import type { AcademicContext } from "@/hooks/useData";

export function getTimeGreeting(isBirthday = false, context?: AcademicContext, userLevel?: number | string): string {
  const hour = new Date().getHours();
  const levelNum = userLevel ? parseInt(String(userLevel).replace(/\D/g, ""), 10) : 0;
  const currentSem = context?.currentSemester || 1;

  if (isBirthday) {
    if (hour < 12) return "Happy Birthday! Good morning";
    if (hour < 17) return "Happy Birthday! Hope your day's amazing";
    return "Happy Birthday! Hope your day's been great";
  }

  // Level 400 2nd Semester 6 Months Industrial Training (IT) Override
  if (levelNum === 400 && currentSem === 2) {
    if (hour < 12) return "Good morning! Hope your 6 Months Industrial Training (IT) placement is off to a great start!";
    return "Welcome back! Wishing you a productive 6 Months Industrial Training (IT) period!";
  }

  // Academic Calendar Context Overrides
  if (context) {
    const semStr = currentSem === 1 ? "1st" : "2nd";
    const sessionStr = context.sessionName;

    if (context.isFirstDayOfSession) {
      if (hour < 12) return `Good morning! Welcome to the new academic session (${sessionStr})`;
      return `Welcome to the start of the ${sessionStr} academic session!`;
    }

    if (context.isFirstDayOfSemester) {
      if (hour < 12) return `Good morning! Welcome to the first day of the ${semStr} Semester`;
      return `Welcome to the first day of the ${semStr} Semester! Let's get to work!`;
    }

    if (context.isLastDayOfSession) {
      return `Congratulations on reaching the final day of the ${sessionStr} session!`;
    }

    if (context.isLastDayOfSemester) {
      return `It's the final day of the ${semStr} Semester! You made it!`;
    }

    if (context.isExamPeriod) {
      if (hour < 5) return "Late night studying? Make sure to get some sleep before your exam!";
      if (hour < 10) return "Good morning! Wishing you the absolute best in your exams today!";
      if (hour < 14) return "Good afternoon! Stay focused and do your best in your exams!";
      if (hour < 18) return "Good evening! Keep pushing, the exams will soon be over!";
      return "Good evening! Review well and get enough rest for tomorrow's papers.";
    }

    if (context.isHoliday) {
      if (levelNum === 200) return "Hope you're having a productive SWEP (Student Work Experience Program) period!";
      if (levelNum === 300) return "Hope your 3-Month SIWES industrial placement is going well!";
      if (hour < 12) return "Good morning! Enjoy the break, you've earned it!";
      if (hour < 17) return "Hope you're having a relaxing and wonderful holiday!";
      return "Good evening! Have a relaxing night away from the books.";
    }

    if (context.isResumptionWeek) {
      if (levelNum === 200) return `Welcome back! Hope your ${semStr} Semester resumption week is going well!`;
      if (levelNum === 300) return `Welcome back! Hope your ${semStr} Semester resumption week is going well!`;
      if (hour < 12) return `Good morning! Still settling into the ${semStr} Semester?`;
      return `Welcome back! Hope your ${semStr} Semester resumption week is going well!`;
    }

    if (context.isEndOfSemester) {
      return `The ${semStr} Semester is wrapping up soon, stay strong for the final stretch!`;
    }

    if (context.currentEventTitle) {
      if (hour < 12) return `Good morning! Enjoy ${context.currentEventTitle} today!`;
      return `Hope you're having a great time at ${context.currentEventTitle}!`;
    }
  }

  // Standard Time-Based Greetings
  if (hour < 5) return "Happy late night";
  if (hour < 8) return "Good early morning";
  if (hour < 12) return "Good morning";
  if (hour < 14) return "Good afternoon";
  if (hour < 17) return "Hope your day's going well";
  if (hour < 19) return "Good evening";
  if (hour < 22) return "Good evening";
  return "Happy late night";
}

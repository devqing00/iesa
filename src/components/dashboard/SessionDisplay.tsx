"use client";

/**
 * SessionDisplay Component
 * 
 * Displays the current active academic session from MongoDB
 */

import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const SessionDisplay: React.FC = () => {
  const { user } = useAuth();
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getAcademicYear = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11, where 0 = Jan
      
      // Academic year runs Sept-Aug (month 8-7)
      // If before September (month < 8), we're in the second half (e.g., Jan 2026 is 2025/2026)
      // If Sept or after (month >= 8), we're in the first half (e.g., Sept 2025 is 2025/2026)
      if (currentMonth < 8) {
        // Jan-Aug: previous year to current year
        return `${currentYear - 1}/${currentYear}`;
      } else {
        // Sept-Dec: current year to next year
        return `${currentYear}/${currentYear + 1}`;
      }
    };

    const fetchActiveSession = async () => {
      if (!user) {
        // Fallback if no user
        setSessionName(getAcademicYear());
        setIsActive(true);
        setIsLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/sessions?active_only=true&limit=1', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const sessions = await response.json();
          if (sessions && sessions.length > 0) {
            const activeSession = sessions[0];
            setSessionName(activeSession.name);
            setIsActive(activeSession.isActive);
          } else {
            // Fallback to current academic year if no active session
            setSessionName(getAcademicYear());
            setIsActive(false);
          }
        } else {
          console.warn('Sessions API error:', response.status);
          // Fallback on error
          setSessionName(getAcademicYear());
          setIsActive(false);
        }
      } catch (error) {
        console.error('Error fetching active session:', error);
        // Fallback on error
        setSessionName(getAcademicYear());
        setIsActive(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveSession();
  }, [user]);

  if (isLoading || !sessionName) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground/5 backdrop-blur-sm border border-foreground/10">
      <Calendar className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-foreground">
        {sessionName}
      </span>
      {isActive && (
        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
          Active
        </span>
      )}
    </div>
  );
};

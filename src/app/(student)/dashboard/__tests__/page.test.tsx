import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import StudentDashboardPage from "../page";

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick, className }: { children: React.ReactNode; href: string; onClick?: (e?: unknown) => void; className?: string }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      className={className}
    >
      {children}
    </a>
  ),
}));

const mockGetAccessToken = vi.fn().mockResolvedValue("token-1");
const mockUser = { id: "507f1f77bcf86cd799439011", email: "test@ui.edu.ng" };
const mockUserProfile = {
  firstName: "Test",
  department: "Industrial Engineering",
  level: "300L",
  currentLevel: "300L",
  matricNumber: "123456",
  phone: "08000000000",
  emailVerified: true,
  admissionYear: 2023,
  hasCompletedOnboarding: true,
};
const mockPermissions = {
  loaded: true,
  hasAnyPermission: vi.fn().mockReturnValue(false),
  hasPermission: vi.fn().mockReturnValue(false),
};
const mockSession = { name: "2025/2026", currentSemester: "first" };
const mockDashboardData = {
  announcements: [
    {
      id: "a1",
      _id: "a1",
      title: "Semester Update",
      category: "general",
      createdAt: new Date().toISOString(),
      priority: "normal",
    },
  ],
  events: [],
  payments: [
    {
      id: "p1",
      _id: "p1",
      title: "Departmental Due",
      amount: 2000,
      deadline: new Date().toISOString(),
      hasPaid: false,
    },
  ],
  todayClasses: [],
  birthdays: [],
  isMyBirthday: false,
};

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    userProfile: mockUserProfile,
    refreshProfile: vi.fn(),
    getAccessToken: mockGetAccessToken,
  }),
}));

vi.mock("@/context/PermissionsContext", () => ({
  usePermissions: () => mockPermissions,
}));

vi.mock("@/context/SessionContext", () => ({
  useSession: () => ({
    currentSession: mockSession,
  }),
}));

vi.mock("@/hooks/useData", () => ({
  useStudentDashboard: () => ({
    isLoading: false,
    data: mockDashboardData,
  }),
}));

vi.mock("@/components/dashboard/DashboardHeader", () => ({
  __esModule: true,
  default: ({ title }: { title?: string }) => <div>{title || "Header"}</div>,
}));

vi.mock("@/components/dashboard/DeadlineWidget", () => ({
  __esModule: true,
  default: () => <div>Deadline Widget</div>,
}));

vi.mock("@/components/ui/ToolHelpModal", () => ({
  HelpButton: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Help</button>,
  ToolHelpModal: () => null,
  useToolHelp: () => ({ showHelp: false, openHelp: vi.fn(), closeHelp: vi.fn() }),
}));

vi.mock("@/components/ui/Skeleton", () => ({
  StudentDashboardSkeleton: () => <div>Loading...</div>,
}));

vi.mock("@/lib/greeting", () => ({
  getTimeGreeting: () => "Good day",
}));

vi.mock("@/lib/quotes", () => ({
  getQuoteOfTheDay: () => ({ text: "Consistency wins", author: "IESA" }),
}));

vi.mock("@/lib/studentAccess", () => ({
  isExternalStudent: () => false,
}));

vi.mock("@/lib/profileImage", () => ({
  resolveProfileImageUrl: () => null,
}));

function mockDashboardFetch() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL, opts?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);

    if (url.includes("/api/v1/growth/rewards/action") && opts?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          visitStreak: 4,
          streakUpdatedToday: false,
          weeklyUsefulActions: 7,
          recognitionLevel: "Momentum Builder",
          perkUtilities: ["fast_shortcuts"],
          nextChain: {
            title: "Great progress — keep the flow",
            detail: "Check your latest announcements for what’s next.",
            href: "/dashboard/announcements",
            cta: "View updates",
          },
        }),
      });
    }

    if (url.includes("/api/v1/growth/rewards/privacy") && opts?.method === "PATCH") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, privacyOptIn: true }) });
    }

    if (url.includes("/api/v1/growth/rewards/leaderboard?scope=cohort")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ scope: "cohort", items: [{ rank: 1, name: "Ada N", weeklyUsefulActions: 9, isMe: false }] }),
      });
    }

    if (url.includes("/api/v1/growth/rewards/leaderboard?scope=team")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ scope: "team", items: [{ rank: 1, name: "Kunle O", weeklyUsefulActions: 8, isMe: false }] }),
      });
    }

    if (url.includes("/api/v1/growth/rewards") && (!opts || opts.method === undefined)) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          visitStreak: 3,
          streakUpdatedToday: true,
          weeklyUsefulActions: 6,
          privacyOptIn: false,
          priorityPins: [],
          perkUtilities: ["fast_shortcuts"],
          recognitionLevel: "On Track",
          weeklyResetCelebration: false,
          isAtRisk: false,
        }),
      });
    }

    if (url.includes("/api/v1/notifications/")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }

    if (url.includes("/api/v1/class-rep/member/overview")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ activePolls: 0 }) });
    }

    if (url.includes("/api/v1/team-head/member/overview")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ membershipCount: 0, activeTasks: 0, pinnedNotices: 0 }) });
    }

    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe("StudentDashboardPage rewards integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockDashboardFetch();
  });

  it("renders privacy toggle and shows chain card after useful action", async () => {
    render(<StudentDashboardPage />);

    expect(await screen.findByText("Recognition Feed (Opt-in)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hidden" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hidden" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Visible" })).toBeInTheDocument();
    });

    const payNowLinks = screen.getAllByRole("link", { name: "Pay now" });
    await act(async () => {
      fireEvent.click(payNowLinks[0]);
    });

    expect(await screen.findByText("Great progress — keep the flow")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View updates" })).toBeInTheDocument();
  }, 15000);
});

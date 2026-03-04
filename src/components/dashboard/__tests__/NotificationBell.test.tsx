import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import NotificationBell from "../NotificationBell";

// Mock AuthContext
const mockGetAccessToken = vi.fn().mockResolvedValue("test-token");
const mockUser = { uid: "user-1", email: "test@ui.edu.ng", role: "student" };

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    getAccessToken: mockGetAccessToken,
    user: mockUser,
  }),
}));

// Mock next/link — render as plain anchor
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick, className }: { children: React.ReactNode; href: string; onClick?: () => void; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>{children}</a>
  ),
}));

// Helper to mock fetch responses
function mockFetchResponses(notifications: unknown[], unreadCount: number) {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes("/unread-count")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ count: unreadCount }),
      });
    }
    if (url.includes("/notifications/")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(notifications),
      });
    }
    return Promise.resolve({ ok: false });
  });
}

const sampleNotifications = [
  {
    _id: "n1",
    userId: "user-1",
    type: "announcement",
    title: "New Announcement",
    message: "Check the notice board",
    link: "/dashboard/announcements",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    _id: "n2",
    userId: "user-1",
    type: "transfer_approved",
    title: "Transfer Approved",
    message: "Your bank transfer was approved",
    link: "/dashboard/payments",
    isRead: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the bell button", async () => {
    mockFetchResponses([], 0);
    await act(async () => {
      render(<NotificationBell />);
    });
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });

  it("shows unread badge when there are unread notifications", async () => {
    mockFetchResponses(sampleNotifications, 1);
    await act(async () => {
      render(<NotificationBell />);
    });
    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("shows 9+ when unread count exceeds 9", async () => {
    mockFetchResponses(sampleNotifications, 15);
    await act(async () => {
      render(<NotificationBell />);
    });
    await waitFor(() => {
      expect(screen.getByText("9+")).toBeInTheDocument();
    });
  });

  it("does not show badge when no unread notifications", async () => {
    mockFetchResponses(sampleNotifications, 0);
    await act(async () => {
      render(<NotificationBell />);
    });
    await waitFor(() => {
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });
  });

  it("opens dropdown on bell click", async () => {
    mockFetchResponses(sampleNotifications, 1);
    await act(async () => {
      render(<NotificationBell />);
    });
    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    });

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("New Announcement")).toBeInTheDocument();
    expect(screen.getByText("Transfer Approved")).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    mockFetchResponses([], 0);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    });
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
  });

  it("shows Mark all read button when there are unread notifications", async () => {
    mockFetchResponses(sampleNotifications, 1);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    });
    expect(screen.getByText("Mark all read")).toBeInTheDocument();
  });

  it("calls mark-all-read endpoint when clicking Mark all read", async () => {
    mockFetchResponses(sampleNotifications, 1);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    });

    // Reset fetch mock to track mark-all-read call
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: () => Promise.resolve({ message: "ok" }) });

    await act(async () => {
      fireEvent.click(screen.getByText("Mark all read"));
    });

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const markAllCall = calls.find(
        (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/mark-all-read")
      );
      expect(markAllCall).toBeDefined();
      expect(markAllCall![1].method).toBe("POST");
    });
  });

  it("fetches notifications and unread count in parallel", async () => {
    mockFetchResponses(sampleNotifications, 1);
    await act(async () => {
      render(<NotificationBell />);
    });

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const listCall = calls.find(
        (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/notifications/") && !c[0].includes("unread-count")
      );
      const countCall = calls.find(
        (c: unknown[]) => typeof c[0] === "string" && c[0].includes("/unread-count")
      );
      expect(listCall).toBeDefined();
      expect(countCall).toBeDefined();
    });
  });
});

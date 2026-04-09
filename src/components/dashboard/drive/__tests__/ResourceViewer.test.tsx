import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ResourceViewer from "../ResourceViewer";

const mocked = vi.hoisted(() => ({
  saveDriveProgress: vi.fn().mockResolvedValue(undefined),
  saveDriveViewerTelemetry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-pdf/dist/Page/AnnotationLayer.css", () => ({}));
vi.mock("react-pdf/dist/Page/TextLayer.css", () => ({}));

const mockPageRenderProps: Array<{ pageNumber: number; renderTextLayer?: boolean; renderAnnotationLayer?: boolean }> = [];

vi.mock("react-pdf", async () => {
  const React = await import("react");
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
    Document: ({ children, onLoadSuccess }: { children: React.ReactNode; onLoadSuccess?: (data: { numPages: number }) => void }) => {
      React.useEffect(() => {
        onLoadSuccess?.({ numPages: 300 });
      }, [onLoadSuccess]);
      return <div data-testid="mock-document">{children}</div>;
    },
    Page: ({ pageNumber, renderTextLayer, renderAnnotationLayer }: { pageNumber: number; renderTextLayer?: boolean; renderAnnotationLayer?: boolean }) => {
      mockPageRenderProps.push({ pageNumber, renderTextLayer, renderAnnotationLayer });
      return <div data-testid="pdf-page" data-page-number={pageNumber}>Page {pageNumber}</div>;
    },
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    getAccessToken: vi.fn().mockResolvedValue("token"),
  }),
}));

vi.mock("@/lib/driveCache", () => ({
  getCachedFile: vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" })),
  cacheFile: vi.fn().mockResolvedValue(undefined),
  evictCachedFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/drive", () => ({
  getDriveStreamUrl: vi.fn().mockReturnValue("http://localhost:8000/api/v1/drive/file/f1/stream"),
  getDrivePdfExportUrl: vi.fn().mockReturnValue("http://localhost:8000/api/v1/drive/file/f1/export-pdf"),
  saveDriveProgress: mocked.saveDriveProgress,
  saveDriveViewerTelemetry: mocked.saveDriveViewerTelemetry,
  createDriveBookmark: vi.fn().mockResolvedValue({ bookmarkId: "b1" }),
  deleteDriveBookmark: vi.fn().mockResolvedValue(undefined),
  formatFileSize: vi.fn().mockReturnValue("2.3 MB"),
  formatSeconds: vi.fn().mockReturnValue("0:00"),
  getFileTypeColor: vi.fn().mockReturnValue({ bg: "bg-coral-light", text: "text-coral", border: "border-coral" }),
  getFileTypeLabel: vi.fn().mockReturnValue("PDF"),
}));

const meta = {
  id: "f1",
  name: "Large Resource.pdf",
  mimeType: "application/pdf",
  fileType: "pdf",
  size: 1024,
  modifiedTime: null,
  createdTime: null,
  description: null,
  previewable: true,
  embedUrl: null,
  thumbnailUrl: null,
  webViewLink: "https://drive.google.com/file/d/f1/view",
  progress: { currentPage: 1, totalPages: 300 },
  bookmarks: [],
  pageNotes: [],
};

describe("ResourceViewer large PDF stability", () => {
  beforeEach(() => {
    mockPageRenderProps.length = 0;
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders a window of pages instead of mounting the whole document", async () => {
    render(
      <ResourceViewer
        meta={meta}
        loading={false}
        token="token"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-document")).toBeInTheDocument();
    });

    await waitFor(() => {
      const mountedPages = screen.getAllByTestId("pdf-page");
      expect(mountedPages.length).toBeGreaterThan(0);
      expect(mountedPages.length).toBeLessThanOrEqual(20);
    });

    const pageInput = screen.getByTitle("Current page");
    fireEvent.change(pageInput, { target: { value: "50" } });

    await waitFor(() => {
      const mountedPages = screen.getAllByTestId("pdf-page");
      expect(mountedPages.length).toBeLessThanOrEqual(20);
      expect(screen.getByText("Page 50")).toBeInTheDocument();
    });
  });

  it("emits telemetry snapshots for loaded sessions", async () => {
    render(
      <ResourceViewer
        meta={meta}
        loading={false}
        token="token"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mocked.saveDriveViewerTelemetry).toHaveBeenCalled();
    });

    const telemetryEvents = mocked.saveDriveViewerTelemetry.mock.calls.map((call) => call[0]?.eventType);
    expect(telemetryEvents).toContain("loaded");
  });

  it("disables heavy text and annotation layers on low-memory mobile mode", async () => {
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: 2,
    });

    (window as Window & { matchMedia: (query: string) => MediaQueryList }).matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    render(
      <ResourceViewer
        meta={meta}
        loading={false}
        token="token"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-document")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockPageRenderProps.length).toBeGreaterThan(0);
    });

    const hasHeavyLayer = mockPageRenderProps.some((p) => p.renderTextLayer || p.renderAnnotationLayer);
    expect(hasHeavyLayer).toBe(false);
  });
});

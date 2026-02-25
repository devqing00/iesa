import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "../Pagination";

describe("Pagination", () => {
  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPage={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders page buttons for small page count", () => {
    render(<Pagination page={1} totalPages={5} onPage={vi.fn()} />);
    // Should show 1 2 3 4 5 plus prev/next
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("highlights the current page", () => {
    render(<Pagination page={3} totalPages={5} onPage={vi.fn()} />);
    const btn = screen.getByText("3");
    expect(btn.className).toContain("bg-navy");
  });

  it("calls onPage with correct page number on click", () => {
    const onPage = vi.fn();
    render(<Pagination page={1} totalPages={5} onPage={onPage} />);
    fireEvent.click(screen.getByText("3"));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it("calls onPage with next page when clicking ›", () => {
    const onPage = vi.fn();
    render(<Pagination page={2} totalPages={5} onPage={onPage} />);
    fireEvent.click(screen.getByText("›"));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it("calls onPage with previous page when clicking ‹", () => {
    const onPage = vi.fn();
    render(<Pagination page={3} totalPages={5} onPage={onPage} />);
    fireEvent.click(screen.getByText("‹"));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("disables previous button on first page", () => {
    const onPage = vi.fn();
    render(<Pagination page={1} totalPages={5} onPage={onPage} />);
    const prevBtn = screen.getByText("‹");
    expect(prevBtn).toBeDisabled();
    fireEvent.click(prevBtn);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("disables next button on last page", () => {
    const onPage = vi.fn();
    render(<Pagination page={5} totalPages={5} onPage={onPage} />);
    const nextBtn = screen.getByText("›");
    expect(nextBtn).toBeDisabled();
    fireEvent.click(nextBtn);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("shows ellipsis for large page counts", () => {
    render(<Pagination page={5} totalPages={20} onPage={vi.fn()} />);
    const ellipses = screen.getAllByText("…");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
    // First and last pages should always be shown
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <Pagination page={1} totalPages={3} onPage={vi.fn()} className="mt-6" />
    );
    expect(container.firstElementChild?.className).toContain("mt-6");
  });
});

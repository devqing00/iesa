import { describe, it, expect } from "vitest";
import { buildQueryString, getApiUrl, API_BASE_URL, ApiRequestError, NetworkError, TimeoutError } from "../client";

describe("getApiUrl", () => {
  it("prepends API_BASE_URL to paths", () => {
    const url = getApiUrl("/api/v1/sessions/");
    expect(url).toBe(`${API_BASE_URL}/api/v1/sessions/`);
  });

  it("works with paths without leading slash", () => {
    const url = getApiUrl("health");
    expect(url).toBe(`${API_BASE_URL}health`);
  });
});

describe("buildQueryString", () => {
  it("builds query string from object", () => {
    const qs = buildQueryString({ page: 1, limit: 10, search: "test" });
    expect(qs).toContain("page=1");
    expect(qs).toContain("limit=10");
    expect(qs).toContain("search=test");
    expect(qs.startsWith("?")).toBe(true);
  });

  it("excludes null and undefined values", () => {
    const qs = buildQueryString({ a: "1", b: null, c: undefined, d: "4" });
    expect(qs).toContain("a=1");
    expect(qs).toContain("d=4");
    expect(qs).not.toContain("b=");
    expect(qs).not.toContain("c=");
  });

  it("excludes empty string values", () => {
    const qs = buildQueryString({ q: "", page: 1 });
    expect(qs).not.toContain("q=");
    expect(qs).toContain("page=1");
  });

  it("returns empty string when all values are empty", () => {
    const qs = buildQueryString({ a: null, b: undefined, c: "" });
    expect(qs).toBe("");
  });

  it("returns empty string for empty object", () => {
    const qs = buildQueryString({});
    expect(qs).toBe("");
  });

  it("converts numeric values to string", () => {
    const qs = buildQueryString({ count: 42 });
    expect(qs).toBe("?count=42");
  });

  it("converts boolean values to string", () => {
    const qs = buildQueryString({ active: true });
    expect(qs).toBe("?active=true");
  });
});

describe("Error Classes", () => {
  it("ApiRequestError has correct properties", () => {
    const error = new ApiRequestError(404, "Not found");
    expect(error.status).toBe(404);
    expect(error.detail).toBe("Not found");
    expect(error.message).toBe("Not found");
    expect(error.name).toBe("ApiRequestError");
    expect(error).toBeInstanceOf(Error);
  });

  it("NetworkError has default message", () => {
    const error = new NetworkError();
    expect(error.message).toContain("Network error");
    expect(error.name).toBe("NetworkError");
    expect(error).toBeInstanceOf(Error);
  });

  it("NetworkError accepts custom message", () => {
    const error = new NetworkError("Custom network message");
    expect(error.message).toBe("Custom network message");
  });

  it("TimeoutError has default message", () => {
    const error = new TimeoutError();
    expect(error.message).toContain("timed out");
    expect(error.name).toBe("TimeoutError");
    expect(error).toBeInstanceOf(Error);
  });

  it("TimeoutError accepts custom message", () => {
    const error = new TimeoutError("Custom timeout");
    expect(error.message).toBe("Custom timeout");
  });
});

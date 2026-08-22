import { describe, expect, it, vi } from "vitest";

import { checkDirectJobStatus } from "./job-status.server";

const URL = "https://careers.example.com/jobs/123";

function response(status: number, body = "") {
  return Promise.resolve(new Response(body, { status }));
}

describe("direct job status checks", () => {
  it.each([404, 410])("treats %s as expired", async (status) => {
    const result = await checkDirectJobStatus(
      URL,
      vi.fn(() => response(status)),
    );
    expect(result.status).toBe("expired");
  });

  it.each([403, 429])("treats %s as uncertain without retry bypass", async (status) => {
    const fetchImpl = vi.fn(() => response(status));
    const result = await checkDirectJobStatus(URL, fetchImpl);
    expect(result.status).toBe("uncertain");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("recognises explicit closed-page wording", async () => {
    const result = await checkDirectJobStatus(
      URL,
      vi.fn(() => response(200, "Applications are now closed for this vacancy.")),
    );
    expect(result.status).toBe("expired");
  });

  it("keeps an ambiguous successful page uncertain", async () => {
    const result = await checkDirectJobStatus(
      URL,
      vi.fn(() => response(200, "Welcome to our careers website.")),
    );
    expect(result.status).toBe("uncertain");
  });
});

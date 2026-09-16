import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("resolves conflicting Tailwind utilities, keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

import { describe, expect, it } from "vitest";

import { assertUniquePermissionKeys, PERMISSIONS } from "./permissions";

describe("PERMISSIONS", () => {
  it("has no duplicate keys", () => {
    expect(() => assertUniquePermissionKeys(PERMISSIONS)).not.toThrow();
  });

  it("uses dot-separated resource.action keys", () => {
    for (const permission of PERMISSIONS) {
      expect(permission.key).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  it("throws on a duplicate key", () => {
    const withDuplicate = [...PERMISSIONS, PERMISSIONS[0]!];
    expect(() => assertUniquePermissionKeys(withDuplicate)).toThrow(/Duplicate permission key/);
  });
});

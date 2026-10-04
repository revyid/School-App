import { describe, it, expect } from "vitest";
import { isValidSlug, schoolSlugFromHost } from "./school.js";

describe("isValidSlug", () => {
  it.each(["sman1", "a", "sdn-01-jakarta", "x".repeat(63)])("menerima %s", (s) => {
    expect(isValidSlug(s)).toBe(true);
  });
  it.each(["Admin", "SMAN1", "-sman1", "sman1-", "sma n1", "sman_1",
    "", "x".repeat(64), "admin", "www", "api", "mail", "static",
    "app", "login", "portal", "xn--sman1", "xn--a"])("menolak %s", (s) => {
    expect(isValidSlug(s)).toBe(false);
  });
});

describe("schoolSlugFromHost", () => {
  const apex = "domainmu.id";
  it("subdomain valid → slug", () => {
    expect(schoolSlugFromHost("sman1.domainmu.id", apex)).toBe("sman1");
    expect(schoolSlugFromHost("sman1.domainmu.id:443", apex)).toBe("sman1");
    expect(schoolSlugFromHost("SMAN1.DOMAINMU.ID", apex)).toBe("sman1");
  });
  it("apex telanjang / reservasi / asing / multi-level / tak valid → null", () => {
    expect(schoolSlugFromHost("domainmu.id", apex)).toBeNull();
    expect(schoolSlugFromHost("admin.domainmu.id", apex)).toBeNull();
    expect(schoolSlugFromHost("app.domainmu.id", apex)).toBeNull();
    expect(schoolSlugFromHost("login.domainmu.id", apex)).toBeNull();
    expect(schoolSlugFromHost("portal.domainmu.id", apex)).toBeNull();
    expect(schoolSlugFromHost("xn--sman1.domainmu.id", apex)).toBeNull();
    expect(schoolSlugFromHost("evil.com", apex)).toBeNull();
    expect(schoolSlugFromHost("a.b.domainmu.id", apex)).toBeNull();
    expect(schoolSlugFromHost("-sman1.domainmu.id", apex)).toBeNull();
    expect(schoolSlugFromHost("sman1.domainmu.id.evil.com", apex)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { FakeProvider } from "./fake-provider.js";
import { waJitterMs } from "./wa-queue.js";

describe("FakeProvider (tes otomatis; Baileys sungguhan tidak diuji otomatis)", () => {
  it("kirim tercatat; putus -> gagal", async () => {
    const p = new FakeProvider();
    const r = await p.send("6281", "halo");
    expect(r.ok).toBe(true);
    expect(p.sent).toHaveLength(1);
    expect(p.name).toBe("fake");
    p.connected = false;
    const r2 = await p.send("6281", "halo2");
    expect(r2.ok).toBe(false);
    expect(p.sent).toHaveLength(1);
    expect((await p.status()).connected).toBe(false);
  });
});

describe("waJitterMs", () => {
  it("rentang 3-10 detik", () => {
    for (let i = 0; i < 50; i++) {
      const v = waJitterMs();
      expect(v).toBeGreaterThanOrEqual(3000);
      expect(v).toBeLessThanOrEqual(10000);
    }
  });
});

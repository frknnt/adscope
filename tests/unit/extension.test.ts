import { describe, expect, it } from "vitest";
import { bulkUrl, checkUrl, MAX_VARIANTS, normalizeSite, selectionLines } from "../../extension/shared.js";
import manifest from "../../extension/manifest.json";

describe("browser extension", () => {
  it("accepts only https sites (http only for localhost)", () => {
    expect(normalizeSite("https://adscope.example.com/panel")).toBe("https://adscope.example.com");
    expect(normalizeSite("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeSite("http://adscope.example.com")).toBeNull();
    expect(normalizeSite("javascript:alert(1)")).toBeNull();
    expect(normalizeSite("https://user:pw@adscope.example.com")).toBeNull();
  });

  it("puts the ad text in the fragment, never the query", () => {
    const url = new URL(checkUrl("https://a.example", { text: "Kilo vermenin en kolay yolu!", landing: "https://shop.example/p" }));
    expect(url.pathname).toBe("/panel/yeni");
    expect(url.search).toBe("");
    const p = new URLSearchParams(url.hash.slice(1));
    expect(p.get("metin")).toBe("Kilo vermenin en kolay yolu!");
    expect(p.get("url")).toBe("https://shop.example/p");
    expect(checkUrl("https://a.example", { text: "x".repeat(5000) }).length).toBeLessThan(2400 + 100);
  });

  it("sends only the selected lines to the platform-variant check, in the fragment", () => {
    const url = new URL(bulkUrl("https://a.example", "Yazın en hafif desteği\r\n\n  7 günde fark gör  \nx\n"));
    expect(url.pathname).toBe("/panel/toplu");
    expect(url.search).toBe("?mod=varyant");
    expect(new URLSearchParams(url.hash.slice(1)).get("metin")).toBe("Yazın en hafif desteği\n7 günde fark gör");
    expect(selectionLines(Array.from({ length: 30 }, (_, i) => `Varyant ${i}`).join("\n"))).toHaveLength(MAX_VARIANTS);
    expect(bulkUrl("https://a.example", "")).toBe("https://a.example/panel/toplu?mod=varyant");
  });

  it("asks for the minimum permissions", () => {
    expect(manifest.manifest_version).toBe(3);
    expect([...manifest.permissions].sort()).toEqual(["contextMenus", "storage"]);
    expect(manifest).not.toHaveProperty("host_permissions");
    expect(manifest).not.toHaveProperty("content_scripts");
  });
});

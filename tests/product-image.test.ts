import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductImage } from "@/components/product-image";
import { renderDigest } from "@/lib/email";
import { digestProductImageHtml, productImageMode, safeImageUrl } from "@/lib/product-image";
import { MOCK_CATALOG } from "@/lib/providers/mock-catalog";
import { parseRakutenProducts } from "@/lib/providers/parse-rakuten";

describe("product image fallback", () => {
  it("uses the placeholder when the image URL is missing", () => {
    expect(productImageMode("", false)).toBe("placeholder");
    expect(productImageMode("   ", false)).toBe("placeholder");
    expect(productImageMode(null, false)).toBe("placeholder");
    expect(safeImageUrl("javascript:alert(1)")).toBe("");

    const html = renderToStaticMarkup(createElement(ProductImage, { src: "", alt: "Handmade Ceramic Mug" }));
    expect(html).toContain('data-product-image="placeholder"');
    expect(html).toContain('aria-label="Handmade Ceramic Mug"');
    expect(html).not.toContain("<img");
  });

  it("uses the placeholder when the image fails to load", () => {
    const src = "https://cdn.example.com/mug.jpg";
    expect(productImageMode(src, false)).toBe("photo");
    expect(productImageMode(src, true)).toBe("placeholder");
  });

  it("keeps a usable photo URL and names the product", () => {
    const html = renderToStaticMarkup(
      createElement(ProductImage, { src: "/products/mug.svg", alt: "Handmade Ceramic Mug" }),
    );
    expect(html).toContain('alt="Handmade Ceramic Mug"');
    expect(html).toContain("/products/mug.svg");
    expect(html).not.toContain('data-product-image="placeholder"');
  });
});

describe("digest product image", () => {
  it("embeds the photo and falls back when the URL is missing", () => {
    const rendered = renderDigest({
      personName: "Maya Chen",
      occasionTitle: "Birthday",
      whenLabel: "14 days",
      budgetCents: 4000,
      deals: [
        {
          title: "Handmade Ceramic Mug",
          store: "Uncommon Goods",
          priceCents: 3600,
          cashbackPercent: 15,
          effectivePriceCents: 3060,
          link: "https://example.com/mug",
          whyMatched: "Fits.",
          imageUrl: "https://cdn.example.com/mug.jpg",
        },
        {
          title: "Brass Fountain Pen",
          store: "JetPens",
          priceCents: 3400,
          cashbackPercent: 0,
          effectivePriceCents: 3400,
          link: "https://example.com/pen",
          whyMatched: "Fits.",
          imageUrl: "  ",
        },
      ],
    });
    expect(rendered.html).toContain('alt="Handmade Ceramic Mug"');
    expect(rendered.html).toContain("https://cdn.example.com/mug.jpg");
    expect(rendered.html).toContain('data-product-image="placeholder"');
    expect(rendered.html).toContain('aria-label="Brass Fountain Pen"');
    expect(rendered.html).not.toMatch(/<img[^>]*src="\s*"/);
    expect(digestProductImageHtml("Wool socks", "")).toContain('data-product-image="placeholder"');
  });
});

describe("provider and sample image urls", () => {
  it("reads imageurl from Rakuten product search", () => {
    const parsed = parseRakutenProducts(`<result><item>
      <productname>Wool socks</productname>
      <price currency="USD">20.00</price>
      <linkurl>https://click.linksynergy.com/socks</linkurl>
      <imageurl> https://cdn.example.com/socks.jpg </imageurl>
    </item></result>`);
    expect(parsed[0].imageUrl).toBe("https://cdn.example.com/socks.jpg");
  });

  it("points every sample product at a local placeholder image", () => {
    expect(MOCK_CATALOG.length).toBeGreaterThan(0);
    for (const item of MOCK_CATALOG) {
      expect(item.imageUrl).toMatch(/^\/products\/.+\.svg$/);
    }
  });
});

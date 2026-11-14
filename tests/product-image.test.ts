// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ProductImage } from "@/components/product-image";
import { renderDigest } from "@/lib/email";
import { digestProductImageHtml, productImageMode, safeImageUrl } from "@/lib/product-image";
import { MOCK_CATALOG } from "@/lib/providers/mock-catalog";
import { parseRakutenProducts } from "@/lib/providers/parse-rakuten";

describe("product image fallback", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = undefined;
    host = undefined;
  });

  async function renderImage(src: string, alt: string) {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    act(() => {
      root?.unmount();
    });
    host?.remove();
    host = document.createElement("div");
    host.style.position = "relative";
    host.style.width = "120px";
    host.style.height = "90px";
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(createElement(ProductImage, { src, alt }));
    });
    return host;
  }

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

  it("uses the placeholder when the image fails to load", async () => {
    const src = "https://cdn.example.com/mug.jpg";
    expect(productImageMode(src, false)).toBe("photo");
    expect(productImageMode(src, true)).toBe("placeholder");

    const alt = "Handmade Ceramic Mug";
    const working = await renderImage("/products/mug.svg", alt);
    const photo = working.querySelector("img");
    expect(photo).not.toBeNull();
    expect(photo?.getAttribute("alt")).toBe(alt);
    expect(photo?.getAttribute("src")).toContain("/products/mug.svg");
    expect(working.querySelector('[data-product-image="placeholder"]')).toBeNull();

    const broken = await renderImage("/products/missing-r2.svg", alt);
    const img = broken.querySelector("img");
    expect(img).not.toBeNull();
    await act(async () => {
      img?.dispatchEvent(new Event("error"));
    });
    const placeholder = broken.querySelector('[data-product-image="placeholder"]');
    const empty = renderToStaticMarkup(createElement(ProductImage, { src: "", alt }));
    expect(placeholder).not.toBeNull();
    expect(placeholder?.outerHTML).toBe(empty);
    expect(broken.querySelector("img")).toBeNull();
  });

  it("uses the placeholder when a missed load error left no pixels", async () => {
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = () => Promise.reject(new DOMException("broken", "EncodingError"));
    try {
      const view = await renderImage("/products/missing-r2.svg", "Wool socks");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      const placeholder = view.querySelector('[data-product-image="placeholder"]');
      expect(placeholder?.getAttribute("aria-label")).toBe("Wool socks");
      expect(placeholder?.getAttribute("data-product-image")).toBe("placeholder");
      expect(view.querySelector("img")).toBeNull();
    } finally {
      HTMLImageElement.prototype.decode = original;
    }
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

  it("uses the placeholder for a site-relative path and embeds an https photo", () => {
    const local = digestProductImageHtml("Handmade Ceramic Mug", "/products/mug.svg");
    expect(local).toContain('data-product-image="placeholder"');
    expect(local).toContain('aria-label="Handmade Ceramic Mug"');
    expect(local).not.toContain("<img");
    expect(local).not.toContain("/products/mug.svg");

    const remote = digestProductImageHtml("Handmade Ceramic Mug", "https://cdn.example.com/mug.jpg");
    expect(remote).toContain('data-product-image="photo"');
    expect(remote).toContain('src="https://cdn.example.com/mug.jpg"');
    expect(remote).toContain('alt="Handmade Ceramic Mug"');

    const httpPhoto = digestProductImageHtml("Wool socks", "http://cdn.example.com/socks.jpg");
    expect(httpPhoto).toContain('src="http://cdn.example.com/socks.jpg"');
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

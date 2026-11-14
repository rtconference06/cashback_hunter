"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { productImageMode, safeImageUrl } from "@/lib/product-image";

export function ProductImage({ src, alt }: { src: string; alt: string }) {
  const safe = safeImageUrl(src);
  const label = alt.trim() || "Product";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const failed = failedSrc === safe;

  useEffect(() => {
    const img = imgRef.current;
    // A 404 can finish before hydration, and React does not replay that error.
    // naturalWidth is also 0 for some loaded SVGs, so confirm with decode().
    if (!img || !img.complete || img.naturalWidth !== 0 || typeof img.decode !== "function") return;
    let active = true;
    img.decode().catch(() => {
      if (active) setFailedSrc(safe);
    });
    return () => {
      active = false;
    };
  }, [safe]);

  if (productImageMode(safe, failed) === "placeholder") {
    return <ProductPlaceholder label={label} />;
  }
  return (
    <Image
      ref={imgRef}
      src={safe}
      alt={label}
      fill
      unoptimized
      sizes="240px"
      className="object-contain p-2"
      onError={() => setFailedSrc(safe)}
    />
  );
}

function ProductPlaceholder({ label }: { label: string }) {
  const initial = (label.slice(0, 1) || "G").toUpperCase();
  return (
    <div
      role="img"
      aria-label={label}
      data-product-image="placeholder"
      className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#F6EEFB] text-[#8529CD]"
    >
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="5" y="13" width="22" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 17h22M16 13v13" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 13c0-3-2.2-5-5-5-2 2.2-1.2 5 5 5Zm0 0c0-3 2.2-5 5-5 2 2.2 1.2 5-5 5Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span className="text-xs font-bold leading-none">{initial}</span>
    </div>
  );
}

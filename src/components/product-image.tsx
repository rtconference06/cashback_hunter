"use client";

import Image from "next/image";
import { useState } from "react";
import { productImageMode, safeImageUrl } from "@/lib/product-image";

export function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const safe = safeImageUrl(src);
  const label = alt.trim() || "Product";
  if (productImageMode(safe, failed) === "placeholder") {
    return <ProductPlaceholder label={label} />;
  }
  return (
    <Image
      src={safe}
      alt={label}
      fill
      unoptimized
      sizes="240px"
      className="object-contain p-2"
      onError={() => setFailed(true)}
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

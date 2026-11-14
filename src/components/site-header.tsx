"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/people", label: "People" },
  { href: "/occasions", label: "Occasions" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/history", label: "History" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.get("q") ?? "";

  return (
    <header className="border-b border-[#DDDDDD] bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-8">
          <Link href="/people" className="flex items-center gap-2 text-[#8529CD]">
            <BagIcon />
            <span className="text-xl font-bold tracking-tight">Gift Hunter</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-6">
            {links.map((link) => {
              const active =
                link.href === "/people"
                  ? pathname === "/people" || pathname.startsWith("/people/")
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "border-b-2 pb-1 text-sm font-semibold",
                    active ? "border-[#8529CD] text-[#8529CD]" : "border-transparent text-[#252525] hover:text-[#8529CD]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <form action="/people" className="relative w-full lg:w-64">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#575757]">
            <SearchIcon />
          </span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Search"
            aria-label="Search people"
            className="h-10 w-full rounded-lg border border-[#DDDDDD] bg-white pl-9 pr-3 text-sm text-[#252525] outline-none placeholder:text-[#575757]"
          />
        </form>
      </div>
    </header>
  );
}

function BagIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#8529CD" />
      <path d="M9 11.5h10l-.7 8.2a1 1 0 0 1-1 .8H10.7a1 1 0 0 1-1-.8L9 11.5Z" fill="white" />
      <path d="M11.5 11.2V9.8a2.5 2.5 0 0 1 5 0v1.4" fill="none" stroke="white" strokeWidth="1.4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

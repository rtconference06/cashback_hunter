import { safeHttpHref } from "@/lib/links";

export function PurchaseLink({ link, className }: { link: string; className?: string }) {
  const href = safeHttpHref(link);
  if (!href) return null;
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {href}
    </a>
  );
}

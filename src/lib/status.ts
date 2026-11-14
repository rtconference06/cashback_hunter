import { hasRakutenCredentials } from "@/lib/providers/rakuten";

export function providerStatusLabel(): string {
  return hasRakutenCredentials(process.env) ? "Rakuten Advertising" : "Sample catalog";
}

export function emailStatusLabel(): string {
  const mode = (process.env.EMAIL_PROVIDER || "log").toLowerCase();
  if (mode === "smtp" && process.env.SMTP_HOST?.trim()) return "Email via SMTP";
  if (mode === "resend" && process.env.RESEND_API_KEY?.trim()) return "Email via Resend";
  return "Email log";
}

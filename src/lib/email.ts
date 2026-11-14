import { displayStore, UNKNOWN_STORE } from "@/lib/deals";
import { safeHttpHref } from "@/lib/links";
import { formatMoney, formatPercent } from "@/lib/money";
import { digestProductImageHtml } from "@/lib/product-image";

export type DigestDeal = {
  title: string;
  store: string;
  priceCents: number;
  cashbackPercent: number;
  effectivePriceCents: number;
  link: string;
  whyMatched: string;
  imageUrl?: string;
};

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailEnv = {
  [key: string]: string | undefined;
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  RESEND_API_KEY?: string;
  DIGEST_TO?: string;
  OWNER_EMAIL?: string;
};

export function digestRecipient(env: EmailEnv = process.env): string {
  return env.DIGEST_TO?.trim() || env.OWNER_EMAIL?.trim() || "owner@localhost";
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderDigest(input: {
  personName: string;
  occasionTitle: string;
  whenLabel: string;
  budgetCents: number;
  deals: DigestDeal[];
}): { subject: string; text: string; html: string } {
  const subject = `Gift Hunter: ${input.personName} — ${input.occasionTitle} (${input.whenLabel})`;
  const lines = [
    `${input.occasionTitle} for ${input.personName} is ${input.whenLabel}.`,
    `Budget ${formatMoney(input.budgetCents)} after cashback.`,
    "",
    ...input.deals.map((deal, index) => {
      const store = displayStore(deal.store);
      return [
        `${index + 1}. ${deal.title}`,
        `Store: ${store}`,
        `Price ${formatMoney(deal.priceCents)} · Cashback ${formatPercent(deal.cashbackPercent)} · You pay ${formatMoney(deal.effectivePriceCents)}`,
        deal.link,
        deal.whyMatched,
        "",
      ].join("\n");
    }),
  ];
  const text = lines.join("\n").trim();
  const items = input.deals
    .map((deal) => {
      const store = displayStore(deal.store);
      const href = safeHttpHref(deal.link);
      const linkHtml = href ? `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a><br/>` : "";
      return `<li>${digestProductImageHtml(deal.title, deal.imageUrl)}<br/><strong>${escapeHtml(deal.title)}</strong><br/>Store: ${escapeHtml(store)}<br/>Price ${escapeHtml(formatMoney(deal.priceCents))} · Cashback ${escapeHtml(formatPercent(deal.cashbackPercent))} · You pay ${escapeHtml(formatMoney(deal.effectivePriceCents))}<br/>${linkHtml}${escapeHtml(deal.whyMatched)}</li>`;
    })
    .join("");
  const html = `<p>${escapeHtml(input.occasionTitle)} for ${escapeHtml(input.personName)} is ${escapeHtml(input.whenLabel)}. Budget ${escapeHtml(formatMoney(input.budgetCents))} after cashback.</p><ol>${items}</ol>`;
  return { subject, text, html };
}

export function formatLoggedEmail(email: OutboundEmail): string {
  return [
    "[gift-hunter] email logged (no email provider configured)",
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    "",
    email.text,
  ].join("\n");
}

function emailConfigured(env: EmailEnv): "smtp" | "resend" | "log" {
  const mode = (env.EMAIL_PROVIDER || "log").toLowerCase();
  if (mode === "smtp" && env.SMTP_HOST?.trim()) return "smtp";
  if (mode === "resend" && env.RESEND_API_KEY?.trim()) return "resend";
  return "log";
}

export async function deliverEmail(
  email: OutboundEmail,
  env: EmailEnv = process.env,
  log: (message: string) => void = console.info,
): Promise<{ provider: string; status: "sent" | "logged" | "failed"; error: string }> {
  const mode = emailConfigured(env);
  if (mode === "smtp") {
    try {
      const { sendSmtp } = await import("@/lib/email-smtp");
      await sendSmtp(email, env);
      return { provider: "smtp", status: "sent", error: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed.";
      return { provider: "smtp", status: "failed", error: message };
    }
  }
  if (mode === "resend") {
    try {
      await sendResend(email, env);
      return { provider: "resend", status: "sent", error: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resend send failed.";
      return { provider: "resend", status: "failed", error: message };
    }
  }
  log(formatLoggedEmail(email));
  return { provider: "log", status: "logged", error: "" };
}

async function sendResend(email: OutboundEmail, env: EmailEnv) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM?.trim() || "Gift Hunter <hunter@localhost>",
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend failed (${response.status}). ${(await response.text()).slice(0, 180)}`);
  }
}

export { UNKNOWN_STORE };

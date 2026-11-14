import nodemailer from "nodemailer";
import type { EmailEnv, OutboundEmail } from "@/lib/email";

export async function sendSmtp(email: OutboundEmail, env: EmailEnv) {
  const port = Number(env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: env.EMAIL_FROM?.trim() || "Gift Hunter <hunter@localhost>",
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

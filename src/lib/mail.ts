import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

/**
 * Transactional email.
 *
 * With no RESEND_API_KEY the app does not fail — it logs the link to the server
 * console instead. That keeps signup and password reset fully testable on a
 * fresh clone before anyone has signed up for an email provider.
 */

let resend: Resend | undefined;

type Mail = { to: string; subject: string; html: string; text: string };

async function send({ to, subject, html, text }: Mail) {
  if (!env.mail.apiKey) {
    console.info(
      `\n[mail] RESEND_API_KEY is not set — email not sent.\n` +
        `  to:      ${to}\n  subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}\n`,
    );
    return { delivered: false as const };
  }

  try {
    resend ??= new Resend(env.mail.apiKey);
    await resend.emails.send({ from: env.mail.from, to, subject, html, text });
    return { delivered: true as const };
  } catch (error) {
    // A mail outage must not turn a successful signup into a 500.
    console.error("[mail] delivery failed", error);
    return { delivered: false as const };
  }
}

function layout(heading: string, body: string, cta: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#0b0b12;padding:32px;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#14141f;border-radius:16px;padding:32px;color:#e7e7f0">
    <tr><td>
      <p style="margin:0 0 4px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8b5cf6">SingPlay</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:#fff">${heading}</h1>
      <p style="margin:0 0 24px;line-height:1.6;color:#b6b6c8">${body}</p>
      <a href="${cta.href}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${cta.label}</a>
      <p style="margin:24px 0 0;font-size:12px;color:#6c6c82;word-break:break-all">Or paste this into your browser:<br>${cta.href}</p>
    </td></tr>
  </table></body></html>`;
}

export function sendVerificationEmail(to: string, token: string) {
  const href = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return send({
    to,
    subject: "Confirm your SingPlay account",
    html: layout(
      "Confirm your email",
      "You're one click away from full playback, playlists, karaoke mode and your own DJ decks.",
      { href, label: "Verify my email" },
    ),
    text: `Confirm your SingPlay account: ${href}\nThis link expires in 24 hours.`,
  });
}

export function sendPasswordResetEmail(to: string, token: string) {
  const href = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return send({
    to,
    subject: "Reset your SingPlay password",
    html: layout(
      "Reset your password",
      "Use the button below to choose a new password. If you didn't ask for this, you can safely ignore this email.",
      { href, label: "Choose a new password" },
    ),
    text: `Reset your SingPlay password: ${href}\nThis link expires in 1 hour.`,
  });
}

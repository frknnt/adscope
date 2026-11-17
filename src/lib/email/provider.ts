import "server-only";
import { appMode } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Same key = same e-mail; the provider drops a repeated send. */
  idempotencyKey: string;
}

export type EmailResult = { ok: true; id: string | null } | { ok: false; reason: "not_configured" | "api_error" | "timeout" };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

/**
 * Resend (https://resend.com) over plain HTTPS. Enabled when RESEND_API_KEY and EMAIL_FROM are set.
 * Message bodies are never logged.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private apiKey = process.env.RESEND_API_KEY,
    private from = process.env.EMAIL_FROM,
    private baseUrl = (process.env.RESEND_BASE_URL || "https://api.resend.com").replace(/\/+$/, ""),
  ) {}

  get enabled() {
    return Boolean(this.apiKey && this.from);
  }

  async send(m: EmailMessage): Promise<EmailResult> {
    if (!this.enabled) return { ok: false, reason: "not_configured" };
    try {
      const res = await fetch(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": m.idempotencyKey.slice(0, 256) },
        body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { ok: false, reason: "api_error" };
      const data = (await res.json().catch(() => null)) as { id?: unknown } | null;
      return { ok: true, id: typeof data?.id === "string" ? data.id : null };
    } catch (e) {
      return { ok: false, reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "api_error" };
    }
  }
}

/** Demo mode only: keeps sent e-mails in process memory so the flow can be tried and tested without an account. */
export class MemoryOutbox implements EmailProvider {
  readonly name = "demo-outbox";
  static messages(): EmailMessage[] {
    const g = globalThis as unknown as { __adscopeOutbox?: EmailMessage[] };
    return (g.__adscopeOutbox ??= []);
  }
  async send(m: EmailMessage): Promise<EmailResult> {
    const box = MemoryOutbox.messages();
    if (!box.some((x) => x.idempotencyKey === m.idempotencyKey)) box.push(m);
    return { ok: true, id: null };
  }
}

export function getEmailProvider(): EmailProvider | null {
  const resend = new ResendEmailProvider();
  if (resend.enabled) return resend;
  return appMode() === "demo" ? new MemoryOutbox() : null;
}

/** True when real e-mail can be sent (not the demo outbox). */
export function emailConfigured() {
  return new ResendEmailProvider().enabled;
}

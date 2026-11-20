"use server";

import { revalidatePath } from "next/cache";
import { submitApprovalForm, type ApprovalFormResult } from "@/lib/approval/service";
import { TOKEN_RE } from "@/lib/security/tokens";

export type ApprovalState = { status: "idle" } | ApprovalFormResult;

/** Customer decisions behind a client approval link. No session; the token is verified again here. */
export async function submitApprovalAction(token: string, _prev: ApprovalState, form: FormData): Promise<ApprovalState> {
  // Honeypot: real people never fill this hidden field.
  if (String(form.get("website") ?? "")) return { ok: true, message: "Teşekkürler." };
  const res = await submitApprovalForm(token, form);
  if (res.ok && TOKEN_RE.test(token)) revalidatePath(`/onay/${token}`);
  return res;
}

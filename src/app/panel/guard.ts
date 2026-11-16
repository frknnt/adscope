import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data";

/** Pages render in parallel with the layout, so each page checks the session itself too. */
export async function requirePanelUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  return user;
}

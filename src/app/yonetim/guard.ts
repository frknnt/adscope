import "server-only";
import { notFound } from "next/navigation";
import { getAdminRepo, getCurrentUser } from "@/lib/data";

/**
 * Admin pages exist only for users whose app_metadata.role is "admin", read on the server with the
 * secret key. Everyone else (signed out included) gets a plain 404, so the area is not advertised.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) notFound();
  const role = await getAdminRepo().getAppRole(user.id);
  if (role !== "admin") notFound();
  return user;
}

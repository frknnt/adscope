import { NextResponse } from "next/server";
import { getCurrentUser, getRepo } from "@/lib/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A file of the caller's own generation (creative download, product photo, tool output). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await ctx.params;
  const i = Number(index);
  if (!UUID.test(id) || !Number.isInteger(i) || i < 0 || i > 20 || !(await getCurrentUser())) return new NextResponse(null, { status: 404 });
  const repo = getRepo();
  const gen = await repo.getGeneration(id);
  const entry = (Array.isArray(gen?.output.files) ? (gen!.output.files as { path?: string; name?: string }[]) : [])[i];
  if (!gen || !entry?.path) return new NextResponse(null, { status: 404 });
  const file = await repo.readGenerationFile(id, entry.path);
  if (!file) return new NextResponse(null, { status: 404 });
  const name = (entry.name ?? "adscope-dosya").replace(/[^a-z0-9._-]/gi, "-");
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

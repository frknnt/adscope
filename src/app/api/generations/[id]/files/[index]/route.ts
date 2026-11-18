import { NextResponse } from "next/server";
import { getCurrentUser, getRepo } from "@/lib/data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A file of the caller's own generation (creative download, product photo, tool output). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
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
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Accept-Ranges": "bytes",
  };
  // Byte ranges, so the browser's video player (Safari in particular) can play generated videos.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  const size = file.bytes.byteLength;
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new NextResponse(Buffer.from(file.bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}` } });
  }
  return new NextResponse(Buffer.from(file.bytes), { headers });
}

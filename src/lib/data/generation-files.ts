/** Storage paths a generation output points to (files[].path). */
export function generationFiles(output: Record<string, unknown>): string[] {
  const files = Array.isArray(output.files) ? (output.files as { path?: unknown }[]) : [];
  return files.map((f) => f.path).filter((p): p is string => typeof p === "string");
}

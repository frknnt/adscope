/**
 * Error report scrubbing (P7.3). Error monitoring must never receive ad creatives, personal data or
 * secrets, so only the error class, a scrubbed message, a scrubbed stack and the route pattern leave
 * the server. Request bodies, headers, cookies, query strings and user ids are never attached.
 */
const PATTERNS: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  [/\b(?:ads_live|whsec|sk|pk|rk|sb_secret|sb_publishable)_[A-Za-z0-9_-]{8,}/g, "[secret]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[jwt]"],
  [/\bBearer\s+\S+/gi, "Bearer [secret]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]"],
  [/\b(?:\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g, "[phone]"],
  [/\b\d{11}\b/g, "[number]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]"],
  [/https?:\/\/[^\s"')]+/gi, "[url]"],
  [/"[^"]{40,}"/g, '"[text]"'],
];

export function scrubText(input: string, max = 300) {
  let s = input;
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function scrubStack(stack: string | undefined) {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .slice(0, 12)
    .map((l) => scrubText(l, 200))
    .join("\n");
}

/** Route pattern only (e.g. "/panel/analiz/[id]"), never the concrete path or query. */
export function routeOf(path: string | undefined) {
  if (!path) return "unknown";
  return path.split("?")[0].replace(/\/[0-9a-f-]{16,}(?=\/|$)/gi, "/[id]").replace(/\/\d+(?=\/|$)/g, "/[n]").slice(0, 120);
}

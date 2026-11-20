import { createMcpHandler } from "@modelcontextprotocol/server";
import { authenticate } from "@/lib/api/v1";
import { buildMcpServer, type McpContext } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Remote MCP server (Streamable HTTP, stateless). Authentication, rate limit and usage counting are
 * the corporate API's: "Authorization: Bearer ads_live_…", 30 requests a minute per key.
 */
const handler = createMcpHandler(
  ({ authInfo }) => {
    const ctx = authInfo?.extra?.adscope as McpContext | undefined;
    if (!ctx) throw new Error("unauthenticated");
    return buildMcpServer(ctx);
  },
  { legacy: "stateless", responseMode: "json", maxRequestBodySize: 64 * 1024, onerror: () => console.error("[mcp] request rejected") },
);

async function serve(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) {
    if (auth.status === 401) auth.headers.set("WWW-Authenticate", 'Bearer realm="adscope", error="invalid_token"');
    return auth;
  }
  const res = await handler.fetch(req, { authInfo: { token: "api-key", clientId: auth.user.id, scopes: [], extra: { adscope: auth satisfies McpContext } } });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;

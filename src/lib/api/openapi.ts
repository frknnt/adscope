import { z } from "zod";
import { AnalysisRequestSchema, AnalysisResponseSchema, ErrorSchema, WebhookEventSchema } from "./schemas";

const json = (schema: z.ZodType, io: "input" | "output" = "output") => z.toJSONSchema(schema, { target: "draft-2020-12", io, unrepresentable: "any" });

const errorResponse = (description: string) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });

/** OpenAPI 3.1 document of the enterprise API, generated from the same Zod schemas the routes use. */
export function openApiDocument(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "AdScope API",
      version: "1.0.0",
      description:
        "Reklam ön kontrolü için kurumsal API. Sonuçlar risk değerlendirmesidir, hukuki görüş değildir. Kimlik doğrulama: `Authorization: Bearer ads_live_…`. Dakikada 30 istek. Webhook imzası: `X-AdScope-Signature: t=<unix>,v1=<HMAC-SHA256(secret, t + \".\" + gövde)>`.",
    },
    servers: [{ url: baseUrl }],
    security: [{ bearer: [] }],
    paths: {
      "/api/v1/analyses": {
        post: {
          summary: "Görsel reklamı kontrol et",
          description: "Panelle aynı kurallar ve aynı kredi kuralı geçerlidir: kredi yalnızca analiz başarıyla bitince düşer. Aynı client_request_id aynı raporu döndürür.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AnalysisRequest" } } } },
          responses: {
            "201": { description: "Rapor hazır", content: { "application/json": { schema: { type: "object", properties: { ok: { const: true }, reused: { type: "boolean" }, analysis: { $ref: "#/components/schemas/Analysis" } } } } } },
            "200": { description: "Aynı istek kimliğiyle önceki rapor" },
            "400": errorResponse("Geçersiz istek"),
            "401": errorResponse("API anahtarı yok ya da geçersiz"),
            "402": errorResponse("Yetersiz kredi"),
            "413": errorResponse("İstek çok büyük"),
            "429": errorResponse("Hız sınırı aşıldı (Retry-After başlığına bakın)"),
          },
        },
        get: {
          summary: "Son analizleri listele",
          responses: { "200": { description: "En fazla 50 özet" }, "401": errorResponse("API anahtarı yok ya da geçersiz") },
        },
      },
      "/api/v1/analyses/{id}": {
        get: {
          summary: "Bir raporu getir",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Rapor", content: { "application/json": { schema: { type: "object", properties: { ok: { const: true }, analysis: { $ref: "#/components/schemas/Analysis" } } } } } },
            "404": errorResponse("Bulunamadı"),
          },
        },
      },
    },
    webhooks: {
      "analysis.completed": {
        post: {
          summary: "Analiz tamamlandı",
          description: "Panelde tanımlı adrese gönderilir. Reklam metni gönderilmez; raporu API ile çekin. 2xx dışındaki yanıtlar 5 kez yeniden denenir (1 dk, 5 dk, 30 dk, 2 sa, 6 sa).",
          parameters: [{ name: "X-AdScope-Signature", in: "header", required: true, schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookEvent" } } } },
          responses: { "200": { description: "Alındı" } },
        },
      },
    },
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Panel > API bölümünden oluşturulan ads_live_ anahtarı" } },
      schemas: {
        AnalysisRequest: json(AnalysisRequestSchema, "input"),
        Analysis: json(AnalysisResponseSchema),
        Error: json(ErrorSchema),
        WebhookEvent: json(WebhookEventSchema),
      },
    },
  };
}

/**
 * Credit cost of each provider-backed image operation. Kept apart from the credit packages so a
 * provider price change only touches this table.
 *
 * Basis (17.11.2026, to be confirmed against https://www.photoroom.com/api/pricing, which could not
 * be read from our environment): Photoroom bills a background removal as one Remove Background call
 * and every Image Editing call (new background, upscale) as five; failed calls are not billed. One
 * AdScope credit sells for about 3.7–6.6 TL depending on the package. Costs below cover the provider
 * price with a margin; local tools (resize, crop, watermark) are free.
 */
export const IMAGE_OPS = {
  remove_background: { credits: 1, providerCalls: 1, label: "Arka plan kaldırma" },
  upscale: { credits: 2, providerCalls: 1, label: "Büyütme" },
  product_scene: { credits: 5, providerCalls: 4, label: "Ürün sahnesi (4 sonuç)" },
} as const;

export type ImageOp = keyof typeof IMAGE_OPS;

export function imageOpCost(op: ImageOp): number {
  return IMAGE_OPS[op].credits;
}

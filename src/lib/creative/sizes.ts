export const CREATIVE_SIZES = {
  kare: { w: 1080, h: 1080, label: "Kare 1:1", hint: "Akış (1080×1080)" },
  dikey: { w: 1080, h: 1350, label: "Dikey 4:5", hint: "Akış (1080×1350)" },
  hikaye: { w: 1080, h: 1920, label: "Hikâye 9:16", hint: "Hikâye ve Reels (1080×1920)" },
  yatay: { w: 1200, h: 628, label: "Yatay 1.91:1", hint: "Bağlantı ve görüntülü reklam (1200×628)" },
} as const;

export type CreativeSizeId = keyof typeof CREATIVE_SIZES;
export const CREATIVE_SIZE_IDS = Object.keys(CREATIVE_SIZES) as [CreativeSizeId, ...CreativeSizeId[]];

/**
 * 9:16 safe area: profile name, buttons and caption cover the top ~250 px and bottom ~340 px of a
 * 1080×1920 story, so text and logos should stay out of those bands (Meta's published guidance for
 * Stories and Reels; TikTok's interface covers a similar area).
 */
export const STORY_UNSAFE = { top: 250, bottom: 340 } as const;

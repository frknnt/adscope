import { CREATIVE_CREDIT_COST } from "@/lib/creative/costs";

/** Texts suggested in one campaign package and how many of them become creatives. */
export const CAMPAIGN_VARIANT_COUNT = 10;
export const CAMPAIGN_PICK = 3;
/** Text cost of a package (same as one AI copy run). */
export const CAMPAIGN_COPY_PART = 1;

/**
 * One price for the whole package (P9.1): every preview is free, the ZIP costs this once. It never
 * goes below what the parts cost on their own: one copy run plus one creative set (all four sizes)
 * per picked text. The short video is rendered in the browser and adds no cost.
 */
export const CAMPAIGN_PACKAGE_CREDIT_COST = CAMPAIGN_COPY_PART + CAMPAIGN_PICK * CREATIVE_CREDIT_COST;

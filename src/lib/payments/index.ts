import "server-only";
import { LemonSqueezyProvider } from "./lemonsqueezy";
import { ShopierProvider } from "./shopier";
import type { PaymentProvider } from "./provider";

export function getPaymentProviders(): PaymentProvider[] {
  return [new LemonSqueezyProvider(), new ShopierProvider()];
}

export function getPaymentProvider(id: string): PaymentProvider | null {
  return getPaymentProviders().find((p) => p.id === id) ?? null;
}

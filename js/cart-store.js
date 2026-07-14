import { SITE_CONFIG, WRAPPING_OPTIONS, RIBBON_OPTIONS, MESSAGE_CARD_PRICE_JPY } from "./config.js";
import { cnyToJpy, uid } from "./utils.js";

const KEY = "yanohana-cart";
let memoryEnvelope = { version: SITE_CONFIG.cartVersion, items: [] };

function readEnvelope() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memoryEnvelope;
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.items)) throw new Error("invalid cart");
    if (value.version !== SITE_CONFIG.cartVersion) return migrate(value);
    return value;
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* use in-memory cart */ }
    return memoryEnvelope;
  }
}

function migrate(value) {
  const items = Array.isArray(value?.items) ? value.items.filter((item) => item?.productId && Array.isArray(item.flowers)) : [];
  const envelope = { version: SITE_CONFIG.cartVersion, items };
  writeEnvelope(envelope);
  return envelope;
}

function writeEnvelope(envelope) {
  memoryEnvelope = envelope;
  try { localStorage.setItem(KEY, JSON.stringify(envelope)); } catch { /* current tab remains usable */ }
  window.dispatchEvent(new CustomEvent("cartchange", { detail: envelope }));
}

export function calculateItem(item) {
  const flowerSubtotalJpy = (item.flowers || []).reduce((sum, flower) => sum + cnyToJpy(flower.priceCny) * flower.qty, 0);
  const optionSubtotalJpy = (WRAPPING_OPTIONS[item.wrapping]?.priceJpy || 0) + (RIBBON_OPTIONS[item.ribbon]?.priceJpy || 0) + (item.messageCard ? MESSAGE_CARD_PRICE_JPY : 0);
  const unitSubtotalJpy = Math.round(item.basePriceJpy || 0) + flowerSubtotalJpy + optionSubtotalJpy;
  const estimatedWeightG = SITE_CONFIG.packagingWeightG + (item.flowers || []).reduce((sum, flower) => sum + flower.estimatedWeightG * flower.qty, 0);
  return { flowerSubtotalJpy, optionSubtotalJpy, unitSubtotalJpy, estimatedWeightG, lineSubtotalJpy: unitSubtotalJpy * (item.quantity || 1), lineWeightG: estimatedWeightG * (item.quantity || 1) };
}

export function shippingForWeight(weightG) {
  if (weightG <= 0) return { priceJpy: 0, label: "" };
  return SITE_CONFIG.shippingTiers.find((tier) => weightG <= tier.maxWeightG) || { priceJpy: null, label: "quote" };
}

export function cartTotals(items) {
  const subtotalJpy = items.reduce((sum, item) => sum + calculateItem(item).lineSubtotalJpy, 0);
  const weightG = items.reduce((sum, item) => sum + calculateItem(item).lineWeightG, 0);
  const shipping = shippingForWeight(weightG);
  return { subtotalJpy, weightG, shipping, totalJpy: shipping.priceJpy === null ? subtotalJpy : subtotalJpy + shipping.priceJpy };
}

export const cartStore = {
  getItems: () => readEnvelope().items,
  count: () => readEnvelope().items.reduce((sum, item) => sum + (item.quantity || 1), 0),
  add(item) {
    const envelope = readEnvelope();
    const normalized = { ...item, cartId: item.cartId || uid(), quantity: Math.max(1, Number(item.quantity) || 1), addedAt: new Date().toISOString() };
    envelope.items.push(normalized);
    writeEnvelope(envelope);
    return normalized;
  },
  replace(cartId, item) {
    const envelope = readEnvelope();
    const index = envelope.items.findIndex((entry) => entry.cartId === cartId);
    if (index < 0) return this.add(item);
    envelope.items[index] = { ...item, cartId, quantity: envelope.items[index].quantity || 1, addedAt: envelope.items[index].addedAt };
    writeEnvelope(envelope);
    return envelope.items[index];
  },
  updateQuantity(cartId, quantity) {
    const envelope = readEnvelope();
    const item = envelope.items.find((entry) => entry.cartId === cartId);
    if (!item) return;
    item.quantity = Math.min(20, Math.max(1, Number(quantity) || 1));
    writeEnvelope(envelope);
  },
  remove(cartId) {
    const envelope = readEnvelope();
    envelope.items = envelope.items.filter((entry) => entry.cartId !== cartId);
    writeEnvelope(envelope);
  },
  setItems(items) { writeEnvelope({ version: SITE_CONFIG.cartVersion, items }); },
  clear() { writeEnvelope({ version: SITE_CONFIG.cartVersion, items: [] }); }
};

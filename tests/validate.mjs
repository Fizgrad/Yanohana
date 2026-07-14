import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateItem, cartTotals, shippingForWeight } from "../js/cart-store.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(projectRoot, path), "utf8"));
const products = readJson("js/data/products.json");
const flowers = readJson("js/data/flowers.json");
const englishNames = readJson("js/data/flower-names-en.json");

assert.equal(products.length, 10, "The storefront must expose ten products");
assert.equal(flowers.length, 68, "The flower catalog must contain 68 entries");
assert.equal(new Set(products.map((item) => item.id)).size, products.length, "Product IDs must be unique");
assert.equal(new Set(flowers.map((item) => item.id)).size, flowers.length, "Flower IDs must be unique");
assert.equal(Object.keys(englishNames).length, flowers.length, "Every flower needs an English name");
assert.deepEqual(products.map((item) => item.sku), ["SF-001","SF-002","SF-003","SF-004","SF-005","SF-006","SF-007","SF-008","SF-009","SF-010"]);
assert.deepEqual(products.map((item) => item.basePriceJpy), [2200,6980,5980,2200,2980,2200,5980,17800,7980,10800]);
assert.doesNotMatch(JSON.stringify(products), /priceUsd|unitCost|grossMargin|targetNetReceipt/i, "Internal pricing data must not be published");

for (const product of products) {
  assert.ok(product.nameJa && product.nameEn, `${product.id} needs Japanese and English names`);
  assert.ok(existsSync(join(projectRoot, product.image)), `${product.id} image does not exist`);
  assert.ok(product.availableFlowerCategories.length > 0, `${product.id} needs flower eligibility rules`);
  assert.ok(product.publicDetails?.materialJa && product.publicDetails?.materialEn, `${product.id} needs bilingual public details`);
  for (const galleryItem of product.gallery || []) assert.ok(existsSync(join(projectRoot, galleryItem.image)), `${product.id} gallery image does not exist`);
}
for (const flower of flowers) {
  assert.ok(englishNames[flower.id], `${flower.id} needs an English translation`);
  assert.ok(["rose", "peony", "accent", "greenery"].includes(flower.category), `${flower.id} has an invalid category`);
  assert.ok(flower.priceCny > 0 && flower.estimatedWeightG > 0, `${flower.id} needs price and weight`);
}

const sample = {
  basePriceJpy: 1000,
  quantity: 2,
  wrapping: "pink",
  ribbon: "beige",
  messageCard: true,
  flowers: [{ priceCny: 10, estimatedWeightG: 15, qty: 3 }]
};
const calculation = calculateItem(sample);
assert.equal(calculation.flowerSubtotalJpy, 660);
assert.equal(calculation.optionSubtotalJpy, 350);
assert.equal(calculation.unitSubtotalJpy, 2010);
assert.equal(calculation.lineSubtotalJpy, 4020);
assert.equal(calculation.estimatedWeightG, 80);
assert.equal(calculation.lineWeightG, 160);
assert.equal(shippingForWeight(100).priceJpy, 480);
assert.equal(shippingForWeight(101).priceJpy, 680);
assert.equal(shippingForWeight(301).priceJpy, 880);
assert.equal(shippingForWeight(501).priceJpy, null);
assert.equal(cartTotals([sample]).totalJpy, 4700);

const htmlFiles = [
  "index.html", "products/index.html", "products/customize.html", "cart.html",
  "checkout.html", "order-complete.html", "404.html", "legal/privacy.html",
  "legal/terms.html", "legal/returns.html", "legal/shipping.html", "legal/commerce.html"
];
for (const htmlFile of htmlFiles) {
  const html = readFileSync(join(projectRoot, htmlFile), "utf8");
  assert.match(html, /<main\b[^>]*id="main"/, `${htmlFile} needs a main landmark`);
  const links = [...html.matchAll(/(?:src|href)="([^"#?]+)"/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(?:https?:|mailto:|data:)/.test(link)) continue;
    const target = resolve(dirname(join(projectRoot, htmlFile)), link);
    assert.ok(existsSync(target), `${htmlFile} references missing file ${link}`);
  }
}

console.log(`Validated ${products.length} products, ${flowers.length} flowers, pricing tiers, and ${htmlFiles.length} pages.`);

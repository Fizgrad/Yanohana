import { SITE_CONFIG } from "./config.js";
import { getLanguage, t } from "./i18n.js";
import { cartStore, calculateItem, cartTotals } from "./cart-store.js";
import { loadJson, rootPath, escapeHtml, yen, uid } from "./utils.js";

const host = document.querySelector("[data-checkout-page]");
let products = [];
let flowers = [];
let englishNames = {};
let items = [];
let submitting = false;

function reconcileCart() {
  const clean = cartStore.getItems().flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId && entry.status === "active" && entry.isCustomizable);
    if (!product || !Array.isArray(item.flowers)) return [];
    const cleanFlowers = item.flowers.flatMap((saved) => {
      const master = flowers.find((entry) => entry.id === saved.id && product.availableFlowerCategories.includes(entry.category) && entry.stockStatus !== "out_of_stock");
      if (!master) return [];
      return [{ id: master.id, nameJa: master.nameJa, nameEn: englishNames[master.id] || master.nameJa, priceCny: master.priceCny, estimatedWeightG: master.estimatedWeightG, qty: Math.min(SITE_CONFIG.maxFlowerPerType, Math.max(1, Number(saved.qty) || 1)) }];
    });
    if (!cleanFlowers.length) return [];
    return [{ ...item, productSku: product.sku, productNameJa: product.nameJa, productNameEn: product.nameEn, basePriceJpy: product.basePriceJpy, previewImage: product.image, flowers: cleanFlowers }];
  });
  cartStore.setItems(clean);
  return clean;
}

const itemName = (item) => getLanguage() === "en" ? item.productNameEn : item.productNameJa;
const flowerName = (flower) => getLanguage() === "en" ? flower.nameEn : flower.nameJa;

function field(name, type, labelKey, placeholder, validation, full = false, extra = "") {
  return `<div class="field${full ? " field-full" : ""}"><label for="${name}">${t(labelKey)} <span class="required">${t("required")}</span></label><input class="input" id="${name}" name="${name}" type="${type}" placeholder="${escapeHtml(placeholder)}" maxlength="${name === "address" ? 180 : 100}" data-validation="${validation}" required ${extra} aria-describedby="${name}-error"><p class="field-error" id="${name}-error"></p></div>`;
}

function render() {
  if (!items.length) {
    host.innerHTML = `<div class="status-box"><h2>${t("emptyCheckout")}</h2><a class="btn" href="products/index.html">${t("goProducts")}</a></div>`;
    return;
  }
  const totals = cartTotals(items);
  const orderItems = items.map((item) => {
    const calc = calculateItem(item);
    const summary = item.flowers.map((flower) => `${escapeHtml(flowerName(flower))} × ${flower.qty}`).join(getLanguage() === "en" ? ", " : "、");
    return `<article class="checkout-item"><img src="${rootPath()}/${item.previewImage}" alt="${escapeHtml(itemName(item))}"><div><h3>${escapeHtml(itemName(item))} × ${item.quantity}</h3><p>${summary}</p><a class="text-link" href="products/customize.html?id=${encodeURIComponent(item.productId)}&amp;edit=${encodeURIComponent(item.cartId)}">${t("edit")}</a></div><strong>${yen(calc.lineSubtotalJpy)}</strong></article>`;
  }).join("");
  host.innerHTML = `<div class="checkout-grid"><aside class="card checkout-order"><h2>${t("orderDetails")}</h2>${orderItems}<dl class="checkout-totals"><div><dt>${t("subtotal")}</dt><dd>${yen(totals.subtotalJpy)}</dd></div><div><dt>${t("shippingEstimate")}</dt><dd>${totals.shipping.priceJpy === null ? t("quoteRequired") : yen(totals.shipping.priceJpy)}</dd></div><div class="final"><dt>${t("total")}</dt><dd>${totals.shipping.priceJpy === null ? `${yen(totals.totalJpy)}+` : yen(totals.totalJpy)}</dd></div></dl>${totals.shipping.priceJpy === null ? `<p class="shipping-note">${t("shippingOver")}</p>` : ""}</aside>
  <section><h2>${t("deliveryDetails")}</h2><form class="checkout-form" data-checkout-form novalidate><div class="form-grid">
    ${field("fullName", "text", "fullName", "山田 花子", "name")}
    ${field("furigana", "text", "furigana", "ヤマダ ハナコ", "katakana")}
    ${field("phone", "tel", "phone", "09012345678", "phone", false, 'inputmode="tel"')}
    ${field("postalCode", "text", "postal", "1500001", "postal", false, 'inputmode="numeric"')}
    ${field("address", "text", "address", getLanguage() === "en" ? "Tokyo, Shibuya..." : "東京都渋谷区…", "address", true)}
    ${field("email", "email", "email", "name@example.com", "email", true)}
    <div class="field field-full"><label for="remarks">${t("remarks")} <span class="muted">(${t("optional")})</span></label><textarea class="textarea" id="remarks" name="remarks" maxlength="1000"></textarea><p class="field-error" id="remarks-error"></p></div>
  </div><div class="checkout-submit"><div class="notice">${t("noCharge")}</div><div class="alert submit-error" data-submit-error hidden></div><button class="btn btn-block" type="submit" data-submit>${t("submitOrder")}</button></div></form></section></div>`;
  host.querySelector("[data-checkout-form]").addEventListener("submit", submitOrder);
  host.querySelectorAll("input[required]").forEach((input) => input.addEventListener("blur", () => validateField(input)));
}

function validateField(input) {
  const value = input.value.trim();
  let message = "";
  if (input.required && !value) message = t("validationRequired");
  else if (input.dataset.validation === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = t("validationEmail");
  else if (input.dataset.validation === "phone" && !/^\d{10,11}$/.test(value.replace(/[\s()-]/g, ""))) message = t("validationPhone");
  else if (input.dataset.validation === "postal" && !/^\d{7}$/.test(value.replace(/[-\s]/g, ""))) message = t("validationPostal");
  else if (input.dataset.validation === "katakana" && !/^[ァ-ヶー\s　]+$/.test(value)) message = t("validationKana");
  input.setAttribute("aria-invalid", String(Boolean(message)));
  document.getElementById(`${input.name}-error`).textContent = message;
  return !message;
}

async function submitOrder(event) {
  event.preventDefault();
  if (submitting) return;
  const form = event.currentTarget;
  const inputs = [...form.querySelectorAll("input[required]")];
  if (!inputs.map(validateField).every(Boolean)) {
    inputs.find((input) => input.getAttribute("aria-invalid") === "true")?.focus();
    return;
  }
  submitting = true;
  const button = form.querySelector("[data-submit]");
  const errorBox = form.querySelector("[data-submit-error]");
  errorBox.hidden = true;
  button.disabled = true;
  button.classList.add("loading");
  button.textContent = t("sending");
  const totals = cartTotals(items);
  const payload = {
    schemaVersion: 1,
    idempotencyKey: sessionStorage.getItem("yanohana-idempotency") || uid(),
    language: getLanguage(),
    submittedAt: new Date().toISOString(),
    customer: Object.fromEntries(new FormData(form)),
    items,
    estimate: { subtotalJpy: totals.subtotalJpy, shippingJpy: totals.shipping.priceJpy, totalJpy: totals.totalJpy, weightG: totals.weightG, exchangeRateCnyToJpy: SITE_CONFIG.exchangeRateCnyToJpy, taxIncluded: SITE_CONFIG.priceIncludesTax }
  };
  sessionStorage.setItem("yanohana-idempotency", payload.idempotencyKey);
  try {
    let result;
    if (SITE_CONFIG.appsScriptEndpoint) {
      const response = await fetch(SITE_CONFIG.appsScriptEndpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      const text = await response.text();
      result = JSON.parse(text);
      if (!response.ok || !result.success) throw new Error(result.message || "Submission failed");
    } else if (SITE_CONFIG.demoSubmission) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      result = { success: true, orderId: `YNH-${new Date().toISOString().slice(0,10).replaceAll("-", "")}-${Math.random().toString(36).slice(2,6).toUpperCase()}`, demo: true };
    } else {
      throw new Error("Order endpoint is not configured");
    }
    sessionStorage.setItem("yanohana-last-order", JSON.stringify({ orderId: result.orderId, submittedAt: payload.submittedAt, email: payload.customer.email, demo: Boolean(result.demo) }));
    cartStore.clear();
    sessionStorage.removeItem("yanohana-idempotency");
    location.href = "order-complete.html";
  } catch {
    errorBox.textContent = t("submitFailed");
    errorBox.hidden = false;
    button.disabled = false;
    button.classList.remove("loading");
    button.textContent = t("submitOrder");
    submitting = false;
  }
}

try {
  [products, flowers, englishNames] = await Promise.all([loadJson("js/data/products.json"), loadJson("js/data/flowers.json"), loadJson("js/data/flower-names-en.json")]);
  items = reconcileCart();
  render();
} catch {
  host.innerHTML = `<div class="status-box"><p>${t("retry")}</p><button class="btn" onclick="location.reload()">${t("retry")}</button></div>`;
}

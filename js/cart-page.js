import { WRAPPING_OPTIONS, RIBBON_OPTIONS } from "./config.js";
import { getLanguage, t } from "./i18n.js";
import { cartStore, calculateItem, cartTotals } from "./cart-store.js";
import { loadJson, rootPath, escapeHtml, yen, showToast } from "./utils.js";

const host = document.querySelector("[data-cart-page]");
let products = [];
let masterFlowers = [];
let englishNames = {};
const productName = (item, product) => getLanguage() === "en" ? (product?.nameEn || item.productNameEn || item.productNameJa) : (product?.nameJa || item.productNameJa);
const flowerName = (flower) => getLanguage() === "en" ? (flower.nameEn || flower.nameJa) : flower.nameJa;
const wrapLabel = (id) => getLanguage() === "en" ? ({white:"White",pink:"Pink",green:"Green"}[id] || id) : (WRAPPING_OPTIONS[id]?.label || id);
const ribbonLabel = (id) => getLanguage() === "en" ? ({none:"None",beige:"Beige",white:"White"}[id] || id) : (RIBBON_OPTIONS[id]?.label || id);

function validateItems(items) {
  let changed = false;
  const valid = items.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product || product.status !== "active" || !product.isCustomizable || !Array.isArray(item.flowers)) { changed = true; return []; }
    const cleanFlowers = item.flowers.flatMap((saved) => {
      const master = masterFlowers.find((flower) => flower.id === saved.id && product.availableFlowerCategories.includes(flower.category) && flower.stockStatus !== "out_of_stock");
      if (!master) { changed = true; return []; }
      if (master.priceCny !== saved.priceCny || master.estimatedWeightG !== saved.estimatedWeightG) changed = true;
      return [{ id: master.id, nameJa: master.nameJa, nameEn: englishNames[master.id] || master.nameJa, priceCny: master.priceCny, estimatedWeightG: master.estimatedWeightG, qty: Math.max(1, Math.min(12, Number(saved.qty) || 1)) }];
    });
    if (!cleanFlowers.length) { changed = true; return []; }
    if (item.basePriceJpy !== product.basePriceJpy) changed = true;
    return [{ ...item, productNameJa: product.nameJa, productNameEn: product.nameEn, basePriceJpy: product.basePriceJpy, previewImage: product.image, flowers: cleanFlowers }];
  });
  if (changed || valid.length !== items.length) { cartStore.setItems(valid); showToast(t("invalidRemoved")); }
  return valid;
}

function render() {
  const items = validateItems(cartStore.getItems());
  document.querySelector("[data-cart-title-count]").textContent = t("itemsCount", { count: items.reduce((sum, item) => sum + item.quantity, 0) });
  if (!items.length) {
    host.innerHTML = `<div class="empty-cart"><div class="empty-cart__flower" aria-hidden="true">❀</div><h2>${t("cartEmpty")}</h2><p class="muted">${getLanguage() === "en" ? "Choose a design and create your own flower composition." : "商品を選んで、あなただけの花の組み合わせを作りましょう。"}</p><a class="btn" href="products/index.html">${t("goProducts")}</a></div>`;
    return;
  }
  const totals = cartTotals(items);
  host.innerHTML = `<div class="cart-layout"><div class="cart-items">${items.map(renderItem).join("")}</div><aside class="card cart-summary"><h2>${t("estimatedTotal")}</h2><dl><div><dt>${t("subtotal")}</dt><dd>${yen(totals.subtotalJpy)}</dd></div><div><dt>${t("weight")}</dt><dd>${totals.weightG}g</dd></div><div><dt>${t("shippingEstimate")}</dt><dd>${totals.shipping.priceJpy === null ? t("quoteRequired") : yen(totals.shipping.priceJpy)}</dd></div><div class="cart-total"><dt>${t("total")}</dt><dd>${totals.shipping.priceJpy === null ? `${yen(totals.totalJpy)}+` : yen(totals.totalJpy)}</dd></div></dl>${totals.shipping.priceJpy === null ? `<p class="shipping-note">${t("shippingOver")}</p>` : ""}<a class="btn btn-block" href="checkout.html">${t("checkout")}</a><p class="summary-note">${t("noCharge")}</p></aside></div>`;
}

function renderItem(item) {
  const product = products.find((entry) => entry.id === item.productId);
  const calculation = calculateItem(item);
  const flowers = item.flowers.map((flower) => `${escapeHtml(flowerName(flower))} × ${flower.qty}`).join(getLanguage() === "en" ? ", " : "、");
  const options = `${t("wrappingPaper")}: ${wrapLabel(item.wrapping)} / ${t("ribbon")}: ${ribbonLabel(item.ribbon)} / ${t("messageCard")}: ${item.messageCard ? (getLanguage() === "en" ? "Yes" : "あり") : t("none")}`;
  return `<article class="card cart-item" data-cart-id="${item.cartId}"><div class="cart-item__image"><img src="${rootPath()}/${product?.image || item.previewImage}" alt="${escapeHtml(productName(item, product))}"></div><div class="cart-item__body"><div><h2>${escapeHtml(productName(item, product))}</h2><div class="cart-item__details"><span>${flowers}</span><span>${escapeHtml(options)}</span></div><div class="cart-item__actions"><a class="text-link" href="products/customize.html?id=${encodeURIComponent(item.productId)}&amp;edit=${encodeURIComponent(item.cartId)}">${t("edit")}</a><button class="text-link" type="button" data-action="remove">${t("remove")}</button></div></div><div class="cart-item__price"><strong>${yen(calculation.lineSubtotalJpy)}</strong><div><span class="visually-hidden">${t("quantity")}</span><div class="quantity"><button type="button" data-action="decrease" aria-label="−">−</button><output>${item.quantity}</output><button type="button" data-action="increase" aria-label="+">+</button></div></div></div></div></article>`;
}

host.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest("[data-cart-id]");
  const item = cartStore.getItems().find((entry) => entry.cartId === card.dataset.cartId);
  if (!item) return;
  if (button.dataset.action === "remove") cartStore.remove(item.cartId);
  if (button.dataset.action === "decrease") item.quantity <= 1 ? cartStore.remove(item.cartId) : cartStore.updateQuantity(item.cartId, item.quantity - 1);
  if (button.dataset.action === "increase") cartStore.updateQuantity(item.cartId, item.quantity + 1);
  render();
});

window.addEventListener("storage", () => { showToast(t("cartChanged")); render(); });
try { [products, masterFlowers, englishNames] = await Promise.all([loadJson("js/data/products.json"), loadJson("js/data/flowers.json"), loadJson("js/data/flower-names-en.json")]); render(); }
catch { host.innerHTML = `<div class="status-box"><p>${t("retry")}</p><button class="btn" onclick="location.reload()">${t("retry")}</button></div>`; }

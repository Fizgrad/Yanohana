import { SITE_CONFIG, WRAPPING_OPTIONS, RIBBON_OPTIONS, MESSAGE_CARD_PRICE_JPY } from "./config.js";
import { getLanguage, localized, t } from "./i18n.js";
import { loadJson, rootPath, escapeHtml, yen, cnyToJpy, showToast } from "./utils.js";
import { cartStore, calculateItem, shippingForWeight } from "./cart-store.js";

const params = new URLSearchParams(location.search);
const productId = params.get("id") || "bouquet-003";
const editCartId = params.get("edit");
const page = document.querySelector("[data-customize-page]");
const loading = document.querySelector("[data-customize-loading]");
const categoryOrder = ["rose", "peony", "accent", "greenery"];
let product;
let flowers = [];
let englishNames = {};
let state = { selected: {}, wrapping: "white", ribbon: "none", messageCard: false };

const flowerName = (flower) => getLanguage() === "en" ? (englishNames[flower.id] || flower.nameJa) : flower.nameJa;
const selectedTotal = () => Object.values(state.selected).reduce((sum, qty) => sum + qty, 0);
const selectedFlowers = () => flowers.filter((flower) => state.selected[flower.id] > 0).map((flower) => ({ id: flower.id, nameJa: flower.nameJa, nameEn: englishNames[flower.id] || flower.nameJa, priceCny: flower.priceCny, estimatedWeightG: flower.estimatedWeightG, qty: state.selected[flower.id] }));
const currentItem = () => ({ productId: product.id, productNameJa: product.nameJa, productNameEn: product.nameEn, basePriceJpy: product.basePriceJpy, previewImage: product.image, flowers: selectedFlowers(), wrapping: state.wrapping, ribbon: state.ribbon, messageCard: state.messageCard, quantity: 1, exchangeRateCnyToJpy: SITE_CONFIG.exchangeRateCnyToJpy });

function restoreEdit() {
  if (!editCartId) return;
  const item = cartStore.getItems().find((entry) => entry.cartId === editCartId && entry.productId === product.id);
  if (!item) return;
  state = { selected: Object.fromEntries(item.flowers.map((flower) => [flower.id, flower.qty])), wrapping: item.wrapping || "white", ribbon: item.ribbon || "none", messageCard: Boolean(item.messageCard) };
}

function renderOptions() {
  document.querySelector("[data-wrapping-options]").innerHTML = Object.entries(WRAPPING_OPTIONS).map(([id, option]) => `<div class="option-choice"><input type="radio" name="wrapping" id="wrapping-${id}" value="${id}" ${state.wrapping === id ? "checked" : ""}><label for="wrapping-${id}"><span class="swatch ${id}"></span>${getLanguage() === "en" ? ({white:"White",pink:"Pink",green:"Green"}[id]) : option.label} ${option.priceJpy ? `+${yen(option.priceJpy)}` : ""}</label></div>`).join("");
  document.querySelector("[data-ribbon-options]").innerHTML = Object.entries(RIBBON_OPTIONS).map(([id, option]) => `<div class="option-choice"><input type="radio" name="ribbon" id="ribbon-${id}" value="${id}" ${state.ribbon === id ? "checked" : ""}><label for="ribbon-${id}">${getLanguage() === "en" ? ({none:"None",beige:"Beige",white:"White"}[id]) : option.label} ${option.priceJpy ? `+${yen(option.priceJpy)}` : ""}</label></div>`).join("");
  const card = document.querySelector("[data-message-card]");
  card.checked = state.messageCard;
  document.querySelector("[data-card-label]").textContent = t("yesWithPrice", { price: yen(MESSAGE_CARD_PRICE_JPY) });
}

function renderGallery() {
  const gallery = product.gallery || [{ image: product.image, labelJa: product.nameJa, labelEn: product.nameEn }];
  const host = document.querySelector("[data-preview-thumbs]");
  host.hidden = gallery.length < 2;
  host.innerHTML = gallery.map((entry, index) => {
    const label = getLanguage() === "en" ? (entry.labelEn || product.nameEn) : (entry.labelJa || product.nameJa);
    return `<button class="preview-thumb" type="button" data-gallery-index="${index}" aria-pressed="${index === 0}" aria-label="${escapeHtml(label)}"><img src="${rootPath()}/${entry.image}" alt=""></button>`;
  }).join("");
  host.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gallery-index]");
    if (!button) return;
    const entry = gallery[Number(button.dataset.galleryIndex)];
    document.querySelector("[data-preview-image]").src = `${rootPath()}/${entry.image}`;
    document.querySelector("[data-preview-image]").alt = getLanguage() === "en" ? (entry.labelEn || product.nameEn) : (entry.labelJa || product.nameJa);
    host.querySelectorAll("button").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
  });
}

function renderFlowers() {
  const query = document.querySelector("#flower-search").value.trim().toLocaleLowerCase(getLanguage() === "ja" ? "ja" : "en");
  let visibleCount = 0;
  const html = categoryOrder.filter((category) => product.availableFlowerCategories.includes(category)).map((category, categoryIndex) => {
    const groupFlowers = flowers.filter((flower) => flower.category === category && (!query || `${flower.nameJa} ${englishNames[flower.id] || ""}`.toLocaleLowerCase().includes(query)));
    visibleCount += groupFlowers.length;
    if (!groupFlowers.length) return "";
    return `<details class="flower-group" data-category="${category}" ${categoryIndex === 0 || query ? "open" : ""}><summary><span>${t(category)}</span><small>${groupFlowers.length}</small></summary><div class="flower-list">${groupFlowers.map(renderFlower).join("")}</div></details>`;
  }).join("");
  document.querySelector("[data-flower-groups]").innerHTML = html;
  document.querySelector("[data-no-results]").hidden = visibleCount > 0;
  updateSummary();
}

function renderFlower(flower) {
  const qty = state.selected[flower.id] || 0;
  const out = flower.stockStatus === "out_of_stock";
  return `<div class="flower-item" data-flower-id="${flower.id}"><span class="flower-thumb ${flower.category}" aria-hidden="true">❀</span><div class="flower-info"><span class="flower-name" title="${escapeHtml(flowerName(flower))}">${escapeHtml(flowerName(flower))}</span><span class="flower-price">${yen(cnyToJpy(flower.priceCny))} / ${getLanguage() === "en" ? "stem" : "点"}</span></div><div class="flower-actions">${out ? `<span class="muted">${t("soldOut")}</span>` : qty === 0 ? `<button class="btn btn-quiet" type="button" data-action="add">${t("add")}</button>` : `<div class="quantity"><button type="button" data-action="decrease" aria-label="−">−</button><output>${qty}</output><button type="button" data-action="increase" aria-label="+">+</button></div><button class="remove-flower" type="button" data-action="remove" aria-label="${t("remove")}">×</button>`}</div></div>`;
}

function changeFlower(id, action) {
  const current = state.selected[id] || 0;
  if (action === "remove") delete state.selected[id];
  if (action === "decrease") current <= 1 ? delete state.selected[id] : state.selected[id] = current - 1;
  if (action === "add" || action === "increase") {
    if (current >= SITE_CONFIG.maxFlowerPerType || selectedTotal() >= SITE_CONFIG.maxFlowersPerItem) { showToast(t("maxReached")); return; }
    state.selected[id] = current + 1;
  }
  renderFlowers();
}

function updateSummary() {
  const item = currentItem();
  const calculation = calculateItem(item);
  const shipping = shippingForWeight(calculation.estimatedWeightG);
  const list = document.querySelector("[data-composition-list]");
  list.innerHTML = item.flowers.length ? item.flowers.map((flower) => `<div class="composition-item"><span>${escapeHtml(getLanguage() === "en" ? flower.nameEn : flower.nameJa)} × ${flower.qty}</span><span>${yen(cnyToJpy(flower.priceCny) * flower.qty)}</span></div>`).join("") : `<p class="composition-empty">${t("selectOne")}</p>`;
  document.querySelector("[data-selected-count]").textContent = t("selectedKinds", { count: item.flowers.length });
  document.querySelector("[data-base-price]").textContent = yen(product.basePriceJpy);
  document.querySelector("[data-flower-subtotal]").textContent = yen(calculation.flowerSubtotalJpy);
  document.querySelector("[data-option-subtotal]").textContent = yen(calculation.optionSubtotalJpy);
  document.querySelector("[data-item-subtotal]").textContent = yen(calculation.unitSubtotalJpy);
  document.querySelector("[data-weight]").textContent = `${calculation.estimatedWeightG}g`;
  document.querySelector("[data-shipping]").textContent = shipping.priceJpy === null ? t("quoteRequired") : yen(shipping.priceJpy);
  const total = shipping.priceJpy === null ? calculation.unitSubtotalJpy : calculation.unitSubtotalJpy + shipping.priceJpy;
  document.querySelector("[data-estimated-total]").textContent = shipping.priceJpy === null ? `${yen(total)}+` : yen(total);
  document.querySelector("[data-mobile-total]").textContent = shipping.priceJpy === null ? `${yen(total)}+` : yen(total);
  document.querySelectorAll("[data-add-cart], [data-mobile-add]").forEach((button) => { button.disabled = item.flowers.length === 0; });
}

async function addToCart(button) {
  if (!selectedFlowers().length || button.disabled) return;
  document.querySelectorAll("[data-add-cart], [data-mobile-add]").forEach((node) => { node.disabled = true; node.classList.add("loading"); });
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (editCartId) cartStore.replace(editCartId, currentItem()); else cartStore.add(currentItem());
  showToast(t("added"));
  document.querySelectorAll("[data-add-cart], [data-mobile-add]").forEach((node) => { node.disabled = false; node.classList.remove("loading"); });
  if (editCartId) setTimeout(() => { location.href = "../cart.html"; }, 450);
}

function bind() {
  document.querySelector("[data-flower-groups]").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    changeFlower(button.closest("[data-flower-id]").dataset.flowerId, button.dataset.action);
  });
  document.querySelector("#flower-search").addEventListener("input", renderFlowers);
  document.querySelector("[data-clear-search]").addEventListener("click", () => { document.querySelector("#flower-search").value = ""; renderFlowers(); document.querySelector("#flower-search").focus(); });
  document.querySelector("[data-wrapping-options]").addEventListener("change", (event) => { state.wrapping = event.target.value; updateSummary(); });
  document.querySelector("[data-ribbon-options]").addEventListener("change", (event) => { state.ribbon = event.target.value; updateSummary(); });
  document.querySelector("[data-message-card]").addEventListener("change", (event) => { state.messageCard = event.target.checked; updateSummary(); });
  document.querySelectorAll("[data-add-cart], [data-mobile-add]").forEach((button) => button.addEventListener("click", () => addToCart(button)));
}

try {
  const [products, allFlowers, names] = await Promise.all([loadJson("js/data/products.json"), loadJson("js/data/flowers.json"), loadJson("js/data/flower-names-en.json")]);
  product = products.find((entry) => entry.id === productId);
  if (!product || product.status !== "active" || !product.isCustomizable) throw new Error("Product unavailable");
  englishNames = names;
  flowers = allFlowers.filter((flower) => product.availableFlowerCategories.includes(flower.category));
  restoreEdit();
  document.querySelectorAll("[data-product-name]").forEach((node) => { node.textContent = localized(product, "name"); });
  document.querySelector("[data-product-description]").textContent = localized(product, "description");
  document.querySelector("[data-preview-image]").src = `${rootPath()}/${product.image}`;
  document.querySelector("[data-preview-image]").alt = localized(product, "name");
  document.querySelector("[data-flower-limit]").textContent = t("flowerLimit", { max: SITE_CONFIG.maxFlowerPerType, total: SITE_CONFIG.maxFlowersPerItem });
  renderOptions(); renderGallery(); renderFlowers(); bind();
  loading.remove(); page.hidden = false;
} catch (error) {
  loading.innerHTML = `<div class="status-box"><p>${getLanguage() === "en" ? "This product could not be loaded or is no longer available." : "商品を読み込めないか、現在ご利用いただけません。"}</p><a class="btn btn-outline" href="index.html">${t("goProducts")}</a></div>`;
}

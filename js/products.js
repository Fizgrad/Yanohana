import { localized, t } from "./i18n.js";
import { loadJson, rootPath, escapeHtml, yen } from "./utils.js";

const grid = document.querySelector("[data-products-grid]");
const filters = document.querySelector("[data-filters]");
let products = [];
let activeCategory = "all";

function render() {
  const shown = activeCategory === "all" ? products : products.filter((product) => product.category === activeCategory);
  grid.innerHTML = shown.map((product) => {
    const enabled = product.status === "active" && product.isCustomizable && product.stockStatus !== "out_of_stock";
    return `<article class="card product-card ${enabled ? "" : "is-unavailable"}" data-category="${product.category}">
      <div class="product-card__image"><img src="${rootPath()}/${product.image}" alt="${escapeHtml(localized(product, "name"))}" loading="lazy"></div>
      <div class="product-card__body"><div class="product-tags"><span class="tag">${t(product.category)}</span><span class="product-sku-tag">${escapeHtml(product.sku || "")}</span></div><h3>${escapeHtml(localized(product, "name"))}</h3><p class="product-card__desc">${escapeHtml(localized(product, "description"))}</p>
      <div class="product-card__foot"><span class="price">${yen(product.basePriceJpy)}〜</span>${enabled ? `<a class="btn btn-outline" href="customize.html?id=${encodeURIComponent(product.id)}">${t("customize")}</a>` : `<button class="btn" disabled>${t("unavailable")}</button>`}</div></div>
    </article>`;
  }).join("");
}

filters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  filters.querySelectorAll("button").forEach((node) => node.classList.toggle("is-active", node === button));
  render();
});

try { products = await loadJson("js/data/products.json"); render(); }
catch { grid.innerHTML = `<div class="status-box"><p>${t("retry")}</p><button class="btn btn-outline" onclick="location.reload()">${t("retry")}</button></div>`; }

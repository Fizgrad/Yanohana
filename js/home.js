import { getLanguage, localized, t } from "./i18n.js";
import { loadJson, rootPath, escapeHtml, yen } from "./utils.js";

const host = document.querySelector("[data-home-products]");
try {
  const products = await loadJson("js/data/products.json");
  host.innerHTML = products.map((product) => `<a class="home-product" href="products/customize.html?id=${encodeURIComponent(product.id)}">
    <img src="${rootPath()}/${product.image}" alt="${escapeHtml(localized(product, "name"))}" loading="lazy">
    <div class="home-product__body"><h3>${escapeHtml(localized(product, "name"))}</h3><span class="price">${getLanguage() === "en" ? `${t("from")} ` : ""}${yen(product.basePriceJpy)}${getLanguage() === "ja" ? t("from") : ""}</span></div>
  </a>`).join("");
} catch (error) {
  host.innerHTML = `<div class="status-box"><p>${getLanguage() === "en" ? "We could not load the collection." : "商品データを読み込めませんでした。"}</p><button class="btn btn-outline" onclick="location.reload()">${t("retry")}</button></div>`;
}

import { getLanguage, setLanguage, t, applyTranslations } from "./i18n.js";
import { rootPath } from "./utils.js";
import { cartStore } from "./cart-store.js";

const root = rootPath();

function renderHeader() {
  const current = document.body.dataset.page || "";
  const host = document.querySelector("[data-site-header]");
  if (!host) return;
  host.innerHTML = `
    <a class="skip-link" href="#main">${getLanguage() === "en" ? "Skip to content" : "本文へ移動"}</a>
    <header class="site-header">
      <div class="site-header__inner container">
        <a class="brand" href="${root}/index.html" aria-label="YANOHANA home"><span class="brand__mark" lang="zh-Hans">颜花</span><span>YANOHANA</span></a>
        <nav class="main-nav" id="main-nav" aria-label="${getLanguage() === "en" ? "Main navigation" : "メインナビゲーション"}">
          <ul>
            <li><a href="${root}/products/index.html" ${current === "products" ? 'aria-current="page"' : ""} data-i18n="navProducts"></a></li>
            <li><a href="${root}/products/customize.html?id=bouquet-003" ${current === "customize" ? 'aria-current="page"' : ""} data-i18n="navCustomize"></a></li>
            <li><a href="${root}/index.html#story" data-i18n="navAbout"></a></li>
          </ul>
        </nav>
        <div class="header-actions">
          <button class="text-link language" type="button" data-language-toggle aria-label="Change language">${t("language")}</button>
          <a class="cart-link" href="${root}/cart.html" ${current === "cart" ? 'aria-current="page"' : ""} aria-label="${t("navCart")}">
            <span aria-hidden="true">⌑</span><span class="cart-link__label" data-i18n="navCart"></span><span class="cart-badge" data-cart-count>0</span>
          </a>
          <button class="menu-button" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="Menu"><span></span><span></span><span></span></button>
        </div>
      </div>
    </header>`;
  const header = host.querySelector(".site-header");
  const menu = host.querySelector(".main-nav");
  const button = host.querySelector(".menu-button");
  const updateScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", updateScroll, { passive: true });
  updateScroll();
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  });
  host.querySelector("[data-language-toggle]").addEventListener("click", () => setLanguage(getLanguage() === "ja" ? "en" : "ja"));
}

function renderFooter() {
  const host = document.querySelector("[data-site-footer]");
  if (!host) return;
  host.innerHTML = `<footer class="site-footer"><div class="container">
    <div class="footer-grid">
      <div><h2 class="brand-title"><span class="brand-title__han" lang="zh-Hans">颜花</span><span>YANOHANA</span></h2><p data-i18n="footerIntro"></p><p><a href="mailto:support@yanohana.example">support@yanohana.example</a></p></div>
      <div><h3 data-i18n="footerGuide"></h3><ul class="footer-links"><li><a href="${root}/legal/shipping.html" data-i18n="shipping"></a></li><li><a href="${root}/legal/returns.html" data-i18n="returns"></a></li><li><a href="${root}/legal/terms.html" data-i18n="terms"></a></li></ul></div>
      <div><h3 data-i18n="footerContact"></h3><ul class="footer-links"><li><a href="${root}/legal/privacy.html" data-i18n="privacy"></a></li><li><a href="${root}/legal/commerce.html" data-i18n="commerce"></a></li><li><a href="mailto:support@yanohana.example">Email</a></li><li><a href="#" aria-label="Instagram">Instagram</a></li></ul></div>
    </div><div class="footer-bottom">© ${new Date().getFullYear()} YANOHANA. All rights reserved.</div>
  </div></footer>`;
}

function updateCartCount() {
  document.querySelectorAll("[data-cart-count]").forEach((badge) => { badge.textContent = cartStore.count(); });
}

function boot() {
  const titles = {
    home: "YANOHANA | Custom Silk Flowers",
    products: "Products | YANOHANA",
    customize: "Customize | YANOHANA",
    cart: "Shopping Cart | YANOHANA",
    checkout: "Delivery & Order Details | YANOHANA",
    complete: "Request Received | YANOHANA"
  };
  if (getLanguage() === "en" && titles[document.body.dataset.page]) document.title = titles[document.body.dataset.page];
  renderHeader();
  renderFooter();
  applyTranslations();
  updateCartCount();
  window.addEventListener("cartchange", updateCartCount);
  window.addEventListener("storage", updateCartCount);
  window.addEventListener("languagechange", () => window.location.reload());
  document.addEventListener("error", (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "true";
    const fallback = document.createElement("div");
    fallback.className = "image-fallback";
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", getLanguage() === "en" ? `${img.alt || "Product"} image coming soon` : `${img.alt || "商品"}の画像は準備中です`);
    fallback.innerHTML = `<span>❀<br><small>${getLanguage() === "en" ? "Image coming soon" : "画像準備中"}</small></span>`;
    img.replaceWith(fallback);
  }, true);
}

boot();

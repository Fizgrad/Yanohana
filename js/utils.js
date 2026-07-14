import { SITE_CONFIG } from "./config.js";

export const rootPath = () => document.body.dataset.root || ".";
export const yen = (value) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
export const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
export const cnyToJpy = (value) => Math.round(Number(value) * SITE_CONFIG.exchangeRateCnyToJpy);
export const uid = () => globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function loadJson(relativePath) {
  const response = await fetch(`${rootPath()}/${relativePath}`);
  if (!response.ok) throw new Error(`データを読み込めませんでした (${response.status})`);
  return response.json();
}

export function imageWithFallback(img) {
  img.addEventListener("error", () => {
    const fallback = document.createElement("div");
    fallback.className = "image-fallback";
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", `${img.alt || "商品"}の画像は準備中です`);
    fallback.innerHTML = "<span>❀<br><small>画像準備中</small></span>";
    img.replaceWith(fallback);
  }, { once: true });
}

export function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

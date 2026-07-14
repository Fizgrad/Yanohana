const raw = sessionStorage.getItem("yanohana-last-order");
let order = null;
try { order = raw ? JSON.parse(raw) : null; } catch { order = null; }
if (order) {
  document.querySelector("[data-order-number]").textContent = order.orderId || "—";
  document.querySelector("[data-submitted-at]").textContent = new Intl.DateTimeFormat(document.documentElement.lang === "en" ? "en-GB" : "ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(order.submittedAt));
  document.querySelector("[data-order-email]").textContent = order.email || "—";
}

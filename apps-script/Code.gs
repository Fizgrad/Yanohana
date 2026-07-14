/**
 * YANOHANA order endpoint for Google Apps Script.
 *
 * 1. Create a Google Sheet and bind this script to it.
 * 2. Run setupSheets() once and fill the Catalog and Settings sheets.
 * 3. Deploy as a Web app (execute as owner; access: anyone).
 * 4. Paste the /exec URL into js/config.js as appsScriptEndpoint.
 */

const SHEETS = Object.freeze({ orders: 'Orders', items: 'OrderItems', catalog: 'Catalog', settings: 'Settings' });
const WRAPPING_JPY = Object.freeze({ white: 0, pink: 120, green: 120 });
const RIBBON_JPY = Object.freeze({ none: 0, beige: 80, white: 80 });
const MESSAGE_CARD_JPY = 150;

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const payload = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    validatePayload_(payload);

    const orderSheet = getRequiredSheet_(SHEETS.orders);
    const existing = findOrderByKey_(orderSheet, payload.idempotencyKey);
    if (existing) return json_({ success: true, orderId: existing, duplicate: true });

    const serverQuote = calculateServerQuote_(payload.items);
    const orderId = createOrderId_();
    const now = new Date();
    const customer = payload.customer;

    orderSheet.appendRow([
      orderId, payload.idempotencyKey, now, 'new', payload.language || 'ja',
      customer.fullName, customer.furigana, customer.phone, customer.postalCode,
      customer.address, customer.email, customer.remarks || '',
      serverQuote.subtotalJpy, serverQuote.shippingJpy === null ? 'quote' : serverQuote.shippingJpy,
      serverQuote.totalJpy, serverQuote.weightG, serverQuote.exchangeRate,
      JSON.stringify(payload.items), '', '', ''
    ]);

    const itemSheet = getRequiredSheet_(SHEETS.items);
    payload.items.forEach(function(item) {
      itemSheet.appendRow([
        orderId, item.cartId || '', item.productId, item.quantity || 1,
        JSON.stringify(item.flowers), item.wrapping, item.ribbon,
        Boolean(item.messageCard), serverQuote.itemTotals[item.cartId || item.productId]
      ]);
    });
    return json_({ success: true, orderId: orderId, quote: serverQuote });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({ success: false, message: String(error && error.message ? error.message : error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function validatePayload_(payload) {
  if (!payload || payload.schemaVersion !== 1) throw new Error('Unsupported schema');
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(String(payload.idempotencyKey || ''))) throw new Error('Invalid idempotency key');
  if (!payload.customer || !payload.items || !Array.isArray(payload.items) || payload.items.length < 1) throw new Error('Order is empty');
  ['fullName', 'furigana', 'phone', 'postalCode', 'address', 'email'].forEach(function(field) {
    if (!String(payload.customer[field] || '').trim()) throw new Error('Missing customer field: ' + field);
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.customer.email)) throw new Error('Invalid email');
  if (!/^\d{7}$/.test(String(payload.customer.postalCode).replace(/[-\s]/g, ''))) throw new Error('Invalid postal code');
}

function calculateServerQuote_(items) {
  const catalog = loadCatalog_();
  const settings = loadSettings_();
  const exchangeRate = Number(settings.exchangeRateCnyToJpy || 22);
  const packagingWeight = Number(settings.packagingWeightG || 35);
  let subtotalJpy = 0;
  let weightG = 0;
  const itemTotals = {};

  items.forEach(function(item) {
    const product = catalog.products[item.productId];
    if (!product || !product.active) throw new Error('Unavailable product: ' + item.productId);
    if (!WRAPPING_JPY.hasOwnProperty(item.wrapping) || !RIBBON_JPY.hasOwnProperty(item.ribbon)) throw new Error('Invalid option');
    const quantity = Math.min(20, Math.max(1, Number(item.quantity) || 1));
    let flowerJpy = 0;
    let flowerWeight = 0;
    let flowerCount = 0;
    (item.flowers || []).forEach(function(selected) {
      const flower = catalog.flowers[selected.id];
      if (!flower || !flower.active) throw new Error('Unavailable flower: ' + selected.id);
      if (product.categories.indexOf(flower.category) < 0) throw new Error('Flower is not allowed for product');
      const qty = Math.min(12, Math.max(1, Number(selected.qty) || 1));
      flowerCount += qty;
      flowerJpy += Math.round(flower.priceCny * exchangeRate) * qty;
      flowerWeight += flower.weightG * qty;
    });
    if (flowerCount < 1 || flowerCount > 40) throw new Error('Invalid flower count');
    const unit = product.basePriceJpy + flowerJpy + WRAPPING_JPY[item.wrapping] + RIBBON_JPY[item.ribbon] + (item.messageCard ? MESSAGE_CARD_JPY : 0);
    const line = unit * quantity;
    subtotalJpy += line;
    weightG += (packagingWeight + flowerWeight) * quantity;
    itemTotals[item.cartId || item.productId] = line;
  });

  const shippingJpy = weightG <= 100 ? Number(settings.shipping100 || 480)
    : weightG <= 300 ? Number(settings.shipping300 || 680)
    : weightG <= 500 ? Number(settings.shipping500 || 880) : null;
  return { subtotalJpy: subtotalJpy, shippingJpy: shippingJpy, totalJpy: subtotalJpy + (shippingJpy || 0), weightG: weightG, exchangeRate: exchangeRate, itemTotals: itemTotals };
}

function loadCatalog_() {
  const rows = getRequiredSheet_(SHEETS.catalog).getDataRange().getValues();
  const result = { products: {}, flowers: {} };
  rows.slice(1).forEach(function(row) {
    const type = String(row[0] || '').trim();
    const id = String(row[1] || '').trim();
    if (!id) return;
    if (type === 'product') result.products[id] = { basePriceJpy: Number(row[2]), categories: String(row[5] || '').split('|').filter(String), active: String(row[6]).toLowerCase() !== 'false' };
    if (type === 'flower') result.flowers[id] = { priceCny: Number(row[3]), weightG: Number(row[4]), category: String(row[5]), active: String(row[6]).toLowerCase() !== 'false' };
  });
  return result;
}

function loadSettings_() {
  const rows = getRequiredSheet_(SHEETS.settings).getDataRange().getValues();
  return rows.slice(1).reduce(function(result, row) { if (row[0]) result[row[0]] = row[1]; return result; }, {});
}

function findOrderByKey_(sheet, key) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const match = values.find(function(row) { return row[1] === key; });
  return match ? match[0] : null;
}

function createOrderId_() {
  return 'YNH-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
}

function getRequiredSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  return sheet;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function setupSheets() {
  const spreadsheet = SpreadsheetApp.getActive();
  const definitions = {};
  definitions[SHEETS.orders] = ['orderId','idempotencyKey','submittedAt','status','language','fullName','furigana','phone','postalCode','address','email','remarks','subtotalJpy','shippingJpy','totalJpy','weightG','exchangeRate','itemsJson','finalTotalJpy','trackingNumber','internalNotes'];
  definitions[SHEETS.items] = ['orderId','cartId','productId','quantity','flowersJson','wrapping','ribbon','messageCard','lineTotalJpy'];
  definitions[SHEETS.catalog] = ['type','id','basePriceJpy','priceCny','weightG','categoryOrAllowedCategories','active'];
  definitions[SHEETS.settings] = ['key','value'];
  Object.keys(definitions).forEach(function(name) {
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(definitions[name]);
    sheet.setFrozenRows(1);
  });
  const settings = getRequiredSheet_(SHEETS.settings);
  if (settings.getLastRow() === 1) {
    [['exchangeRateCnyToJpy',22],['packagingWeightG',35],['shipping100',480],['shipping300',680],['shipping500',880]].forEach(function(row) { settings.appendRow(row); });
  }
}

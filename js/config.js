export const SITE_CONFIG = Object.freeze({
  brandName: "颜花 YANOHANA",
  contactEmail: "support@yanohana.example",
  exchangeRateCnyToJpy: 22,
  priceIncludesTax: true,
  appsScriptEndpoint: "",
  demoSubmission: true,
  contactLeadTime: "2営業日以内",
  cartVersion: 2,
  maxFlowerPerType: 12,
  maxFlowersPerItem: 40,
  packagingWeightG: 35,
  shippingTiers: [
    { maxWeightG: 100, priceJpy: 480, label: "100gまで" },
    { maxWeightG: 300, priceJpy: 680, label: "300gまで" },
    { maxWeightG: 500, priceJpy: 880, label: "500gまで" }
  ]
});

export const WRAPPING_OPTIONS = Object.freeze({
  white: { label: "ホワイト", priceJpy: 0 },
  pink: { label: "ピンク", priceJpy: 120 },
  green: { label: "グリーン", priceJpy: 120 }
});

export const RIBBON_OPTIONS = Object.freeze({
  none: { label: "なし", priceJpy: 0 },
  beige: { label: "ベージュ", priceJpy: 80 },
  white: { label: "ホワイト", priceJpy: 80 }
});

export const MESSAGE_CARD_PRICE_JPY = 150;

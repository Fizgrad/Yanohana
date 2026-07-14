# YANOHANA

Japanese/English static customization storefront for made-to-order silk flowers. Customers choose a base product, select flower types and quantities, add wrapping options, review an estimated JPY total, and submit an order request without immediate payment.

Live site: https://fizgrad.github.io/Yanohana/

## Run locally

The JSON data is loaded with `fetch()`, so serve the directory over HTTP instead of opening the HTML files directly.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

## Configure orders

The checked-in configuration uses demo submission so the full UI flow can be tested without an external service.

1. Create a Google Sheet and add the contents of `apps-script/Code.gs` as its bound Apps Script.
2. Run `setupSheets()` once.
3. Fill `Catalog` with the product and flower master data. The header documents the required columns.
4. Deploy the script as a Web app that executes as the owner and allows public access.
5. Set `appsScriptEndpoint` in `js/config.js` to the `/exec` URL and set `demoSubmission` to `false`.

The endpoint uses an idempotency key to reject duplicate submissions and recalculates prices, weights, eligibility and shipping from the Sheet catalog rather than trusting browser totals.

## GitHub Pages

`.github/workflows/pages.yml` deploys the site whenever `main` is pushed. In the repository settings, choose **GitHub Actions** as the Pages source. Relative URLs work both at a custom domain and at a project path such as `/Yanohana/`.

Before production launch, replace the example email, confirm exchange rate and shipping rules, load the real catalog into Sheets, replace illustration placeholders with approved photography, and have all legal pages reviewed by the actual operating entity.

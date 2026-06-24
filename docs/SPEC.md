# Strukin — Specification

Design reference for the app. For setup and usage see the [README](../README.md).

## 1. Goal

Replace the manual reimbursement workflow (rename receipt photos → hand-write a per-date note of `image – amount – description` → zip everything) with an app that:

1. Stores receipts per trip.
2. Records amount / date / category / description per receipt — typed manually, or pre-filled by a vision model.
3. Exports a finance-ready **PDF claim sheet** (with receipt images attached) and a **CSV**.

Hard constraint: must run with **no backend** so it can be hosted free on GitHub Pages. This is met by keeping all state client-side and using a **bring-your-own-key** model for AI (the browser calls the LLM provider directly).

## 2. Architecture

- Static single-page app: **Vite + React** (plain JS), no router (view state in `App.jsx`).
- Persistence: **IndexedDB via Dexie**. No network calls except, in auto mode, a direct request to the user's configured LLM endpoint.
- PDF generation: **jsPDF + jspdf-autotable**, lazy-loaded (kept out of the initial bundle).

```
src/
  App.jsx                  view-state shell (list | batch | settings)
  db.js                    Dexie schema + batch/receipt/settings helpers
  components/
    BatchList.jsx          all batches + "new batch"
    BatchDetail.jsx        one batch: receipts, totals, exports, edit
    ReceiptForm.jsx        shared add/edit form (manual + auto)
    Settings.jsx           API config, categories, identity
    ui.jsx                 Icon / Modal / BlobImage / Spinner
  lib/
    format.js              rupiah, parseAmount, terbilang, dates
    image.js               compress/resize, blob<->dataURL, dimensions
    extract.js             vision API call + JSON contract
    exportPdf.js           claim sheet + receipt pages
    exportCsv.js           one row per receipt
    download.js            blob download + safe filenames
```

## 3. Data model (IndexedDB)

### `batches`
| field | type | notes |
|---|---|---|
| id | auto | primary key |
| name | string | e.g. "Reimburse Dinas Jatim" |
| location | string | e.g. "Jawa Timur" |
| startDate / endDate | ISO `YYYY-MM-DD` | trip period |
| company / employeeName | string | optional; overrides Settings defaults in the PDF |
| createdAt | number | epoch ms |

### `receipts`
| field | type | notes |
|---|---|---|
| id | auto | primary key |
| batchId | number | FK → batches.id |
| date | ISO `YYYY-MM-DD` | |
| amount | integer | Rupiah, no decimals |
| category | string | from the user's category list |
| description | string | |
| merchant | string | optional |
| image | Blob | stored compressed (JPEG, ≤1700px); PDFs are rendered to JPEG on import |
| imageType / filename | string | |
| source | `'manual'` \| `'auto'` | provenance badge |
| status | `'draft'` \| `'done'` | draft = uploaded but not completed/confirmed |
| extraction | object \| null | `{ candidates: [{label, value}], model }` |
| order | number | display order within batch |
| createdAt | number | |

### `settings` (single row, key `'app'`)
`baseUrl`, `apiKey`, `model`, `company`, `employeeName`, `categories[]`, `showSignature`.

Default categories: Transport, Konsumsi, Perbekalan, Kesehatan, Obat, Akomodasi, Lainnya.

## 4. Intake & modes

### Bulk-first intake
A batch's dropzone accepts many image/PDF files at once. Each file is normalized
to a JPEG (`lib/image.js` → `prepareReceiptImage`; PDFs via `lib/pdf.js` →
`renderPdfFirstPage`, first page only, pdf.js lazy-loaded with a `?worker`
bundle) and stored as a `status: 'draft'` receipt. Drafts show a "perlu
dilengkapi" badge and are excluded from totals and exports.

`Lengkapi semua dengan AI` runs extraction over every draft sequentially. A
draft auto-promotes to `done` only if the result is valid (amount > 0 and date
within range); otherwise it stays a draft for manual fixing. More files can be
added to a batch at any time.

### Per-receipt form
Both modes converge on `ReceiptForm`. Manual = type the fields. Auto = "Isi
otomatis (AI)" → fields pre-filled, then reviewed. Saving requires a date that
is present and **within the batch's date range** (`startDate`..`endDate`); the
save button is disabled and an inline error is shown until it is. A valid save
sets `status: 'done'`.

### Extraction contract (`lib/extract.js`)

Request: OpenAI-compatible `POST {baseUrl}/chat/completions` with a system prompt + a user message containing the (downscaled) image and the user's category list. `temperature: 0`, `response_format: { type: 'json_object' }`. Sends `Authorization: Bearer <key>` plus OpenRouter's optional `HTTP-Referer` / `X-Title` headers.

Expected JSON:
```json
{
  "merchant": "string",
  "date": "YYYY-MM-DD",
  "category": "string (from provided list)",
  "description": "string (short, Indonesian)",
  "currency": "IDR",
  "amount_candidates": [{ "label": "Total Belanja", "value": 87500 }],
  "suggested_amount": 87500,
  "line_items": [{ "name": "string", "qty": 1, "price": 0 }]
}
```

Response parsing is defensive: strips markdown fences, falls back to the first `{…}` block, and normalizes all amounts to integers.

**Why candidates, not a single amount.** Real receipts print several totals and the *right one to claim is a human judgment call* (in the reference data, two structurally identical Indomaret receipts were claimed at different lines — once `Harga Jual`, once `Total Belanja`). So the model returns every labeled total it finds; the user selects one in the form. The model never silently commits a number.

## 5. Exports

### PDF (`lib/exportPdf.js`), A4 portrait
- **Page 1 — claim sheet:** header (`Laporan Reimbursement`, company, "Perjalanan dinas") · meta (nama, lokasi, periode, jumlah bukti) · table (No, Tanggal, Kategori, Deskripsi, Jumlah) with a Total foot row · per-category subtotals · grand-total box · *terbilang* · a right-aligned two-column signature block (dibuat oleh / disetujui oleh), omitted when `settings.showSignature === false`.
- **Pages 2…N — proof:** one receipt image per page, scaled to fit with a caption (`Bukti N · date · category · merchant · amount`). One-per-page is deliberate so small-text photographed receipts stay legible for finance.

Only `status: 'done'` receipts are exported (the caller filters); if drafts exist the user is warned before the file is generated.

### CSV (`lib/exportCsv.js`)
One row per receipt — `No, Tanggal, Kategori, Deskripsi, Merchant, Jumlah (Rp)` — plus a Total row. UTF-8 with BOM for Excel. (Line-item granularity was considered and rejected as noise for reimbursement.)

## 6. Decisions log

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Static SPA on GitHub Pages | Free, no backend; enabled by BYO-key |
| AI key handling | Stored in browser, sent only to chosen provider | No server to hold secrets; user owns cost |
| Amount in auto mode | Candidate list, user picks | "Which total to claim" is human judgment |
| PDF receipts | One per page, full size | Legibility of photographed receipts |
| PDF header | Minimal: company / name / location / period | Per user; extra fields add clutter |
| CSV rows | One per receipt | Matches the original note format |
| Number words | *terbilang* on the PDF | Standard on Indonesian claim sheets |
| Intake | Bulk multi-file, then organize | Faster for many receipts, esp. with batch AI |
| PDF files | Render first page to image (pdf.js) | Keeps thumbnail/AI/export image-based; no PDF embedding |
| Out-of-range date | Block saving | User chose strict enforcement over a soft warning |
| Signatures | Right-aligned two columns, toggle | Matches Indonesian convention; optional per preference |
| pdf.js worker | Vite `?worker` + `workerPort` | `?url`/`workerSrc` hangs under the Vite dev server |

## 7. Privacy / security model

- Manual mode performs zero network requests.
- Auto mode transmits only the active receipt image to the user-configured endpoint.
- API key lives in IndexedDB on the user's device; shown masked by default in Settings; never bundled or committed.
- No third-party analytics or telemetry.

## 8. Possible future work

- Multi-image batch import (queue several photos, review in sequence).
- Optional cloud sync / encrypted export-import of the whole dataset.
- Receipt de-duplication and currency support beyond IDR.
- Per-provider cost estimate shown before an auto run.

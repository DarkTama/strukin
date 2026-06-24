# Strukin

*From* struk *(receipt) +* -in *— "handle the receipts."*

Turn a pile of trip receipts into a finance-ready **PDF claim sheet + CSV** — without the manual typing.

Built for the way business-trip (*dinas*) reimbursements actually get done in Indonesia: collect a mix of digital invoices (GoCar, Halodoc…) and photographed paper receipts (Indomaret…), record each one's date / amount / category, and hand finance a single document with the proof attached.

It runs **100% in your browser** and deploys **free to GitHub Pages** — no server, no database, no hosting bill.

## Two modes

- **Manual** — upload a receipt image and type the fields. Fully offline; nothing ever leaves your device.
- **Auto (bring your own key)** — point it at any OpenAI-compatible vision API (OpenRouter by default). It reads the receipt and pre-fills the form. Crucially, it does **not** decide the amount for you: it lists every total it found on the receipt (`Total Belanja`, `Harga Jual`, `Non Tunai`…) as candidates, and you pick the right one. The model assists; you stay in control of the number that gets claimed.

Both modes save into the same review form, so auto mode is just "manual with the blanks pre-filled."

## Workflow

Drop in *all* your receipts first, then organize:

1. Drag & drop (or pick) many **images and/or PDFs** at once — each becomes a draft receipt marked *"perlu dilengkapi"*.
2. Either click a draft to fill it in, or hit **"Lengkapi semua dengan AI"** to extract every draft in one go.
3. Drafts that come back clean (amount found, date within the trip range) flip to done automatically; the rest stay flagged for a quick manual fix.
4. Add more receipts to the batch anytime.

## Features

- Group receipts into **batches** (one per trip), kept as history.
- **Bulk multi-file upload** (drag & drop), images **and PDF** — PDFs are rendered (first page) via pdf.js.
- Per receipt: date, amount, category, description, merchant, image.
- **Date validation** — a receipt's date must fall within the batch's date range; saving is blocked until it does.
- Indonesian Rupiah formatting + amount-in-words (*terbilang*).
- Editable expense categories.
- **Model picker** — fetch the provider's full model list and search it from Settings.
- **PDF export** — page 1 is the claim sheet (header, itemized table, per-category subtotals, grand total, *terbilang*, and a right-aligned signature block you can toggle off); following pages are each receipt image, one per page at full size, captioned back to its row.
- **CSV export** — one row per receipt, UTF-8 with BOM (opens cleanly in Excel).
- Exports include only completed receipts; drafts are skipped (with a heads-up).
- All data stored locally in **IndexedDB**; settings in IndexedDB too.

## Privacy

- **Manual mode sends nothing anywhere.** Images and data stay in your browser.
- **Auto mode** sends only the receipt image you're processing, directly to the API provider you configured. Your API key is stored locally in your browser and is never sent anywhere except that provider. It is never committed to the repo.
- There is no backend and no analytics. Clearing your browser data clears the app's data.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # preview the production build
```

Requires Node 18+ (developed on Node 24).

## Deploy to GitHub Pages (free)

1. Create a GitHub repo and push this project to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The included workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) builds the app and publishes it. Your site appears at `https://<user>.github.io/<repo-name>/`.

> **Repo name matters.** Project Pages are served from `/<repo-name>/`, so the production base path must match. If your repo is **not** named `strukin`, change `REPO_NAME` in [vite.config.js](vite.config.js) to match.

## Auto mode setup

1. Get an API key from an OpenAI-compatible provider — e.g. [OpenRouter](https://openrouter.ai).
2. In the app, open **Settings** and enter:
   - **Base URL** — e.g. `https://openrouter.ai/api/v1` (default).
   - **API key** — your key (stored only in this browser).
   - **Model** — any **vision-capable** model, e.g. `google/gemini-2.0-flash-001` or `openai/gpt-4o-mini`. Click **"Muat daftar model"** to fetch the provider's full model list and search it.
3. When adding a receipt, upload the image and click **Isi otomatis (AI)**.

Vision calls on small/cheap models cost a fraction of a cent per receipt.

## CORS (self-hosted / local providers)

Strukin calls your API **directly from the browser**, so the provider must send
CORS headers. Hosted gateways like OpenRouter do; many self-hosted proxies built
for CLI tools (e.g. [9router](https://github.com/decolua/9router)) **do not**, so
the browser blocks the request and you see a CORS error. CORS is enforced by the
browser from the server's response — no client setting can bypass it. Three fixes:

**A. Local dev — Vite proxy (no server changes).** The browser talks only to
`localhost`; Vite forwards to your provider server-side, so CORS never applies.

1. Copy [.env.example](.env.example) to `.env.local` and set:
   `VITE_API_PROXY=https://your-host.ts.net`
2. `npm run dev`
3. In Settings, set **Base URL** to `/proxy/v1`.

(Dev only — the deployed site can't proxy, so it needs option B or C.)

**B. Add CORS headers at the provider** (works for the deployed site too). Put a
small reverse proxy in front that allows your origin and answers preflight. With
[Caddy](https://caddyserver.com):

```caddy
your-host.ts.net {
    @cors header Origin *
    handle @cors {
        header Access-Control-Allow-Origin "{header.Origin}"
        header Access-Control-Allow-Methods "GET, POST, OPTIONS"
        header Access-Control-Allow-Headers "Authorization, Content-Type"
        @preflight method OPTIONS
        respond @preflight 204
    }
    reverse_proxy localhost:<9router-port>
}
```

**C. Same-origin.** Serve Strukin from the same host/port as the API so the
browser sees one origin and CORS doesn't apply at all.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) (plain JS)
- [Dexie](https://dexie.org/) for IndexedDB
- [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) for PDF export

See [docs/SPEC.md](docs/SPEC.md) for the full design: data model, extraction contract, export layout, and the decisions behind them.

## Status & limitations

- AI extraction quality depends on the model and image. Photographed paper receipts may need a correction — that's exactly why every auto result lands in an editable review form.
- This is a personal tool, not multi-user software: data lives in one browser and isn't synced. Use the exports as your durable copies.

## License

Copyright (C) 2026 DarkTama.

Strukin is free software, licensed under the **GNU General Public License v3.0 or later** (GPL-3.0-or-later) — see [LICENSE](LICENSE). You may use, study, share, and modify it; if you distribute a modified version, you must release your changes under the same license.

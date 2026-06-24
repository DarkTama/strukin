# Strukin

*From* struk *(receipt) +* -in *— "handle the receipts."*

Turn a pile of trip receipts into a finance-ready **PDF claim sheet + CSV** — without the manual typing.

Built for the way business-trip (*dinas*) reimbursements actually get done in Indonesia: collect a mix of digital invoices (GoCar, Halodoc…) and photographed paper receipts (Indomaret…), record each one's date / amount / category, and hand finance a single document with the proof attached.

It runs **100% in your browser** and deploys **free to GitHub Pages** — no server, no database, no hosting bill.

## Two modes

- **Manual** — upload a receipt image and type the fields. Fully offline; nothing ever leaves your device.
- **Auto (bring your own key)** — point it at any OpenAI-compatible vision API (OpenRouter by default). It reads the receipt and pre-fills the form. Crucially, it does **not** decide the amount for you: it lists every total it found on the receipt (`Total Belanja`, `Harga Jual`, `Non Tunai`…) as candidates, and you pick the right one. The model assists; you stay in control of the number that gets claimed.

Both modes save into the same review form, so auto mode is just "manual with the blanks pre-filled."

## Features

- Group receipts into **batches** (one per trip), kept as history.
- Per receipt: date, amount, category, description, merchant, image.
- Indonesian Rupiah formatting + amount-in-words (*terbilang*).
- Editable expense categories.
- **PDF export** — page 1 is the claim sheet (header, itemized table, per-category subtotals, grand total, *terbilang*, signature block); following pages are each receipt image, one per page at full size, captioned back to its row.
- **CSV export** — one row per receipt, UTF-8 with BOM (opens cleanly in Excel).
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
   - **Model** — any **vision-capable** model, e.g. `google/gemini-2.0-flash-001` or `openai/gpt-4o-mini`.
3. When adding a receipt, upload the image and click **Isi otomatis (AI)**.

Vision calls on small/cheap models cost a fraction of a cent per receipt.

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

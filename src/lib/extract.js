// Auto mode: send a receipt image to an OpenAI-compatible chat-completions
// endpoint (OpenRouter by default) and get back structured fields.
// The model NEVER decides the final amount on its own — it returns a list of
// candidate amounts it found, and the user picks one in the review form.

import { compressImage, blobToDataURL } from './image.js'

const SYSTEM_PROMPT = `You read Indonesian receipts (struk/kuitansi/invoice) for an expense reimbursement tool.
Extract data from the receipt image and respond with ONLY a JSON object, no prose, no markdown fences.

Rules:
- Amounts are integer Rupiah. Strip "Rp", thousand separators (dots), and decimals. e.g. "Rp 83.333" -> 83333.
- amount_candidates: list EVERY total-like number on the receipt with its printed label, in the receipt's own words (e.g. "Total Belanja", "Harga Jual", "Non Tunai", "Total dibayar", "Total Pembayaran"). Do not guess which one to claim — list them all.
- suggested_amount: your best single guess of the amount to reimburse (usually the grand total actually paid).
- date: ISO "YYYY-MM-DD". If the year is missing assume the current year.
- category: choose the closest match from the provided category list, else "Lainnya".
- description: a short Indonesian phrase (max ~8 words) describing the purchase.
- merchant: the store/service name.
- line_items: array of {name, qty, price} if itemized, else [].`

function buildJSONInstruction(categories) {
  return `Category list: ${categories.join(', ')}.

Respond with exactly this JSON shape:
{
  "merchant": string,
  "date": "YYYY-MM-DD",
  "category": string,
  "description": string,
  "currency": "IDR",
  "amount_candidates": [{ "label": string, "value": number }],
  "suggested_amount": number,
  "line_items": [{ "name": string, "qty": number, "price": number }]
}`
}

// Pull a JSON object out of a model response that may include stray text/fences.
function parseModelJSON(content) {
  if (!content) throw new Error('Respons model kosong.')
  let text = String(content).trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1))
    }
    throw new Error('Tidak bisa membaca JSON dari respons model.')
  }
}

function normalizeAmount(v) {
  if (typeof v === 'number') return Math.round(v)
  const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

export async function extractReceipt({ baseUrl, apiKey, model, blob, categories, signal }) {
  if (!apiKey) throw new Error('API key belum diatur. Buka Settings dulu.')
  if (!model) throw new Error('Model belum diatur. Buka Settings dulu.')

  const compact = await compressImage(blob, { maxDim: 1400, quality: 0.8 })
  const dataUrl = await blobToDataURL(compact)
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'

  const body = {
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildJSONInstruction(categories) },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  }

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // OpenRouter-specific niceties; harmless for other providers.
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Reimburse Organizer',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new Error(`Gagal menghubungi API (${e.message}). Cek base URL / koneksi / CORS.`)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const hint =
      res.status === 401 ? ' — API key salah?' :
      res.status === 402 ? ' — saldo/kredit habis?' :
      res.status === 404 ? ' — model tidak ditemukan?' :
      res.status === 429 ? ' — kena rate limit, coba lagi.' : ''
    throw new Error(`API error ${res.status}${hint} ${detail.slice(0, 200)}`.trim())
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  const parsed = parseModelJSON(content)

  const candidates = Array.isArray(parsed.amount_candidates)
    ? parsed.amount_candidates
        .map((c) => ({ label: String(c.label || 'Total'), value: normalizeAmount(c.value) }))
        .filter((c) => c.value > 0)
    : []

  const suggested = normalizeAmount(parsed.suggested_amount) || candidates[0]?.value || 0

  return {
    merchant: parsed.merchant || '',
    date: parsed.date || '',
    category: parsed.category || '',
    description: parsed.description || '',
    amount: suggested,
    candidates,
    lineItems: Array.isArray(parsed.line_items) ? parsed.line_items : [],
    model,
  }
}

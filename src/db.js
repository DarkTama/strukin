import Dexie from 'dexie'

// All data lives locally in the browser (IndexedDB). Nothing is sent to any
// server except, in auto mode, the image you choose to send to the LLM
// provider you configured in Settings.
export const db = new Dexie('strukin')

db.version(1).stores({
  // ++id = auto-increment primary key. Extra fields are indexed for querying.
  batches: '++id, name, createdAt',
  receipts: '++id, batchId, date, order, createdAt',
  settings: 'key',
})

const SETTINGS_KEY = 'app'

export const DEFAULT_SETTINGS = {
  key: SETTINGS_KEY,
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'google/gemini-2.0-flash-001',
  company: '',
  employeeName: '',
  categories: [
    'Transport',
    'Konsumsi',
    'Perbekalan',
    'Kesehatan',
    'Obat',
    'Akomodasi',
    'Lainnya',
  ],
}

export async function getSettings() {
  const saved = await db.settings.get(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(saved || {}) }
}

export async function saveSettings(patch) {
  const current = await getSettings()
  const next = { ...current, ...patch, key: SETTINGS_KEY }
  await db.settings.put(next)
  return next
}

// ---- Batch helpers ----

export async function createBatch(fields = {}) {
  const now = Date.now()
  const id = await db.batches.add({
    name: fields.name || 'Reimbursement baru',
    location: fields.location || '',
    startDate: fields.startDate || '',
    endDate: fields.endDate || '',
    company: fields.company || '',
    employeeName: fields.employeeName || '',
    createdAt: now,
  })
  return id
}

export async function updateBatch(id, patch) {
  await db.batches.update(id, patch)
}

export async function deleteBatch(id) {
  await db.transaction('rw', db.batches, db.receipts, async () => {
    await db.receipts.where('batchId').equals(id).delete()
    await db.batches.delete(id)
  })
}

// ---- Receipt helpers ----

export async function addReceipt(batchId, fields) {
  const count = await db.receipts.where('batchId').equals(batchId).count()
  const id = await db.receipts.add({
    batchId,
    date: fields.date || '',
    amount: Number(fields.amount) || 0,
    category: fields.category || '',
    description: fields.description || '',
    merchant: fields.merchant || '',
    image: fields.image || null, // Blob
    imageType: fields.imageType || '',
    filename: fields.filename || '',
    source: fields.source || 'manual',
    extraction: fields.extraction || null,
    order: count,
    createdAt: Date.now(),
  })
  return id
}

export async function updateReceipt(id, patch) {
  await db.receipts.update(id, patch)
}

export async function deleteReceipt(id) {
  await db.receipts.delete(id)
}

// CSV export: one row per receipt, ready for Excel / finance import.

import { formatDateLong } from './format.js'
import { downloadBlob, safeFilename } from './download.js'

function csvCell(value) {
  const s = value == null ? '' : String(value)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function exportCsv(batch, receipts) {
  const sorted = [...receipts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const total = sorted.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  const rows = [
    ['No', 'Tanggal', 'Kategori', 'Deskripsi', 'Merchant', 'Jumlah (Rp)'],
    ...sorted.map((r, i) => [
      i + 1,
      formatDateLong(r.date),
      r.category,
      r.description,
      r.merchant || '',
      Number(r.amount) || 0,
    ]),
    ['', '', '', '', 'Total', total],
  ]

  const BOM = String.fromCharCode(0xfeff)
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  // Prepend a UTF-8 BOM so Excel reads accented characters correctly.
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, safeFilename(batch.name || 'reimbursement') + '.csv')
}

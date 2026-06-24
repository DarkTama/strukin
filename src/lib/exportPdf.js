// PDF export:
//   Page 1  = claim sheet (header, table, category subtotals, grand total,
//             terbilang, signatures).
//   Page 2+ = each receipt image, one per page at full size, captioned back
//             to its table row.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  formatNumber, formatPeriod, formatDateLong, formatDateShort, terbilang,
} from './format.js'
import { toJpegForPdf } from './image.js'
import { safeFilename } from './download.js'

export async function exportPdf(batch, receipts, settings = {}) {
  const sorted = [...receipts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const total = sorted.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40

  const company = batch.company || settings.company || ''
  const employee = batch.employeeName || settings.employeeName || ''

  // ---- Header ----
  let y = 54
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20)
  doc.text('Laporan Reimbursement', margin, y)
  if (company) {
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(90)
    doc.text(company, pageW - margin, y - 4, { align: 'right' })
  }
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(110)
  doc.text('Perjalanan dinas', margin, y + 15)

  y += 26
  doc.setDrawColor(180).setLineWidth(1)
  doc.line(margin, y, pageW - margin, y)

  // ---- Meta (two columns) ----
  y += 20
  doc.setFontSize(10)
  const meta = [
    ['Nama', employee || '-'],
    ['Lokasi', batch.location || '-'],
    ['Periode', formatPeriod(batch.startDate, batch.endDate) || '-'],
    ['Jumlah bukti', `${sorted.length} struk`],
  ]
  const colX = [margin, pageW / 2 + 10]
  meta.forEach((row, i) => {
    const x = colX[i % 2]
    const ry = y + Math.floor(i / 2) * 16
    doc.setTextColor(130).text(row[0], x, ry)
    doc.setTextColor(40).text(String(row[1]), x + 75, ry)
  })
  y += Math.ceil(meta.length / 2) * 16 + 12

  // ---- Table ----
  autoTable(doc, {
    startY: y,
    head: [['No', 'Tanggal', 'Kategori', 'Deskripsi', 'Jumlah (Rp)']],
    body: sorted.map((r, i) => [
      i + 1, formatDateLong(r.date), r.category, r.description, formatNumber(r.amount),
    ]),
    foot: [['', '', '', 'Total', formatNumber(total)]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, textColor: 40, lineColor: 210 },
    headStyles: { fillColor: [240, 240, 238], textColor: 60, fontStyle: 'bold' },
    footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28, halign: 'right' },
      1: { cellWidth: 90 },
      2: { cellWidth: 78 },
      4: { cellWidth: 82, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  const afterTableY = doc.lastAutoTable.finalY + 24

  // ---- Category subtotals (left) ----
  const subtotals = {}
  sorted.forEach((r) => {
    const cat = r.category || 'Lainnya'
    subtotals[cat] = (subtotals[cat] || 0) + (Number(r.amount) || 0)
  })
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(130)
  doc.text('Subtotal per kategori', margin, afterTableY)
  let sy = afterTableY + 15
  doc.setTextColor(70)
  Object.entries(subtotals).forEach(([cat, val]) => {
    doc.text(cat, margin, sy)
    doc.text(formatNumber(val), margin + 170, sy, { align: 'right' })
    sy += 13
  })

  // ---- Total box + terbilang (right) ----
  const boxX = pageW / 2 + 10
  const boxW = pageW - margin - boxX
  doc.setFillColor(245, 245, 243).rect(boxX, afterTableY - 4, boxW, 42, 'F')
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110)
  doc.text('Total reimbursement', boxX + 10, afterTableY + 11)
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(20)
  doc.text('Rp ' + formatNumber(total), boxX + 10, afterTableY + 30)
  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(120)
  const terbLines = doc.splitTextToSize('Terbilang: ' + terbilang(total), boxW)
  doc.text(terbLines, boxX, afterTableY + 56)

  // ---- Signatures (right-aligned, two columns) ----
  if (settings.showSignature !== false) {
    let sigY = Math.max(sy, afterTableY + 56 + terbLines.length * 10) + 36
    if (sigY > pageH - 96) sigY = pageH - 96
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(70)
    const colW = 150
    const gap = 24
    const rightCenter = pageW - margin - colW / 2
    const leftCenter = rightCenter - colW - gap
    doc.text('Dibuat oleh,', leftCenter, sigY, { align: 'center' })
    doc.text('Disetujui oleh,', rightCenter, sigY, { align: 'center' })
    doc.setDrawColor(150)
    doc.line(leftCenter - colW / 2, sigY + 50, leftCenter + colW / 2, sigY + 50)
    doc.line(rightCenter - colW / 2, sigY + 50, rightCenter + colW / 2, sigY + 50)
    doc.text(employee || '( .............................. )', leftCenter, sigY + 63, { align: 'center' })
    doc.text('( .............................. )', rightCenter, sigY + 63, { align: 'center' })
  }

  // ---- Receipt pages ----
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    if (!r.image) continue
    doc.addPage()
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30)
    doc.text(`Bukti ${i + 1}`, margin, 50)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90)
    const caption = [formatDateShort(r.date), r.category, r.merchant, 'Rp ' + formatNumber(r.amount)]
      .filter(Boolean).join('   ·   ')
    doc.text(caption, margin, 66)
    doc.setDrawColor(210).line(margin, 74, pageW - margin, 74)

    try {
      const { dataUrl, width, height } = await toJpegForPdf(r.image)
      const availW = pageW - margin * 2
      const availH = pageH - 90 - margin
      const scale = Math.min(availW / width, availH / height)
      const w = width * scale
      const h = height * scale
      doc.addImage(dataUrl, 'JPEG', (pageW - w) / 2, 90, w, h)
    } catch {
      doc.setTextColor(150).text('(gambar tidak bisa dimuat)', margin, 110)
    }
  }

  doc.save(safeFilename(batch.name || 'reimbursement') + '.pdf')
}

// Client-side image helpers: resize/compress before sending to the LLM or
// embedding in a PDF, and conversions between Blob / data URL / dimensions.

import { isPdf, renderPdfFirstPage } from './pdf.js'

// Turn an uploaded File (image or PDF) into a normalized JPEG Blob ready to
// store as a receipt image. PDFs are rendered (first page) via pdf.js.
export async function prepareReceiptImage(file, opts = {}) {
  if (isPdf(file)) {
    const blob = await renderPdfFirstPage(file, opts)
    if (!blob) throw new Error('Gagal membaca PDF.')
    return blob
  }
  if (file.type?.startsWith('image/')) {
    return compressImage(file, { maxDim: 1700, quality: 0.85, ...opts })
  }
  throw new Error(`Tipe file tidak didukung: ${file.name || file.type}`)
}

// Re-encode a Blob to a (smaller) JPEG Blob, scaled so its longest side is
// at most maxDim. Used to cut tokens/cost for vision calls and keep PDFs lean.
export async function compressImage(blob, { maxDim = 1600, quality = 0.82 } = {}) {
  let bitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    // Fallback for environments/formats without createImageBitmap.
    return blob
  }
  let { width, height } = bitmap
  const scale = Math.min(1, maxDim / Math.max(width, height))
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const out = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  )
  return out || blob
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Returns { dataUrl, width, height } as a JPEG suitable for jsPDF.addImage.
export async function toJpegForPdf(blob, opts = {}) {
  const jpeg = await compressImage(blob, { maxDim: 1700, quality: 0.85, ...opts })
  const dataUrl = await blobToDataURL(jpeg)
  const { width, height } = await imageSize(dataUrl)
  return { dataUrl, width, height }
}

export function imageSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}

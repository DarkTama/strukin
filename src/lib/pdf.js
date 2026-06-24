// PDF support. pdf.js is heavy, so it's dynamically imported only when a PDF
// is actually uploaded. We render the first page to a JPEG and from then on
// treat the receipt exactly like an image (thumbnail, AI, export all reuse it).

let pdfjsPromise

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import('pdfjs-dist')
      // Vite's ?worker import bundles + wires the worker correctly in both dev
      // and production (the ?url/workerSrc path hangs under the dev server).
      const PdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default
      lib.GlobalWorkerOptions.workerPort = new PdfWorker()
      return lib
    })()
  }
  return pdfjsPromise
}

export function isPdf(file) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '')
}

export async function renderPdfFirstPage(file, { maxDim = 1700 } = {}) {
  const lib = await getPdfjs()
  const data = await file.arrayBuffer()
  const doc = await lib.getDocument({ data }).promise
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(maxDim / Math.max(base.width, base.height), 3)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    return await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.85))
  } finally {
    doc.destroy?.()
  }
}

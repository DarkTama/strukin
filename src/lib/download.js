// Trigger a browser download for a Blob, and make filesystem-safe filenames.

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke a tick later so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFilename(name) {
  return (
    String(name || 'reimbursement')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'reimbursement'
  )
}

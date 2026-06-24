import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateBatch, addReceipt, updateReceipt, deleteReceipt, DEFAULT_SETTINGS } from '../db.js'
import { formatRupiah, formatDateShort, formatPeriod, terbilang } from '../lib/format.js'
import { exportCsv } from '../lib/exportCsv.js'
import { prepareReceiptImage } from '../lib/image.js'
import { isPdf } from '../lib/pdf.js'
import { extractReceipt } from '../lib/extract.js'
import { Icon, Modal, BlobImage, Spinner } from './ui.jsx'
import ReceiptForm from './ReceiptForm.jsx'

export default function BatchDetail({ batchId, settings, onBack, onOpenSettings }) {
  const batch = useLiveQuery(() => db.batches.get(batchId), [batchId])
  const receipts = useLiveQuery(
    () => db.receipts.where('batchId').equals(batchId).sortBy('order'),
    [batchId],
  )
  const fileRef = useRef(null)
  const [editing, setEditing] = useState(null)
  const [editBatch, setEditBatch] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [aiProgress, setAiProgress] = useState(null)

  if (!batch) return <p className="batch-meta">Memuat…</p>

  const list = receipts || []
  const drafts = list.filter((r) => r.status === 'draft')
  const doneList = list.filter((r) => r.status !== 'draft')
  const total = doneList.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const categories = settings?.categories?.length ? settings.categories : DEFAULT_SETTINGS.categories
  const hasKey = !!settings?.apiKey

  const inRange = (date) => {
    if (!date) return false
    const s = batch.startDate
    const e = batch.endDate
    if (s && e) return date >= s && date <= e
    return true
  }

  const importFiles = async (files) => {
    const arr = Array.from(files || []).filter((f) => f.type?.startsWith('image/') || isPdf(f))
    if (!arr.length) return
    setImporting(true)
    const errors = []
    for (const file of arr) {
      try {
        const blob = await prepareReceiptImage(file)
        await addReceipt(batchId, {
          image: blob,
          imageType: 'image/jpeg',
          filename: file.name,
          status: 'draft',
          source: 'manual',
        })
      } catch (e) {
        errors.push(`${file.name}: ${e.message}`)
      }
    }
    setImporting(false)
    if (errors.length) alert('Sebagian file gagal diproses:\n' + errors.join('\n'))
  }

  const completeAllWithAI = async () => {
    if (!hasKey) {
      alert('API key belum diatur. Buka Settings untuk mengaktifkan mode auto.')
      return
    }
    const targets = drafts.filter((r) => r.image)
    if (!targets.length) return
    setAiProgress({ done: 0, total: targets.length })
    const errors = []
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i]
      try {
        const ex = await extractReceipt({
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
          blob: r.image,
          categories,
        })
        const valid = ex.amount > 0 && inRange(ex.date)
        await updateReceipt(r.id, {
          date: ex.date || '',
          amount: ex.amount || 0,
          category: ex.category || '',
          description: ex.description || '',
          merchant: ex.merchant || '',
          source: 'auto',
          extraction: { candidates: ex.candidates || [], model: settings.model || '' },
          status: valid ? 'done' : 'draft',
        })
      } catch (e) {
        errors.push(`${r.filename || 'struk'}: ${e.message}`)
      }
      setAiProgress({ done: i + 1, total: targets.length })
    }
    setAiProgress(null)
    let msg = ''
    if (errors.length) msg += 'Sebagian gagal diekstrak:\n' + errors.join('\n') + '\n\n'
    msg += 'Selesai. Periksa struk yang masih ditandai "perlu dilengkapi" (jumlah kosong atau tanggal di luar rentang).'
    alert(msg.trim())
  }

  const doExportPdf = async () => {
    if (!doneList.length) return alert('Belum ada struk lengkap untuk diekspor.')
    if (drafts.length && !confirm(`${drafts.length} struk masih draft dan tidak akan masuk PDF. Lanjutkan?`)) return
    setExporting(true)
    try {
      const { exportPdf } = await import('../lib/exportPdf.js')
      await exportPdf(batch, doneList, settings || {})
    } catch (e) {
      alert('Gagal membuat PDF: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  const doExportCsv = () => {
    if (!doneList.length) return alert('Belum ada struk lengkap untuk diekspor.')
    if (drafts.length && !confirm(`${drafts.length} struk masih draft dan tidak akan masuk CSV. Lanjutkan?`)) return
    try {
      exportCsv(batch, doneList)
    } catch (e) {
      alert('Gagal membuat CSV: ' + e.message)
    }
  }

  const removeReceipt = (r) => {
    if (confirm('Hapus struk ini?')) deleteReceipt(r.id)
  }

  return (
    <>
      <div className="breadcrumb">
        <a onClick={onBack}><Icon name="back" size={15} /> Semua batch</a>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-head" style={{ marginBottom: 10 }}>
          <h2>{batch.name}</h2>
          <div className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={() => setEditBatch(true)}>
            <Icon name="edit" size={16} /> Edit
          </button>
        </div>
        <div className="batch-meta" style={{ marginBottom: 14 }}>
          {[batch.location, formatPeriod(batch.startDate, batch.endDate)]
            .filter(Boolean)
            .join('  ·  ') || 'Belum ada lokasi / periode'}
        </div>
        <div className="summary">
          <div>
            <div className="label">Total</div>
            <div className="total">{formatRupiah(total)}</div>
          </div>
          <div className="spacer" />
          <div style={{ textAlign: 'right', maxWidth: 300 }}>
            <div className="label">
              {doneList.length} struk
              {drafts.length > 0 && <span style={{ color: '#8a5a00' }}> · {drafts.length} draft</span>}
            </div>
            {total > 0 && (
              <div className="batch-meta" style={{ fontStyle: 'italic', fontSize: 12 }}>
                {terbilang(total)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 14 }}>
        <div className="spacer" />
        <button className="btn" onClick={doExportPdf} disabled={exporting}>
          {exporting ? <Spinner /> : <Icon name="file" size={17} />} PDF
        </button>
        <button className="btn" onClick={doExportCsv}>
          <Icon name="download" size={17} /> CSV
        </button>
      </div>

      <div
        className={'dropzone' + (dragOver ? ' drag' : '')}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); importFiles(e.dataTransfer.files) }}
        style={{ marginBottom: 16 }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { importFiles(e.target.files); e.target.value = '' }}
        />
        {importing ? (
          <span><Spinner /> Memproses file…</span>
        ) : (
          <>
            <div className="dz-icon"><Icon name="upload" size={26} /></div>
            <div>Tarik &amp; lepas gambar / PDF di sini, atau klik untuk pilih</div>
            <div className="dz-hint">bisa banyak sekaligus — tiap file jadi satu struk</div>
          </>
        )}
      </div>

      {drafts.length > 0 && (
        <div className="draft-banner" style={{ marginBottom: 16 }}>
          <Icon name="file" size={18} />
          <span>{drafts.length} struk perlu dilengkapi.</span>
          <div className="spacer" style={{ flex: 1 }} />
          {aiProgress ? (
            <span><Spinner size={15} /> Memproses {aiProgress.done}/{aiProgress.total}…</span>
          ) : hasKey ? (
            <button className="btn btn-sm btn-primary" onClick={completeAllWithAI}>
              <Icon name="sparkles" size={15} /> Lengkapi semua dengan AI
            </button>
          ) : (
            <a style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }} onClick={onOpenSettings}>
              atur API key untuk auto-isi
            </a>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty" style={{ color: 'var(--text-faint)' }}>
          Belum ada struk. Unggah gambar atau PDF di atas untuk mulai.
        </div>
      ) : (
        <div className="receipt-grid">
          {list.map((r, i) => {
            const isDraftCard = r.status === 'draft'
            const dateBad = r.date && !inRange(r.date)
            return (
              <div className={'receipt-card' + (isDraftCard ? ' is-draft' : '')} key={r.id}>
                <div className="receipt-thumb" onClick={() => setEditing(r)} style={{ cursor: 'pointer' }}>
                  {r.image ? (
                    <BlobImage blob={r.image} alt={r.description} />
                  ) : (
                    <span className="placeholder"><Icon name="receipt" size={30} /></span>
                  )}
                </div>
                <div className="receipt-body">
                  {isDraftCard ? (
                    <span className="tag tag-warn" style={{ alignSelf: 'flex-start' }}>Perlu dilengkapi</span>
                  ) : (
                    <div className="receipt-amount">{formatRupiah(r.amount)}</div>
                  )}
                  <div className="receipt-desc">
                    {r.description || <em className="batch-meta">Tanpa deskripsi</em>}
                  </div>
                  <div className="receipt-sub">
                    {[formatDateShort(r.date), r.merchant].filter(Boolean).join('  ·  ') || '—'}
                  </div>
                  {dateBad && (
                    <div className="receipt-sub" style={{ color: 'var(--danger)' }}>
                      tanggal di luar rentang
                    </div>
                  )}
                  <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {r.category && <span className="tag">{r.category}</span>}
                    {r.source === 'auto' && <span className="tag tag-auto">AI</span>}
                  </div>
                </div>
                <div className="receipt-actions">
                  <span className="batch-count" style={{ alignSelf: 'center', paddingLeft: 4 }}>#{i + 1}</span>
                  <div className="spacer" style={{ flex: 1 }} />
                  <button className="icon-btn" onClick={() => setEditing(r)} aria-label="Edit struk">
                    <Icon name="edit" size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => removeReceipt(r)} aria-label="Hapus struk">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <ReceiptForm
          receipt={editing}
          batch={batch}
          settings={settings}
          onClose={() => setEditing(null)}
          onOpenSettings={onOpenSettings}
        />
      )}

      {editBatch && <EditBatchModal batch={batch} onClose={() => setEditBatch(false)} />}
    </>
  )
}

function EditBatchModal({ batch, onClose }) {
  const [form, setForm] = useState({
    name: batch.name || '',
    location: batch.location || '',
    startDate: batch.startDate || '',
    endDate: batch.endDate || '',
    company: batch.company || '',
    employeeName: batch.employeeName || '',
  })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async () => {
    await updateBatch(batch.id, { ...form, name: form.name.trim() || 'Reimbursement baru' })
    onClose()
  }

  return (
    <Modal
      title="Edit batch"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={save}><Icon name="check" /> Simpan</button>
        </>
      }
    >
      <div className="field">
        <label>Nama batch</label>
        <input value={form.name} onChange={set('name')} />
      </div>
      <div className="field">
        <label>Lokasi</label>
        <input value={form.location} onChange={set('location')} />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Tanggal mulai</label>
          <input type="date" value={form.startDate} onChange={set('startDate')} />
        </div>
        <div className="field">
          <label>Tanggal selesai</label>
          <input type="date" value={form.endDate} onChange={set('endDate')} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Perusahaan (untuk PDF)</label>
          <input value={form.company} onChange={set('company')} placeholder="Opsional" />
        </div>
        <div className="field">
          <label>Nama pegawai (untuk PDF)</label>
          <input value={form.employeeName} onChange={set('employeeName')} placeholder="Opsional" />
        </div>
      </div>
      <p className="help">Kosongkan untuk memakai default dari Settings.</p>
    </Modal>
  )
}

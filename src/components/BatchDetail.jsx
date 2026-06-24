import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateBatch, deleteReceipt } from '../db.js'
import { formatRupiah, formatDateShort, formatPeriod, terbilang } from '../lib/format.js'
import { exportCsv } from '../lib/exportCsv.js'
import { Icon, Modal, BlobImage, Spinner } from './ui.jsx'
import ReceiptForm from './ReceiptForm.jsx'

export default function BatchDetail({ batchId, settings, onBack, onOpenSettings }) {
  const batch = useLiveQuery(() => db.batches.get(batchId), [batchId])
  const receipts = useLiveQuery(
    () => db.receipts.where('batchId').equals(batchId).sortBy('order'),
    [batchId],
  )
  const [editing, setEditing] = useState(null) // receipt object | 'new' | null
  const [editBatch, setEditBatch] = useState(false)
  const [exporting, setExporting] = useState(false)

  if (!batch) return <p className="batch-meta">Memuat…</p>

  const list = receipts || []
  const total = list.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const doExportPdf = async () => {
    if (list.length === 0) return alert('Belum ada struk untuk diekspor.')
    setExporting(true)
    try {
      // Lazy-loaded so jsPDF (~600 kB) stays out of the initial bundle.
      const { exportPdf } = await import('../lib/exportPdf.js')
      await exportPdf(batch, list, settings || {})
    } catch (e) {
      alert('Gagal membuat PDF: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  const doExportCsv = () => {
    if (list.length === 0) return alert('Belum ada struk untuk diekspor.')
    try {
      exportCsv(batch, list)
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

      <div className="card card-pad" style={{ marginBottom: 18 }}>
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
          <div style={{ textAlign: 'right', maxWidth: 280 }}>
            <div className="label">{list.length} struk</div>
            {total > 0 && (
              <div className="batch-meta" style={{ fontStyle: 'italic', fontSize: 12 }}>
                {terbilang(total)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" /> Tambah struk
        </button>
        <div className="spacer" />
        <button className="btn" onClick={doExportPdf} disabled={exporting}>
          {exporting ? <Spinner /> : <Icon name="file" size={17} />} PDF
        </button>
        <button className="btn" onClick={doExportCsv}>
          <Icon name="download" size={17} /> CSV
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="big"><Icon name="camera" size={40} /></div>
            <p>Belum ada struk di batch ini.</p>
            <p>Tambahkan gambar struk, lalu isi manual atau pakai AI untuk mengisinya.</p>
          </div>
        </div>
      ) : (
        <div className="receipt-grid">
          {list.map((r, i) => (
            <div className="receipt-card" key={r.id}>
              <div className="receipt-thumb">
                {r.image ? (
                  <BlobImage blob={r.image} alt={r.description} />
                ) : (
                  <span className="placeholder"><Icon name="receipt" size={30} /></span>
                )}
              </div>
              <div className="receipt-body">
                <div className="receipt-amount">{formatRupiah(r.amount)}</div>
                <div className="receipt-desc">{r.description || <em className="batch-meta">Tanpa deskripsi</em>}</div>
                <div className="receipt-sub">
                  {[formatDateShort(r.date), r.merchant].filter(Boolean).join('  ·  ')}
                </div>
                <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
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
          ))}
        </div>
      )}

      {editing && (
        <ReceiptForm
          batchId={batchId}
          receipt={editing === 'new' ? null : editing}
          settings={settings}
          onClose={() => setEditing(null)}
          onOpenSettings={onOpenSettings}
        />
      )}

      {editBatch && (
        <EditBatchModal batch={batch} onClose={() => setEditBatch(false)} />
      )}
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

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, createBatch, deleteBatch } from '../db.js'
import { formatRupiah, formatPeriod } from '../lib/format.js'
import { Icon, Modal } from './ui.jsx'

export default function BatchList({ onOpen }) {
  const batches = useLiveQuery(
    () => db.batches.orderBy('createdAt').reverse().toArray(),
    [],
  )
  const receipts = useLiveQuery(() => db.receipts.toArray(), [])
  const [showNew, setShowNew] = useState(false)

  const totalFor = (id) =>
    (receipts || []).filter((r) => r.batchId === id).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const countFor = (id) => (receipts || []).filter((r) => r.batchId === id).length

  const remove = (e, b) => {
    e.stopPropagation()
    if (confirm(`Hapus batch "${b.name}" beserta semua struknya?`)) deleteBatch(b.id)
  }

  return (
    <>
      <div className="section-head">
        <h2>Reimbursement</h2>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Icon name="plus" /> Batch baru
        </button>
      </div>

      {batches && batches.length === 0 && (
        <div className="card">
          <div className="empty">
            <div className="big"><Icon name="receipt" size={40} /></div>
            <p>Belum ada batch reimbursement.</p>
            <p>Buat satu untuk tiap perjalanan dinas, lalu tambahkan struk-strukmu.</p>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <Icon name="plus" /> Buat batch pertama
            </button>
          </div>
        </div>
      )}

      {batches && batches.length > 0 && (
        <div className="card">
          {batches.map((b) => (
            <div className="batch-row" key={b.id} onClick={() => onOpen(b.id)}>
              <div className="grow">
                <div className="batch-name">{b.name}</div>
                <div className="batch-meta">
                  {[b.location, formatPeriod(b.startDate, b.endDate)].filter(Boolean).join('  ·  ') ||
                    'Belum ada lokasi / periode'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="batch-total">{formatRupiah(totalFor(b.id))}</div>
                <div className="batch-count">{countFor(b.id)} struk</div>
              </div>
              <button className="icon-btn" onClick={(e) => remove(e, b)} aria-label="Hapus batch">
                <Icon name="trash" size={17} />
              </button>
              <Icon name="chevron" size={18} style={{ color: 'var(--text-faint)' }} />
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewBatchModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            onOpen(id)
          }}
        />
      )}
    </>
  )
}

function NewBatchModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', location: '', startDate: '', endDate: '' })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async () => {
    const id = await createBatch({
      ...form,
      name: form.name.trim() || 'Reimbursement baru',
    })
    onCreated(id)
  }

  return (
    <Modal
      title="Batch baru"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={submit}>
            <Icon name="check" /> Buat
          </button>
        </>
      }
    >
      <div className="field">
        <label>Nama batch</label>
        <input
          value={form.name}
          onChange={set('name')}
          placeholder="Reimburse Dinas Jatim"
          autoFocus
        />
      </div>
      <div className="field">
        <label>Lokasi</label>
        <input value={form.location} onChange={set('location')} placeholder="Jawa Timur" />
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
    </Modal>
  )
}

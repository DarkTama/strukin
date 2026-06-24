import { useRef, useState } from 'react'
import { addReceipt, updateReceipt, DEFAULT_SETTINGS } from '../db.js'
import { parseAmount, formatRupiah, todayISO } from '../lib/format.js'
import { compressImage } from '../lib/image.js'
import { extractReceipt } from '../lib/extract.js'
import { Icon, Modal, BlobImage, Spinner } from './ui.jsx'

export default function ReceiptForm({ batchId, receipt, settings, onClose, onOpenSettings }) {
  const isEdit = !!receipt
  const fileRef = useRef(null)

  const [imageBlob, setImageBlob] = useState(receipt?.image || null)
  const [filename, setFilename] = useState(receipt?.filename || '')
  const [form, setForm] = useState({
    date: receipt?.date || todayISO(),
    amount: receipt?.amount ? String(receipt.amount) : '',
    category: receipt?.category || '',
    description: receipt?.description || '',
    merchant: receipt?.merchant || '',
  })
  const [candidates, setCandidates] = useState(receipt?.extraction?.candidates || [])
  const [source, setSource] = useState(receipt?.source || 'manual')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const categories = settings?.categories?.length ? settings.categories : DEFAULT_SETTINGS.categories
  const catOptions = form.category && !categories.includes(form.category)
    ? [form.category, ...categories]
    : categories
  const hasKey = !!settings?.apiKey
  const parsedAmount = parseAmount(form.amount)

  const pickFile = async (file) => {
    if (!file) return
    setError('')
    try {
      const compact = await compressImage(file, { maxDim: 1700, quality: 0.85 })
      setImageBlob(compact)
      setFilename(file.name)
    } catch {
      setImageBlob(file)
      setFilename(file.name)
    }
  }

  const runAuto = async () => {
    if (!imageBlob) {
      setError('Pilih gambar struk dulu.')
      return
    }
    if (!hasKey) {
      setError('API key belum diatur. Buka Settings untuk mengaktifkan mode auto.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await extractReceipt({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        blob: imageBlob,
        categories,
      })
      setForm((f) => ({
        ...f,
        date: r.date || f.date,
        amount: r.amount ? String(r.amount) : f.amount,
        category: r.category || f.category,
        description: r.description || f.description,
        merchant: r.merchant || f.merchant,
      }))
      setCandidates(r.candidates || [])
      setSource('auto')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const resetForNext = () => {
    setImageBlob(null)
    setFilename('')
    setCandidates([])
    setSource('manual')
    setForm((f) => ({ ...f, amount: '', description: '', merchant: '' }))
  }

  const save = async (addAnother) => {
    const payload = {
      date: form.date,
      amount: parsedAmount,
      category: form.category,
      description: form.description.trim(),
      merchant: form.merchant.trim(),
      image: imageBlob,
      imageType: imageBlob?.type || '',
      filename,
      source,
      extraction: candidates.length
        ? { candidates, model: settings?.model || '' }
        : receipt?.extraction || null,
    }
    setBusy(true)
    try {
      if (isEdit) {
        await updateReceipt(receipt.id, payload)
        onClose()
      } else {
        await addReceipt(batchId, payload)
        if (addAnother) resetForNext()
        else onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit struk' : 'Tambah struk'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Batal</button>
          {!isEdit && (
            <button className="btn" onClick={() => save(true)} disabled={busy}>
              Simpan & tambah lagi
            </button>
          )}
          <button className="btn btn-primary" onClick={() => save(false)} disabled={busy}>
            {busy ? <Spinner /> : <Icon name="check" />} Simpan
          </button>
        </>
      }
    >
      <div className="field">
        <label>Gambar struk</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <div
          className="receipt-thumb"
          style={{ height: 150, borderRadius: 8, cursor: 'pointer', border: '1px dashed var(--border-strong)' }}
          onClick={() => fileRef.current?.click()}
        >
          {imageBlob ? (
            <BlobImage blob={imageBlob} alt="struk" />
          ) : (
            <span className="placeholder" style={{ textAlign: 'center' }}>
              <Icon name="upload" size={26} />
              <div style={{ fontSize: 13, marginTop: 6 }}>Klik untuk pilih / foto struk</div>
            </span>
          )}
        </div>
        {imageBlob && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="upload" size={15} /> Ganti
            </button>
            <button className="btn btn-sm btn-primary" onClick={runAuto} disabled={busy}>
              {busy ? <Spinner size={15} /> : <Icon name="sparkles" size={15} />} Isi otomatis (AI)
            </button>
            {!hasKey && (
              <span className="help" style={{ marginTop: 0 }}>
                butuh API key —{' '}
                <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={onOpenSettings}>
                  atur di Settings
                </a>
              </span>
            )}
          </div>
        )}
      </div>

      {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="field-row">
        <div className="field">
          <label>Tanggal</label>
          <input type="date" value={form.date} onChange={set('date')} />
        </div>
        <div className="field">
          <label>Kategori</label>
          <select value={form.category} onChange={set('category')}>
            <option value="">— pilih —</option>
            {catOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Jumlah (Rp)</label>
        {candidates.length > 0 && (
          <div className="chip-list" style={{ marginBottom: 8 }}>
            {candidates.map((c, i) => {
              const active = parsedAmount === c.value
              return (
                <button
                  key={i}
                  type="button"
                  className="radio-card"
                  style={{ flex: 'none', padding: '6px 10px', ...(active ? {} : {}) }}
                  onClick={() => setForm((f) => ({ ...f, amount: String(c.value) }))}
                >
                  <span className={active ? 'tag' : ''} style={{ marginRight: 6 }}>{c.label}</span>
                  {formatRupiah(c.value)}
                </button>
              )
            })}
          </div>
        )}
        <input
          inputMode="numeric"
          value={form.amount}
          onChange={set('amount')}
          placeholder="83.333"
        />
        <div className="help">= {formatRupiah(parsedAmount)}{candidates.length > 0 && ' · pilih kandidat di atas atau ketik sendiri'}</div>
      </div>

      <div className="field">
        <label>Deskripsi</label>
        <input value={form.description} onChange={set('description')} placeholder="belanja perbekalan, sarapan" />
      </div>

      <div className="field">
        <label>Merchant <span className="help" style={{ display: 'inline' }}>(opsional)</span></label>
        <input value={form.merchant} onChange={set('merchant')} placeholder="Indomaret" />
      </div>

      {source === 'auto' && (
        <div className="notice"><Icon name="sparkles" size={14} /> Diisi oleh AI — periksa lagi angka & tanggalnya sebelum simpan.</div>
      )}
    </Modal>
  )
}

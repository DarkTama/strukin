import { useState, useEffect } from 'react'
import { saveSettings } from '../db.js'
import { listModels } from '../lib/extract.js'
import { Icon, Spinner } from './ui.jsx'

const MODEL_SUGGESTIONS = [
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet',
  'qwen/qwen-2-vl-72b-instruct',
]

export default function Settings({ settings, onSaved, onBack }) {
  const [form, setForm] = useState(null)
  const [newCat, setNewCat] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [models, setModels] = useState(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [modelSearch, setModelSearch] = useState('')

  useEffect(() => {
    if (settings) setForm({ ...settings })
  }, [settings])

  if (!form) return <p className="batch-meta">Memuat…</p>

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setSaved(false)
  }

  const addCategory = () => {
    const v = newCat.trim()
    if (!v || form.categories.includes(v)) return
    setForm((f) => ({ ...f, categories: [...f.categories, v] }))
    setNewCat('')
    setSaved(false)
  }
  const removeCategory = (c) => {
    setForm((f) => ({ ...f, categories: f.categories.filter((x) => x !== c) }))
    setSaved(false)
  }

  const loadModels = async () => {
    setModelsLoading(true)
    setModelsError('')
    try {
      const ids = await listModels({ baseUrl: form.baseUrl, apiKey: form.apiKey })
      setModels(ids)
      if (!ids.length) setModelsError('Provider tidak mengembalikan daftar model.')
    } catch (e) {
      setModelsError(e.message)
      setModels(null)
    } finally {
      setModelsLoading(false)
    }
  }

  const save = async () => {
    await saveSettings({
      baseUrl: form.baseUrl.trim() || 'https://openrouter.ai/api/v1',
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      company: form.company,
      employeeName: form.employeeName,
      categories: form.categories,
      showSignature: form.showSignature !== false,
    })
    setSaved(true)
    onSaved?.()
  }

  return (
    <>
      <div className="breadcrumb">
        <a onClick={onBack}><Icon name="back" size={15} /> Semua batch</a>
      </div>

      <div className="section-head">
        <h2>Settings</h2>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Identitas (untuk PDF)</h3>
        <div className="field-row">
          <div className="field">
            <label>Nama perusahaan</label>
            <input value={form.company} onChange={set('company')} placeholder="Nama Perusahaan" />
          </div>
          <div className="field">
            <label>Nama pegawai</label>
            <input value={form.employeeName} onChange={set('employeeName')} placeholder="Nama kamu" />
          </div>
        </div>
        <p className="help">Dipakai sebagai default di header PDF. Bisa ditimpa per-batch.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.showSignature !== false}
            onChange={(e) => { setForm((f) => ({ ...f, showSignature: e.target.checked })); setSaved(false) }}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontSize: 14 }}>Tampilkan kolom tanda tangan di PDF</span>
        </label>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Kategori</h3>
        <div className="chip-list" style={{ marginBottom: 12 }}>
          {form.categories.map((c) => (
            <span className="chip" key={c}>
              {c}
              <button onClick={() => removeCategory(c)} aria-label={`Hapus ${c}`}>
                <Icon name="x" size={14} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="Tambah kategori…"
            style={{ flex: 1, padding: '9px 11px', border: '1px solid var(--border-strong)', borderRadius: 7 }}
          />
          <button className="btn" onClick={addCategory}><Icon name="plus" /> Tambah</button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>Mode auto (AI)</h3>
        <p className="notice" style={{ marginBottom: 16 }}>
          API key disimpan hanya di browser ini (IndexedDB) dan dikirim langsung ke provider yang kamu
          pilih saat memproses gambar. Mode manual tidak butuh ini dan tidak mengirim apa pun.
        </p>
        <div className="field">
          <label>Base URL (OpenAI-compatible)</label>
          <input value={form.baseUrl} onChange={set('baseUrl')} placeholder="https://openrouter.ai/api/v1" />
        </div>
        <div className="field">
          <label>API key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={set('apiKey')}
              placeholder="sk-or-..."
              style={{ flex: 1 }}
              autoComplete="off"
            />
            <button className="btn" onClick={() => setShowKey((v) => !v)}>
              {showKey ? 'Sembunyikan' : 'Lihat'}
            </button>
          </div>
        </div>
        <div className="field">
          <label>Model vision</label>
          <input value={form.model} onChange={set('model')} list="model-suggestions" placeholder="google/gemini-2.0-flash-001" />
          <datalist id="model-suggestions">
            {MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
          </datalist>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <button className="btn btn-sm" onClick={loadModels} disabled={modelsLoading || !form.apiKey}>
              {modelsLoading ? <Spinner size={15} /> : <Icon name="refresh" size={15} />} Muat daftar model
            </button>
            <span className="help" style={{ marginTop: 0 }}>ambil semua model dari provider</span>
          </div>
          {modelsError && <div className="error-box" style={{ marginTop: 8 }}>{modelsError}</div>}
          {models && (
            <div style={{ marginTop: 8 }}>
              <div style={{ position: 'relative' }}>
                <Icon name="search" size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-faint)' }} />
                <input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder={`Cari di ${models.length} model…`}
                  style={{ paddingLeft: 30 }}
                />
              </div>
              <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 7, marginTop: 6 }}>
                {(() => {
                  const q = modelSearch.trim().toLowerCase()
                  const matches = models.filter((m) => m.toLowerCase().includes(q))
                  if (!matches.length) {
                    return <div style={{ padding: '10px 12px', color: 'var(--text-faint)', fontSize: 13 }}>Tidak ada yang cocok.</div>
                  }
                  return matches.slice(0, 300).map((m) => (
                    <div
                      key={m}
                      onClick={() => { setForm((f) => ({ ...f, model: m })); setSaved(false) }}
                      style={{
                        padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                        fontFamily: 'var(--font-mono, monospace)',
                        background: form.model === m ? 'var(--accent-soft)' : 'transparent',
                        color: form.model === m ? 'var(--accent)' : 'var(--text)',
                      }}
                    >
                      {m}
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
          <p className="help">Pakai model yang mendukung input gambar (vision).</p>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={save}><Icon name="check" /> Simpan settings</button>
        {saved && <span style={{ color: 'var(--success)', fontSize: 14 }}><Icon name="check" size={15} /> Tersimpan</span>}
      </div>
    </>
  )
}

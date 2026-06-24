import { useEffect, useState } from 'react'

// Minimal inline-SVG icon set (stroke-based, inherits currentColor).
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7',
  edit: 'M4 20h4L18 10l-4-4L4 16v4zM13.5 6.5l4 4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h5l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.07-.33.1-.66.1-1z',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M5 21h14',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5',
  back: 'M19 12H5m0 0l6 6m-6-6l6-6',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 13l4 4L19 7',
  receipt: 'M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3zM9 8h6M9 12h6M9 16h4',
  chevron: 'M9 6l6 6-6 6',
  upload: 'M12 17V5m0 0l-4 4m4-4l4 4M5 21h14',
  loader: 'M12 3a9 9 0 1 0 9 9',
  refresh: 'M4 4v6h6M20 20v-6h-6M20 9a8 8 0 0 0-14-4M4 15a8 8 0 0 0 14 4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  sparkles: 'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z',
  camera: 'M4 8h3l2-2h6l2 2h3v11H4V8zm8 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
}

export function Icon({ name, size = 18, className, style }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export function Spinner({ size = 18 }) {
  return <Icon name="loader" size={size} className="spin" />
}

// Renders a Blob as an <img>, managing the object URL lifecycle.
export function BlobImage({ blob, alt = '', className }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  if (!url) return null
  return <img src={url} alt={alt} className={className} />
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" style={wide ? { maxWidth: 640 } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

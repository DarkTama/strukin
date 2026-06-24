// Indonesian Rupiah formatting/parsing + number-to-words (terbilang) + dates.

const idNumber = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

// 70500 -> "70.500"
export function formatNumber(n) {
  return idNumber.format(Math.round(Number(n) || 0))
}

// 70500 -> "Rp 70.500"
export function formatRupiah(n) {
  return 'Rp ' + formatNumber(n)
}

// Parse user/AI input into an integer rupiah amount.
// Handles "Rp 70.500", "70.500", "83.333", "27.000,00".
export function parseAmount(input) {
  if (typeof input === 'number') return Math.round(input)
  if (!input) return 0
  let s = String(input).trim()
  s = s.replace(/rp/i, '').replace(/\s/g, '')
  // Drop a decimal part if present (Indonesian uses comma as decimal sep).
  if (s.includes(',')) s = s.split(',')[0]
  // Remove thousands separators and any stray non-digits.
  s = s.replace(/[. ]/g, '').replace(/[^0-9-]/g, '')
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

const ones = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima',
  'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas',
]

function toWords(n) {
  n = Math.floor(Math.abs(n))
  if (n < 12) return ones[n]
  if (n < 20) return toWords(n - 10) + ' belas'
  if (n < 100) return toWords(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + toWords(n % 10) : '')
  if (n < 200) return 'seratus' + (n - 100 ? ' ' + toWords(n - 100) : '')
  if (n < 1000) return toWords(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + toWords(n % 100) : '')
  if (n < 2000) return 'seribu' + (n - 1000 ? ' ' + toWords(n - 1000) : '')
  if (n < 1e6) return toWords(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + toWords(n % 1000) : '')
  if (n < 1e9) return toWords(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + toWords(n % 1e6) : '')
  if (n < 1e12) return toWords(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + toWords(n % 1e9) : '')
  return toWords(Math.floor(n / 1e12)) + ' triliun' + (n % 1e12 ? ' ' + toWords(n % 1e12) : '')
}

// 592733 -> "lima ratus sembilan puluh dua ribu tujuh ratus tiga puluh tiga rupiah"
export function terbilang(n) {
  const v = Math.round(Number(n) || 0)
  if (v === 0) return 'nol rupiah'
  const words = toWords(v).replace(/\s+/g, ' ').trim()
  return words + ' rupiah'
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function parseISO(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

// "2025-08-18" -> "18 Agu"
export function formatDateShort(iso) {
  const p = parseISO(iso)
  if (!p) return iso || ''
  return `${p.d} ${MONTHS_SHORT[p.m - 1]}`
}

// "2025-08-18" -> "18 Agustus 2025"
export function formatDateLong(iso) {
  const p = parseISO(iso)
  if (!p) return iso || ''
  return `${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y}`
}

// Range like "18 - 22 Agustus 2025" / "18 Agu - 3 Sep 2025"
export function formatPeriod(startISO, endISO) {
  const a = parseISO(startISO)
  const b = parseISO(endISO)
  if (a && b) {
    if (a.y === b.y && a.m === b.m) return `${a.d} - ${b.d} ${MONTHS_LONG[b.m - 1]} ${b.y}`
    if (a.y === b.y) return `${a.d} ${MONTHS_SHORT[a.m - 1]} - ${b.d} ${MONTHS_SHORT[b.m - 1]} ${b.y}`
    return `${formatDateLong(startISO)} - ${formatDateLong(endISO)}`
  }
  if (a) return formatDateLong(startISO)
  if (b) return formatDateLong(endISO)
  return ''
}

// Today's date as "YYYY-MM-DD" in local time.
export function todayISO() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

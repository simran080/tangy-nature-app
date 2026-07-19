function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// Extracts numeric part from any SKU ID format (e.g. "06", "6", "TN-00006" → 6)
function skuIdNum(id) {
  const m = String(id||'').match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}
// Normalizes any SKU ID format to canonical "TN-00006" form for comparison
function normalizeSkuId(id) {
  if (!id) return '';
  return 'TN-' + String(skuIdNum(id)).padStart(5, '0');
}

function nextSkuId() {
  const max = _skus.length ? Math.max(..._skus.map(s => skuIdNum(s.id))) : 0;
  return 'TN-' + String(max + 1).padStart(5, '0');
}

// Extracts numeric part from any Sale ID format (e.g. "S076", "S-00076" → 76)
function saleIdNum(id) {
  const m = String(id||'').match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}
// Normalizes any Sale ID format to canonical "S-00076" form for comparison
function normalizeSaleId(id) {
  if (!id) return '';
  return 'S-' + String(saleIdNum(id)).padStart(5, '0');
}
function nextSaleId() {
  const max = _sales.length ? Math.max(..._sales.map(s => saleIdNum(s.id))) : 0;
  return 'S-' + String(max + 1).padStart(5, '0');
}

// Extracts numeric part from any Purchase ID format (e.g. "P064", "P-00064" → 64)
function purchaseIdNum(id) {
  const m = String(id||'').match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}
// Normalizes any Purchase ID format to canonical "P-00064" form for comparison
function normalizePurchaseId(id) {
  if (!id) return '';
  return 'P-' + String(purchaseIdNum(id)).padStart(5, '0');
}
function nextPurchaseId() {
  const max = _purchases.length ? Math.max(..._purchases.map(p => purchaseIdNum(p.id))) : 0;
  return 'P-' + String(max + 1).padStart(5, '0');
}
function fmt(n) { return '$' + (+n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }

// Escape user-entered text before interpolating into innerHTML (product
// names, comments, sources, etc. are all free text — never trust them raw).
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[ch]);
}
// Only allow http(s) URLs through to an href — rejects javascript: etc.
function safeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value), location.href);
    return (url.protocol === 'https:' || url.protocol === 'http:') ? esc(url.href) : '';
  } catch { return ''; }
}

// Split a dollar amount evenly across n units to the cent, with any leftover
// cents allocated to the first units so the parts sum exactly to the total.
function splitEven(total, n) {
  const cents = Math.round((+total||0) * 100);
  const base = Math.floor(cents / n);
  const rem = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 100);
}

// ─── CSV EXPORT ───────────────────────────────────────────
function _csvEsc(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; }
function toCSV(rows, cols) {
  const head = cols.map(c => _csvEsc(c.label)).join(',');
  const body = rows.map(r => cols.map(c => _csvEsc(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')).join('\n');
  return head + '\n' + body;
}
function downloadCSV(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fmtDate(d) { if (!d) return '—'; const dt = new Date(d+'T00:00:00'); return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }

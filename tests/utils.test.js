// Unit tests for the pure functions in js/utils.js.
//
// Run with:  node --test   (from the repo root)
//
// No dependencies, no build step — js/utils.js declares its functions as
// plain globals (this app doesn't use ES modules on purpose, see
// js/README or the modularization notes), so we load it into a vm sandbox
// and pull the functions back out rather than requiring it directly.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run in the SAME realm as this test process (not a fresh vm.createContext
// sandbox) — utils.js's safeUrl() needs the real global `URL`, which isn't
// a core JS builtin and wouldn't exist in an isolated sandbox, and a
// separate realm would also make its arrays fail strict-equality checks
// against arrays created in this file even when their contents match.
global.location = { href: 'https://simran080.github.io/tangy-nature-app/' };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
vm.runInThisContext(src, { filename: 'js/utils.js' });

const {
  skuIdNum, normalizeSkuId,
  saleIdNum, normalizeSaleId,
  purchaseIdNum, normalizePurchaseId,
  fmt, esc, safeUrl, splitEven, toCSV, fmtDate,
} = global;

// ─── ID parsing / normalization ──────────────────────────────

test('skuIdNum extracts the numeric part from any SKU id format', () => {
  assert.equal(skuIdNum('TN-00006'), 6);
  assert.equal(skuIdNum('6'), 6);
  assert.equal(skuIdNum('06'), 6);
  assert.equal(skuIdNum(''), 0);
  assert.equal(skuIdNum(null), 0);
  assert.equal(skuIdNum(undefined), 0);
});

test('normalizeSkuId produces the canonical TN-##### form regardless of input format', () => {
  assert.equal(normalizeSkuId('6'), 'TN-00006');
  assert.equal(normalizeSkuId('TN-6'), 'TN-00006');
  assert.equal(normalizeSkuId('TN-00006'), 'TN-00006');
  assert.equal(normalizeSkuId(''), '');
  assert.equal(normalizeSkuId(null), '');
});

test('saleIdNum / normalizeSaleId', () => {
  assert.equal(saleIdNum('S076'), 76);
  assert.equal(saleIdNum('S-00076'), 76);
  assert.equal(normalizeSaleId('76'), 'S-00076');
  assert.equal(normalizeSaleId('S076'), 'S-00076');
});

test('purchaseIdNum / normalizePurchaseId', () => {
  assert.equal(purchaseIdNum('P064'), 64);
  assert.equal(purchaseIdNum('P-00064'), 64);
  assert.equal(normalizePurchaseId('P064'), 'P-00064');
});

// Two IDs that normalize to the same canonical form must be treated as the
// same record — this is what unsold-inventory / trade-linking matching
// depends on throughout the app.
test('normalize*Id treats different-format inputs of the same number as equal', () => {
  assert.equal(normalizeSkuId('6'), normalizeSkuId('TN-00006'));
  assert.equal(normalizeSaleId('76'), normalizeSaleId('S-00076'));
  assert.equal(normalizePurchaseId('64'), normalizePurchaseId('P-00064'));
});

// ─── Money formatting ─────────────────────────────────────────

test('fmt formats numbers as USD with thousands separators', () => {
  assert.equal(fmt(0), '$0.00');
  assert.equal(fmt(1234.5), '$1,234.50');
  assert.equal(fmt(1234567.891), '$1,234,567.89');
  assert.equal(fmt(-5), '$-5.00');
});

test('fmt treats non-numeric/missing input as 0', () => {
  assert.equal(fmt(null), '$0.00');
  assert.equal(fmt(undefined), '$0.00');
  assert.equal(fmt('abc'), '$0.00');
  assert.equal(fmt(''), '$0.00');
});

// splitEven backs the bulk-purchase shipping/gas allocation — the app's own
// selling point per its own docs is "shipping/gas split to the cent," so
// this one directly protects a stated feature.
test('splitEven divides a total evenly across n units to the cent', () => {
  assert.deepEqual(splitEven(0, 4), [0, 0, 0, 0]);
  assert.deepEqual(splitEven(10, 2), [5, 5]);
});

test('splitEven allocates leftover cents to the first units, never drops a cent', () => {
  const parts = splitEven(10, 3);
  assert.deepEqual(parts, [3.34, 3.33, 3.33]);
  const sum = parts.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 10) < 1e-9, `parts should sum back to the total, got ${sum}`);
});

test('splitEven handles a total that does not divide evenly at all', () => {
  const parts = splitEven(9.99, 4);
  const sum = Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100;
  assert.equal(sum, 9.99);
});

// ─── HTML/URL escaping (security-relevant — see the esc()/safeUrl() sweep
// done across every list/detail render this app does) ──────────────────

test('esc escapes the five HTML-significant characters', () => {
  assert.equal(esc(`<script>alert('&"')</script>`), '&lt;script&gt;alert(&#39;&amp;&quot;&#39;)&lt;/script&gt;');
});

test('esc treats null/undefined as empty string, not the literal word', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});

test('esc passes plain text through unchanged', () => {
  assert.equal(esc('Sony 24-70mm f/2.8'), 'Sony 24-70mm f/2.8');
});

test('safeUrl allows http(s) URLs through', () => {
  assert.equal(safeUrl('https://example.com/label.pdf'), 'https://example.com/label.pdf');
  assert.equal(safeUrl('http://example.com'), 'http://example.com/');
});

test('safeUrl rejects javascript: and other non-http(s) schemes', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '');
});

test('safeUrl rejects empty/missing input rather than treating it as valid', () => {
  assert.equal(safeUrl(''), '');
  assert.equal(safeUrl(null), '');
  assert.equal(safeUrl(undefined), '');
});

// ─── CSV export ───────────────────────────────────────────────

test('toCSV quotes fields containing commas, quotes, or newlines', () => {
  const rows = [{ name: 'Sony, 24-70mm "pro"', note: 'line1\nline2' }];
  const cols = [{ label: 'Name', key: 'name' }, { label: 'Note', key: 'note' }];
  const csv = toCSV(rows, cols);
  const expected = 'Name,Note\n"Sony, 24-70mm ""pro"""' + ',' + '"line1\nline2"';
  assert.equal(csv, expected);
});

// ─── Date formatting ────────────────────────────────────────

test('fmtDate formats an ISO date string as "Mon D, YYYY"', () => {
  assert.equal(fmtDate('2026-05-20'), 'May 20, 2026');
});

test('fmtDate returns an em-dash placeholder for missing input', () => {
  assert.equal(fmtDate(''), '—');
  assert.equal(fmtDate(null), '—');
});

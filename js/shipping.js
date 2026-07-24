// ─── SHIPPING LABELS (Shippo via Edge Function) ────────────
const SHIPPO_FN_URL = `${SUPABASE_URL}/functions/v1/shippo-label`;

// Business ship-from address (editable here). Used as address_from on every label.
const SHIP_FROM = {
  name: 'Simarpreet Kaur',
  street1: '3 Upland Woods Cir Unit 408',
  city: 'Norwood', state: 'MA', zip: '02062', country: 'US',
};

let _shipCtx = null; // { mode:'presale'|'postsale', saleId, rates:[], selectedRateId, selectedAmount }
// Rate selected in the Log Sale flow but NOT yet purchased — purchase happens on Log Sale.
// { rateId, amount, provider, servicelevel, purchased: <buy response once bought, else null> }
let _pendingShipLabel = null;

// ─── UNRECONCILED LABEL PURCHASE (persisted across reload) ──
// Buying a Shippo label and saving the sale/updating it can't be one atomic
// transaction — they're two different systems. If the save fails right
// after a successful purchase, this is the only record that a real charge
// happened. Persisted the moment the purchase succeeds, before the save is
// even attempted, so a crash or refresh doesn't lose track of it — surfaced
// as a banner on next load until a human reconciles it.
const PENDING_LABEL_KEY = 'tn_pending_label';
function _persistPendingLabel(info) {
  try { localStorage.setItem(PENDING_LABEL_KEY, JSON.stringify({ ...info, at: Date.now() })); } catch {}
}
function _clearPendingLabel() {
  try { localStorage.removeItem(PENDING_LABEL_KEY); } catch {}
  const wrap = document.getElementById('pending-label-banner-wrap');
  if (wrap) wrap.style.display = 'none';
}
function checkPendingLabel() {
  const wrap = document.getElementById('pending-label-banner-wrap');
  const banner = document.getElementById('pending-label-banner');
  if (!wrap || !banner) return;
  let info;
  try { info = JSON.parse(localStorage.getItem(PENDING_LABEL_KEY) || 'null'); } catch { info = null; }
  if (!info) { wrap.style.display = 'none'; return; }
  const label = info.label || {};
  const when = info.at ? new Date(info.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  banner.innerHTML = `
    <div style="font-weight:600;font-size:13px;color:var(--red);margin-bottom:4px;">Unreconciled shipping label</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">
      A label was purchased (${esc(when)}) but ${info.mode === 'postsale' ? `saving it to sale <strong>${esc(info.saleId||'')}</strong>` : 'logging the sale'} failed. This was a real charge — nothing was lost, but it needs to be reconciled manually.
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:2px;">Tracking: <span style="font-family:'DM Mono',monospace;color:var(--text);">${esc(label.tracking_number||'—')}</span></div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;">Amount: ${fmt(info.amount)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${label.label_url ? `<a href="${safeUrl(label.label_url)}" target="_blank" rel="noopener" class="btn" style="padding:6px 12px;font-size:12px;">Open label</a>` : ''}
      ${info.mode === 'postsale' ? `<button class="btn" style="padding:6px 12px;font-size:12px;" onclick="retryPendingLabel()">Retry saving to sale</button>` : ''}
      <button class="btn" style="padding:6px 12px;font-size:12px;" onclick="_clearPendingLabel()">Dismiss (handled manually)</button>
    </div>`;
  wrap.style.display = 'block';
}
async function retryPendingLabel() {
  let info;
  try { info = JSON.parse(localStorage.getItem(PENDING_LABEL_KEY) || 'null'); } catch { info = null; }
  if (!info || info.mode !== 'postsale') return;
  try {
    await applyLabelToSale(info.saleId, info.label, info.amount, info.provider);
    toast('Reconciled — label saved to sale');
  } catch (e) {
    toast('Still failing: ' + e.message);
  }
  checkPendingLabel();
}

function toggleUseShippo() {
  const on = document.getElementById('sale-use-shippo').checked;
  document.getElementById('sale-get-rates-btn').style.display = on ? 'block' : 'none';
  if (!on) {
    _pendingShipLabel = null;
    document.getElementById('sale-label-hint').textContent = '';
  }
}

function _resetShipLabelUI() {
  document.getElementById('ship-to-name').value = '';
  document.getElementById('ship-to-street').value = '';
  document.getElementById('ship-to-city').value = '';
  document.getElementById('ship-to-zip').value = '';
  document.getElementById('ship-to-phone').value = '';
  document.getElementById('ship-rates').innerHTML = '';
  document.getElementById('ship-result').innerHTML = '';
  document.getElementById('ship-insure-on').checked = false;
  document.getElementById('ship-insure-fields').style.display = 'none';
  document.getElementById('ship-insure-content').value = 'Camera gear';
  document.getElementById('ship-signature').value = '';
  const btn = document.getElementById('ship-rates-btn');
  btn.innerHTML = 'Compare Rates' + ICON_CHEVRON_R; btn.disabled = false; btn.style.display = '';
}

function toggleShipInsurance() {
  document.getElementById('ship-insure-fields').style.display =
    document.getElementById('ship-insure-on').checked ? 'block' : 'none';
}

// Buy a label for an already-logged sale (retroactive) — from the sale detail sheet.
function openShipLabel(saleId) {
  const s = _sales.find(x => x.id === saleId);
  if (!s) return;
  const { s: sku } = _skuFor(s.purchaseId);
  _shipCtx = { mode: 'postsale', saleId, rates: [], selectedRateId: null, selectedAmount: null };
  document.getElementById('shiplabel-title').textContent = 'Buy Shipping Label';
  document.getElementById('shiplabel-sub').textContent = `${sku.product || 'Item'} · ${s.id}`;
  _resetShipLabelUI();
  document.getElementById('ship-to-state').value = s.state || '';
  document.getElementById('ship-insure-amount').value = (+s.unitPrice || +s.netCost || 0).toFixed(2);
  closeSheet('detail-sheet');
  openSheet('shiplabel-sheet');
}

// Buy a label WHILE logging a sale, before it's saved — from the Log Sale sheet.
// On purchase, fills Shipping paid + appends tracking to notes right in that form.
function openShipLabelForSale() {
  const purchaseId = document.getElementById('sale-purchase').value;
  if (!purchaseId) { toast('Select a purchase (item being sold) first'); return; }
  const purchase = _purchases.find(p => p.id === purchaseId) || {};
  const sku = _skus.find(s => normalizeSkuId(s.id) === normalizeSkuId(purchase.skuId)) || {};
  _shipCtx = { mode: 'presale', saleId: null, rates: [], selectedRateId: null, selectedAmount: null };
  document.getElementById('shiplabel-title').textContent = 'Get Shipping Rates';
  document.getElementById('shiplabel-sub').textContent = `${sku.product || 'Item'} (before sale is logged)`;
  _resetShipLabelUI();
  document.getElementById('ship-to-state').value = document.getElementById('sale-state').value || '';
  const salePrice = +document.getElementById('sale-price').value || 0;
  document.getElementById('ship-insure-amount').value = (salePrice || +purchase.netCost || 0).toFixed(2);
  document.getElementById('ship-insure-content').value = sku.product || 'Camera gear';
  openSheet('shiplabel-sheet');
}

function _shipToAddress() {
  return {
    name: document.getElementById('ship-to-name').value.trim(),
    street1: document.getElementById('ship-to-street').value.trim(),
    city: document.getElementById('ship-to-city').value.trim(),
    state: document.getElementById('ship-to-state').value.trim().toUpperCase(),
    zip: document.getElementById('ship-to-zip').value.trim(),
    phone: document.getElementById('ship-to-phone').value.trim(),
    country: 'US',
  };
}
function _shipParcel() {
  return {
    length: +document.getElementById('ship-len').value || 0,
    width: +document.getElementById('ship-wid').value || 0,
    height: +document.getElementById('ship-hgt').value || 0,
    distance_unit: 'in',
    weight: +document.getElementById('ship-weight').value || 0,
    mass_unit: 'lb',
  };
}
function _shipExtra() {
  const extra = {};
  const sig = document.getElementById('ship-signature').value;
  if (sig) extra.signature_confirmation = sig;
  if (document.getElementById('ship-insure-on').checked) {
    const amount = +document.getElementById('ship-insure-amount').value || 0;
    if (amount > 0) {
      extra.insurance = {
        amount: amount.toFixed(2),
        currency: 'USD',
        content: document.getElementById('ship-insure-content').value.trim() || 'Camera gear',
      };
    }
  }
  return extra;
}

// Map a Shippo rate's carrier name to our fixed Carrier dropdown values.
// Returns '' if it doesn't recognize the carrier (e.g. DHL) so the caller
// falls back to whatever the user picked manually.
function _mapCarrier(provider) {
  const p = (provider || '').toUpperCase();
  if (p.includes('USPS')) return 'USPS';
  if (p.includes('FEDEX')) return 'FedEx';
  if (p.includes('UPS')) return 'UPS';
  return '';
}

async function _shippoCall(payload) {
  await ensureValidToken();
  const res = await fetch(SHIPPO_FN_URL, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${_authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `Request failed (${res.status})`);
  return data;
}

async function fetchShipRates() {
  const to = _shipToAddress();
  const parcel = _shipParcel();
  if (!to.name || !to.street1 || !to.city || !to.state || !to.zip) {
    toast('Fill in the full buyer address first'); return;
  }
  if (!parcel.weight) { toast('Enter the parcel weight'); return; }
  if (document.getElementById('ship-insure-on').checked && !(+document.getElementById('ship-insure-amount').value > 0)) {
    toast('Enter a declared value to insure this shipment'); return;
  }
  const extra = _shipExtra();
  const btn = document.getElementById('ship-rates-btn');
  btn.disabled = true; btn.textContent = 'Fetching rates…';
  document.getElementById('ship-rates').innerHTML = '';
  document.getElementById('ship-result').innerHTML = '';
  try {
    const data = await _shippoCall({ action: 'rates', from: SHIP_FROM, to, parcel, extra });
    _shipCtx.rates = data.rates || [];
    _shipCtx.extraSummary = [
      extra.insurance ? `Insured $${extra.insurance.amount}` : null,
      extra.signature_confirmation ? 'Signature required' : null,
    ].filter(Boolean).join(' · ');
    renderShipRates();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = 'Compare Rates' + ICON_CHEVRON_R;
  }
}

function renderShipRates() {
  const box = document.getElementById('ship-rates');
  const rates = _shipCtx.rates;
  if (!rates.length) { box.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0;">No rates returned for this address/parcel.</div>'; return; }
  const extraBadge = _shipCtx.extraSummary
    ? `<div style="font-size:11px;color:var(--blue);background:var(--blue-dim);border-radius:6px;padding:5px 10px;margin-bottom:10px;display:inline-flex;align-items:center;">${ICON_CHECK}${_shipCtx.extraSummary}</div>` : '';
  box.innerHTML = `<div class="section-title" style="padding:0;margin:0 0 8px;">Rates (cheapest first)</div>` + extraBadge +
    rates.map((r, i) => `
      <div onclick="selectShipRate(${i})" id="ship-rate-${i}" style="display:flex;align-items:center;gap:10px;padding:11px 12px;border:0.5px solid ${_shipCtx.selectedRateId===r.object_id?'var(--amber)':'var(--border)'};background:${_shipCtx.selectedRateId===r.object_id?'var(--amber-dim)':'var(--bg2)'};border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text);">${esc(r.provider)} · ${esc(r.servicelevel||'')}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:1px;">${r.estimated_days!=null?r.estimated_days+' day'+(r.estimated_days==1?'':'s'):'—'}</div>
        </div>
        <div style="font-size:15px;font-weight:600;font-family:'DM Mono',monospace;color:var(--amber);">$${(+r.amount).toFixed(2)}</div>
      </div>`).join('') +
    (_shipCtx.mode === 'presale'
      ? `<button class="btn btn-primary" id="ship-buy-btn" style="margin-top:4px;opacity:0.5;" disabled onclick="useSelectedShipRate()">Select a rate</button>`
      : `<button class="btn btn-primary" id="ship-buy-btn" style="margin-top:4px;opacity:0.5;" disabled onclick="buyShipLabel()">Select a rate to buy</button>`);
}

function selectShipRate(i) {
  const r = _shipCtx.rates[i];
  if (!r) return;
  _shipCtx.selectedRateId = r.object_id;
  _shipCtx.selectedAmount = +r.amount;
  _shipCtx.selectedProvider = r.provider;
  _shipCtx.selectedServicelevel = r.servicelevel;
  renderShipRates();
  const buy = document.getElementById('ship-buy-btn');
  buy.disabled = false; buy.style.opacity = '1';
  buy.textContent = _shipCtx.mode === 'presale'
    ? `Use This Rate — $${(+r.amount).toFixed(2)}`
    : `Buy Label — $${(+r.amount).toFixed(2)}`;
}

// Presale only: just quote + remember the rate, fill Shipping paid — no charge yet.
// The actual purchase happens when the sale is saved (see saveSale()).
function useSelectedShipRate() {
  if (!_shipCtx.selectedRateId) { toast('Select a rate first'); return; }
  _pendingShipLabel = {
    rateId: _shipCtx.selectedRateId,
    amount: _shipCtx.selectedAmount,
    provider: _shipCtx.selectedProvider,
    servicelevel: _shipCtx.selectedServicelevel,
    purchased: null,
  };
  document.getElementById('sale-ship-paid').value = _shipCtx.selectedAmount.toFixed(2);
  document.getElementById('sale-label-hint').textContent =
    `Rate selected: $${_shipCtx.selectedAmount.toFixed(2)} (${_shipCtx.selectedProvider} · ${_shipCtx.selectedServicelevel||''}) — label will be purchased when you log this sale.`;
  document.getElementById('sale-label-hint').style.color = 'var(--blue)';
  calcSaleProfit();
  closeSheet('shiplabel-sheet');
}

// Retroactive path only (sale already exists in the DB) — purchases immediately.
async function buyShipLabel() {
  const rateId = _shipCtx.selectedRateId;
  const amount = _shipCtx.selectedAmount;
  if (!rateId) { toast('Select a rate first'); return; }
  if (!confirm(`Buy this shipping label for $${amount.toFixed(2)}? This charges your Shippo account.`)) return;
  const buy = document.getElementById('ship-buy-btn');
  buy.disabled = true; buy.textContent = 'Purchasing…';
  try {
    const data = await _shippoCall({ action: 'buy', rate_id: rateId, label_file_type: 'PDF_4x6' });
    _persistPendingLabel({ mode: 'postsale', saleId: _shipCtx.saleId, label: data, amount, provider: _shipCtx.selectedProvider });
    await applyLabelToSale(_shipCtx.saleId, data, amount, _shipCtx.selectedProvider);
    document.getElementById('ship-rates').innerHTML = '';
    document.getElementById('ship-result').innerHTML = `
      <div style="background:var(--green-dim);border:0.5px solid var(--green);border-radius:var(--radius);padding:14px 16px;">
        <div style="display:flex;align-items:center;font-size:13px;font-weight:600;color:var(--green);margin-bottom:8px;">${ICON_CHECK}Label purchased</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Tracking</div>
        <div style="font-size:14px;font-family:'DM Mono',monospace;color:var(--text);margin-bottom:12px;word-break:break-all;">${esc(data.tracking_number||'—')}</div>
        <a href="${safeUrl(data.label_url)}" target="_blank" rel="noopener" class="btn btn-primary" style="display:block;text-decoration:none;text-align:center;">${ICON_TAG}Open / Print Label</a>
      </div>`;
    toast(`Label bought — $${amount.toFixed(2)} added to shipping`);
  } catch (e) {
    toast(e.message);
    buy.disabled = false; buy.style.opacity = '1'; buy.textContent = `Buy Label — $${amount.toFixed(2)}`;
  }
}

// Write the label cost + tracking back into the sale and recompute profit — retroactive path
async function applyLabelToSale(saleId, label, amount, provider) {
  const s = _sales.find(x => x.id === saleId);
  if (!s) return;
  const gross = +s.grossSale || ((+s.unitPrice||0) + (+s.shippingCharged||0));
  const fees = +s.fees || 0;
  const ga = +s.ga || 0;
  const cost = +s.netCost || 0;
  const shipPaid = amount;
  const net = gross - fees - shipPaid - ga;
  const profit = net - cost;
  const updated = {
    ...s,
    shippingPaid: shipPaid,
    netSale: net,
    profit,
    margin: cost > 0 ? profit / cost : 0,
    trackingNumber: label.tracking_number || '',
    trackingUrl: label.tracking_url || '',
    labelUrl: label.label_url || '',
    carrier: _mapCarrier(provider) || s.carrier || '',
  };
  await DB.saveSale(updated);
  _clearPendingLabel();
  await loadAll(true);
}

// ─── SALES ─────────────────────────────────────────────────
let _saleIsTrade = false;

function setSaleAcqType(type) {
  _saleIsTrade = type === 'trade';
  const cashBtn = document.getElementById('sale-type-cash');
  const tradeBtn = document.getElementById('sale-type-trade');
  const tradeGroup = document.getElementById('sale-trade-group');
  if (_saleIsTrade) {
    cashBtn.style.background = 'var(--bg3)'; cashBtn.style.borderColor = 'var(--border2)'; cashBtn.style.color = 'var(--text2)';
    tradeBtn.style.background = 'var(--blue-dim)'; tradeBtn.style.borderColor = 'var(--blue)'; tradeBtn.style.color = 'var(--blue)';
    tradeGroup.style.display = 'block';
    _selectedTradePurchaseIds = [];
    renderTradeChips('sale-trade-selected', _selectedTradePurchaseIds, removeTradePurchase);
    populateTradePurchaseSelect();
  } else {
    cashBtn.style.background = 'var(--amber)'; cashBtn.style.borderColor = 'var(--amber)'; cashBtn.style.color = 'var(--on-accent)';
    tradeBtn.style.background = 'var(--bg3)'; tradeBtn.style.borderColor = 'var(--border2)'; tradeBtn.style.color = 'var(--text2)';
    tradeGroup.style.display = 'none';
    _selectedTradePurchaseIds = [];
  }
}

function populateSalePurchaseSelect(preselect) {
  const skus = _skus;
  const soldIds = new Set(_sales.filter(s=>!preselect||normalizePurchaseId(s.purchaseId)!==normalizePurchaseId(preselect)).map(s=>normalizePurchaseId(s.purchaseId)));
  const available = _purchases.filter(p=>!soldIds.has(normalizePurchaseId(p.id)) && !p.sold);
  const sel = document.getElementById('sale-purchase');
  sel.innerHTML = available.length
    ? available.map(p=>{
        const sku = skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
        return `<option value="${p.id}" ${p.id===preselect?'selected':''}>${esc(sku.product||'Unknown')} (${fmtDate(p.date)} · ${fmt(p.netCost)})</option>`;
      }).join('')
    : '<option value="">No unsold purchases available</option>';
  onSalePurchaseChange();
}
function openSaleForPurchase(purchaseId) {
  openSheet('sale-sheet');
  populateSalePurchaseSelect(purchaseId);
  document.getElementById('sale-purchase').value = purchaseId;
  onSalePurchaseChange();
}
function onSalePurchaseChange() {
  calcSaleProfit();
}

function editSale(id) {
  const s = _sales.find(x => x.id === id);
  if (!s) return;
  closeSheet('detail-sheet');
  document.getElementById('sale-sheet-title').textContent = 'Edit Sale';
  document.getElementById('sale-edit-id').value = id;
  document.getElementById('sale-label-hint').textContent = '';
  document.getElementById('sale-use-shippo').checked = false;
  document.getElementById('sale-get-rates-btn').style.display = 'none';
  _pendingShipLabel = null;

  // Purchase select must include this sale's own purchase even though it's "sold"
  populateSalePurchaseSelect(s.purchaseId);
  document.getElementById('sale-purchase').value = s.purchaseId;

  document.getElementById('sale-date').value = s.date || '';
  document.getElementById('sale-source').value = s.source || 'Facebook';
  document.getElementById('sale-price').value = s.unitPrice || '';
  document.getElementById('sale-state').value = s.state || '';
  document.getElementById('sale-ship-charged').value = s.shippingCharged || 0;
  document.getElementById('sale-ship-paid').value = s.shippingPaid || 0;
  // feesPct is stored as a fraction (e.g. 0.0299) — display as a percent (2.99)
  document.getElementById('sale-fees-pct').value = +(((+s.feesPct || 0) * 100).toFixed(4));
  document.getElementById('sale-fees-fixed').value = s.feesFixed || 0;
  document.getElementById('sale-ga').value = s.ga || 0;
  document.getElementById('sale-comments').value = s.comments || '';
  document.getElementById('sale-tracking').value = s.trackingNumber || '';
  document.getElementById('sale-tracking-url').value = s.trackingUrl || '';
  document.getElementById('sale-label-url').value = s.labelUrl || '';
  document.getElementById('sale-carrier').value = s.carrier || '';

  _saleIsTrade = !!s.isTrade;
  if (_saleIsTrade) {
    setSaleAcqType('trade');
    try { _selectedTradePurchaseIds = JSON.parse(s.tradePurchaseIds || '[]'); }
    catch { _selectedTradePurchaseIds = s.tradePurchaseId ? [s.tradePurchaseId] : []; }
    renderTradeChips('sale-trade-selected', _selectedTradePurchaseIds, removeTradePurchase);
    populateTradePurchaseSelect();
  } else {
    setSaleAcqType('cash');
  }

  calcSaleProfit();
  document.getElementById('sale-btn-row').innerHTML = `
    <button class="btn btn-secondary" onclick="deleteSale('${id}')">Delete</button>
    <button class="btn btn-primary" onclick="saveSale()">Update</button>
  `;
  document.getElementById('sale-overlay').classList.add('open');
  document.getElementById('sale-sheet').style.transform = 'translate(-50%, 0)';
}
function calcSaleProfit() {
  const purchaseId = document.getElementById('sale-purchase').value;
  const purchase = _purchases.find(p=>p.id===purchaseId)||{};
  const cost = +purchase.netCost||0;
  const price = +document.getElementById('sale-price').value||0;
  const shipCharged = +document.getElementById('sale-ship-charged').value||0;
  const shipPaid = +document.getElementById('sale-ship-paid').value||0;
  const feesPct = (+document.getElementById('sale-fees-pct').value||0) / 100;
  const feesFixed = +document.getElementById('sale-fees-fixed').value||0;
  const ga = +document.getElementById('sale-ga').value||0;
  const gross = price + shipCharged;
  const fees = gross * feesPct + feesFixed;
  const net = gross - fees - shipPaid - ga;
  const profit = net - cost;
  const margin = cost > 0 ? (profit / cost * 100) : 0;
  document.getElementById('s-price').textContent = fmt(price);
  document.getElementById('s-shipcharged').textContent = fmt(shipCharged);
  document.getElementById('s-gross').textContent = fmt(gross);
  document.getElementById('s-fees').textContent = fmt(fees);
  document.getElementById('s-shippaid').textContent = fmt(shipPaid);
  document.getElementById('s-ga').textContent = fmt(ga);
  document.getElementById('s-net').textContent = fmt(net);
  document.getElementById('s-cost').textContent = fmt(cost);
  const profitEl = document.getElementById('s-profit');
  profitEl.textContent = fmt(profit);
  profitEl.style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';
  const marginEl = document.getElementById('s-margin');
  marginEl.textContent = margin.toFixed(1) + '%';
  marginEl.style.color = margin >= 0 ? 'var(--green)' : 'var(--red)';
}
async function saveSale() {
  const purchaseId = document.getElementById('sale-purchase').value;
  const price = +document.getElementById('sale-price').value;
  if (!purchaseId || !price) { toast('Please select a purchase and enter a sale price'); return; }

  const useShippo = document.getElementById('sale-use-shippo').checked;
  if (useShippo && !_pendingShipLabel) {
    toast('Get shipping rates and pick one, or uncheck "Buy this label via Shippo"');
    return;
  }

  const btnRow = document.getElementById('sale-btn-row');
  const saveBtn = btnRow.querySelector('.btn-primary');
  let boughtLabel = null;
  if (useShippo && _pendingShipLabel) {
    if (_pendingShipLabel.purchased) {
      // Already bought on a prior attempt (e.g. the DB save failed after purchase) — don't buy twice.
      boughtLabel = _pendingShipLabel.purchased;
    } else {
      if (!confirm(`Buy this shipping label for $${_pendingShipLabel.amount.toFixed(2)} via Shippo, then log the sale?`)) return;
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Buying label…'; }
      try {
        boughtLabel = await _shippoCall({ action: 'buy', rate_id: _pendingShipLabel.rateId, label_file_type: 'PDF_4x6' });
        _pendingShipLabel.purchased = boughtLabel;
        _persistPendingLabel({ mode: 'presale', purchaseId, label: boughtLabel, amount: _pendingShipLabel.amount, provider: _pendingShipLabel.provider });
      } catch (e) {
        toast('Label purchase failed — sale not logged: ' + e.message);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = document.getElementById('sale-edit-id').value ? 'Update' : 'Log Sale'; }
        return;
      }
    }
    if (saveBtn) saveBtn.textContent = 'Logging sale…';
  }

  const purchase = _purchases.find(p=>p.id===purchaseId)||{};
  const cost = +purchase.netCost||0;
  const shipCharged = +document.getElementById('sale-ship-charged').value||0;
  const shipPaid = boughtLabel ? _pendingShipLabel.amount : (+document.getElementById('sale-ship-paid').value||0);
  const feesPct = (+document.getElementById('sale-fees-pct').value||0)/100;
  const feesFixed = +document.getElementById('sale-fees-fixed').value||0;
  const ga = +document.getElementById('sale-ga').value||0;
  const gross = price + shipCharged;
  const fees = gross * feesPct + feesFixed;
  const net = gross - fees - shipPaid - ga;
  const profit = net - cost;
  const editId = document.getElementById('sale-edit-id').value;
  const comments = document.getElementById('sale-comments').value;
  const trackingNumber = boughtLabel ? (boughtLabel.tracking_number || '') : document.getElementById('sale-tracking').value.trim();
  const trackingUrl = boughtLabel ? (boughtLabel.tracking_url || '') : document.getElementById('sale-tracking-url').value;
  const labelUrl = boughtLabel ? (boughtLabel.label_url || '') : document.getElementById('sale-label-url').value;
  const carrier = boughtLabel ? (_mapCarrier(_pendingShipLabel?.provider) || document.getElementById('sale-carrier').value) : document.getElementById('sale-carrier').value;
  const s = {
    ...(editId ? { id: editId } : {}), // new rows get their id from the DB sequence
    purchaseId, skuId: purchase.skuId,
    date: document.getElementById('sale-date').value,
    source: document.getElementById('sale-source').value,
    state: document.getElementById('sale-state').value.toUpperCase(),
    unitPrice: price, grossSale: gross, fees, feesPct, feesFixed,
    shippingCharged: shipCharged, shippingPaid: shipPaid, ga,
    netSale: net, netCost: cost, profit,
    margin: cost > 0 ? profit/cost : 0,
    isTrade: _saleIsTrade,
    tradePurchaseIds: JSON.stringify(_selectedTradePurchaseIds),
    trackingNumber, trackingUrl, labelUrl, carrier,
    comments,
  };
  try {
    await DB.saveSale(s);
    await loadAll();
    _pendingShipLabel = null;
    _clearPendingLabel();
    closeSheet('sale-sheet');
    renderSales();
    // Best-effort — browsers often block a popup this far after an async chain,
    // so the sale detail sheet's "Download Label" button (persisted labelUrl)
    // is the reliable way to get back to it.
    if (boughtLabel?.label_url) window.open(boughtLabel.label_url, '_blank', 'noopener');
    toast(editId ? 'Sale updated' : 'Sale logged — ' + fmt(profit) + ' profit' + (boughtLabel ? ' · label purchased — see sale detail to download' : ''));
  } catch(e) {
    toast(e.message + (boughtLabel ? ' — label was already purchased, tracking: ' + (boughtLabel.tracking_number||'—') : ''));
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = editId ? 'Update' : 'Log Sale'; }
  }
}
let saleFilter = 'all';
let saleTypeFilter = 'all';
let saleYear = 'all', saleQuarter = 'all', saleMonth = 'all';
function setSaleFilter(el) {
  document.querySelectorAll('#sale-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  saleFilter = el.dataset.filter;
  renderSales();
}
function setSaleType(el) {
  document.querySelectorAll('#sale-type-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  saleTypeFilter = el.dataset.type;
  renderSales();
}
function setSaleYear(el, year) {
  document.querySelectorAll('#sale-year-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  saleYear = year;
  saleQuarter = 'all';
  saleMonth = 'all';
  renderSales();
}
function setSaleQuarter(el, quarter) {
  document.querySelectorAll('#sale-quarter-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  saleQuarter = quarter;
  saleMonth = 'all';
  renderSales();
}
function setSaleMonth(el, month) {
  document.querySelectorAll('#sale-month-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  saleMonth = month;
  renderSales();
}
function renderSaleYearTabs() {
  const ytEl = document.getElementById('sale-year-tabs');
  const years = [...new Set(_sales.map(s => s.date ? s.date.slice(0,4) : null).filter(Boolean))].sort().reverse();
  ytEl.innerHTML = `<div class="tab ${saleYear==='all'?'active':''}" onclick="setSaleYear(this,'all')">All Time</div>`
    + years.map(y => `<div class="tab ${saleYear===y?'active':''}" onclick="setSaleYear(this,'${y}')">${y}</div>`).join('');
}
function renderSaleQuarterTabs() {
  const qtEl = document.getElementById('sale-quarter-tabs');
  if (saleYear === 'all') { qtEl.style.display = 'none'; return; }
  const quartersWithData = new Set(
    _sales.filter(s => s.date && s.date.startsWith(saleYear))
      .map(s => 'Q' + Math.ceil(parseInt(s.date.slice(5,7)) / 3))
  );
  if (quartersWithData.size === 0) { qtEl.style.display = 'none'; return; }
  qtEl.style.display = 'flex';
  qtEl.innerHTML = `<div class="tab ${saleQuarter==='all'?'active':''}" onclick="setSaleQuarter(this,'all')">Full Year</div>`
    + ['Q1','Q2','Q3','Q4'].filter(q => quartersWithData.has(q))
      .map(q => `<div class="tab ${saleQuarter===q?'active':''}" onclick="setSaleQuarter(this,'${q}')">${q}</div>`).join('');
}
function renderSaleMonthTabs() {
  const mtEl = document.getElementById('sale-month-tabs');
  if (saleYear === 'all') { mtEl.style.display = 'none'; return; }
  const qMonths = saleQuarter !== 'all' ? getQuarterMonths(saleQuarter) : null;
  const monthsWithData = new Set(
    _sales.filter(s => {
      if (!s.date || !s.date.startsWith(saleYear)) return false;
      if (qMonths && !qMonths.includes(s.date.slice(5,7))) return false;
      return true;
    }).map(s => s.date.slice(5,7))
  );
  if (monthsWithData.size === 0) { mtEl.style.display = 'none'; return; }
  mtEl.style.display = 'flex';
  const label = saleQuarter !== 'all' ? saleQuarter : 'All Months';
  mtEl.innerHTML = `<div class="tab ${saleMonth==='all'?'active':''}" onclick="setSaleMonth(this,'all')">${label}</div>`
    + ['01','02','03','04','05','06','07','08','09','10','11','12']
      .filter(m => monthsWithData.has(m))
      .map(m => `<div class="tab ${saleMonth===m?'active':''}" onclick="setSaleMonth(this,'${m}')">${MONTH_NAMES[parseInt(m)-1]}</div>`).join('');
}

function renderSales() {
  const q = (document.getElementById('sale-search').value||'').toLowerCase();
  const skus = _skus;
  const purchases = _purchases;
  let sales = [..._sales].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // Search
  if (q) sales = sales.filter(s=>{
    const p = purchases.find(x=>x.id===s.purchaseId)||{};
    const sku = skus.find(x=>normalizeSkuId(x.id)===normalizeSkuId(p.skuId))||{};
    return (sku.product+sku.brand+s.source).toLowerCase().includes(q);
  });

  // PayPal summary — always computed from ALL sales regardless of filter
  const allPending = _sales.filter(s => !s.paypalReleased && (+s.profit||0) > 0);
  const pendingTotal = allPending.reduce((t,s) => t+(+s.profit||0), 0);
  const summaryEl = document.getElementById('paypal-summary');
  const totalEl = document.getElementById('paypal-total');
  const countEl2 = document.getElementById('paypal-count');
  if (summaryEl && totalEl && countEl2) {
    summaryEl.style.display = saleFilter === 'paypal' ? 'block' : 'none';
    totalEl.innerHTML = isViewer() ? '<span style="color:var(--text3);letter-spacing:3px;">••••</span>' : fmt(pendingTotal);
    countEl2.textContent = `${allPending.length} sale${allPending.length!==1?'s':''} pending`;
  }

  // Filter
  if (saleFilter === 'profit')   sales = sales.filter(s => (+s.profit||0) > 0);
  if (saleFilter === 'loss')     sales = sales.filter(s => (+s.profit||0) < 0);
  if (saleFilter === 'facebook') sales = sales.filter(s => (s.source||'').toLowerCase().includes('facebook'));
  if (saleFilter === 'ebay')     sales = sales.filter(s => (s.source||'').toLowerCase().includes('ebay'));
  if (saleFilter === 'paypal')   sales = sales.filter(s => !s.paypalReleased && (+s.profit||0) > 0);

  // Apply product type filter
  if (saleTypeFilter !== 'all') sales = sales.filter(s => {
    const p = purchases.find(x=>x.id===s.purchaseId)||{};
    const sku = skus.find(x=>normalizeSkuId(x.id)===normalizeSkuId(p.skuId))||{};
    return sku.type === saleTypeFilter;
  });

  // Apply date filter
  if (saleYear !== 'all') sales = sales.filter(s => s.date && s.date.startsWith(saleYear));
  if (saleQuarter !== 'all') {
    const qMonths = getQuarterMonths(saleQuarter);
    sales = sales.filter(s => s.date && qMonths.includes(s.date.slice(5,7)));
  }
  if (saleMonth !== 'all') sales = sales.filter(s => s.date && s.date.slice(5,7) === saleMonth);

  renderSaleYearTabs();
  renderSaleQuarterTabs();
  renderSaleMonthTabs();

  // Count
  const countEl = document.getElementById('sale-count');
  if (countEl) countEl.textContent = `${sales.length} ${sales.length === 1 ? 'sale' : 'sales'}`;

  const el = document.getElementById('sale-list');
  if (sales.length === 0) {
    el.innerHTML = saleFilter === 'paypal'
      ? `<div class="empty"><div class="empty-icon">${ICON_CHECK_BIG}</div><div class="empty-text">All profits sent to PayPal!</div></div>`
      : `<div class="empty"><div class="empty-icon">${ICON_DOLLAR_BIG}</div><div class="empty-text">No sales found</div><div class="empty-sub">Try a different filter or search</div></div>`;
    return;
  }
  el.innerHTML = sales.map(s => {
    const purchase = purchases.find(p=>p.id===s.purchaseId)||{};
    const sku = skus.find(sk=>sk.id===purchase.skuId)||{};
    const profit = +s.profit||0;
    const cond = purchase.condition||'';
    const condColor = ['like new','excellent'].includes(cond.toLowerCase()) ? 'var(--green)' : ['good','well used'].includes(cond.toLowerCase()) ? 'var(--amber)' : cond ? 'var(--red)' : 'var(--text3)';
    return `<div class="list-item" onclick="viewSaleDetail('${s.id}')">
      <div class="item-icon ${typeClass(sku.type||'')}">${typeIcon(sku.type||'')}</div>
      <div class="item-body">
        <div class="item-name">${esc(sku.product||'Unknown')}</div>
        <div class="item-sub">${fmtDate(s.date)} · ${esc(s.source||'')} · ${esc(s.state||'')}</div>
      </div>
      <div class="item-right">
        <div class="item-amount ${profit>=0?'green':'red'}">${hideFin(fmt(profit))}</div>
        <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:4px;align-items:center;">
          <div style="font-size:11px;color:var(--text3);">${isViewer()?"••••":((+s.margin||0)*100).toFixed(1)+"%"}</div>
          ${cond ? `<div style="font-size:10px;font-weight:600;color:${condColor};">${esc(cond.toUpperCase())}</div>` : ''}
          ${s.isTrade?'<div class="item-badge" style="background:var(--blue-dim);color:var(--blue);">Trade</div>':''}
          ${s.paypalReleased?`<div class="item-badge" style="background:var(--green-dim);color:var(--green);display:flex;align-items:center;">${ICON_CHECK}PayPal</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}
function viewSaleDetail(id) {
  const s = _sales.find(x=>x.id===id);
  if (!s) return;
  const purchase = _purchases.find(p=>p.id===s.purchaseId)||{};
  const sku = _skus.find(sk=>sk.id===purchase.skuId)||{};
  const profit = +s.profit||0;

  // Build trade block
  let tradeBlock = '';
  if (s.isTrade) {
    const linkedIds = (() => { try { return JSON.parse(s.tradePurchaseIds||'[]'); } catch { return s.tradePurchaseId ? [s.tradePurchaseId] : []; } })();
    const chips = linkedIds.map(pid => {
      const lp = _purchases.find(p=>p.id===pid)||{};
      const lsku = _skus.find(sk=>sk.id===lp.skuId)||{};
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--blue-dim);border:0.5px solid var(--blue);color:var(--blue);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:500;margin:2px;">${esc(lsku.product||pid)}</span>`;
    }).join('');
    tradeBlock = `<div style="background:var(--blue-dim);border:0.5px solid var(--blue);border-radius:var(--radius-sm);padding:10px 12px;margin:8px 0;">
      <div style="font-size:11px;font-weight:600;letter-spacing:1px;color:var(--blue);margin-bottom:6px;">TRADE — received:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${chips||'<span style="font-size:12px;color:var(--blue);opacity:0.7;">No items linked</span>'}</div>
    </div>`;
  }

  document.getElementById('detail-title').textContent = sku.product||'Sale';
  const cond = purchase.condition||'';
  const condColor = ['like new','excellent'].includes(cond.toLowerCase()) ? 'var(--green)' : ['good','well used'].includes(cond.toLowerCase()) ? 'var(--amber)' : cond ? 'var(--red)' : 'var(--text2)';
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-row"><span class="detail-key">Sale ID</span><span class="detail-val mono" style="color:var(--amber);">${s.id}</span></div>
    <div class="detail-row"><span class="detail-key">Purchase ID</span><span class="detail-val mono" style="color:var(--text2);">${s.purchaseId||'—'}</span></div>
    <div class="detail-row"><span class="detail-key">SKU ID</span><span class="detail-val mono" style="color:var(--text2);">${purchase.skuId||'—'}</span></div>
    <div class="detail-row"><span class="detail-key">Item condition</span><span class="detail-val">${cond ? `<span style="font-weight:600;color:${condColor};">${esc(cond)}</span>` : '—'}</span></div>
    <div class="detail-row"><span class="detail-key">Type</span><span class="detail-val"><span class="item-badge" style="${s.isTrade?'background:var(--blue-dim);color:var(--blue)':'background:var(--green-dim);color:var(--green)'}">${s.isTrade?'Trade':'Cash'}</span></span></div>
    ${tradeBlock}
    <div class="detail-row"><span class="detail-key">Date</span><span class="detail-val">${fmtDate(s.date)}</span></div>
    <div class="detail-row"><span class="detail-key">Channel</span><span class="detail-val">${esc(s.source||'—')}</span></div>
    <div class="detail-row"><span class="detail-key">Buyer state</span><span class="detail-val">${esc(s.state||'—')}</span></div>
    <div class="detail-row"><span class="detail-key">Sale price</span><span class="detail-val mono">${hideFin(fmt(s.unitPrice))}</span></div>
    <div class="detail-row"><span class="detail-key">Shipping charged</span><span class="detail-val mono">${fmt(s.shippingCharged)}</span></div>
    <div class="detail-row"><span class="detail-key">Shipping paid</span><span class="detail-val mono">${fmt(s.shippingPaid)}</span></div>
    <div class="detail-row"><span class="detail-key">Carrier</span><span class="detail-val">${esc(s.carrier || '—')}</span></div>
    <div class="detail-row"><span class="detail-key">Tracking #</span><span class="detail-val mono">${s.trackingNumber ? (safeUrl(s.trackingUrl) ? `<a href="${safeUrl(s.trackingUrl)}" target="_blank" rel="noopener" style="color:var(--blue);">${esc(s.trackingNumber)}</a>` : esc(s.trackingNumber)) : '—'}</span></div>
    <div class="detail-row"><span class="detail-key">Platform fees</span><span class="detail-val mono">${fmt(s.fees)}</span></div>
    <div class="detail-row"><span class="detail-key">G&A</span><span class="detail-val mono">${fmt(s.ga)}</span></div>
    <div class="detail-row"><span class="detail-key">Net cost basis</span><span class="detail-val mono">${hideFin(fmt(s.netCost))}</span></div>
    <div class="detail-row"><span class="detail-key">Net sale</span><span class="detail-val mono">${hideFin(fmt(s.netSale))}</span></div>
    <div class="detail-row"><span class="detail-key">Net profit</span><span class="detail-val mono" style="color:${profit>=0?'var(--green)':'var(--red)'};font-size:16px;">${hideFin(fmt(profit))}</span></div>
    <div class="detail-row"><span class="detail-key">Margin</span><span class="detail-val mono" style="color:${profit>=0?'var(--green)':'var(--red)'};">${isViewer()?"••••":((+s.margin||0)*100).toFixed(1)+"%"}</span></div>
    ${s.comments?`<div class="detail-row"><span class="detail-key">Notes</span><span class="detail-val" style="font-size:12px;color:var(--text2);">${esc(s.comments)}</span></div>`:''}
    ${safeUrl(s.labelUrl)
      ? `<a href="${safeUrl(s.labelUrl)}" target="_blank" rel="noopener" class="btn btn-primary" style="margin-top:16px;display:block;text-decoration:none;text-align:center;">${ICON_TAG}Download / Print Label</a>`
      : (canWrite() ? `<button class="btn btn-primary" style="margin-top:16px;" onclick="openShipLabel('${id}')">${ICON_TAG}Buy Shipping Label</button>` : '')}
    ${canWrite() && !s.paypalReleased ? `<button class="btn btn-primary" style="margin-top:12px;background:var(--green);color:var(--on-accent);" onclick="releaseToPaypal('${id}')">${ICON_SEND}Release to PayPal</button>` : ''}
    ${s.paypalReleased ? `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;padding:4px 2px;font-size:13px;color:var(--text2);">${ICON_CHECK}Profit sent to PayPal</div>` : ''}
    <div style="margin-top:12px;" class="btn-row">
      ${canWrite() ? `<button class="btn btn-secondary" onclick="editSale('${id}')">${ICON_EDIT}Edit</button>` : ''}
      ${canWrite() ? `<button class="btn btn-secondary" onclick="openEditSaleTrades('${id}')">${ICON_SWAP}Trades</button>` : ''}
      ${canDelete() ? `<button class="btn btn-danger" onclick="deleteSale('${id}')">Delete</button>` : ''}
    </div>
  `;
  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-sheet').style.transform = 'translate(-50%, 0)';
}
let _teIds = []; // trade edit chip IDs
let _teIsTrade = false; // tracked explicitly — do not infer from button inline styles

function openEditSaleTrades(saleId) {
  closeSheet('detail-sheet');
  const s = _sales.find(x=>x.id===saleId)||{};
  document.getElementById('trade-edit-sale-id').value = saleId;
  // Init from existing trade data
  try { _teIds = JSON.parse(s.tradePurchaseIds||'[]'); } catch { _teIds = s.tradePurchaseId ? [s.tradePurchaseId] : []; }
  setTradeEditType(s.isTrade ? 'trade' : 'cash');
  renderTeChips();
  populateTeSelect();
  document.getElementById('sale-trades-overlay').classList.add('open');
  document.getElementById('sale-trades-sheet').style.transform = 'translate(-50%, 0)';
}

function setTradeEditType(type) {
  const isTrade = type === 'trade';
  _teIsTrade = isTrade;
  const cashBtn = document.getElementById('te-cash');
  const tradeBtn = document.getElementById('te-trade');
  const group = document.getElementById('te-trade-group');
  if (isTrade) {
    cashBtn.style.cssText = 'flex:1;padding:10px;border-radius:var(--radius-sm);border:0.5px solid var(--border2);background:var(--bg3);color:var(--text2);font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;';
    tradeBtn.style.cssText = 'flex:1;padding:10px;border-radius:var(--radius-sm);border:0.5px solid var(--blue);background:var(--blue-dim);color:var(--blue);font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;';
    group.style.display = 'block';
    populateTeSelect();
  } else {
    cashBtn.style.cssText = 'flex:1;padding:10px;border-radius:var(--radius-sm);border:0.5px solid var(--amber);background:var(--amber);color:var(--on-accent);font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;';
    tradeBtn.style.cssText = 'flex:1;padding:10px;border-radius:var(--radius-sm);border:0.5px solid var(--border2);background:var(--bg3);color:var(--text2);font-size:13px;font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;';
    group.style.display = 'none';
    _teIds = [];
    renderTeChips();
  }
}

function populateTeSelect() {
  const soldIds = new Set(_sales.map(s => normalizePurchaseId(s.purchaseId)));
  const unsold = [..._purchases]
    .filter(p => !soldIds.has(normalizePurchaseId(p.id)) && !p.sold && !_teIds.map(normalizePurchaseId).includes(normalizePurchaseId(p.id)))
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  const sel = document.getElementById('te-purchase-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">+ Add unsold purchase received…</option>' +
    unsold.map(p => {
      const sku = _skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
      return `<option value="${p.id}">${p.id} · ${esc(sku.product||'Unknown')} · ${fmtDate(p.date)} · ${fmt(p.netCost)}</option>`;
    }).join('');
}

function addTeChip() {
  const sel = document.getElementById('te-purchase-select');
  const id = sel.value;
  if (!id || _teIds.includes(id)) return;
  _teIds.push(id);
  renderTeChips();
  populateTeSelect();
  sel.value = '';
}

function removeTeChip(id) {
  _teIds = _teIds.filter(x => x !== id);
  renderTeChips();
  populateTeSelect();
}

function renderTeChips() {
  const el = document.getElementById('te-chips');
  if (!el) return;
  if (_teIds.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = _teIds.map(id => {
    const p = _purchases.find(x=>x.id===id)||{};
    const sku = _skus.find(x=>normalizeSkuId(x.id)===normalizeSkuId(p.skuId))||{};
    const label = sku.product ? sku.product.split(' ').slice(0,3).join(' ') : id;
    return `<div style="display:inline-flex;align-items:center;gap:5px;background:var(--blue-dim);border:0.5px solid var(--blue);color:var(--blue);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:500;">
      ${esc(label)}<span onclick="removeTeChip('${id}')" style="cursor:pointer;font-size:14px;line-height:1;opacity:0.7;">×</span>
    </div>`;
  }).join('');
}

async function saveEditSaleTrades() {
  const saleId = document.getElementById('trade-edit-sale-id').value;
  const s = _sales.find(x=>x.id===saleId);
  if (!s) return;
  const updated = {
    ...s,
    isTrade: _teIsTrade,
    tradePurchaseIds: JSON.stringify(_teIds),
  };
  try {
    await DB.saveSale(updated);
    await loadAll();
    closeSheet('sale-trades-sheet');
    toast('Trade links saved');
    viewSaleDetail(saleId);
  } catch(e) { toast(e.message); }
}

async function releaseToPaypal(id) {
  const s = _sales.find(x=>x.id===id);
  if (!s) return;
  if (!confirm(`Release ${fmt(+s.profit||0)} profit to PayPal for this sale?`)) return;
  try {
    await DB.saveSale({...s, paypalReleased: true});
    await loadAll();
    closeSheet('detail-sheet');
    renderSales();
    toast('Profit released to PayPal');
  } catch(e) { toast(e.message); }
}

async function deleteSale(id) {
  if (!confirm('Delete this sale?')) return;
  try { await DB.deleteSale(id); await loadAll(); closeSheet('detail-sheet'); renderSales(); toast('Sale deleted'); } catch(e) { toast(e.message); }
}

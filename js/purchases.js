// ─── PURCHASES ─────────────────────────────────────────────
let _selectedTradeSaleIds = [];
let _selectedTradePurchaseIds = [];

function setAcqType(type) {
  const isTrade = type === 'trade';
  document.getElementById('purchase-is-trade').value = isTrade ? '1' : '0';
  const cashBtn = document.getElementById('acq-cash');
  const tradeBtn = document.getElementById('acq-trade');
  if (isTrade) {
    cashBtn.style.cssText = 'flex:1;padding:10px;border-radius:var(--radius-sm);border:0.5px solid var(--border2);background:var(--bg3);color:var(--text2);font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;';
    tradeBtn.style.cssText = 'flex:1;padding:10px;border-radius:var(--radius-sm);border:0.5px solid var(--blue);background:var(--blue-dim);color:var(--blue);font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;';
    document.getElementById('trade-link-group').style.display = 'block';
    _selectedTradeSaleIds = [];
    renderTradeChips('purchase-trade-selected', _selectedTradeSaleIds, removeTradeSale);
    populateTradeSaleSelect();
  } else {
    cashBtn.style.cssText = 'flex:1;padding:10px;border-radius:var(--radius-sm);border:0.5px solid var(--amber);background:var(--amber);color:var(--on-accent);font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;';
    tradeBtn.style.cssText = 'flex:1;padding:10px;border-radius:var(--radius-sm);border:0.5px solid var(--border2);background:var(--bg3);color:var(--text2);font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;';
    document.getElementById('trade-link-group').style.display = 'none';
    _selectedTradeSaleIds = [];
  }
}

function populateTradeSaleSelect() {
  const sales = [..._sales].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const sel = document.getElementById('purchase-trade-sale');
  sel.innerHTML = '<option value="">+ Add a sale given in trade…</option>' +
    sales.filter(s => !_selectedTradeSaleIds.includes(s.id)).map(s => {
      const p = _purchases.find(x=>x.id===s.purchaseId)||{};
      const sku = _skus.find(x=>normalizeSkuId(x.id)===normalizeSkuId(p.skuId))||{};
      return `<option value="${s.id}">${s.id} · ${esc(sku.product||'Unknown')} · ${fmtDate(s.date)} · ${fmt(s.netSale)}</option>`;
    }).join('');
}

function addTradeSale() {
  const sel = document.getElementById('purchase-trade-sale');
  const id = sel.value;
  if (!id || _selectedTradeSaleIds.includes(id)) return;
  _selectedTradeSaleIds.push(id);
  renderTradeChips('purchase-trade-selected', _selectedTradeSaleIds, removeTradeSale);
  populateTradeSaleSelect();
  sel.value = '';
}

function removeTradeSale(id) {
  _selectedTradeSaleIds = _selectedTradeSaleIds.filter(x => x !== id);
  renderTradeChips('purchase-trade-selected', _selectedTradeSaleIds, removeTradeSale);
  populateTradeSaleSelect();
}

function addTradePurchase() {
  const sel = document.getElementById('sale-trade-purchase');
  const id = sel.value;
  if (!id || _selectedTradePurchaseIds.includes(id)) return;
  _selectedTradePurchaseIds.push(id);
  renderTradeChips('sale-trade-selected', _selectedTradePurchaseIds, removeTradePurchase);
  populateTradePurchaseSelect();
  sel.value = '';
}

function removeTradePurchase(id) {
  _selectedTradePurchaseIds = _selectedTradePurchaseIds.filter(x => x !== id);
  renderTradeChips('sale-trade-selected', _selectedTradePurchaseIds, removeTradePurchase);
  populateTradePurchaseSelect();
}

function populateTradePurchaseSelect() {
  const soldIds = new Set(_sales.map(s => normalizePurchaseId(s.purchaseId)));
  const unsold = [..._purchases]
    .filter(p => !soldIds.has(normalizePurchaseId(p.id)) && !p.sold && !_selectedTradePurchaseIds.map(normalizePurchaseId).includes(normalizePurchaseId(p.id)))
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  const sel = document.getElementById('sale-trade-purchase');
  if (!sel) return;
  sel.innerHTML = '<option value="">+ Add an unsold purchase received in trade…</option>' +
    unsold.map(p => {
      const sku = _skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
      return `<option value="${p.id}">${p.id} · ${esc(sku.product||'Unknown')} · ${fmtDate(p.date)} · ${fmt(p.netCost)}</option>`;
    }).join('');
}

function renderTradeChips(containerId, ids, removeFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (ids.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = ids.map(id => {
    // Try to find a label for the id
    const sale = _sales.find(s => s.id === id);
    const purchase = _purchases.find(p => p.id === id);
    let label = id;
    if (sale) {
      const p = _purchases.find(x=>x.id===sale.purchaseId)||{};
      const sku = _skus.find(x=>normalizeSkuId(x.id)===normalizeSkuId(p.skuId))||{};
      label = sku.product ? sku.product.split(' ').slice(0,3).join(' ') : id;
    } else if (purchase) {
      const sku = _skus.find(x=>x.id===purchase.skuId)||{};
      label = sku.product ? sku.product.split(' ').slice(0,3).join(' ') : id;
    }
    return `<div style="display:inline-flex;align-items:center;gap:5px;background:var(--blue-dim);border:0.5px solid var(--blue);color:var(--blue);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:500;">
      ${esc(label)}
      <span onclick="${removeFn.name}('${id}')" style="cursor:pointer;font-size:14px;line-height:1;opacity:0.7;">×</span>
    </div>`;
  }).join('');
}
function populatePurchaseSKUSelect() {
  // Now a typeahead — just clear the search field when opening
  document.getElementById('purchase-sku-search').value = '';
  document.getElementById('purchase-sku').value = '';
  document.getElementById('sku-dropdown').style.display = 'none';
}

function filterSkuDropdown() {
  const q = document.getElementById('purchase-sku-search').value.toLowerCase();
  const dropdown = document.getElementById('sku-dropdown');
  const matches = _skus.filter(s =>
    !q || (s.product+s.brand+s.type).toLowerCase().includes(q)
  );
  if (matches.length === 0) {
    dropdown.style.display = 'none';
    return;
  }
  dropdown.style.display = 'block';
  dropdown.innerHTML = matches.map(s => `<div onclick="selectSku('${s.id}')"
      style="padding:11px 14px;cursor:pointer;border-bottom:0.5px solid var(--border);font-size:14px;"
      onmousedown="event.preventDefault()"
      onmouseover="this.style.background='var(--bg4)'"
      onmouseout="this.style.background=''">
      <div style="font-weight:500;color:var(--text);">${esc(s.product)}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(s.brand)} · ${esc(s.type)} · SKU ${s.id}</div>
    </div>`
  ).join('');
}

// Looks the label up from _skus rather than accepting it as a parameter —
// keeps user-controlled text out of the inline onclick attribute entirely.
function selectSku(id) {
  const sku = _skus.find(s => s.id === id) || {};
  document.getElementById('purchase-sku').value = id;
  document.getElementById('purchase-sku-search').value = sku.brand ? `${sku.brand} – ${sku.product}` : id;
  document.getElementById('sku-dropdown').style.display = 'none';
}

function hideSkuDropdown() {
  document.getElementById('sku-dropdown').style.display = 'none';
}
function calcPurchaseCost() {
  const price = +document.getElementById('purchase-price').value||0;
  const qty = Math.max(1, Math.floor(+document.getElementById('purchase-qty').value||1));
  const ship = +document.getElementById('purchase-shipping').value||0;
  const gas = +document.getElementById('purchase-gas').value||0;
  const gross = price * qty;
  const net = gross + ship + gas;
  document.getElementById('p-gross').textContent = fmt(gross);
  document.getElementById('p-net').textContent = fmt(net);
  const perRow = document.getElementById('p-perunit-row');
  if (perRow) {
    if (qty > 1) {
      perRow.style.display = 'flex';
      document.getElementById('p-perunit').textContent = `${fmt(net / qty)} × ${qty}`;
    } else {
      perRow.style.display = 'none';
    }
  }
}
async function savePurchase() {
  const skuId = document.getElementById('purchase-sku').value;
  const price = +document.getElementById('purchase-price').value;
  if (!skuId || !price) { toast('Please select a product and enter a price'); return; }
  const qty = Math.max(1, Math.floor(+document.getElementById('purchase-qty').value||1));
  const ship = +document.getElementById('purchase-shipping').value||0;
  const gas = +document.getElementById('purchase-gas').value||0;
  const editId = document.getElementById('purchase-edit-id').value;
  const isTrade = document.getElementById('purchase-is-trade').value === '1';
  const dateVal = document.getElementById('purchase-date').value;
  const listedDateVal = document.getElementById('purchase-listed-date').value;
  const monthVal = dateVal ? MONTH_NAMES[parseInt(dateVal.slice(5,7))-1] : '';
  const base = {
    skuId, date: dateVal, month: monthVal, listedDate: listedDateVal,
    source: document.getElementById('purchase-source').value,
    state: document.getElementById('purchase-state').value.toUpperCase(),
    pricePerPiece: price,
    paymentVia: document.getElementById('purchase-payment').value,
    condition: document.getElementById('purchase-condition').value,
    comments: document.getElementById('purchase-comments').value,
    isTrade,
  };
  try {
    if (editId || qty === 1) {
      // Single record — edit, or a one-off buy (unchanged behavior)
      const p = {
        ...base,
        ...(editId ? { id: editId } : {}), // new rows get their id from the DB sequence
        qty: 1, grossCost: price,
        shipping: ship, gas, netCost: price + ship + gas,
        tradeSaleIds: JSON.stringify(_selectedTradeSaleIds),
      };
      await DB.savePurchase(p);
      await loadAll();
      closeSheet('purchase-sheet');
      renderPurchases();
      toast(editId ? 'Purchase updated' : 'Purchase logged');
      return;
    }
    // Bulk buy — fan out into `qty` individual unit records, each its own
    // sellable item with its own cost basis (shipping/gas split evenly).
    const shipShare = splitEven(ship, qty);
    const gasShare  = splitEven(gas, qty);
    const rows = Array.from({ length: qty }, (_, i) => ({
      ...base,
      qty: 1, grossCost: price,
      shipping: shipShare[i], gas: gasShare[i],
      netCost: price + shipShare[i] + gasShare[i],
      // Keep any trade linkage on the first unit only, to avoid double-counting
      tradeSaleIds: JSON.stringify(i === 0 ? _selectedTradeSaleIds : []),
    }));
    // One request for the whole batch — PostgREST runs a multi-row insert
    // as a single transaction, so a network failure can't leave a partial
    // batch the way qty sequential single-row inserts could.
    const saved = await DB.savePurchases(rows);
    saved.sort((a, b) => purchaseIdNum(a.id) - purchaseIdNum(b.id));
    await loadAll();
    closeSheet('purchase-sheet');
    renderPurchases();
    toast(`${qty} units logged (${saved[0].id}–${saved[saved.length - 1].id})`);
  } catch(e) { toast(e.message); }
}
let purchaseFilter = 'all';
let purchaseTypeFilter = 'all';
let purchaseYear = 'all', purchaseQuarter = 'all', purchaseMonth = 'all';
function setPurchaseFilter(el) {
  document.querySelectorAll('#purchase-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  purchaseFilter = el.dataset.filter;
  renderPurchases();
}

// Customer-facing "what's in stock" list — product info only, no cost/pricing data.
function getUnsoldPurchases() {
  const soldIds = new Set(_sales.map(s => normalizePurchaseId(s.purchaseId)));
  return _purchases.filter(p => !soldIds.has(normalizePurchaseId(p.id)) && !p.sold);
}
function buildUnsoldInventoryText() {
  const unsold = getUnsoldPurchases();
  const typeLabels = { Camera:'CAMERAS', Lens:'LENSES', Drone:'DRONES', Accessory:'ACCESSORIES', Flash:'FLASHES' };
  const typeOrder = ['Camera','Lens','Drone','Accessory','Flash'];
  const grouped = {};
  unsold.forEach(p => {
    const sku = _skus.find(s => normalizeSkuId(s.id) === normalizeSkuId(p.skuId)) || {};
    const type = typeOrder.includes(sku.type) ? sku.type : 'Other';
    (grouped[type] = grouped[type] || []).push({ product: sku.product || 'Unknown item', condition: p.condition || '' });
  });
  const sections = [...typeOrder, 'Other']
    .filter(t => grouped[t] && grouped[t].length)
    .map(t => {
      const label = typeLabels[t] || 'OTHER';
      const items = grouped[t]
        .sort((a,b) => a.product.localeCompare(b.product))
        .map(i => `- ${i.product}${i.condition ? ' — ' + i.condition : ''}`).join('\n');
      return `${label}\n${items}`;
    });
  const dateStr = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  const header = `IN STOCK — Tangy Nature LLC\n${dateStr}\n${unsold.length} item${unsold.length!==1?'s':''} available`;
  return sections.length ? `${header}\n\n${sections.join('\n\n')}` : `${header}\n\nNothing in stock right now.`;
}
async function copyUnsoldInventory() {
  const text = buildUnsoldInventoryText();
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied in-stock list to clipboard');
  } catch (e) {
    toast('Could not copy — try Download instead');
  }
}
function downloadUnsoldInventory() {
  const text = buildUnsoldInventoryText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `tangy-nature-in-stock-${_today()}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Downloaded in-stock list');
}
function setPurchaseType(el) {
  document.querySelectorAll('#purchase-type-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  purchaseTypeFilter = el.dataset.type;
  renderPurchases();
}
function setPurchaseYear(el, year) {
  document.querySelectorAll('#purchase-year-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  purchaseYear = year;
  purchaseQuarter = 'all';
  purchaseMonth = 'all';
  renderPurchases();
}
function setPurchaseQuarter(el, quarter) {
  document.querySelectorAll('#purchase-quarter-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  purchaseQuarter = quarter;
  purchaseMonth = 'all';
  renderPurchases();
}
function setPurchaseMonth(el, month) {
  document.querySelectorAll('#purchase-month-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  purchaseMonth = month;
  renderPurchases();
}
function renderPurchaseYearTabs() {
  const ytEl = document.getElementById('purchase-year-tabs');
  const years = [...new Set(_purchases.map(p => p.date ? p.date.slice(0,4) : null).filter(Boolean))].sort().reverse();
  ytEl.innerHTML = `<div class="tab ${purchaseYear==='all'?'active':''}" onclick="setPurchaseYear(this,'all')">All Time</div>`
    + years.map(y => `<div class="tab ${purchaseYear===y?'active':''}" onclick="setPurchaseYear(this,'${y}')">${y}</div>`).join('');
}
function renderPurchaseQuarterTabs() {
  const qtEl = document.getElementById('purchase-quarter-tabs');
  if (purchaseYear === 'all') { qtEl.style.display = 'none'; return; }
  const quartersWithData = new Set(
    _purchases.filter(p => p.date && p.date.startsWith(purchaseYear))
      .map(p => 'Q' + Math.ceil(parseInt(p.date.slice(5,7)) / 3))
  );
  if (quartersWithData.size === 0) { qtEl.style.display = 'none'; return; }
  qtEl.style.display = 'flex';
  qtEl.innerHTML = `<div class="tab ${purchaseQuarter==='all'?'active':''}" onclick="setPurchaseQuarter(this,'all')">Full Year</div>`
    + ['Q1','Q2','Q3','Q4'].filter(q => quartersWithData.has(q))
      .map(q => `<div class="tab ${purchaseQuarter===q?'active':''}" onclick="setPurchaseQuarter(this,'${q}')">${q}</div>`).join('');
}
function renderPurchaseMonthTabs() {
  const mtEl = document.getElementById('purchase-month-tabs');
  if (purchaseYear === 'all') { mtEl.style.display = 'none'; return; }
  const qMonths = purchaseQuarter !== 'all' ? getQuarterMonths(purchaseQuarter) : null;
  const monthsWithData = new Set(
    _purchases.filter(p => {
      if (!p.date || !p.date.startsWith(purchaseYear)) return false;
      if (qMonths && !qMonths.includes(p.date.slice(5,7))) return false;
      return true;
    }).map(p => p.date.slice(5,7))
  );
  if (monthsWithData.size === 0) { mtEl.style.display = 'none'; return; }
  mtEl.style.display = 'flex';
  const label = purchaseQuarter !== 'all' ? purchaseQuarter : 'All Months';
  mtEl.innerHTML = `<div class="tab ${purchaseMonth==='all'?'active':''}" onclick="setPurchaseMonth(this,'all')">${label}</div>`
    + ['01','02','03','04','05','06','07','08','09','10','11','12']
      .filter(m => monthsWithData.has(m))
      .map(m => `<div class="tab ${purchaseMonth===m?'active':''}" onclick="setPurchaseMonth(this,'${m}')">${MONTH_NAMES[parseInt(m)-1]}</div>`).join('');
}

function renderPurchases() {
  const q = (document.getElementById('purchase-search').value||'').toLowerCase();
  const skus = _skus;
  const sales = _sales;
  const soldIds = new Set(sales.map(s=>normalizePurchaseId(s.purchaseId)));
  let purchases = [..._purchases].sort((a,b)=>new Date(b.date)-new Date(a.date));

  const shareActionsEl = document.getElementById('unsold-share-actions');
  if (shareActionsEl) shareActionsEl.style.display = purchaseFilter === 'unsold' ? 'flex' : 'none';

  // Apply search
  if (q) purchases = purchases.filter(p=>{
    const sku = skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
    return (sku.product+sku.brand+p.source+p.paymentVia).toLowerCase().includes(q);
  });

  // Apply sold/unsold/trade filter
  if (purchaseFilter === 'sold')   purchases = purchases.filter(p => soldIds.has(normalizePurchaseId(p.id)) || p.sold);
  if (purchaseFilter === 'unsold') purchases = purchases.filter(p => !soldIds.has(normalizePurchaseId(p.id)) && !p.sold);
  if (purchaseFilter === 'trade')  purchases = purchases.filter(p => p.isTrade);

  // Apply product type filter
  if (purchaseTypeFilter !== 'all') purchases = purchases.filter(p => {
    const sku = skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
    return sku.type === purchaseTypeFilter;
  });

  // Apply date filter
  if (purchaseYear !== 'all') purchases = purchases.filter(p => p.date && p.date.startsWith(purchaseYear));
  if (purchaseQuarter !== 'all') {
    const qMonths = getQuarterMonths(purchaseQuarter);
    purchases = purchases.filter(p => p.date && qMonths.includes(p.date.slice(5,7)));
  }
  if (purchaseMonth !== 'all') purchases = purchases.filter(p => p.date && p.date.slice(5,7) === purchaseMonth);

  renderPurchaseYearTabs();
  renderPurchaseQuarterTabs();
  renderPurchaseMonthTabs();

  // Update count label
  const countEl = document.getElementById('purchase-count');
  if (countEl) countEl.textContent = `${purchases.length} ${purchases.length === 1 ? 'item' : 'items'}`;

  const el = document.getElementById('purchase-list');
  if (purchases.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">${ICON_BOX_BIG}</div><div class="empty-text">No purchases found</div><div class="empty-sub">Try a different filter or search</div></div>`;
    return;
  }
  el.innerHTML = purchases.map(p => {
    const sku = skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
    const sold = soldIds.has(normalizePurchaseId(p.id)) || p.sold;
    return `<div class="list-item" onclick="viewPurchaseDetail('${p.id}')">
      <div class="item-icon ${typeClass(sku.type||'')}">${typeIcon(sku.type||'')}</div>
      <div class="item-body">
        <div class="item-name">${esc(sku.product||'Unknown product')}</div>
        <div class="item-sub">${fmtDate(p.date)} · ${esc(p.source||'')} · ${esc(p.paymentVia||'')}${p.listedDate?` · Listed ${fmtDate(p.listedDate)}`:''}</div>
      </div>
      <div class="item-right">
        <div class="item-amount">${hideFin(fmt(p.netCost))}</div>
        <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:4px;">
          <div class="item-badge ${sold?'badge-sold':'badge-unsold'}">${sold?'Sold':'Unsold'}</div>
          ${p.isTrade?'<div class="item-badge" style="background:var(--blue-dim);color:var(--blue);">Trade</div>':''}
        </div>
        ${p.condition?`<div style="font-size:10px;font-weight:600;color:${['like new','excellent'].includes((p.condition||'').toLowerCase())?'var(--green)':p.condition.toLowerCase()==='good'?'var(--amber)':['well used','heavily used'].includes((p.condition||'').toLowerCase())?'var(--red)':'var(--red)'};margin-top:3px;text-align:right;">${esc(p.condition)}</div>`:''}
      </div>
    </div>`;
  }).join('');
}
function viewPurchaseDetail(id) {
  const p = _purchases.find(x=>x.id===id);
  if (!p) return;
  const sku = _skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
  const sale = _sales.find(s=>normalizePurchaseId(s.purchaseId)===normalizePurchaseId(id));
  const isTrade = p.isTrade;
  const tradeSaleIds = (() => { try { return JSON.parse(p.tradeSaleIds||'[]'); } catch { return []; } })();
  document.getElementById('detail-title').textContent = sku.product||'Purchase';
  const daysListedToSold = (p.listedDate && sale && sale.date)
    ? Math.round((new Date(sale.date) - new Date(p.listedDate)) / (1000*60*60*24))
    : null;
  const daysOnShelf = (p.listedDate && !sale)
    ? Math.round((new Date() - new Date(p.listedDate)) / (1000*60*60*24))
    : null;
  const saleBlock = sale ? `
    <div style="margin:16px 0 8px;padding:12px 14px;background:var(--green-dim);border-radius:var(--radius-sm);border:0.5px solid var(--green);">
      <div style="font-size:11px;font-weight:600;letter-spacing:1px;color:var(--green);margin-bottom:8px;">LINKED SALE · ${sale.id}</div>
      <div class="detail-row" style="border-color:var(--green-dim)"><span class="detail-key">Sale date</span><span class="detail-val">${fmtDate(sale.date)}</span></div>
      ${daysListedToSold !== null ? `<div class="detail-row" style="border-color:var(--green-dim)"><span class="detail-key">Listed → Sold</span><span class="detail-val">${daysListedToSold} day${daysListedToSold!==1?'s':''}</span></div>` : ''}
      <div class="detail-row" style="border-color:var(--green-dim)"><span class="detail-key">Channel</span><span class="detail-val">${esc(sale.source||'—')} · ${esc(sale.state||'—')}</span></div>
      <div class="detail-row" style="border-color:var(--green-dim)"><span class="detail-key">Sale price</span><span class="detail-val mono">${fmt(sale.unitPrice)}</span></div>
      <div class="detail-row" style="border-color:var(--green-dim)"><span class="detail-key">Net sale</span><span class="detail-val mono">${fmt(sale.netSale)}</span></div>
      <div class="detail-row" style="border-bottom:none"><span class="detail-key">Net profit</span><span class="detail-val mono" style="color:${(+sale.profit||0)>=0?'var(--green)':'var(--red)'};font-size:15px;">${fmt(sale.profit)}</span></div>
    </div>` : '';
  const tradeBlock = isTrade && tradeSaleIds.length ? `
    <div style="margin:4px 0 8px;padding:10px 14px;background:var(--blue-dim);border-radius:var(--radius-sm);border:0.5px solid var(--blue);">
      <div style="font-size:11px;font-weight:600;letter-spacing:1px;color:var(--blue);margin-bottom:6px;">TRADE — sales given away:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${tradeSaleIds.map(sid=>`<span style="background:var(--blue-dim);color:var(--blue);border-radius:20px;padding:2px 8px;font-size:12px;font-weight:500;">${sid}</span>`).join('')}</div>
    </div>` : '';
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-row"><span class="detail-key">Purchase ID</span><span class="detail-val mono" style="color:var(--amber)">${p.id}</span></div>
    <div class="detail-row"><span class="detail-key">SKU ID</span><span class="detail-val mono" style="color:var(--text2);">${p.skuId||'—'}</span></div>
    <div class="detail-row"><span class="detail-key">Sale ID</span><span class="detail-val mono" style="color:${sale?'var(--green)':'var(--text3);font-style:italic'}">${sale?sale.id:'Still on Shelf'}</span></div>
    <div class="detail-row"><span class="detail-key">Brand / Type</span><span class="detail-val">${esc(sku.brand||'—')} · ${esc(sku.type||'—')}</span></div>
    <div class="detail-row"><span class="detail-key">Purchased</span><span class="detail-val">${fmtDate(p.date)}</span></div>
    <div class="detail-row"><span class="detail-key">Listed on</span><span class="detail-val">${p.listedDate ? fmtDate(p.listedDate) : '—'}</span></div>
    ${daysOnShelf !== null ? `<div class="detail-row"><span class="detail-key">Days on shelf</span><span class="detail-val" style="color:${daysOnShelf<=14?'var(--green)':daysOnShelf<=45?'var(--amber)':'var(--red)'};">${daysOnShelf} day${daysOnShelf!==1?'s':''}</span></div>` : ''}
    <div class="detail-row"><span class="detail-key">Source</span><span class="detail-val">${esc(p.source||'—')}</span></div>
    <div class="detail-row"><span class="detail-key">State</span><span class="detail-val">${esc(p.state||'—')}</span></div>
    <div class="detail-row"><span class="detail-key">Qty</span><span class="detail-val">${p.qty||1}</span></div>
    <div class="detail-row"><span class="detail-key">Price/unit</span><span class="detail-val mono">${hideFin(fmt(p.pricePerPiece))}</span></div>
    <div class="detail-row"><span class="detail-key">Shipping</span><span class="detail-val mono">${hideFin(fmt(p.shipping))}</span></div>
    <div class="detail-row"><span class="detail-key">Gas</span><span class="detail-val mono">${hideFin(fmt(p.gas))}</span></div>
    <div class="detail-row"><span class="detail-key">Net cost</span><span class="detail-val mono" style="color:var(--amber);font-size:15px;">${hideFin(fmt(p.netCost))}</span></div>
    <div class="detail-row"><span class="detail-key">Payment</span><span class="detail-val">${esc(p.paymentVia||'—')}</span></div>
    <div class="detail-row"><span class="detail-key">Condition</span><span class="detail-val">${p.condition ? `<span style="font-weight:600;color:${['like new','excellent'].includes((p.condition||'').toLowerCase())?'var(--green)':['good','well used'].includes((p.condition||'').toLowerCase())?'var(--amber)':'var(--red)'}">${esc(p.condition)}</span>` : '—'}</span></div>
    <div class="detail-row"><span class="detail-key">Acquisition</span><span class="detail-val"><span class="item-badge" style="${isTrade?'background:var(--blue-dim);color:var(--blue)':'background:var(--green-dim);color:var(--green)'}">${isTrade?'Trade':'Cash Buy'}</span></span></div>
    <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val"><span class="item-badge ${sale?'badge-sold':'badge-unsold'}">${sale?'Sold':'Unsold'}</span></span></div>
    ${p.comments?`<div class="detail-row"><span class="detail-key">Notes</span><span class="detail-val" style="font-size:12px;color:var(--text2);">${esc(p.comments)}</span></div>`:''}
    ${tradeBlock}
    ${saleBlock}
    <div style="margin-top:20px;" class="btn-row">
      ${canWrite() ? `<button class="btn btn-secondary" onclick="editPurchase('${id}')">Edit</button>` : ''}
      ${!sale
        ? (canWrite() ? '<button class="btn btn-primary" onclick="closeSheet(\'detail-sheet\');openSaleForPurchase(\'' + id + '\')">Log Sale' + ICON_CHEVRON_R + '</button>' : '')
        : '<button class="btn btn-secondary" onclick="closeSheet(\'detail-sheet\');viewSaleDetail(\'' + (sale.id) + '\')">View Sale' + ICON_CHEVRON_R + '</button>'}
    </div>
    ${!sale && canDelete() ? '<div style="margin-top:10px;"><button class="btn btn-danger" onclick="deletePurchase(\'' + id + '\')">Delete Purchase</button></div>' : ''}
  `;
  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-sheet').style.transform = 'translate(-50%, 0)';
}
function editPurchase(id) {
  const p = _purchases.find(x=>x.id===id);
  if (!p) return;
  closeSheet('detail-sheet');
  populatePurchaseSKUSelect();
  document.getElementById('purchase-sheet-title').textContent = 'Edit Purchase';
  document.getElementById('purchase-edit-id').value = id;
  document.getElementById('purchase-sku').value = p.skuId;
  // Pre-fill typeahead label
  const skuForEdit = _skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
  document.getElementById('purchase-sku-search').value = skuForEdit.product ? skuForEdit.brand+' – '+skuForEdit.product : p.skuId;
  document.getElementById('purchase-date').value = p.date;
  document.getElementById('purchase-listed-date').value = p.listedDate||'';
  document.getElementById('purchase-source').value = p.source;
  document.getElementById('purchase-price').value = p.pricePerPiece;
  document.getElementById('purchase-qty').value = p.qty||1;
  document.getElementById('purchase-shipping').value = p.shipping||0;
  document.getElementById('purchase-gas').value = p.gas||0;
  document.getElementById('purchase-payment').value = p.paymentVia;
  document.getElementById('purchase-state').value = p.state||'';
  document.getElementById('purchase-comments').value = p.comments||'';
  document.getElementById('purchase-condition').value = p.condition||'';
  calcPurchaseCost();
  document.getElementById('purchase-btn-row').innerHTML = `
    <button class="btn btn-secondary" onclick="deletePurchase('${id}')">Delete</button>
    <button class="btn btn-primary" onclick="savePurchase()">Update</button>
  `;
  document.getElementById('purchase-overlay').classList.add('open');
  document.getElementById('purchase-sheet').style.transform = 'translate(-50%, 0)';
}
async function deletePurchase(id) {
  if (!confirm('Delete this purchase? Any linked sale will also be removed.')) return;
  try {
    const linked = _sales.filter(s=>normalizePurchaseId(s.purchaseId)===normalizePurchaseId(id));
    for (const s of linked) await DB.deleteSale(s.id);
    await DB.deletePurchase(id);
    await loadAll();
    closeSheet('detail-sheet');
    closeSheet('purchase-sheet');
    renderPurchases();
    toast('Purchase deleted');
  } catch(e) { toast(e.message); }
}

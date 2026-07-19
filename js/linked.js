// ─── LINKED RECORDS ────────────────────────────────────────
let linkedFilter = 'all';
function setLinkedFilter(el) {
  document.querySelectorAll('#linked-tabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  linkedFilter = el.dataset.filter;
  renderLinked();
}
function renderLinked() {
  const q = (document.getElementById('linked-search').value||'').toLowerCase();
  const skus = _skus;
  const purchases = _purchases;
  const sales = _sales;
  const saleByPurchase = {};
  sales.forEach(s => { saleByPurchase[s.purchaseId] = s; });

  let rows = [...purchases].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // filter
  rows = rows.filter(p => {
    const sku = skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
    const sale = saleByPurchase[p.id];
    const sold = !!sale;
    if (linkedFilter === 'sold' && !sold) return false;
    if (linkedFilter === 'unsold' && sold) return false;
    if (linkedFilter === 'trade' && !p.isTrade) return false;
    if (q) {
      const text = (sku.product+sku.brand+p.id+(sale?sale.id:'')+p.comments).toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  const sold = rows.filter(p=>saleByPurchase[p.id]).length;
  const unsold = rows.filter(p=>!saleByPurchase[p.id]).length;
  document.getElementById('linked-subtitle').textContent = `${rows.length} records · ${sold} sold · ${unsold} unsold`;

  const el = document.getElementById('linked-list');
  if (rows.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">${ICON_LINK_BIG}</div><div class="empty-text">No records found</div></div>`;
    return;
  }

  el.innerHTML = rows.map(p => {
    const sku = skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
    const sale = saleByPurchase[p.id];
    const profit = sale ? +sale.profit||0 : null;
    const tradeIcon = p.isTrade ? ICON_SWAP : '';
    return `
    <div style="background:var(--bg2);border:0.5px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px;cursor:pointer;" onclick="viewPurchaseDetail('${p.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-size:14px;font-weight:600;">${tradeIcon}${esc(sku.product||'Unknown')}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${esc(sku.brand||'')} · ${esc(sku.type||'')}</div>
        </div>
        <span class="item-badge ${sale?'badge-sold':'badge-unsold'}">${sale?'Sold':'Unsold'}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;">
        <div><span style="color:var(--text3);">Purchase</span> <span style="font-family:'DM Mono',monospace;color:var(--amber);">${p.id}</span></div>
        <div><span style="color:var(--text3);">Sale</span> <span style="font-family:'DM Mono',monospace;color:${sale?'var(--green)':'var(--text3)'};">${sale?sale.id:'—'}</span></div>
        <div><span style="color:var(--text3);">Cost</span> <span style="font-family:'DM Mono',monospace;">${'$'+(+p.netCost||0).toFixed(0)}</span></div>
        <div><span style="color:var(--text3);">Profit</span> <span style="font-family:'DM Mono',monospace;color:${profit===null?'var(--text3)':profit>=0?'var(--green)':'var(--red)'};">${profit===null?'—':'$'+profit.toFixed(0)}</span></div>
        <div><span style="color:var(--text3);">Bought</span> <span>${fmtDate(p.date)}</span></div>
        <div><span style="color:var(--text3);">Sold</span> <span>${sale?fmtDate(sale.date):'—'}</span></div>
      </div>
      ${(()=>{try{const ids=JSON.parse(p.tradeSaleIds||'[]');return ids.length?`<div style="margin-top:8px;font-size:11px;color:var(--blue);background:var(--blue-dim);padding:5px 8px;border-radius:6px;">Traded: ${ids.join(', ')}</div>`:''}catch{return ''}})()}
      ${p.comments&&p.comments!='nan'?`<div style="margin-top:6px;font-size:11px;color:var(--text3);font-style:italic;">${esc(p.comments.slice(0,80))}${p.comments.length>80?'…':''}</div>`:''}
    </div>`;
  }).join('');
}

// ─── INSIGHTS (merged Summary + Pricing) ───────────────────
let summaryFilter = 'all';

function setSummaryFilter(el) {
  document.querySelectorAll('#summary-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  summaryFilter = el.dataset.filter;
  renderSummary();
}

function renderSummary() {
  const q = (document.getElementById('summary-search').value||'').toLowerCase();
  const sortCol = document.getElementById('summary-sort-select')?.value || 'sku';
  const COND_ORDER = ['Like New', 'Excellent', 'Good', 'Well Used', 'Heavily Used'];

  let rows = _skus.map(sku => {
    const purchases = _purchases.filter(p => normalizeSkuId(p.skuId) === normalizeSkuId(sku.id));
    if (!purchases.length) return null;

    const purchaseNormIds = new Set(purchases.map(p => normalizePurchaseId(p.id)));
    const matchedSales = _sales.filter(s => purchaseNormIds.has(normalizePurchaseId(s.purchaseId)));
    const soldPurchaseIds = new Set(matchedSales.map(s => normalizePurchaseId(s.purchaseId)));
    const soldPurchases = purchases.filter(p => soldPurchaseIds.has(normalizePurchaseId(p.id)) || p.sold);
    const unsoldPurchases = purchases.filter(p => !soldPurchaseIds.has(normalizePurchaseId(p.id)) && !p.sold);

    const qtyPurchased = purchases.reduce((s, p) => s + (+p.qty||1), 0);
    const qtySold = soldPurchases.reduce((s, p) => s + (+p.qty||1), 0);
    const qtyRemaining = qtyPurchased - qtySold;
    const sellThrough = qtyPurchased > 0 ? qtySold / qtyPurchased : 0;
    const tiedUpCapital = unsoldPurchases.reduce((s, p) => s + (+p.netCost||0), 0);
    const totalProfit = matchedSales.reduce((s, sale) => s + (+sale.profit||0), 0);
    const totalCostSold = matchedSales.reduce((s, sale) => s + (+sale.netCost||0), 0);
    const avgMargin = totalCostSold > 0 ? (totalProfit / totalCostSold) * 100 : null;

    // Build condition map for the pricing rows
    const condMap = {};
    matchedSales.forEach(sale => {
      const p = purchases.find(p => normalizePurchaseId(p.id) === normalizePurchaseId(sale.purchaseId));
      const cond = p?.condition || 'Unknown';
      const days = (p?.date && sale.date) ? Math.round((new Date(sale.date) - new Date(p.date)) / 86400000) : null;
      if (!condMap[cond]) condMap[cond] = [];
      condMap[cond].push({ netCost: +(p?.netCost)||0, netSale: +sale.netSale||0, profit: +sale.profit||0, days });
    });

    const allDays = Object.values(condMap).flat().map(e => e.days).filter(d => d !== null && d >= 0);
    const avgDays = allDays.length ? Math.round(allDays.reduce((a,b)=>a+b,0)/allDays.length) : null;

    return { sku, qtyPurchased, qtySold, qtyRemaining, sellThrough, tiedUpCapital, totalProfit, avgMargin, avgDays, condMap };
  }).filter(Boolean);

  if (q) rows = rows.filter(r => (r.sku.product+r.sku.brand+r.sku.type+r.sku.id).toLowerCase().includes(q));
  if (summaryFilter === 'remaining') rows = rows.filter(r => r.qtyRemaining > 0);
  if (['Camera','Lens','Accessory'].includes(summaryFilter)) rows = rows.filter(r => r.sku.type === summaryFilter);

  rows.sort((a, b) => {
    if (sortCol === 'sku')     return skuIdNum(a.sku.id) - skuIdNum(b.sku.id);
    if (sortCol === 'capital') return b.tiedUpCapital - a.tiedUpCapital;
    if (sortCol === 'profit')  return b.totalProfit - a.totalProfit;
    if (sortCol === 'margin')  return (b.avgMargin||0) - (a.avgMargin||0);
    if (sortCol === 'days')    return (a.avgDays||9999) - (b.avgDays||9999);
    if (sortCol === 'rem')     return b.qtyRemaining - a.qtyRemaining;
    if (sortCol === 'sellpct') return b.sellThrough - a.sellThrough;
    return 0;
  });

  const countEl = document.getElementById('summary-count');
  if (countEl) countEl.textContent = `${rows.length} ${rows.length===1?'product':'products'}`;

  const list = document.getElementById('summary-list');
  if (!list) return;
  if (!rows.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px;">No products found</div>`;
    return;
  }

  const avg = arr => arr.reduce((s,v)=>s+v,0)/arr.length;
  const fmtC = v => '$' + Math.round(v).toLocaleString();
  const fmtPct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

  list.innerHTML = rows.map(r => {
    const pct = Math.round(r.sellThrough * 100);
    const profitColor = r.totalProfit > 0 ? 'var(--green)' : r.totalProfit < 0 ? 'var(--red)' : 'var(--text3)';
    const marginColor = (r.avgMargin||0) > 0 ? 'var(--green)' : (r.avgMargin||0) < 0 ? 'var(--red)' : 'var(--text3)';

    const conds = [...COND_ORDER.filter(c => r.condMap[c]), ...(r.condMap['Unknown'] ? ['Unknown'] : [])];

    const condColHdr = conds.length ? `
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr 1.1fr 0.8fr;gap:4px;padding:5px 12px 4px;background:var(--bg3);border-bottom:0.5px solid var(--border);">
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Condition</div>
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Avg Buy</div>
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Avg Sell</div>
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Profit · Margin</div>
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Days</div>
      </div>` : '';

    const condRows = conds.map(cond => {
      const entries = r.condMap[cond];
      const avgBuy    = avg(entries.map(e => e.netCost));
      const avgSell   = avg(entries.map(e => e.netSale));
      const avgProfit = avg(entries.map(e => e.profit));
      const daysArr   = entries.map(e => e.days).filter(d => d !== null && d >= 0);
      const avgDaysC  = daysArr.length ? Math.round(avg(daysArr)) : null;
      const count     = entries.length;
      const pColor    = avgProfit >= 0 ? 'var(--green)' : 'var(--red)';
      const margPct   = avgBuy > 0 ? (avgProfit / avgBuy) * 100 : null;
      const dimStyle  = count === 1 ? 'opacity:0.65;' : '';
      return `<div style="display:grid;grid-template-columns:1.2fr 1fr 1fr 1.1fr 0.8fr;gap:4px;padding:9px 12px;border-bottom:0.5px solid var(--border);align-items:center;${dimStyle}">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text2);">${esc(cond)}</div>
          <div style="font-size:10px;color:${count===1?'var(--amber)':'var(--text3)'};margin-top:1px;">${count} sale${count>1?'s':''}</div>
        </div>
        <div style="font-size:13px;font-weight:600;font-family:'DM Mono',monospace;color:var(--amber);">${hideFin(fmtC(avgBuy))}</div>
        <div style="font-size:13px;font-weight:600;font-family:'DM Mono',monospace;color:var(--text);">${hideFin(fmtC(avgSell))}</div>
        <div>
          <div style="font-size:13px;font-weight:600;font-family:'DM Mono',monospace;color:${pColor};">${hideFin(fmtC(avgProfit))}</div>
          ${margPct !== null ? `<div style="font-size:10px;color:${pColor};margin-top:1px;">${hideFin(fmtPct(margPct))}</div>` : ''}
        </div>
        <div style="font-size:13px;font-weight:600;font-family:'DM Mono',monospace;color:var(--blue);">${avgDaysC !== null ? avgDaysC+'d' : '—'}</div>
      </div>`;
    }).join('');

    const noSales = !conds.length;

    return `<div style="background:var(--bg2);border:0.5px solid var(--border);border-radius:var(--radius);margin-bottom:12px;overflow:hidden;">
      <!-- Card header -->
      <div style="padding:10px 12px;background:var(--bg3);border-bottom:0.5px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--text3);">${r.sku.id}</span>
          <span class="item-badge ${r.sku.type==='Camera'?'badge-camera':r.sku.type==='Lens'?'badge-lens':'badge-acc'}" style="font-size:10px;">${esc(r.sku.type||'—')}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.sku.product||'—')}</span>
          <span style="font-size:11px;color:var(--text3);white-space:nowrap;">${esc(r.sku.brand||'')}</span>
        </div>
        <!-- Inventory strip -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:12px;font-weight:600;color:${r.qtyRemaining>0?'var(--amber)':'var(--green)'};">${r.qtyRemaining}</span>
            <span style="font-size:11px;color:var(--text3);">in stock</span>
            <span style="font-size:11px;color:var(--border2);">·</span>
            <span style="font-size:12px;font-weight:600;color:var(--green);">${r.qtySold}</span>
            <span style="font-size:11px;color:var(--text3);">sold</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <div style="background:var(--bg4);border-radius:3px;height:4px;width:44px;">
              <div style="width:${pct}%;max-width:100%;background:var(--green);height:100%;border-radius:3px;"></div>
            </div>
            <span style="font-size:11px;color:var(--text3);">${pct}%</span>
          </div>
          ${r.tiedUpCapital > 0 ? `<span style="font-size:11px;background:var(--amber-dim);color:var(--amber);padding:2px 7px;border-radius:4px;font-family:'DM Mono',monospace;">${hideFin(fmtC(r.tiedUpCapital))} tied up</span>` : ''}
          ${r.qtySold > 0 ? `<span style="font-size:11px;background:${r.totalProfit>=0?'var(--green-dim)':'var(--red-dim)'};color:${profitColor};padding:2px 7px;border-radius:4px;font-family:'DM Mono',monospace;">${hideFin((r.totalProfit>=0?'+':'')+fmtC(r.totalProfit))} profit</span>` : ''}
          ${r.avgMargin !== null ? `<span style="font-size:11px;color:${marginColor};">${hideFin(fmtPct(r.avgMargin))} margin</span>` : ''}
        </div>
      </div>
      ${condColHdr}
      ${condRows}
      ${noSales ? `<div style="padding:10px 12px;font-size:12px;color:var(--text3);font-style:italic;">No sales yet</div>` : ''}
    </div>`;
  }).join('');
}

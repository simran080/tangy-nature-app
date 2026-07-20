function exportSales() {
  const rows = [..._sales].sort((a,b) => saleIdNum(a.id) - saleIdNum(b.id));
  const cols = [
    { label:'Sale ID', key:'id' },
    { label:'Purchase ID', key:'purchaseId' },
    { label:'SKU ID', get:r => r.skuId || _skuFor(r.purchaseId).p.skuId || '' },
    { label:'Product', get:r => _skuFor(r.purchaseId).s.product || '' },
    { label:'Date', key:'date' },
    { label:'Channel', key:'source' },
    { label:'Buyer State', key:'state' },
    { label:'Sale Price', key:'unitPrice' },
    { label:'Shipping Charged', key:'shippingCharged' },
    { label:'Shipping Paid', key:'shippingPaid' },
    { label:'Fees', key:'fees' },
    { label:'G&A', key:'ga' },
    { label:'Net Cost', key:'netCost' },
    { label:'Net Sale', key:'netSale' },
    { label:'Profit', key:'profit' },
    { label:'Margin %', get:r => ((+r.margin||0)*100).toFixed(1) },
    { label:'Trade', get:r => r.isTrade ? 'Yes' : 'No' },
    { label:'PayPal Released', get:r => r.paypalReleased ? 'Yes' : 'No' },
    { label:'Carrier', key:'carrier' },
    { label:'Tracking Number', key:'trackingNumber' },
    { label:'Tracking URL', key:'trackingUrl' },
    { label:'Label URL', key:'labelUrl' },
    { label:'Notes', key:'comments' },
  ];
  downloadCSV(`tangy-nature-sales-${_today()}.csv`, toCSV(rows, cols));
  toast(`Exported ${rows.length} sales`);
}
function exportPurchases() {
  const rows = [..._purchases].sort((a,b) => purchaseIdNum(a.id) - purchaseIdNum(b.id));
  const soldIds = new Set(_sales.map(s => normalizePurchaseId(s.purchaseId)));
  const cols = [
    { label:'Purchase ID', key:'id' },
    { label:'SKU ID', key:'skuId' },
    { label:'Product', get:r => (_skus.find(s => normalizeSkuId(s.id) === normalizeSkuId(r.skuId))||{}).product || '' },
    { label:'Date', key:'date' },
    { label:'Listed Date', key:'listedDate' },
    { label:'Source', key:'source' },
    { label:'State', key:'state' },
    { label:'Qty', get:r => r.qty || 1 },
    { label:'Price/Unit', key:'pricePerPiece' },
    { label:'Shipping', key:'shipping' },
    { label:'Gas', key:'gas' },
    { label:'Net Cost', key:'netCost' },
    { label:'Payment', key:'paymentVia' },
    { label:'Condition', key:'condition' },
    { label:'Trade', get:r => r.isTrade ? 'Yes' : 'No' },
    { label:'Status', get:r => (soldIds.has(normalizePurchaseId(r.id)) || r.sold) ? 'Sold' : 'Unsold' },
    { label:'Notes', key:'comments' },
  ];
  downloadCSV(`tangy-nature-purchases-${_today()}.csv`, toCSV(rows, cols));
  toast(`Exported ${rows.length} purchases`);
}
function exportExpenses() {
  const rows = [..._expenses].sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const cols = [
    { label:'Date', key:'date' },
    { label:'Category', key:'type' },
    { label:'Product', key:'product' },
    { label:'Source', key:'source' },
    { label:'Qty', get:r => r.qty || 1 },
    { label:'Price', key:'price' },
    { label:'Discount', key:'discount' },
    { label:'Tax', key:'taxAmount' },
    { label:'Net Amount', key:'netAmount' },
  ];
  downloadCSV(`tangy-nature-expenses-${_today()}.csv`, toCSV(rows, cols));
  toast(`Exported ${rows.length} expenses`);
}

// ─── DASHBOARD ─────────────────────────────────────────────
let dashYear = 'all';
let dashQuarter = 'all';
let dashMonth = 'all';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function setDashYear(el, year) {
  document.querySelectorAll('#dash-year-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  dashYear = year;
  dashQuarter = 'all';
  dashMonth = 'all';
  renderQuarterTabs();
  renderMonthTabs();
  renderDashboardMetrics();
  renderDashboardChart();
}

function setDashQuarter(el, quarter) {
  document.querySelectorAll('#dash-quarter-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  dashQuarter = quarter;
  dashMonth = 'all';
  renderMonthTabs();
  renderDashboardMetrics();
  renderDashboardChart();
}

function setDashMonth(el, month) {
  document.querySelectorAll('#dash-month-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  dashMonth = month;
  renderDashboardMetrics();
  renderDashboardChart();
}

function renderQuarterTabs() {
  const qtEl = document.getElementById('dash-quarter-tabs');
  if (dashYear === 'all') { qtEl.style.display = 'none'; return; }
  const quartersWithData = new Set(
    _sales.filter(s => s.date && s.date.startsWith(dashYear))
      .map(s => 'Q' + Math.ceil(parseInt(s.date.slice(5,7)) / 3))
  );
  if (quartersWithData.size === 0) { qtEl.style.display = 'none'; return; }
  qtEl.style.display = 'flex';
  qtEl.innerHTML = `<div class="tab ${dashQuarter==='all'?'active':''}" onclick="setDashQuarter(this,'all')">Full Year</div>`
    + ['Q1','Q2','Q3','Q4'].filter(q => quartersWithData.has(q))
      .map(q => `<div class="tab ${dashQuarter===q?'active':''}" onclick="setDashQuarter(this,'${q}')">${q}</div>`).join('');
}

function renderMonthTabs() {
  const mtEl = document.getElementById('dash-month-tabs');
  if (dashYear === 'all') { mtEl.style.display = 'none'; return; }

  // Get months that have data — filtered by quarter if set
  const qMonths = dashQuarter !== 'all' ? getQuarterMonths(dashQuarter) : null;
  const monthsWithData = new Set(
    _sales.filter(s => {
      if (!s.date || !s.date.startsWith(dashYear)) return false;
      if (qMonths && !qMonths.includes(s.date.slice(5,7))) return false;
      return true;
    }).map(s => s.date.slice(5,7))
  );
  if (monthsWithData.size === 0) { mtEl.style.display = 'none'; return; }
  mtEl.style.display = 'flex';
  const label = dashQuarter !== 'all' ? dashQuarter : 'All Months';
  mtEl.innerHTML = `<div class="tab ${dashMonth==='all'?'active':''}" onclick="setDashMonth(this,'all')">${label}</div>`
    + ['01','02','03','04','05','06','07','08','09','10','11','12']
      .filter(m => monthsWithData.has(m))
      .map(m => `<div class="tab ${dashMonth===m?'active':''}" onclick="setDashMonth(this,'${m}')">${MONTH_NAMES[parseInt(m)-1]}</div>`).join('');
}

function getQuarterMonths(q) {
  return { Q1:['01','02','03'], Q2:['04','05','06'], Q3:['07','08','09'], Q4:['10','11','12'] }[q] || [];
}

function renderDashboardMetrics() {
  const purchases = _purchases;
  const allSales = _sales;
  const skus = _skus;
  const allExpenses = _expenses;

  // Filter by year → quarter → month
  let sales = dashYear === 'all' ? allSales : allSales.filter(s => s.date && s.date.startsWith(dashYear));
  let expenses = dashYear === 'all' ? allExpenses : allExpenses.filter(e => e.date && e.date.startsWith(dashYear));
  if (dashYear !== 'all' && dashQuarter !== 'all') {
    const months = getQuarterMonths(dashQuarter);
    sales = sales.filter(s => s.date && months.includes(s.date.slice(5,7)));
    expenses = expenses.filter(e => e.date && months.includes(e.date.slice(5,7)));
  }
  if (dashYear !== 'all' && dashMonth !== 'all') {
    sales = sales.filter(s => s.date && s.date.slice(5,7) === dashMonth);
    expenses = expenses.filter(e => e.date && e.date.slice(5,7) === dashMonth);
  }

  const totalCost = sales.reduce((s,s2) => s + (+s2.netCost||0), 0);
  const totalRevenue = sales.reduce((s,s2) => s + (+s2.netSale||0), 0);
  const totalProfit = sales.reduce((s,s2) => s + (+s2.profit||0), 0);
  const totalExpenses = expenses.reduce((s,e) => s + (+e.netAmount||0), 0);
  const operatingProfit = totalProfit - totalExpenses;
  const revToProfitPct = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
  const soldIds = new Set(allSales.map(s=>normalizePurchaseId(s.purchaseId)));
  const unsoldPurchases = purchases.filter(p => !soldIds.has(normalizePurchaseId(p.id)) && !p.sold);
  const tiedUp = unsoldPurchases.reduce((s,p) => s + (+p.netCost||0), 0);

  // Avg days to sell
  const daysArr = sales.map(s => {
    const purchase = purchases.find(p => p.id === s.purchaseId);
    if (!purchase || !purchase.date || !s.date) return null;
    return Math.round((new Date(s.date) - new Date(purchase.date)) / (1000*60*60*24));
  }).filter(d => d !== null && d >= 0);
  const avgDays = daysArr.length > 0 ? Math.round(daysArr.reduce((a,b)=>a+b,0) / daysArr.length) : null;
  const avgDaysColor = avgDays === null ? 'var(--text)' : +avgDays <= 3 ? 'var(--green)' : +avgDays <= 14 ? 'var(--amber)' : 'var(--red)';

  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric-card hero">
      <div class="hero-main">
        <div class="metric-label">OPERATING PROFIT</div>
        <div class="metric-value">${hideFin(fmt(operatingProfit))}</div>
      </div>
      <div class="hero-breakdown">
        <div class="hero-stat"><span>Sales profit</span><strong>${hideFin(fmt(totalProfit))}</strong></div>
        <div class="hero-stat"><span>Expenses</span><strong>${hideFin(fmt(totalExpenses))}</strong></div>
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-label">TOTAL COST</div>
      <div class="metric-value">${hideFin(fmt(totalCost))}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">TOTAL REVENUE</div>
      <div class="metric-value">${hideFin(fmt(totalRevenue))}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">REVENUE TO PROFIT</div>
      <div class="metric-value ${revToProfitPct>=0?'green':'red'}">${isViewer()?"••••":revToProfitPct.toFixed(1)+"%"}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">TIED-UP CAPITAL</div>
      <div class="metric-value">${hideFin(fmt(tiedUp))}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">ITEMS SOLD</div>
      <div class="metric-value amber">${sales.length}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">AVG DAYS TO SELL</div>
      <div class="metric-value" style="color:${avgDaysColor};">${avgDays !== null ? avgDays + 'd' : '—'}</div>
    </div>
  `;

  const unsoldEl = document.getElementById('dash-unsold');
  if (unsoldPurchases.length === 0) {
    unsoldEl.innerHTML = '<div class="empty"><div class="empty-text">No unsold inventory</div></div>';
  } else {
    unsoldEl.innerHTML = [...unsoldPurchases].sort((a,b) => (+b.netCost||0) - (+a.netCost||0)).map(p => {
      const sku = skus.find(s=>normalizeSkuId(s.id)===normalizeSkuId(p.skuId))||{};
      return `<div class="list-item" onclick="viewPurchaseDetail('${p.id}')">
        <div class="item-icon ${typeClass(sku.type||'')}">${typeIcon(sku.type||'')}</div>
        <div class="item-body">
          <div class="item-name">${esc(sku.product||'Unknown')}</div>
          <div class="item-sub">${fmtDate(p.date)} · ${esc(p.source||'')}</div>
        </div>
        <div class="item-right">
          <div class="item-amount amber">${hideFin(fmt(p.netCost))}</div>
          <div class="item-badge badge-unsold">Unsold</div>
        </div>
      </div>`;
    }).join('');
  }

  const recentEl = document.getElementById('dash-recent-sales');
  const recent = [...sales].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (recent.length === 0) {
    recentEl.innerHTML = '<div class="empty"><div class="empty-text">No sales yet</div></div>';
  } else {
    recentEl.innerHTML = recent.map(s => {
      const purchase = purchases.find(p=>p.id===s.purchaseId)||{};
      const sku = skus.find(sk=>sk.id===purchase.skuId)||{};
      const profit = +s.profit||0;
      const daysToSell = (purchase.date && s.date)
        ? Math.round((new Date(s.date) - new Date(purchase.date)) / (1000*60*60*24))
        : null;
      const daysLabel = daysToSell === null ? '—' : daysToSell === 0 ? 'Same day' : daysToSell === 1 ? '1 day' : `${daysToSell} days`;
      const daysColor = daysToSell === null ? 'var(--text3)' : daysToSell <= 3 ? 'var(--green)' : daysToSell <= 14 ? 'var(--amber)' : 'var(--red)';
      return `<div class="list-item" style="align-items:flex-start;padding:14px 16px;" onclick="viewSaleDetail('${s.id}')">
        <div class="item-icon ${typeClass(sku.type||'')}" style="margin-top:2px;">${typeIcon(sku.type||'')}</div>
        <div class="item-body">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div class="item-name" style="min-width:0;flex:1;">${esc(sku.product||'Unknown')}</div>
            <div style="font-size:11px;font-weight:600;color:${daysColor};background:var(--bg3);border-radius:20px;padding:2px 8px;white-space:nowrap;display:flex;align-items:center;flex-shrink:0;">${ICON_CLOCK}${daysLabel}</div>
          </div>
          <div class="item-sub">${fmtDate(purchase.date)} → ${fmtDate(s.date)} · ${esc(s.source||'')}</div>
          <div style="display:flex;gap:10px;margin-top:8px;">
            <div style="flex:1;min-width:0;background:var(--bg3);border-radius:6px;padding:6px 8px;">
              <div style="font-size:10px;color:var(--text3);letter-spacing:0.5px;margin-bottom:2px;">COST</div>
              <div style="font-size:12px;font-weight:600;font-family:'DM Mono',monospace;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${hideFin(fmt(s.netCost))}</div>
            </div>
            <div style="flex:1;min-width:0;background:var(--bg3);border-radius:6px;padding:6px 8px;">
              <div style="font-size:10px;color:var(--text3);letter-spacing:0.5px;margin-bottom:2px;">SALE</div>
              <div style="font-size:12px;font-weight:600;font-family:'DM Mono',monospace;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${hideFin(fmt(s.netSale))}</div>
            </div>
            <div style="flex:1;min-width:0;background:var(--bg3);border-radius:6px;padding:6px 8px;">
              <div style="font-size:10px;color:var(--text3);letter-spacing:0.5px;margin-bottom:2px;">PROFIT</div>
              <div style="font-size:12px;font-weight:600;font-family:'DM Mono',monospace;color:${profit>=0?'var(--green)':'var(--red)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${hideFin(fmt(profit))}</div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
}

// ─── MONTHLY TREND CHART ────────────────────────────────────
let _dashChart = null;
function renderDashboardChart() {
  const wrap = document.getElementById('dash-trend-wrap');
  const canvas = document.getElementById('dash-trend-chart');
  if (!wrap || !canvas || typeof Chart === 'undefined') return;
  if (isViewer()) { wrap.style.display = 'none'; return; }

  let sales = dashYear === 'all' ? _sales : _sales.filter(s => s.date && s.date.startsWith(dashYear));
  let expenses = dashYear === 'all' ? _expenses : _expenses.filter(e => e.date && e.date.startsWith(dashYear));
  if (dashYear !== 'all' && dashQuarter !== 'all') {
    const months = getQuarterMonths(dashQuarter);
    sales = sales.filter(s => s.date && months.includes(s.date.slice(5,7)));
    expenses = expenses.filter(e => e.date && months.includes(e.date.slice(5,7)));
  }
  if (dashYear !== 'all' && dashMonth !== 'all') {
    sales = sales.filter(s => s.date && s.date.slice(5,7) === dashMonth);
    expenses = expenses.filter(e => e.date && e.date.slice(5,7) === dashMonth);
  }

  const byMonth = {};
  const monthKey = d => d.slice(0, 7); // YYYY-MM
  sales.forEach(s => {
    if (!s.date) return;
    const k = monthKey(s.date);
    (byMonth[k] = byMonth[k] || { revenue: 0, cost: 0, profit: 0, expenses: 0 });
    byMonth[k].revenue += +s.netSale || 0;
    byMonth[k].cost += +s.netCost || 0;
    byMonth[k].profit += +s.profit || 0;
  });
  expenses.forEach(e => {
    if (!e.date) return;
    const k = monthKey(e.date);
    (byMonth[k] = byMonth[k] || { revenue: 0, cost: 0, profit: 0, expenses: 0 });
    byMonth[k].expenses += +e.netAmount || 0;
  });

  const months = Object.keys(byMonth).sort();
  if (months.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  const labels = months.map(m => {
    const [y, mo] = m.split('-');
    return MONTH_NAMES[parseInt(mo) - 1] + ' \'' + y.slice(2);
  });
  const revenueData = months.map(m => byMonth[m].revenue);
  const costData = months.map(m => byMonth[m].cost + byMonth[m].expenses);
  const profitData = months.map(m => byMonth[m].profit - byMonth[m].expenses);

  const style = getComputedStyle(document.documentElement);
  const cGreen = style.getPropertyValue('--green').trim();
  const cRed = style.getPropertyValue('--red').trim();
  const cBlue = style.getPropertyValue('--blue').trim();
  const cText3 = style.getPropertyValue('--text3').trim();
  const cBorder = style.getPropertyValue('--border').trim();
  const font = { family: "'DM Sans', sans-serif", size: 11 };

  if (_dashChart) { _dashChart.destroy(); _dashChart = null; }
  _dashChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Revenue', data: revenueData, borderColor: cBlue, backgroundColor: cBlue, tension: 0.3, pointRadius: 2 },
        { label: 'Cost', data: costData, borderColor: cRed, backgroundColor: cRed, tension: 0.3, pointRadius: 2 },
        { label: 'Profit', data: profitData, borderColor: cGreen, backgroundColor: cGreen, tension: 0.3, pointRadius: 2, borderWidth: 2.5 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: cText3, boxWidth: 10, font } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: cText3, font }, grid: { color: cBorder } },
        y: { ticks: { color: cText3, font, callback: v => '$' + v }, grid: { color: cBorder } },
      },
    },
  });
}

function renderDashboard() {
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

  // Build year tabs from available sales data
  const allSales = _sales;
  const years = [...new Set(allSales.map(s => s.date ? s.date.slice(0,4) : null).filter(Boolean))].sort().reverse();
  const tabsEl = document.getElementById('dash-year-tabs');
  tabsEl.innerHTML = `<div class="tab ${dashYear==='all'?'active':''}" onclick="setDashYear(this,'all')">All Time</div>`
    + years.map(y => `<div class="tab ${dashYear===y?'active':''}" onclick="setDashYear(this,'${y}')">${y}</div>`).join('');


  renderDashboardMetrics();
  renderDashboardChart();
}

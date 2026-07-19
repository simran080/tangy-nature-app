// ─── EXPENSES ─────────────────────────────────────────────
const expCategoryIcon = { 'Cam Accessories':ICON_GEAR, 'Backdrop':ICON_IMAGE, 'Display Board':ICON_CLIPBOARD, 'Shipping':ICON_BOX, 'Others':ICON_BULB };
let expFilter = 'all';
function setExpFilter(el) {
  document.querySelectorAll('#exp-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  expFilter = el.dataset.filter;
  renderExpenses();
}
function calcExpenseCost() {
  const price = +document.getElementById('expense-price').value||0;
  const qty = +document.getElementById('expense-qty').value||1;
  const discount = +document.getElementById('expense-discount').value||0;
  const taxRate = (+document.getElementById('expense-tax').value||0)/100;
  const gross = (price * qty) - discount;
  const net = gross + (gross * taxRate);
  document.getElementById('exp-net-display').textContent = fmt(net);
}
function openExpenseSheet() {
  document.getElementById('expense-sheet-title').textContent = 'Log Expense';
  document.getElementById('expense-edit-id').value = '';
  document.getElementById('expense-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('expense-qty').value = 1;
  document.getElementById('expense-price').value = '';
  document.getElementById('expense-discount').value = 0;
  document.getElementById('expense-tax').value = 6.35;
  document.getElementById('expense-product').value = '';
  document.getElementById('expense-source').value = '';
  document.getElementById('exp-net-display').textContent = '$0.00';
  document.getElementById('expense-btn-row').innerHTML = '<button class="btn btn-primary" onclick="saveExpense()">Log Expense</button>';
  document.getElementById('expense-overlay').classList.add('open');
  document.getElementById('expense-sheet').style.transform = 'translate(-50%, 0)';
}
async function saveExpense() {
  const product = document.getElementById('expense-product').value.trim();
  const price = +document.getElementById('expense-price').value;
  if (!product || !price) { toast('Please fill in product and price'); return; }
  const qty = +document.getElementById('expense-qty').value||1;
  const discount = +document.getElementById('expense-discount').value||0;
  const taxRate = (+document.getElementById('expense-tax').value||0)/100;
  const gross = (price * qty) - discount;
  const taxAmount = gross * taxRate;
  const net = gross + taxAmount;
  const editId = document.getElementById('expense-edit-id').value;
  const e = {
    id: editId || uid(),
    type: document.getElementById('expense-type').value,
    product, source: document.getElementById('expense-source').value,
    date: document.getElementById('expense-date').value,
    price, qty, discount, taxRate, grossAmount: gross, taxAmount, netAmount: net,
  };
  try {
    await DB.saveExpense(e);
    await loadAll();
    closeSheet('expense-sheet');
    renderExpenses();
    toast(editId ? 'Expense updated' : 'Expense logged');
  } catch(e2) { toast(e2.message); }
}
function renderExpenses() {
  let expenses = [..._expenses].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (expFilter !== 'all') expenses = expenses.filter(e=>e.type===expFilter);
  const allExpenses = _expenses;
  const totalNet = allExpenses.reduce((s,e)=>s+(+e.netAmount||0),0);
  const totalGross = allExpenses.reduce((s,e)=>s+(+e.grossAmount||0),0);
  const totalTax = allExpenses.reduce((s,e)=>s+(+e.taxAmount||0),0);
  const countEl = document.getElementById('exp-count');
  if (countEl) countEl.textContent = `${expenses.length} ${expenses.length === 1 ? 'item' : 'items'}`;
  document.getElementById('exp-metrics').innerHTML = `
    <div class="metric-card">
      <div class="metric-label">TOTAL SPENT</div>
      <div class="metric-value red">${fmt(totalNet)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">TAX PAID</div>
      <div class="metric-value">${fmt(totalTax)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">ITEMS</div>
      <div class="metric-value amber">${allExpenses.length}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">PRE-TAX TOTAL</div>
      <div class="metric-value">${fmt(totalGross)}</div>
    </div>
  `;
  const el = document.getElementById('expense-list');
  if (expenses.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">${ICON_RECEIPT_BIG}</div><div class="empty-text">No expenses yet</div><div class="empty-sub">Tap + to log your first expense</div></div>`;
    return;
  }
  el.innerHTML = expenses.map(e => `
    <div class="list-item" onclick="viewExpenseDetail('${e.id}')">
      <div class="item-icon icon-acc">${expCategoryIcon[e.type]||ICON_BULB}</div>
      <div class="item-body">
        <div class="item-name">${esc(e.product)}</div>
        <div class="item-sub">${esc(e.type)} · ${esc(e.source||'—')} · ${fmtDate(e.date)}</div>
      </div>
      <div class="item-right">
        <div class="item-amount red">${fmt(e.netAmount)}</div>
        <div style="font-size:11px;color:var(--text3);">qty ${e.qty||1}</div>
      </div>
    </div>
  `).join('');
}
function viewExpenseDetail(id) {
  const e = _expenses.find(x=>x.id===id);
  if (!e) return;
  document.getElementById('detail-title').textContent = e.product;
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-row"><span class="detail-key">Category</span><span class="detail-val">${esc(e.type)}</span></div>
    <div class="detail-row"><span class="detail-key">Source</span><span class="detail-val">${esc(e.source||'—')}</span></div>
    <div class="detail-row"><span class="detail-key">Date</span><span class="detail-val">${fmtDate(e.date)}</span></div>
    <div class="detail-row"><span class="detail-key">Unit price</span><span class="detail-val mono">${fmt(e.price)}</span></div>
    <div class="detail-row"><span class="detail-key">Qty</span><span class="detail-val">${e.qty||1}</span></div>
    <div class="detail-row"><span class="detail-key">Discount</span><span class="detail-val mono">${fmt(e.discount)}</span></div>
    <div class="detail-row"><span class="detail-key">Gross amount</span><span class="detail-val mono">${fmt(e.grossAmount)}</span></div>
    <div class="detail-row"><span class="detail-key">Tax (${((+e.taxRate||0)*100).toFixed(2)}%)</span><span class="detail-val mono">${fmt(e.taxAmount)}</span></div>
    <div class="detail-row"><span class="detail-key">Net amount</span><span class="detail-val mono" style="color:var(--red);font-size:16px;">${fmt(e.netAmount)}</span></div>
    <div style="margin-top:20px;" class="btn-row">
      ${canWrite() ? `<button class="btn btn-secondary" onclick="editExpense('${id}')">Edit</button>` : ''}
      ${canDelete() ? `<button class="btn btn-danger" onclick="deleteExpense('${id}')">Delete</button>` : ''}
    </div>
  `;
  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-sheet').style.transform = 'translate(-50%, 0)';
}
function editExpense(id) {
  const e = _expenses.find(x=>x.id===id);
  if (!e) return;
  closeSheet('detail-sheet');
  document.getElementById('expense-sheet-title').textContent = 'Edit Expense';
  document.getElementById('expense-edit-id').value = id;
  document.getElementById('expense-type').value = e.type;
  document.getElementById('expense-product').value = e.product;
  document.getElementById('expense-source').value = e.source||'';
  document.getElementById('expense-date').value = e.date||'';
  document.getElementById('expense-qty').value = e.qty||1;
  document.getElementById('expense-price').value = e.price;
  document.getElementById('expense-discount').value = e.discount||0;
  document.getElementById('expense-tax').value = ((+e.taxRate||0)*100).toFixed(2);
  calcExpenseCost();
  document.getElementById('expense-btn-row').innerHTML = `
    <button class="btn btn-danger" onclick="deleteExpense('${id}')">Delete</button>
    <button class="btn btn-primary" onclick="saveExpense()">Update</button>
  `;
  document.getElementById('expense-overlay').classList.add('open');
  document.getElementById('expense-sheet').style.transform = 'translate(-50%, 0)';
}
async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  try { await DB.deleteExpense(id); await loadAll(); closeSheet('detail-sheet'); closeSheet('expense-sheet'); renderExpenses(); toast('Expense deleted'); } catch(e) { toast(e.message); }
}

// ─── SKU CATALOG ───────────────────────────────────────────
let skuFilter = 'all';
function setSkuFilter(el) {
  document.querySelectorAll('#sku-tabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  skuFilter = el.dataset.filter;
  renderSKUs();
}
function renderSKUs() {
  const q = (document.getElementById('sku-search').value||'').toLowerCase();
  let skus = _skus.filter(s => {
    const match = !q || (s.product+s.brand+s.type).toLowerCase().includes(q);
    const filter = skuFilter === 'all' || s.type === skuFilter;
    return match && filter;
  });
  const countEl = document.getElementById('sku-count');
  if (countEl) countEl.textContent = `${skus.length} ${skus.length === 1 ? 'item' : 'items'}`;
  const el = document.getElementById('sku-list');
  if (skus.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">${ICON_CAMERA_BIG}</div><div class="empty-text">No SKUs yet</div><div class="empty-sub">Tap + to add your first product</div></div>`;
    return;
  }
  el.innerHTML = skus.map(s => `
    <div class="list-item" onclick="editSKU('${s.id}')">
      <div class="item-icon ${typeClass(s.type)}">${typeIcon(s.type)}</div>
      <div class="item-body">
        <div class="item-name">${esc(s.product)}</div>
        <div class="item-sub">${esc(s.brand)} · ${esc(s.sensor||'')} ${s.mp?esc(s.mp)+'MP':''}</div>
      </div>
      <div class="item-right">
        <div class="item-badge ${s.type==='Camera'?'badge-camera':s.type==='Lens'?'badge-lens':'badge-acc'}">${esc(s.type)}</div>
      </div>
    </div>
  `).join('');
}
function clearSkuForm() {
  ['sku-brand','sku-product','sku-mp','sku-fps','sku-video','sku-lens-type','sku-aperture'].forEach(id=>{
    document.getElementById(id).value='';
  });
  document.getElementById('sku-type').value='Camera';
  document.getElementById('sku-sensor').value='';
  setSkuDetailsOpen(false);
}
function setSkuDetailsOpen(open) {
  document.getElementById('sku-extra-details').style.display = open ? 'block' : 'none';
  document.getElementById('sku-details-toggle').textContent = open ? '− Hide Details' : '+ Add Details';
}
function toggleSkuDetails() {
  const isOpen = document.getElementById('sku-extra-details').style.display !== 'none';
  setSkuDetailsOpen(!isOpen);
}
async function saveSKU() {
  const product = document.getElementById('sku-product').value.trim();
  const brand = document.getElementById('sku-brand').value.trim();
  if (!product || !brand) { toast('Please fill in brand and product name'); return; }
  const editId = document.getElementById('sku-edit-id').value;
  const sku = {
    id: editId || nextSkuId(),
    brand, type: document.getElementById('sku-type').value,
    product,
    sensor: document.getElementById('sku-sensor').value,
    mp: document.getElementById('sku-mp').value,
    fps: document.getElementById('sku-fps').value,
    video: document.getElementById('sku-video').value,
    lensType: document.getElementById('sku-lens-type').value,
    aperture: document.getElementById('sku-aperture').value,
  };
  try {
    await DB.saveSku(sku);
    await DB.saveProductDetails(sku);
    await loadAll();
    closeSheet('sku-sheet');
    renderSKUs();
    toast(editId ? 'SKU updated' : 'SKU added');
  } catch(e) { toast('Save failed: ' + e.message); }
}
function editSKU(id) {
  const sku = _skus.find(s=>s.id===id);
  if (!sku) return;
  document.getElementById('sku-sheet-title').textContent = 'Edit SKU';
  document.getElementById('sku-edit-id').value = id;
  document.getElementById('sku-brand').value = sku.brand||'';
  document.getElementById('sku-type').value = sku.type||'Camera';
  document.getElementById('sku-product').value = sku.product||'';
  document.getElementById('sku-sensor').value = sku.sensor||'';
  document.getElementById('sku-mp').value = sku.mp||'';
  document.getElementById('sku-fps').value = sku.fps||'';
  document.getElementById('sku-video').value = sku.video||'';
  document.getElementById('sku-lens-type').value = sku.lensType||'';
  document.getElementById('sku-aperture').value = sku.aperture||'';
  const hasDetails = sku.sensor || sku.mp || sku.fps || sku.video || sku.lensType || sku.aperture;
  setSkuDetailsOpen(!!hasDetails);
  document.getElementById('sku-btn-row').innerHTML = `
    <button class="btn btn-danger" onclick="deleteSKU('${id}')">Delete</button>
    <button class="btn btn-primary" onclick="saveSKU()">Update</button>
  `;
  document.getElementById('sku-overlay').classList.add('open');
  document.getElementById('sku-sheet').style.transform = 'translate(-50%, 0)';
}
async function deleteSKU(id) {
  if (!confirm('Delete this SKU?')) return;
  try { await DB.deleteSku(id); await loadAll(); closeSheet('sku-sheet'); renderSKUs(); toast('SKU deleted'); } catch(e) { toast(e.message); }
}

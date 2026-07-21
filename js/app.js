// ─── SUPABASE CONFIG ──────────────────────────────────────
const SUPABASE_URL = 'https://euulsabzjzrdrhmgzxfu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1dWxzYWJ6anpyZHJobWd6eGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNTQzNzUsImV4cCI6MjA5MjgzMDM3NX0.MC7buyUzIJxTBGXfskAuypRIORnQ3GBvlPWtFq-B7k4';

// ─── DB LAYER (Supabase) ──────────────────────────────────
const DB = {
  async _get(table, order) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    if (order) url += `&order=${order}`;
    const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async _upsert(table, row, returning) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': `resolution=merge-duplicates,return=${returning ? 'representation' : 'minimal'}` },
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error(await res.text());
    return returning ? (await res.json())[0] : undefined;
  },
  async _delete(table, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
    });
    if (!res.ok) throw new Error(await res.text());
  },
  async getSkus()          { return this._get('skus', 'id.asc'); },
  async getProductDetails(){ return this._get('product_details', 'id.asc'); },
  async getPurchases() { return this._get('purchases', 'date.desc'); },
  async getSales()     { return this._get('sales', 'date.desc'); },
  async getExpenses()  { return this._get('expenses', 'date.desc'); },
  async saveSku(row)      { return this._upsert('skus', { id: row.id, brand: row.brand, type: row.type, product: row.product }); },
  async saveProductDetails(row) { return this._upsert('product_details', { id: row.id, sensor: row.sensor, mp: row.mp, fps: row.fps, video: row.video, lensType: row.lensType, aperture: row.aperture }); },
  async savePurchase(row) { return this._upsert('purchases', row, true); },
  async saveSale(row)     { return this._upsert('sales', row, true); },
  async saveExpense(row)  { return this._upsert('expenses', row); },
  async deleteSku(id)      { return this._delete('skus', id); },
  async deletePurchase(id) { return this._delete('purchases', id); },
  async deleteSale(id)     { return this._delete('sales', id); },
  async deleteExpense(id)  { return this._delete('expenses', id); },
};

// ─── LOCAL CACHE (populated on each page load) ─────────────
let _skus = [], _purchases = [], _sales = [], _expenses = [];

let _dataLoaded = false;
async function loadAll(silent) {
  if (!silent) { showLoader(true); setDbStatus('loading'); }
  try {
    await ensureValidToken();
    const [rawSkus, details, purchases, sales, expenses] = await Promise.all([
      DB.getSkus(), DB.getProductDetails(), DB.getPurchases(), DB.getSales(), DB.getExpenses()
    ]);
    _skus = rawSkus.map(s => ({ ...s, ...(details.find(d => d.id === s.id) || {}) }));
    [_purchases, _sales, _expenses] = [purchases, sales, expenses];
    _dataLoaded = true;
    try { localStorage.setItem('tn_cache', JSON.stringify({ skus:_skus, purchases:_purchases, sales:_sales, expenses:_expenses, at: Date.now() })); } catch {}
    setDbStatus('ok');
  } catch(e) {
    // Offline / unreachable — hydrate from last good cache so the app still works read-only
    if (!_dataLoaded) {
      try {
        const c = JSON.parse(localStorage.getItem('tn_cache') || 'null');
        if (c && c.skus) { _skus=c.skus; _purchases=c.purchases; _sales=c.sales; _expenses=c.expenses; _dataLoaded=true; }
      } catch {}
    }
    if (!silent) toast(_dataLoaded ? 'Offline — showing last synced data' : 'Could not connect to database');
    setDbStatus('error');
    console.error(e);
  }
  if (!silent) showLoader(false);
}

function setDbStatus(state) {
  const dot = document.getElementById('db-dot');
  const label = document.getElementById('db-label');
  if (!dot || !label) return;
  if (state === 'ok') {
    dot.style.background = 'var(--green)';
    dot.style.boxShadow = '0 0 6px var(--green)';
    label.style.color = 'var(--green)';
    label.textContent = 'Supabase';
  } else if (state === 'loading') {
    dot.style.background = 'var(--amber)';
    dot.style.boxShadow = '0 0 6px var(--amber)';
    label.style.color = 'var(--amber)';
    label.textContent = 'Fetching from Supabase…';
  } else {
    dot.style.background = 'var(--red)';
    dot.style.boxShadow = 'none';
    label.style.color = 'var(--red)';
    label.textContent = 'Supabase unreachable';
  }
}

function showLoader(on) {
  let el = document.getElementById('global-loader');
  if (el) el.style.display = on ? 'flex' : 'none';
}


function _skuFor(purchaseId) {
  const p = _purchases.find(p => p.id === purchaseId) || {};
  const s = _skus.find(s => normalizeSkuId(s.id) === normalizeSkuId(p.skuId)) || {};
  return { p, s };
}
function _today() { return new Date().toISOString().slice(0,10); }



// ─── NAVIGATION ───────────────────────────────────────────
let currentPage = 'dashboard';
function renderCurrentPage() {
  const page = currentPage;
  if (page === 'dashboard') renderDashboard();
  else if (page === 'sku') renderSKUs();
  else if (page === 'purchases') renderPurchases();
  else if (page === 'sales') renderSales();
  else if (page === 'expenses') renderExpenses();
  else if (page === 'linked') renderLinked();
  else if (page === 'summary') renderSummary();
  requestAnimationFrame(syncNavHeight);
}

// Desktop sidebar nav height follows the current page's content height,
// so it ends around the same point as the page rather than stretching
// full viewport height or shrinking to just its own menu items.
function syncNavHeight() {
  const nav = document.querySelector('.nav');
  const page = document.querySelector('.page.active');
  if (!nav || !page) return;
  if (window.innerWidth < 760) { nav.style.height = ''; return; }
  const navTop = nav.getBoundingClientRect().top;
  // Measure the last content element, not .page's own box -- .page carries
  // 40px of trailing bottom padding that would otherwise get included.
  const lastChild = page.lastElementChild;
  const pageBottom = (lastChild || page).getBoundingClientRect().bottom;
  const maxAvailable = window.innerHeight - 24 - navTop;
  const target = Math.max(200, Math.min(pageBottom - navTop, maxAvailable));
  nav.style.height = target + 'px';
}
window.addEventListener('resize', () => requestAnimationFrame(syncNavHeight));
async function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const navBtn = document.getElementById('nav-' + page);
  if (navBtn) navBtn.classList.add('active');
  currentPage = page;
  window.scrollTo(0, 0);
  if (_dataLoaded) {
    // Instant render from cache, then silently refresh in the background
    renderCurrentPage();
    loadAll(true).then(renderCurrentPage);
  } else {
    await loadAll();
    renderCurrentPage();
  }
}

// ─── SHEETS ───────────────────────────────────────────────
function openSheet(id) {
  const name = id.replace('-sheet','');
  document.getElementById(name+'-overlay').classList.add('open');
  document.getElementById(id).style.transform = 'translate(-50%, 0)';
  if (id === 'purchase-sheet') populatePurchaseSKUSelect();
  if (id === 'sale-sheet') populateSalePurchaseSelect();
  if (id === 'sku-sheet') {
    document.getElementById('sku-sheet-title').textContent = 'New SKU';
    document.getElementById('sku-edit-id').value = '';
    clearSkuForm();
    document.getElementById('sku-btn-row').innerHTML = '<button class="btn btn-primary" onclick="saveSKU()">Save SKU</button>';
  }
  if (id === 'purchase-sheet') {
    document.getElementById('purchase-sheet-title').textContent = 'Log Purchase';
    document.getElementById('purchase-edit-id').value = '';
    document.getElementById('purchase-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('purchase-listed-date').value = '';
    document.getElementById('purchase-btn-row').innerHTML = '<button class="btn btn-primary" onclick="savePurchase()">Log Purchase</button>';
    setAcqType('cash');
    // Reset to a clean form so nothing (esp. a leftover qty) carries into the next entry
    document.getElementById('purchase-sku').value = '';
    document.getElementById('purchase-sku-search').value = '';
    document.getElementById('purchase-price').value = '';
    document.getElementById('purchase-qty').value = '1';
    document.getElementById('purchase-shipping').value = '0';
    document.getElementById('purchase-gas').value = '0';
    document.getElementById('purchase-state').value = '';
    document.getElementById('purchase-comments').value = '';
    document.getElementById('purchase-condition').value = '';
    calcPurchaseCost();
  }
  if (id === 'sale-sheet') {
    document.getElementById('sale-sheet-title').textContent = 'Log Sale';
    document.getElementById('sale-edit-id').value = '';
    document.getElementById('sale-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('sale-btn-row').innerHTML = '<button class="btn btn-primary" onclick="saveSale()">Log Sale</button>';
    document.getElementById('sale-label-hint').textContent = '';
    document.getElementById('sale-use-shippo').checked = false;
    document.getElementById('sale-get-rates-btn').style.display = 'none';
    document.getElementById('sale-carrier').value = '';
    document.getElementById('sale-tracking').value = '';
    document.getElementById('sale-tracking-url').value = '';
    document.getElementById('sale-label-url').value = '';
    _pendingShipLabel = null;
    _saleIsTrade = false;
    setSaleAcqType('cash');
    calcSaleProfit();
  }
}
function closeSheet(id) {
  const name = id.replace('-sheet','');
  document.getElementById(name+'-overlay').classList.remove('open');
  document.getElementById(id).style.transform = 'translate(-50%, 100%)';
}

// ─── ACCESSIBILITY: sheet inert/focus + tab semantics ───────
// A few call sites move a sheet on/off screen by setting .style.transform
// directly instead of going through openSheet()/closeSheet(). A
// MutationObserver on that one attribute covers every current and future
// call site without having to track each one down individually.
let _sheetFocusReturnEl = null;
function _sheetIsOpen(el) { return /translate\(-50%,\s*0(px)?\)/.test(el.style.transform); }
function _onSheetTransformChange(el) {
  const isOpen = _sheetIsOpen(el);
  if (isOpen && el.hasAttribute('inert')) {
    el.removeAttribute('inert');
    _sheetFocusReturnEl = document.activeElement;
    const focusable = el.querySelector('input, select, textarea, button, [tabindex]');
    (focusable || el).focus();
  } else if (!isOpen && !el.hasAttribute('inert')) {
    el.setAttribute('inert', '');
    const prev = _sheetFocusReturnEl;
    _sheetFocusReturnEl = null;
    if (prev && document.body.contains(prev)) prev.focus();
  }
}
document.querySelectorAll('.sheet').forEach(el => {
  el.setAttribute('tabindex', '-1');
  el.setAttribute('inert', '');
});
new MutationObserver(muts => {
  for (const m of muts) _onSheetTransformChange(m.target);
}).observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });
document.addEventListener('keydown', e => {
  const open = document.querySelector('.sheet:not([inert])');
  if (!open) return;
  if (e.key === 'Escape') { closeSheet(open.id); return; }
  if (e.key !== 'Tab') return;
  // Basic focus trap — keep Tab/Shift+Tab cycling within the open sheet.
  const focusable = [...open.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// Filter tabs are plain divs with onclick handlers rebuilt via innerHTML
// all over the app; rather than touch every render call site, decorate
// whatever's currently in the DOM and re-decorate on any relevant change.
function decorateTabs() {
  document.querySelectorAll('.tabs').forEach(list => {
    list.setAttribute('role', 'tablist');
    [...list.children].forEach(tab => {
      if (!tab.classList.contains('tab')) return;
      tab.setAttribute('role', 'tab');
      const active = tab.classList.contains('active');
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.setAttribute('tabindex', active ? '0' : '-1');
    });
  });
}
new MutationObserver(() => decorateTabs())
  .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
decorateTabs();
document.addEventListener('keydown', e => {
  const tab = e.target.closest('[role="tab"]');
  if (!tab) return;
  const list = tab.closest('[role="tablist"]');
  if (!list) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const i = tabs.indexOf(tab);
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : tabs[(i - 1 + tabs.length) % tabs.length];
    next.focus(); next.click();
  } else if (e.key === 'Home') {
    e.preventDefault(); tabs[0].focus(); tabs[0].click();
  } else if (e.key === 'End') {
    e.preventDefault(); tabs[tabs.length - 1].focus(); tabs[tabs.length - 1].click();
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); tab.click();
  }
});

// ─── TOAST ─────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show';
  setTimeout(() => t.className = 'toast', 2100);
}







// ─── AUTH ──────────────────────────────────────────────────
let _authToken = null;
let _userRole = 'user'; // 'dba' | 'admin' | 'user' | 'viewer'
let _userEmail = '';

function parseRole(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    // Prefer app_metadata (admin-only, tamper-proof); fall back to user_metadata
    // during the migration window.
    return (p.app_metadata && p.app_metadata.role)
        || (p.user_metadata && p.user_metadata.role)
        || 'user';
  } catch { return 'user'; }
}

function parseEmail(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    return p.email || '';
  } catch { return ''; }
}

function canWrite() { return _userRole === 'dba' || _userRole === 'admin'; }
function canDelete() { return _userRole === 'dba'; }
function isViewer() { return _userRole === 'viewer'; }
function hideFin(val) { return isViewer() ? '<span style="color:var(--text3);letter-spacing:3px;font-size:13px;">••••</span>' : val; }

function applyRoleUI() {
  // Show/hide all add buttons
  document.querySelectorAll('.header-action').forEach(btn => {
    btn.style.display = canWrite() ? 'flex' : 'none';
  });
  // The Log button and its menu items (Catalog/Purchase/Sale/Expense)
  document.querySelectorAll('[data-write-action]').forEach(btn => {
    btn.style.display = canWrite() ? '' : 'none';
  });
  // Data export is owner-only
  const exp = document.getElementById('dash-export');
  if (exp) exp.style.display = canWrite() ? 'block' : 'none';
  // Role badge in sign-out area
  const badge = document.getElementById('role-badge');
  if (badge) {
    const colors = { dba:'var(--red)', admin:'var(--amber)', user:'var(--blue)', viewer:'var(--text2)' };
    badge.textContent = _userRole.toUpperCase();
    badge.style.color = colors[_userRole] || 'var(--text2)';
    badge.style.borderColor = colors[_userRole] || 'var(--border)';
  }
  // Username inside the account menu
  const userEmailEl = document.getElementById('user-email');
  if (userEmailEl) {
    userEmailEl.textContent = _userEmail || '';
    userEmailEl.title = _userEmail || '';
  }
  // Avatar initial
  const avatarBtn = document.getElementById('user-avatar-btn');
  if (avatarBtn) avatarBtn.textContent = _userEmail ? _userEmail.charAt(0).toUpperCase() : '?';
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  closeLogMenu();
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  if (menu.style.display === 'none') closeExportSubmenu();
}
function toggleLogMenu() {
  const menu = document.getElementById('log-menu');
  if (!menu) return;
  const userMenu = document.getElementById('user-menu');
  if (userMenu) userMenu.style.display = 'none';
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
function closeLogMenu() {
  const menu = document.getElementById('log-menu');
  if (menu) menu.style.display = 'none';
}
function toggleExportSubmenu() {
  const sub = document.getElementById('export-submenu');
  const chevron = document.getElementById('export-chevron');
  if (!sub) return;
  const opening = sub.style.display === 'none';
  sub.style.display = opening ? 'block' : 'none';
  if (chevron) chevron.style.transform = opening ? 'rotate(90deg)' : 'none';
}
function closeExportSubmenu() {
  const sub = document.getElementById('export-submenu');
  const chevron = document.getElementById('export-chevron');
  if (sub) sub.style.display = 'none';
  if (chevron) chevron.style.transform = 'none';
}
document.addEventListener('click', e => {
  const menu = document.getElementById('user-menu');
  const btn = document.getElementById('user-avatar-btn');
  if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = 'none';
    closeExportSubmenu();
  }
  const logMenu = document.getElementById('log-menu');
  const logBtn = document.getElementById('log-btn');
  if (logMenu && logMenu.style.display !== 'none' && !logMenu.contains(e.target) && !logBtn.contains(e.target)) {
    logMenu.style.display = 'none';
  }
});

// Persist access + refresh tokens and the expiry timestamp
function saveSession(data) {
  _authToken = data.access_token;
  const expiresAt = Date.now() + ((+data.expires_in || 3600) * 1000);
  localStorage.setItem('tn_auth_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('tn_refresh_token', data.refresh_token);
  localStorage.setItem('tn_expires_at', String(expiresAt));
}

function clearSession() {
  localStorage.removeItem('tn_auth_token');
  localStorage.removeItem('tn_refresh_token');
  localStorage.removeItem('tn_expires_at');
  _authToken = null;
}

// Exchange the refresh token for a fresh access token
let _refreshInFlight = null;
async function refreshAccessToken() {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    const rt = localStorage.getItem('tn_refresh_token');
    if (!rt) return false;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      });
      if (!res.ok) return false;
      const data = await res.json();
      saveSession(data);
      _userRole = parseRole(_authToken);
      _userEmail = parseEmail(_authToken);
      return true;
    } catch { return false; }
  })();
  try { return await _refreshInFlight; } finally { _refreshInFlight = null; }
}

// Refresh proactively when the token is within 60s of expiring.
// If no expiry is recorded (legacy session), rely on the 401-retry in _authedFetch.
async function ensureValidToken() {
  if (!_authToken) return false;
  const exp = +localStorage.getItem('tn_expires_at') || 0;
  if (exp && Date.now() > exp - 60000) return await refreshAccessToken();
  return true;
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  if (!email || !password) { showLoginError('Please enter email and password.'); return; }
  btn.textContent = 'Signing in…'; btn.disabled = true; errEl.style.display = 'none';
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
    saveSession(data);
    _userRole = parseRole(_authToken);
    _userEmail = email;
    showApp();
  } catch(e) {
    showLoginError(e.message);
    btn.textContent = 'Sign In'; btn.disabled = false;
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = 'block';
}

async function checkSession() {
  const stored = localStorage.getItem('tn_auth_token');
  if (!stored) return false;
  _authToken = stored;
  _userRole = parseRole(stored);
  _userEmail = parseEmail(stored);
  // If we have a recorded expiry and it has passed, refresh before trusting it
  const exp = +localStorage.getItem('tn_expires_at') || 0;
  if (exp && Date.now() > exp - 60000) {
    return await refreshAccessToken();
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${stored}` }
  });
  if (res.ok) return true;
  // Access token rejected — last-ditch refresh
  return await refreshAccessToken();
}

function signOut() {
  clearSession();
  try { localStorage.removeItem('tn_cache'); } catch {}
  _userRole = 'user';
  _skus = []; _purchases = []; _sales = []; _expenses = [];
  _dataLoaded = false;
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-password').value = '';
  document.getElementById('login-email').value = '';
}

// ─── THEME (light/dark) ─────────────────────────────────────
function currentTheme() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit) return explicit;
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}
function updateThemeToggleIcon(mode) {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.innerHTML = mode === 'dark' ? ICON_SUN : ICON_MOON;
}
function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  try { localStorage.setItem('tn_theme', mode); } catch {}
  updateThemeToggleIcon(mode);
  const meta = document.getElementById('theme-color-meta');
  // meta[name=theme-color] requires a literal — must match --bg in :root/dark tokens above
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#1b1f18' : '#ede6d6');
  // Chart colors are read from CSS vars at draw time, so redraw on theme change
  if (typeof renderDashboardChart === 'function') renderDashboardChart();
}
function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
function initTheme() {
  updateThemeToggleIcon(currentTheme());
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!document.documentElement.getAttribute('data-theme')) updateThemeToggleIcon(currentTheme());
    });
  }
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  applyRoleUI();
  initTheme();
  showQuoteFab();
  init();
}

// Override DB to use the auth token, with proactive refresh + one 401 retry
async function _authedFetch(url, opts = {}) {
  await ensureValidToken();
  const withAuth = () => ({
    ...opts,
    headers: { ...(opts.headers||{}), apikey: ANON_KEY, Authorization: `Bearer ${_authToken}` }
  });
  let r = await fetch(url, withAuth());
  if (r.status === 401 && await refreshAccessToken()) {
    r = await fetch(url, withAuth());
  }
  return r;
}
DB._get = async function(table, order) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  if (order) url += `&order=${order}`;
  const r = await _authedFetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};
DB._upsert = async function(table, row, returning) {
  const r = await _authedFetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Prefer': `resolution=merge-duplicates,return=${returning ? 'representation' : 'minimal'}` },
    body: JSON.stringify(row)
  });
  if (!r.ok) throw new Error(await r.text());
  return returning ? (await r.json())[0] : undefined;
};
DB._delete = async function(table, id) {
  const r = await _authedFetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
};

// ─── PULL TO REFRESH ──────────────────────────────────────
(function setupPullToRefresh(){
  const ind = document.createElement('div');
  ind.id = 'ptr-indicator';
  ind.innerHTML = '<div class="ptr-spinner"></div>';
  ind.style.cssText = 'position:fixed;top:0;left:50%;width:36px;height:36px;border-radius:50%;background:var(--bg3);border:0.5px solid var(--border2);display:flex;align-items:center;justify-content:center;z-index:350;transition:transform 0.15s,opacity 0.15s;opacity:0;pointer-events:none;transform:translateX(-50%) translateY(-48px);';
  const spin = ind.querySelector('.ptr-spinner');
  spin.style.cssText = 'width:18px;height:18px;border:2px solid var(--bg4);border-top-color:var(--amber);border-radius:50%;';
  document.body.appendChild(ind);

  let startY = 0, pulling = false, dist = 0, refreshing = false;
  const THRESHOLD = 70;
  window.addEventListener('touchstart', e => {
    if (refreshing || window.scrollY > 0) { pulling = false; return; }
    startY = e.touches[0].clientY; pulling = true; dist = 0;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (!pulling) return;
    dist = e.touches[0].clientY - startY;
    if (dist > 0 && window.scrollY <= 0) {
      const pull = Math.min(dist, 120);
      ind.style.opacity = String(Math.min(pull / THRESHOLD, 1));
      ind.style.transform = `translateX(-50%) translateY(${Math.min(pull - 48, 12)}px) rotate(${pull*3}deg)`;
    }
  }, { passive: true });
  window.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;
    if (dist > THRESHOLD && !refreshing) {
      refreshing = true;
      ind.style.opacity = '1';
      ind.style.transform = 'translateX(-50%) translateY(12px)';
      spin.style.animation = 'spin 0.7s linear infinite';
      await loadAll(true);
      renderCurrentPage();
      spin.style.animation = '';
      refreshing = false;
    }
    ind.style.opacity = '0';
    ind.style.transform = 'translateX(-50%) translateY(-48px)';
  }, { passive: true });
})();

// ─── SERVICE WORKER (offline shell) ───────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e));
  }
}

// ─── INIT ─────────────────────────────────────────────────
async function init() {
  registerServiceWorker();
  await loadAll();
  renderDashboard();
  requestAnimationFrame(syncNavHeight);
}

(async () => {
  const valid = await checkSession();
  if (valid) showApp();
  // else login screen is already visible
})();

// ─── QUOTE TOOL ────────────────────────────────────────────
const QT_URL = 'http://100.66.178.62:8766';

function openQuoteTool() {
  window.open(QT_URL, '_blank');
}


function showQuoteFab() {
  const fab = document.getElementById('quote-fab');
  if (fab) fab.style.display = 'flex';
}


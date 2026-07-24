// ─── MANAGE USERS (manage-users Edge Function) ──────────────
const USERS_FN_URL = `${SUPABASE_URL}/functions/v1/manage-users`;
const ROLE_LABEL = { dba: 'DBA (full access)', admin: 'Admin', user: 'User (read-only)', viewer: 'Viewer (read-only, masked)' };
let _usersCache = [];

async function _usersCall(payload) {
  await ensureValidToken();
  const res = await fetch(USERS_FN_URL, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${_authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `Request failed (${res.status})`);
  return data;
}

function canManageUsers() { return _userRole === 'dba'; }

async function openUsersSheet() {
  openSheet('users-sheet');
  const body = document.getElementById('users-body');
  body.innerHTML = '<div class="loading-state" style="padding:36px;text-align:center;color:var(--text2);">Loading users…</div>';
  try {
    const { users } = await _usersCall({ action: 'list' });
    _usersCache = users;
    renderUsersList();
  } catch (e) {
    body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--red);font-size:13px;">${esc(e.message)}</div>`;
  }
}

function renderUsersList() {
  const body = document.getElementById('users-body');
  if (!_usersCache.length) {
    body.innerHTML = '<div class="empty"><div class="empty-text">No users found</div></div>';
    return;
  }
  body.innerHTML = _usersCache.map(u => `
    <div class="list-item" style="align-items:flex-start;">
      <div class="item-body">
        <div class="item-name">${esc(u.email || '(no email)')}</div>
        <div class="item-sub">${u.last_sign_in_at ? 'Last signed in ' + fmtDate(u.last_sign_in_at.slice(0,10)) : 'Never signed in'}</div>
      </div>
      <select class="form-select" style="width:auto;flex-shrink:0;" data-user-id="${esc(u.id)}" onchange="setUserRole('${esc(u.id)}', this)">
        ${Object.keys(ROLE_LABEL).map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

async function setUserRole(userId, selectEl) {
  const newRole = selectEl.value;
  const prevRole = _usersCache.find(u => u.id === userId)?.role;
  selectEl.disabled = true;
  try {
    await _usersCall({ action: 'setRole', user_id: userId, role: newRole });
    const u = _usersCache.find(x => x.id === userId);
    if (u) u.role = newRole;
    toast('Role updated — they need to sign out and back in for it to take effect');
  } catch (e) {
    selectEl.value = prevRole;
    toast('Failed to update role: ' + e.message);
  } finally {
    selectEl.disabled = false;
  }
}

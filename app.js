// ============================================================
// Zanos City — Rental Management App
// ============================================================

const SUPABASE_URL = 'https://fwkchszqkosjyesmsvlj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kjWHvwntT1U__wY_5K0F1w_cd_YhBT9';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Enum values live in the DB in English; the labels come from the active language.
const categoryLabel = (v) => t('cat.' + v);
const statusLabel = (v) => t('st.' + v);
const priorityLabel = (v) => t('pri.' + v);

let currentUser = null;
let currentMembership = null; // { property_id, role, ... }
let currentProperty = null;
let currentTenancy = null; // active tenancy (owner: latest active; tenant: their own)
let editingTenancyId = null;

// ---------- View management ----------
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.hidden = (v.id !== id));
}

function setMsg(el, text, kind) {
  el.textContent = text;
  el.className = 'msg' + (kind ? ' ' + kind : '');
  el.hidden = !text;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(dateLocale());
}
function fmtMoney(n) {
  return '€' + Number(n).toFixed(2);
}
function fmtDateTime(d) {
  return new Date(d).toLocaleString(dateLocale());
}
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

// In every thread there are exactly two sides: the signed-in user and whoever
// holds the other role on the property.
function otherPartyLabel() {
  return currentMembership && currentMembership.role === 'owner'
    ? t('party.tenant')
    : t('party.owner');
}

// ---------- Tabs ----------
function initTabs(scopeSelector) {
  const scope = document.querySelector(scopeSelector);
  scope.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      scope.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      scope.querySelectorAll('.tab-panel').forEach(p => {
        p.hidden = p.getAttribute('data-panel') !== tab;
      });
    });
  });
}

// ---------- Auth ----------
const GUEST_CODE_KEY = 'zanos_guest_code';
const DEVICE_ROLE_KEY = 'zanos_device_role';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

let loggingError = false;

// Failures never reach a database trigger, so they are reported explicitly.
// Guarded against recursion: a failure to log must not log a failure.
async function logError(context, error, details) {
  if (loggingError || !currentUser) return;
  loggingError = true;
  try {
    await sb.rpc('rental_log_client_error', {
      p_context: context,
      p_message: (error && (error.message || String(error))) || 'unknown',
      p_details: details || null
    });
  } catch (e) {
    /* nothing useful left to do */
  } finally {
    loggingError = false;
  }
}

window.addEventListener('error', (e) => logError('window.onerror', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => logError('unhandledrejection', e.reason));

// Every failed Supabase call goes through here so it lands in the audit log too.
function reportFailure(context, error, el, friendly) {
  logError(context, error);
  const text = friendly || t('error', { msg: error.message });
  if (el) setMsg(el, text, 'error'); else alert(text);
}

async function sendMagicLink(email) {
  return sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
}

// Supabase reports these as prose; map the two we expect onto our own wording.
function authErrorText(error) {
  const raw = (error.message || '').toLowerCase();
  if (raw.includes('invalid login credentials')) return t('login.badCredentials');
  if (raw.includes('rate limit')) return t('login.rateLimited');
  return t('error', { msg: error.message });
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('loginMsg');
  if (!password) { setMsg(msg, t('login.passwordRequired'), 'error'); return; }
  setMsg(msg, '', '');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { setMsg(msg, authErrorText(error), 'error'); return; }
  await boot();
});

document.getElementById('magicLinkBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const msg = document.getElementById('loginMsg');
  if (!email) { document.getElementById('loginEmail').reportValidity(); return; }
  setMsg(msg, t('login.sending'), '');
  const { error } = await sendMagicLink(email);
  if (error) setMsg(msg, authErrorText(error), 'error');
  else setMsg(msg, t('login.sent'), 'ok');
});

function rememberDeviceRole(role) {
  try { localStorage.setItem(DEVICE_ROLE_KEY, role); } catch (e) { /* private mode */ }
}

// A phone that has signed in as owner or tenant should not be offered the guest
// entry, and vice versa. Both stay reachable behind a link, since a device can
// legitimately change hands.
function applyDeviceRoleToLogin() {
  let role = null;
  try { role = localStorage.getItem(DEVICE_ROLE_KEY); } catch (e) { /* private mode */ }

  const guestHidden = role === 'account';
  const accountHidden = role === 'guest';

  document.getElementById('guestCard').hidden = guestHidden;
  document.getElementById('revealGuest').hidden = !guestHidden;
  document.getElementById('signinCard').hidden = accountHidden;
  document.getElementById('signupCard').hidden = true;
  document.getElementById('revealAccount').hidden = !accountHidden;
}

document.getElementById('revealGuest').addEventListener('click', () => {
  document.getElementById('guestCard').hidden = false;
  document.getElementById('revealGuest').hidden = true;
});
document.getElementById('revealAccount').addEventListener('click', () => {
  document.getElementById('signinCard').hidden = false;
  document.getElementById('revealAccount').hidden = true;
});

function showSignupCard(show) {
  document.getElementById('signinCard').hidden = show;
  document.getElementById('signupCard').hidden = !show;
  setMsg(document.getElementById('signupMsg'), '', '');
  setMsg(document.getElementById('loginMsg'), '', '');
}

document.getElementById('createAccountBtn').addEventListener('click', () => {
  // Carry over whatever they already typed, so it is not asked twice.
  document.getElementById('signupEmail').value = document.getElementById('loginEmail').value.trim();
  showSignupCard(true);
});
document.getElementById('backToSignIn').addEventListener('click', () => showSignupCard(false));

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  const msg = document.getElementById('signupMsg');

  if (password.length < 8) { setMsg(msg, t('login.passwordTooShort'), 'error'); return; }
  if (password !== confirm) { setMsg(msg, t('signup.mismatch'), 'error'); return; }

  setMsg(msg, t('login.creating'), '');
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) { setMsg(msg, authErrorText(error), 'error'); return; }

  // Supabase does not reveal existing addresses through an error; it returns a
  // user with no identities instead.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    setMsg(msg, t('login.accountExists'), 'error');
    return;
  }
  if (data.session) { await boot(); return; }
  e.target.reset();
  setMsg(msg, t('signup.checkEmail', { email }), 'ok');
});

// ---------- Setting a password ----------
document.getElementById('passwordToggle').addEventListener('click', () => {
  const panel = document.getElementById('passwordPanel');
  panel.hidden = !panel.hidden;
});

document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('passwordMsg');
  setMsg(msg, t('account.saving'), '');
  const { error } = await sb.auth.updateUser({ password: document.getElementById('newPassword').value });
  if (error) { setMsg(msg, t('error', { msg: error.message }), 'error'); return; }
  e.target.reset();
  setMsg(msg, t('account.saved'), 'ok');
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  window.location.reload();
});

// ---------- Onboarding ----------
document.getElementById('createPropertyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('propName').value.trim();
  const address = document.getElementById('propAddress').value.trim();
  const msg = document.getElementById('onboardingMsg');
  setMsg(msg, t('onb.creating'), '');
  const { data: prop, error } = await sb.from('rental_properties')
    .insert({ name, address, created_by: currentUser.id })
    .select().single();
  if (error) {
    // 42501 = blocked by the allowlist policy, not a real failure to report raw.
    setMsg(msg, error.code === '42501' ? t('onb.notAllowed') : t('error', { msg: error.message }), 'error');
    return;
  }
  const { error: memErr } = await sb.from('rental_property_members')
    .insert({ property_id: prop.id, user_id: currentUser.id, role: 'owner', display_name: currentUser.email });
  if (memErr) { setMsg(msg, t('error', { msg: memErr.message }), 'error'); return; }
  await boot();
});

document.getElementById('joinPropertyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('inviteCodeInput').value.trim();
  const msg = document.getElementById('onboardingMsg');
  setMsg(msg, t('onb.joining'), '');
  const { error } = await sb.rpc('rental_join_property', { p_invite_code: code });
  if (error) { setMsg(msg, t('onb.invalidCode'), 'error'); return; }
  await boot();
});

document.getElementById('guestCodeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('guestCodeInput').value.trim();
  const msg = document.getElementById('guestMsg');
  setMsg(msg, t('onb.guest.redeeming'), '');
  if (await showGuestView(code)) {
    try { localStorage.setItem(GUEST_CODE_KEY, code); } catch (e) { /* private mode */ }
    rememberDeviceRole('guest');
    setMsg(msg, '', '');
  } else {
    setMsg(msg, t('onb.guest.invalid'), 'error');
  }
});

document.getElementById('guestExitBtn').addEventListener('click', () => {
  localStorage.removeItem(GUEST_CODE_KEY);
  document.getElementById('guestCodeInput').value = '';
  boot();
});

// ============================================================
// OWNER DASHBOARD
// ============================================================

async function loadOwnerDashboard() {
  document.getElementById('ownerPropName').textContent = currentProperty.name;
  document.getElementById('ownerPropAddress').textContent = currentProperty.address || '';
  document.getElementById('inviteCodeDisplay').textContent = currentProperty.invite_code;

  await refreshTenancies();
  await refreshOwnerPayments();
  await refreshOwnerMaintenance();
  await refreshOwnerMessages();
  await refreshPropertyInfo();
  await refreshGuestInvites();
  await refreshAllowedTenants();
  await refreshPeople();
  await refreshDocuments('owner');
  await refreshAudit();
}

async function refreshTenancies() {
  const { data: tenancies } = await sb.from('rental_tenancies')
    .select('*').eq('property_id', currentProperty.id)
    .order('start_date', { ascending: false });

  const active = (tenancies || []).find(t => t.status === 'active');
  currentTenancy = active || null;

  const infoEl = document.getElementById('currentTenancyInfo');
  if (active) {
    infoEl.innerHTML = `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(active.tenant_name || t('tenancy.defaultTenant'))}</div>
          <div class="sub">${fmtDate(active.start_date)} → ${active.end_date ? fmtDate(active.end_date) : t('dash')} ·
            ${t('tenancy.rentLine', { amount: fmtMoney(active.monthly_rent) })}</div>
        </div>
        <button class="btn-small" data-edit-tenancy="${active.id}">${t('tenancy.edit')}</button>
        <button class="btn-small danger" data-end-tenancy="${active.id}">${t('tenancy.endBtn')}</button>
      </div>`;
    infoEl.querySelector('[data-edit-tenancy]').addEventListener('click', () => startTenancyEdit(active));
    infoEl.querySelector('[data-end-tenancy]').addEventListener('click', async (e) => {
      if (!confirm(t('tenancy.endConfirm'))) return;
      await sb.from('rental_tenancies').update({ status: 'ended' }).eq('id', e.target.getAttribute('data-end-tenancy'));
      await refreshTenancies();
    });
  } else {
    infoEl.innerHTML = `<span class="muted">${t('tenancy.none')}</span>`;
  }

  const histEl = document.getElementById('tenancyHistory');
  if (!tenancies || tenancies.length === 0) {
    histEl.innerHTML = `<span class="muted">${t('tenancy.historyEmpty')}</span>`;
  } else {
    histEl.innerHTML = tenancies.map(item => `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(item.tenant_name || t('tenancy.defaultTenant'))}</div>
          <div class="sub">${fmtDate(item.start_date)} → ${item.end_date ? fmtDate(item.end_date) : t('dash')} · ${t('tenancy.rentLine', { amount: fmtMoney(item.monthly_rent) })}</div>
        </div>
        <span class="pill ${item.status === 'active' ? 'paid' : 'pending'}">${item.status === 'active' ? t('tenancy.statusActive') : t('tenancy.statusEnded')}</span>
      </div>`).join('');
  }
}

function startTenancyEdit(tenancy) {
  editingTenancyId = tenancy.id;
  document.getElementById('tenantName').value = tenancy.tenant_name || '';
  document.getElementById('tenantEmail').value = tenancy.tenant_email || '';
  document.getElementById('leaseStart').value = tenancy.start_date || '';
  document.getElementById('leaseEnd').value = tenancy.end_date || '';
  document.getElementById('rentAmount').value = tenancy.monthly_rent ?? '';
  document.getElementById('commonYearly').value = tenancy.common_expenses_yearly ?? '';
  document.getElementById('internetMonthly').value = tenancy.internet_monthly ?? '';
  document.getElementById('tenancyEditNote').hidden = false;
  document.querySelector('#tenancyForm button[type=submit]').textContent = t('tenancy.update');
  document.getElementById('tenancyForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelTenancyEdit() {
  editingTenancyId = null;
  document.getElementById('tenancyForm').reset();
  document.getElementById('tenancyEditNote').hidden = true;
  document.querySelector('#tenancyForm button[type=submit]').textContent = t('tenancy.save');
}

document.getElementById('cancelTenancyEdit').addEventListener('click', cancelTenancyEdit);

document.getElementById('tenancyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    property_id: currentProperty.id,
    tenant_name: document.getElementById('tenantName').value.trim() || null,
    tenant_email: document.getElementById('tenantEmail').value.trim() || null,
    start_date: document.getElementById('leaseStart').value,
    end_date: document.getElementById('leaseEnd').value || null,
    monthly_rent: parseFloat(document.getElementById('rentAmount').value),
    common_expenses_yearly: parseFloat(document.getElementById('commonYearly').value) || null,
    internet_monthly: parseFloat(document.getElementById('internetMonthly').value) || null
  };

  const { error } = editingTenancyId
    ? await sb.from('rental_tenancies').update(payload).eq('id', editingTenancyId)
    : await sb.from('rental_tenancies').insert({ ...payload, created_by: currentUser.id });

  if (error) { reportFailure('tenancy.save', error); return; }
  cancelTenancyEdit();
  await refreshTenancies();
});

// ---------- Approved tenants and who has access ----------

async function refreshAllowedTenants() {
  const el = document.getElementById('allowedTenantList');
  const { data: rows, error } = await sb.from('rental_allowed_tenants')
    .select('*').eq('property_id', currentProperty.id).order('created_at');
  if (error) { reportFailure('allowedTenants.load', error); return; }

  el.innerHTML = (!rows || rows.length === 0)
    ? `<span class="muted">${t('allowed.empty')}</span>`
    : rows.map(r => `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(r.email)}</div>
          ${r.label ? `<div class="sub">${escapeHtml(r.label)}</div>` : ''}
        </div>
        <button class="btn-small danger" data-remove-allowed="${r.id}">${t('allowed.remove')}</button>
      </div>`).join('');

  el.querySelectorAll('[data-remove-allowed]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('allowed.removeConfirm'))) return;
      const { error: delErr } = await sb.from('rental_allowed_tenants')
        .delete().eq('id', btn.getAttribute('data-remove-allowed'));
      if (delErr) { reportFailure('allowedTenants.remove', delErr); return; }
      await refreshAllowedTenants();
    });
  });
}

document.getElementById('allowedTenantForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await sb.from('rental_allowed_tenants').insert({
    property_id: currentProperty.id,
    email: document.getElementById('allowedEmail').value.trim(),
    label: document.getElementById('allowedLabel').value.trim() || null,
    created_by: currentUser.id
  });
  if (error) { reportFailure('allowedTenants.add', error); return; }
  e.target.reset();
  await refreshAllowedTenants();
});

async function refreshPeople() {
  const el = document.getElementById('peopleList');
  const { data: people, error } = await sb.rpc('rental_property_people');
  if (error) { reportFailure('people.load', error); return; }

  el.innerHTML = (!people || people.length === 0)
    ? `<span class="muted">${t('people.empty')}</span>`
    : people.map(p => `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(p.email)}</div>
          <div class="sub">${fmtDate(p.joined_at)}</div>
        </div>
        <span class="pill ${p.role === 'owner' ? 'paid' : 'pending'}">${
          p.role === 'owner' ? t('party.owner') : t('party.tenant')}</span>
        ${p.role === 'owner' ? '' :
          `<button class="btn-small danger" data-remove-person="${p.user_id}">${t('people.remove')}</button>`}
      </div>`).join('');

  el.querySelectorAll('[data-remove-person]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('people.removeConfirm'))) return;
      const { error: delErr } = await sb.from('rental_property_members').delete()
        .eq('property_id', currentProperty.id)
        .eq('user_id', btn.getAttribute('data-remove-person'));
      if (delErr) { reportFailure('people.remove', delErr); return; }
      await refreshPeople();
    });
  });
}

async function refreshOwnerPayments() {
  const listEl = document.getElementById('ownerPaymentsList');
  if (!currentTenancy) {
    listEl.innerHTML = `<span class="muted">${t('need.tenancyFirst')}</span>`;
    return;
  }
  const { data: payments } = await sb.from('rental_payments')
    .select('*').eq('tenancy_id', currentTenancy.id)
    .order('due_date', { ascending: false, nullsFirst: false });

  if (!payments || payments.length === 0) {
    listEl.innerHTML = `<span class="muted">${t('pay.empty')}</span>`;
    return;
  }
  listEl.innerHTML = payments.map(p => `
    <div class="list-item">
      <div class="main">
        <div class="title">${categoryLabel(p.category)} — ${fmtMoney(p.amount)}</div>
        <div class="sub">${p.notes ? escapeHtml(p.notes) + ' · ' : ''}${t('pay.dueLabel')}: ${fmtDate(p.due_date)}${p.paid_on ? ' · ' + t('pay.paidLabel') + ': ' + fmtDate(p.paid_on) : ''}</div>
      </div>
      ${p.series_id ? `<span class="pill low">${t('pay.seriesBadge')}</span>` : ''}
      <span class="pill ${p.status}">${statusLabel(p.status)}</span>
      ${p.status !== 'paid' ? `<button class="btn-small" data-mark-paid="${p.id}">${t('pay.markPaid')}</button>` : ''}
    </div>`).join('');

  listEl.querySelectorAll('[data-mark-paid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await sb.from('rental_payments').update({ status: 'paid', paid_on: new Date().toISOString().slice(0, 10) })
        .eq('id', btn.getAttribute('data-mark-paid'));
      await refreshOwnerPayments();
    });
  });
}

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentTenancy) { alert(t('need.tenancyFirst')); return; }

  const category = document.getElementById('paymentCategory').value;
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const due = document.getElementById('paymentDue').value || null;
  const notes = document.getElementById('paymentNotes').value.trim() || null;
  const recurring = document.getElementById('paymentRecurring').checked;

  if (recurring) {
    // Without a first date there is nothing to step monthly from.
    if (!due) { alert(t('pay.needDueDate')); return; }
    const { data: created, error } = await sb.rpc('rental_create_recurring_payments', {
      p_tenancy_id: currentTenancy.id,
      p_category: category,
      p_amount: amount,
      p_first_due: due,
      p_notes: notes
    });
    if (error) { reportFailure('payments.recurring', error); return; }
    alert(t('pay.recurringDone', { count: created }));
  } else {
    const { error } = await sb.from('rental_payments').insert({
      tenancy_id: currentTenancy.id, category, amount, due_date: due, notes,
      created_by: currentUser.id
    });
    if (error) { reportFailure('payments.add', error); return; }
  }

  e.target.reset();
  await refreshOwnerPayments();
});

async function refreshOwnerMaintenance() {
  await renderMaintenanceList('ownerMaintenanceList', true);
}

async function refreshOwnerMessages() {
  if (!currentTenancy) {
    document.getElementById('ownerMessagesList').innerHTML = `<span class="muted">${t('need.tenancyFirst')}</span>`;
    return;
  }
  await renderMessages('ownerMessagesList', currentTenancy.id);
}

document.getElementById('ownerMessageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentTenancy) { alert(t('need.tenancyFirst')); return; }
  const input = document.getElementById('ownerMessageInput');
  await sb.from('rental_messages').insert({ tenancy_id: currentTenancy.id, author_id: currentUser.id, body: input.value.trim() });
  input.value = '';
  await refreshOwnerMessages();
});

// ============================================================
// Property information + guest codes (owner)
// ============================================================

async function refreshPropertyInfo() {
  const el = document.getElementById('ownerInfoList');
  const { data: entries } = await sb.from('rental_property_info')
    .select('*').eq('property_id', currentProperty.id)
    .order('sort_order', { ascending: true });

  if (!entries || entries.length === 0) {
    el.innerHTML = `<span class="muted">${t('info.empty')}</span>`;
    return;
  }
  el.innerHTML = entries.map(entry => `
    <div class="list-item">
      <div class="main">
        <div class="title">${escapeHtml(entry.title)}</div>
        ${entry.body ? `<div class="sub">${escapeHtml(entry.body)}</div>` : ''}
      </div>
      <span class="pill ${entry.visible_to_guests ? 'paid' : 'pending'}">
        ${entry.visible_to_guests ? t('info.badgeGuest') : t('info.badgeTenantOnly')}
      </span>
      <button class="btn-small danger" data-delete-info="${entry.id}">${t('info.delete')}</button>
    </div>`).join('');

  el.querySelectorAll('[data-delete-info]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('info.deleteConfirm'))) return;
      await sb.from('rental_property_info').delete().eq('id', btn.getAttribute('data-delete-info'));
      await refreshPropertyInfo();
    });
  });
}

document.getElementById('infoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await sb.from('rental_property_info').insert({
    property_id: currentProperty.id,
    title: document.getElementById('infoTitle').value.trim(),
    body: document.getElementById('infoBody').value.trim() || null,
    visible_to_guests: document.getElementById('infoVisibleToGuests').checked,
    created_by: currentUser.id
  });
  if (error) { alert(t('error', { msg: error.message })); return; }
  e.target.reset();
  document.getElementById('infoVisibleToGuests').checked = true;
  await refreshPropertyInfo();
});

function guestInviteStatus(invite) {
  if (invite.revoked_at) return { key: 'gcode.statusRevoked', pill: 'low' };
  if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
    return { key: 'gcode.statusExpired', pill: 'pending' };
  }
  return { key: 'gcode.statusActive', pill: 'paid' };
}

async function refreshGuestInvites() {
  const el = document.getElementById('guestInviteList');
  const { data: invites } = await sb.from('rental_guest_invites')
    .select('*').eq('property_id', currentProperty.id)
    .order('created_at', { ascending: false });

  if (!invites || invites.length === 0) {
    el.innerHTML = `<span class="muted">${t('gcode.empty')}</span>`;
    return;
  }
  el.innerHTML = invites.map(invite => {
    const status = guestInviteStatus(invite);
    return `
    <div class="list-item">
      <div class="main">
        <div class="title"><code>${escapeHtml(invite.code)}</code></div>
        <div class="sub">${invite.label ? escapeHtml(invite.label) + ' · ' : ''}${
          invite.expires_at ? t('gcode.expiresOn', { date: fmtDate(invite.expires_at) }) : t('gcode.noExpiry')
        }</div>
      </div>
      <span class="pill ${status.pill}">${t(status.key)}</span>
      ${invite.revoked_at ? '' : `<button class="btn-small danger" data-revoke="${invite.id}">${t('gcode.revoke')}</button>`}
    </div>`;
  }).join('');

  el.querySelectorAll('[data-revoke]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('gcode.revokeConfirm'))) return;
      await sb.from('rental_guest_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', btn.getAttribute('data-revoke'));
      await refreshGuestInvites();
    });
  });
}

document.getElementById('guestInviteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const days = parseInt(document.getElementById('guestInviteDays').value, 10);
  const expiresAt = Number.isFinite(days) && days > 0
    ? new Date(Date.now() + days * 86400000).toISOString()
    : null;
  const { error } = await sb.from('rental_guest_invites').insert({
    property_id: currentProperty.id,
    label: document.getElementById('guestInviteLabel').value.trim() || null,
    expires_at: expiresAt,
    created_by: currentUser.id
  });
  if (error) { alert(t('error', { msg: error.message })); return; }
  document.getElementById('guestInviteLabel').value = '';
  await refreshGuestInvites();
});

// ============================================================
// Documents (owner and tenant share this)
// ============================================================

function docCategoryLabel(v) { return t('doccat.' + v); }

async function refreshDocuments(prefix) {
  const el = document.getElementById(prefix + 'DocList');
  if (!currentTenancy) {
    el.innerHTML = `<span class="muted">${t('need.tenancyFirst')}</span>`;
    return;
  }
  const { data: docs, error } = await sb.from('rental_documents')
    .select('*').eq('tenancy_id', currentTenancy.id)
    .order('created_at', { ascending: false });
  if (error) { reportFailure('documents.load', error); return; }

  el.innerHTML = (!docs || docs.length === 0)
    ? `<span class="muted">${t('doc.empty')}</span>`
    : docs.map(d => `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(d.title)}</div>
          <div class="sub">${docCategoryLabel(d.category)} · ${fmtDate(d.created_at)}</div>
        </div>
        <button class="btn-small" data-open-doc="${d.id}" data-path="${escapeHtml(d.storage_path)}">${t('doc.open')}</button>
        <button class="btn-small danger" data-del-doc="${d.id}" data-path="${escapeHtml(d.storage_path)}">${t('doc.delete')}</button>
      </div>`).join('');

  el.querySelectorAll('[data-open-doc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      // The bucket is private, so every view needs a short-lived signed URL.
      const { data, error: urlErr } = await sb.storage.from('rental-documents')
        .createSignedUrl(btn.getAttribute('data-path'), 60);
      if (urlErr) { reportFailure('documents.sign', urlErr); return; }
      window.open(data.signedUrl, '_blank');
    });
  });

  el.querySelectorAll('[data-del-doc]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('doc.deleteConfirm'))) return;
      const { error: rmErr } = await sb.storage.from('rental-documents')
        .remove([btn.getAttribute('data-path')]);
      if (rmErr) { reportFailure('documents.removeFile', rmErr); return; }
      const { error: delErr } = await sb.from('rental_documents')
        .delete().eq('id', btn.getAttribute('data-del-doc'));
      if (delErr) { reportFailure('documents.removeRow', delErr); return; }
      await refreshDocuments(prefix);
    });
  });
}

function wireDocumentUpload(prefix) {
  document.getElementById(prefix + 'DocForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById(prefix + 'DocMsg');
    if (!currentTenancy) { setMsg(msg, t('need.tenancyFirst'), 'error'); return; }

    const file = document.getElementById(prefix + 'DocFile').files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setMsg(msg, t('doc.tooBig'), 'error'); return; }

    setMsg(msg, t('doc.uploading'), '');
    // The first path segment is the tenancy: that is what the storage policies
    // read to decide who may open the file.
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    const path = `${currentTenancy.id}/${crypto.randomUUID()}${ext}`;

    const { error: upErr } = await sb.storage.from('rental-documents').upload(path, file);
    if (upErr) { reportFailure('documents.upload', upErr, msg); return; }

    const { error: rowErr } = await sb.from('rental_documents').insert({
      tenancy_id: currentTenancy.id,
      title: document.getElementById(prefix + 'DocTitle').value.trim(),
      category: document.getElementById(prefix + 'DocCategory').value,
      storage_path: path,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: currentUser.id
    });
    if (rowErr) {
      // Do not leave an orphan file behind if the row fails.
      await sb.storage.from('rental-documents').remove([path]);
      reportFailure('documents.insertRow', rowErr, msg);
      return;
    }
    e.target.reset();
    setMsg(msg, '', '');
    await refreshDocuments(prefix);
  });
}

wireDocumentUpload('owner');
wireDocumentUpload('tenant');

// ============================================================
// Audit log (owner only)
// ============================================================

async function refreshAudit() {
  const el = document.getElementById('auditList');
  let query = sb.from('rental_audit_log')
    .select('*').eq('property_id', currentProperty.id)
    .order('occurred_at', { ascending: false }).limit(200);
  if (document.getElementById('auditFilter').value === 'errors') {
    query = query.eq('action', 'ERROR');
  }
  const { data: rows, error } = await query;
  if (error) { reportFailure('audit.load', error); return; }

  el.innerHTML = (!rows || rows.length === 0)
    ? `<span class="muted">${t('audit.empty')}</span>`
    : rows.map(r => `
      <div class="list-item audit-row">
        <div class="main">
          <div class="title">${t('act.' + r.action)} · ${escapeHtml(r.table_name)}</div>
          <div class="sub">${fmtDateTime(r.occurred_at)} · ${escapeHtml(r.actor_email || '—')}</div>
          <details class="audit-details">
            <summary>${t('audit.details')}</summary>
            <pre>${escapeHtml(JSON.stringify(r.new_data ?? r.old_data ?? {}, null, 1))}</pre>
          </details>
        </div>
        <span class="pill ${r.action === 'ERROR' ? 'overdue' : 'low'}">${t('act.' + r.action)}</span>
      </div>`).join('');
}

document.getElementById('auditRefresh').addEventListener('click', refreshAudit);
document.getElementById('auditFilter').addEventListener('change', refreshAudit);

// ============================================================
// GUEST DASHBOARD
// ============================================================

async function renderInfoList(containerId) {
  const el = document.getElementById(containerId);
  const { data: entries } = await sb.from('rental_property_info')
    .select('*').eq('property_id', currentProperty.id)
    .order('sort_order', { ascending: true });

  if (!entries || entries.length === 0) {
    el.innerHTML = `<span class="muted">${t('guest.empty')}</span>`;
    return;
  }
  el.innerHTML = entries.map(entry => `
    <div class="list-item">
      <div class="main">
        <div class="title">${escapeHtml(entry.title)}</div>
        ${entry.body ? `<div class="sub">${escapeHtml(entry.body)}</div>` : ''}
      </div>
    </div>`).join('');
}

// Returns false for an unknown, revoked or expired code so the caller can
// tell the visitor, rather than dropping them on an empty page.
async function showGuestView(code) {
  const { data: rows, error } = await sb.rpc('rental_guest_view', { p_code: code });
  if (error || !rows || rows.length === 0) return false;

  document.getElementById('guestPropName').textContent = rows[0].property_name;
  document.getElementById('guestPropAddress').textContent = rows[0].property_address || '';

  const entries = rows.filter(r => r.entry_title);
  const el = document.getElementById('guestInfoList');
  el.innerHTML = entries.length === 0
    ? `<span class="muted">${t('guest.empty')}</span>`
    : entries.map(r => `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(r.entry_title)}</div>
          ${r.entry_body ? `<div class="sub">${escapeHtml(r.entry_body)}</div>` : ''}
        </div>
      </div>`).join('');

  document.getElementById('userBox').hidden = true;
  document.getElementById('guestBox').hidden = false;
  document.getElementById('passwordPanel').hidden = true;
  showView('view-guest');
  return true;
}

// ============================================================
// TENANT DASHBOARD
// ============================================================

async function loadTenantDashboard() {
  const { data: tenancy } = await sb.from('rental_tenancies')
    .select('*').eq('tenant_user_id', currentUser.id).eq('status', 'active')
    .order('start_date', { ascending: false }).limit(1).maybeSingle();
  currentTenancy = tenancy;

  const infoEl = document.getElementById('tenantLeaseInfo');
  if (tenancy) {
    infoEl.textContent = t('tenant.leaseLine', {
      rent: fmtMoney(tenancy.monthly_rent),
      start: fmtDate(tenancy.start_date),
      end: tenancy.end_date ? fmtDate(tenancy.end_date) : t('dash')
    });
  } else {
    infoEl.textContent = t('tenant.noActiveAccount');
  }

  await refreshTenantPayments();
  await refreshTenantMaintenance();
  await refreshTenantMessages();
  await renderInfoList('tenantInfoList');
  await refreshDocuments('tenant');
}

async function refreshTenantPayments() {
  const listEl = document.getElementById('tenantPaymentsList');
  if (!currentTenancy) { listEl.innerHTML = `<span class="muted">${t('need.noActiveTenancy')}</span>`; return; }
  const { data: payments } = await sb.from('rental_payments')
    .select('*').eq('tenancy_id', currentTenancy.id)
    .order('due_date', { ascending: false, nullsFirst: false });
  if (!payments || payments.length === 0) {
    listEl.innerHTML = `<span class="muted">${t('pay.empty')}</span>`;
    return;
  }
  listEl.innerHTML = payments.map(p => `
    <div class="list-item">
      <div class="main">
        <div class="title">${categoryLabel(p.category)} — ${fmtMoney(p.amount)}</div>
        <div class="sub">${p.notes ? escapeHtml(p.notes) + ' · ' : ''}${t('pay.dueLabel')}: ${fmtDate(p.due_date)}${p.paid_on ? ' · ' + t('pay.paidLabel') + ': ' + fmtDate(p.paid_on) : ''}</div>
      </div>
      <span class="pill ${p.status}">${statusLabel(p.status)}</span>
    </div>`).join('');
}

document.getElementById('maintenanceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentTenancy) { alert(t('need.tenancyReport')); return; }
  const payload = {
    tenancy_id: currentTenancy.id,
    title: document.getElementById('maintTitle').value.trim(),
    description: document.getElementById('maintDescription').value.trim() || null,
    priority: document.getElementById('maintPriority').value,
    created_by: currentUser.id
  };
  const { error } = await sb.from('rental_maintenance_requests').insert(payload);
  if (error) { alert(t('error', { msg: error.message })); return; }
  e.target.reset();
  await refreshTenantMaintenance();
});

async function refreshTenantMaintenance() {
  await renderMaintenanceList('tenantMaintenanceList', false);
}

async function refreshTenantMessages() {
  if (!currentTenancy) {
    document.getElementById('tenantMessagesList').innerHTML = `<span class="muted">${t('need.noActiveTenancy')}</span>`;
    return;
  }
  await renderMessages('tenantMessagesList', currentTenancy.id);
}

document.getElementById('tenantMessageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentTenancy) { alert(t('need.noActiveTenancy')); return; }
  const input = document.getElementById('tenantMessageInput');
  await sb.from('rental_messages').insert({ tenancy_id: currentTenancy.id, author_id: currentUser.id, body: input.value.trim() });
  input.value = '';
  await refreshTenantMessages();
});

// ============================================================
// Shared: Maintenance list + comments (used by both dashboards)
// ============================================================

async function renderMaintenanceList(containerId, isOwner) {
  const el = document.getElementById(containerId);
  let query = sb.from('rental_maintenance_requests').select('*').order('created_at', { ascending: false });
  if (!isOwner) {
    if (!currentTenancy) { el.innerHTML = `<span class="muted">${t('need.noActiveTenancy')}</span>`; return; }
    query = query.eq('tenancy_id', currentTenancy.id);
  } else {
    if (!currentTenancy) { el.innerHTML = `<span class="muted">${t('need.tenancyFirst')}</span>`; return; }
    query = query.eq('tenancy_id', currentTenancy.id);
  }
  const { data: requests } = await query;
  if (!requests || requests.length === 0) {
    el.innerHTML = `<span class="muted">${t('maint.empty')}</span>`;
    return;
  }

  el.innerHTML = requests.map(r => `
    <div class="request-card" data-request-id="${r.id}">
      <div class="head">
        <div>
          <div class="title">${escapeHtml(r.title)}</div>
          <div class="sub">${fmtDate(r.created_at)}</div>
        </div>
        <div>
          <span class="pill ${r.priority}">${priorityLabel(r.priority)}</span>
          <span class="pill ${r.status}">${statusLabel(r.status)}</span>
        </div>
      </div>
      ${r.description ? `<div class="desc">${escapeHtml(r.description)}</div>` : ''}
      ${isOwner ? `
        <div class="status-actions">
          ${['open', 'in_progress', 'resolved', 'closed'].map(s => `
            <button class="btn-small" data-set-status="${s}" ${r.status === s ? 'disabled' : ''}>${statusLabel(s)}</button>
          `).join('')}
        </div>` : ''}
      <div class="comments" data-comments></div>
      <form class="comment-form" data-comment-form>
        <input type="text" placeholder="${t('maint.commentPlaceholder')}" required>
        <button type="submit" class="btn-small">${t('maint.reply')}</button>
      </form>
    </div>
  `).join('');

  el.querySelectorAll('[data-request-id]').forEach(card => {
    const requestId = card.getAttribute('data-request-id');
    loadComments(card, requestId);

    card.querySelectorAll('[data-set-status]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.getAttribute('data-set-status');
        const patch = { status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === 'resolved') patch.resolved_at = new Date().toISOString();
        await sb.from('rental_maintenance_requests').update(patch).eq('id', requestId);
        await renderMaintenanceList(containerId, isOwner);
      });
    });

    card.querySelector('[data-comment-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      await sb.from('rental_maintenance_comments').insert({
        request_id: requestId, author_id: currentUser.id, body: input.value.trim()
      });
      input.value = '';
      loadComments(card, requestId);
    });
  });
}

async function loadComments(card, requestId) {
  const { data: comments } = await sb.from('rental_maintenance_comments')
    .select('*').eq('request_id', requestId).order('created_at', { ascending: true });
  const el = card.querySelector('[data-comments]');
  if (!comments || comments.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = comments.map(c => `
    <div class="comment">
      <span class="author">${c.author_id === currentUser.id ? t('party.you') : otherPartyLabel()}</span>
      <span class="comment-time">${fmtDateTime(c.created_at)}</span>
      <div class="comment-body">${escapeHtml(c.body)}</div>
    </div>`).join('');
}

// ============================================================
// Shared: Messages thread
// ============================================================

async function renderMessages(containerId, tenancyId) {
  const el = document.getElementById(containerId);
  const { data: messages } = await sb.from('rental_messages')
    .select('*').eq('tenancy_id', tenancyId).order('created_at', { ascending: true });
  if (!messages || messages.length === 0) {
    el.innerHTML = `<span class="muted">${t('msg.empty')}</span>`;
    return;
  }
  el.innerHTML = messages.map(m => {
    const mine = m.author_id === currentUser.id;
    return `
    <div class="message-bubble ${mine ? 'mine' : 'theirs'}">
      <div class="sender">${mine ? t('party.you') : otherPartyLabel()}</div>
      ${escapeHtml(m.body)}
      <div class="meta">${fmtDateTime(m.created_at)}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

// ============================================================
// Boot sequence
// ============================================================

async function boot() {
  showView('view-loading');

  document.getElementById('guestBox').hidden = true;

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    currentUser = null;
    document.getElementById('userBox').hidden = true;
    document.getElementById('passwordPanel').hidden = true;
    // A guest is identified by their code alone, with no account at all.
    let savedCode = null;
    try { savedCode = localStorage.getItem(GUEST_CODE_KEY); } catch (e) { /* private mode */ }
    if (savedCode && await showGuestView(savedCode)) return;
    try { localStorage.removeItem(GUEST_CODE_KEY); } catch (e) { /* private mode */ }
    applyDeviceRoleToLogin();
    showView('view-login');
    return;
  }

  currentUser = session.user;
  rememberDeviceRole('account');
  document.getElementById('userBox').hidden = false;
  document.getElementById('userEmail').textContent = currentUser.email;

  // The summary is the source of truth for the role: it never exposes the
  // invite code, and it drops guests whose access window has closed.
  const { data: summaryRows } = await sb.rpc('rental_my_property_summary');
  const summary = summaryRows && summaryRows[0];

  if (!summary) {
    const [{ data: canCreate }, { data: canJoin }] = await Promise.all([
      sb.rpc('rental_can_create_property'),
      sb.rpc('rental_can_join_as_tenant')
    ]);
    document.getElementById('ownerOnboardCard').hidden = !canCreate;
    document.getElementById('tenantOnboardCard').hidden = !canJoin;
    showView('view-onboarding');
    return;
  }

  currentMembership = { property_id: summary.property_id, role: summary.role };
  currentProperty = { id: summary.property_id, name: summary.name, address: summary.address };

  if (summary.role === 'owner') {
    // Owners read the full row, which also carries the tenant invite code.
    const { data: property } = await sb.from('rental_properties')
      .select('*').eq('id', summary.property_id).single();
    // Keep the summary values if that read comes back empty, rather than
    // blanking the whole dashboard on a null.
    currentProperty = property || currentProperty;
    showView('view-owner');
    initTabs('#view-owner');
    await loadOwnerDashboard();
  } else {
    showView('view-tenant');
    initTabs('#view-tenant');
    await loadTenantDashboard();
  }
}

sb.auth.onAuthStateChange((_event, _session) => {
  boot();
});

// ---------- Language ----------
// i18n.js repaints the static labels and owns the switcher; here we re-render
// the data-driven lists so they pick up the new language too.
document.addEventListener('langchange', () => { boot(); });

boot();

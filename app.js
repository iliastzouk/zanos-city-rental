// ============================================================
// Zanos City — Rental Management App
// ============================================================

const SUPABASE_URL = 'https://fwkchszqkosjyesmsvlj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kjWHvwntT1U__wY_5K0F1w_cd_YhBT9';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Enum values live in the DB in English; the labels come from the active language.
// An unknown value falls back to itself rather than printing a translation key.
function enumLabel(prefix, value) {
  const key = prefix + '.' + value;
  const label = t(key);
  return label === key ? String(value) : label;
}
const categoryLabel = (v) => enumLabel('cat', v);
const statusLabel = (v) => enumLabel('st', v);
const priorityLabel = (v) => enumLabel('pri', v);

let currentUser = null;
let currentMembership = null; // { property_id, role, ... }
let currentProperty = null;
let currentTenancy = null; // active tenancy (owner: latest active; tenant: their own)
let editingTenancyId = null;
let editingPaymentId = null;
let editingPaymentDue = null;
let allTenancies = [];        // every tenancy of the property, newest first
let paymentsTenancyId = null; // which one the Payments tab is showing
let maintTenancyId = null;    // and which one the Maintenance tab is showing
let messagesTenancyId = null;
let docsTenancyId = null;
let editingInfoId = null;
const MAX_PHOTOS = 5;

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
// Seconds carry no meaning in a conversation, and a bare date reads worse than
// "Yesterday" for anything recent. The audit log keeps the full stamp.
function fmtChatTime(d) {
  const when = new Date(d);
  const loc = dateLocale();
  // el-GR resolves '2-digit' hours to a 12-hour clock; both languages read the
  // rest of this app on a 24-hour one.
  const time = when.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const thatDay = new Date(when); thatDay.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((midnight - thatDay) / 86400000);
  if (daysAgo === 0) return `${t('time.today')} · ${time}`;
  if (daysAgo === 1) return `${t('time.yesterday')} · ${time}`;
  const opts = { day: 'numeric', month: 'short' };
  if (when.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return `${when.toLocaleDateString(loc, opts)} · ${time}`;
}
// 'YYYY-MM-DD' parsed as local, not UTC, so a day never shifts.
function parseDate(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function isoDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
// The month a charge belongs to, in whichever language is active. Storing this
// text would freeze it in one language for everyone.
function fmtMonth(d) {
  return parseDate(d).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
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
      // A hidden element has no scroll height, so a thread rendered while its
      // panel was closed can only be pinned to its newest message now.
      scope.querySelectorAll(`.tab-panel[data-panel="${tab}"] .messages-list`).forEach(list => {
        list.scrollTop = list.scrollHeight;
        if (list.dataset.tenancy && list.dataset.newest) {
          markMessagesSeen(list.dataset.tenancy, list.dataset.newest);
        }
      });
      delete btn.dataset.badge;
      requestAnimationFrame(() => revealTabs(scope));
    });
  });
}

// Switching tabs from halfway down a long panel used to leave the reader in the
// middle of the new one, with the tab row itself scrolled up behind the sticky
// topbar — no way to see which tab was now active without scrolling back. Bring
// the row back into view, clearing the height of the bar that would cover it.
// Measured after the panel swap has been laid out: hiding a tall panel can
// shrink the page and move everything under the reader's feet first.
function revealTabs(scope) {
  const tabs = scope.querySelector('.tabs');
  const bar = document.querySelector('.topbar');
  if (!tabs || !bar) return;
  const barBottom = bar.getBoundingClientRect().bottom;
  if (tabs.getBoundingClientRect().top >= barBottom) return;   // already in view
  const target = tabs.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 8;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: Math.max(target, 0), behavior: smooth ? 'smooth' : 'auto' });
}

// ---------- Auth ----------
const GUEST_PAGE = 'guest/';
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

// Both the magic link and the reset use the same email box as the sign-in form,
// so neither asks for the address twice. This reports the problem in our own
// words rather than leaving one button on the browser's native bubble and the
// other on ours, and puts the cursor back where the fix is. The button stays
// enabled: a dead button that does nothing when tapped explains less than a
// sentence saying what is missing.
function loginEmailOrComplain() {
  const field = document.getElementById('loginEmail');
  const msg = document.getElementById('loginMsg');
  const email = field.value.trim();
  if (!email) { setMsg(msg, t('login.needEmail'), 'error'); field.focus(); return null; }
  if (!field.checkValidity()) { setMsg(msg, t('login.invalidEmail'), 'error'); field.focus(); return null; }
  return email;
}

document.getElementById('magicLinkBtn').addEventListener('click', async () => {
  const msg = document.getElementById('loginMsg');
  const email = loginEmailOrComplain();
  if (!email) return;
  setMsg(msg, t('login.sending'), '');
  const { error } = await sendMagicLink(email);
  if (error) setMsg(msg, authErrorText(error), 'error');
  else setMsg(msg, t('login.sent'), 'ok');
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

// Password sign-in existed with no way back in after forgetting one, which
// stranded the tenant completely — they have no other route.
document.getElementById('forgotPassword').addEventListener('click', async () => {
  const msg = document.getElementById('loginMsg');
  const email = loginEmailOrComplain();
  if (!email) return;

  setMsg(msg, t('login.sending'), '');
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) { setMsg(msg, authErrorText(error), 'error'); return; }
  // Deliberately the same wording whether or not the address is registered.
  setMsg(msg, t('login.resetSent'), 'ok');
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

// Files live under <tenancy_id>/..., which is what the storage policies read
// to decide who may open them.
async function uploadTenancyFile(file, folder, tenancyId) {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const path = `${tenancyId}/${folder}/${crypto.randomUUID()}${ext}`;
  const { error } = await sb.storage.from('rental-documents').upload(path, file);
  return { path, error };
}

async function openStoredFile(path) {
  // The bucket is private, so every view needs a short-lived signed URL.
  const { data, error } = await sb.storage.from('rental-documents').createSignedUrl(path, 60);
  if (error) { reportFailure('storage.sign', error); return; }
  window.open(data.signedUrl, '_blank');
}

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
  await renderCalendar('owner');
  await refreshAudit();
}

async function refreshTenancies() {
  const { data: tenancies, error } = await sb.from('rental_tenancies')
    .select('*').eq('property_id', currentProperty.id)
    .order('start_date', { ascending: false });
  if (error) { reportFailure('tenancies.load', error); return; }

  // The rest of the dashboard keys off the active tenancy.
  allTenancies = tenancies || [];
  currentTenancy = allTenancies.find(item => item.status === 'active') || null;

  // Default the Payments tab to the active tenancy, but keep any explicit
  // choice that still exists.
  const fallback = currentTenancy ? currentTenancy.id : (allTenancies[0] || {}).id || null;
  if (!allTenancies.some(item => item.id === paymentsTenancyId)) paymentsTenancyId = fallback;
  if (!allTenancies.some(item => item.id === maintTenancyId)) maintTenancyId = fallback;
  if (!allTenancies.some(item => item.id === messagesTenancyId)) messagesTenancyId = fallback;
  if (!allTenancies.some(item => item.id === docsTenancyId)) docsTenancyId = fallback;

  const el = document.getElementById('tenancyHistory');
  if (!tenancies || tenancies.length === 0) {
    el.innerHTML = `<span class="muted">${t('tenancy.historyEmpty')}</span>`;
    return;
  }

  // One list for every tenancy, active ones marked and carrying the extra
  // action. Showing the current one twice, in its own card and again here,
  // only raised the question of which copy was authoritative.
  el.innerHTML = tenancies.map(item => {
    const isActive = item.status === 'active';
    return `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(item.tenant_name || t('tenancy.defaultTenant'))}</div>
          <div class="sub">${fmtDate(item.start_date)} → ${item.end_date ? fmtDate(item.end_date) : t('dash')} · ${t('tenancy.rentLine', { amount: fmtMoney(item.monthly_rent) })}</div>
        </div>
        <span class="pill ${isActive ? 'paid' : 'pending'}">${isActive ? t('tenancy.statusActive') : t('tenancy.statusEnded')}</span>
        <button class="btn-small" data-edit-row="${item.id}">${t('tenancy.edit')}</button>
        ${isActive ? `<button class="btn-small" data-end-row="${item.id}">${t('tenancy.endBtn')}</button>` : ''}
        <button class="btn-small danger" data-delete-row="${item.id}">${t('tenancy.delete')}</button>
      </div>`;
  }).join('');

  const find = (id) => tenancies.find(x => x.id === id);

  el.querySelectorAll('[data-edit-row]').forEach(btn => {
    btn.addEventListener('click', () => startTenancyEdit(find(btn.getAttribute('data-edit-row'))));
  });
  el.querySelectorAll('[data-delete-row]').forEach(btn => {
    btn.addEventListener('click', () => deleteTenancy(find(btn.getAttribute('data-delete-row'))));
  });
  el.querySelectorAll('[data-end-row]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('tenancy.endConfirm'))) return;
      const { error: endErr } = await sb.from('rental_tenancies')
        .update({ status: 'ended' }).eq('id', btn.getAttribute('data-end-row'));
      if (endErr) { reportFailure('tenancy.end', endErr); return; }
      await loadOwnerDashboard();
    });
  });
}

// Everything hanging off a tenancy is ON DELETE CASCADE, so removing one takes
// its payments, messages, reports and documents with it. Say so with real
// numbers before touching anything.
async function deleteTenancy(tenancy) {
  if (!tenancy) return;
  const msg = document.getElementById('tenancyListMsg');

  const [payments, messages, requests, documents] = await Promise.all([
    sb.from('rental_payments').select('id, proof_path').eq('tenancy_id', tenancy.id),
    sb.from('rental_messages').select('id').eq('tenancy_id', tenancy.id),
    sb.from('rental_maintenance_requests').select('id').eq('tenancy_id', tenancy.id),
    sb.from('rental_documents').select('id, storage_path').eq('tenancy_id', tenancy.id)
  ]);
  const failed = [payments, messages, requests, documents].find(r => r.error);
  if (failed) { reportFailure('tenancy.deleteCount', failed.error, msg); return; }

  const what = `${tenancy.tenant_name || t('tenancy.defaultTenant')} · ` +
    `${fmtDate(tenancy.start_date)} → ${tenancy.end_date ? fmtDate(tenancy.end_date) : t('dash')}`;

  if (!confirm(t('tenancy.deleteConfirm', {
    what,
    payments: payments.data.length,
    messages: messages.data.length,
    requests: requests.data.length,
    documents: documents.data.length
  }))) return;

  setMsg(msg, t('tenancy.deleting'), '');

  // The cascade clears the rows but not the stored files, which would otherwise
  // linger in the bucket unreachable and unaccounted for.
  const paths = [
    ...documents.data.map(d => d.storage_path),
    ...payments.data.map(p => p.proof_path)
  ].filter(Boolean);
  if (paths.length) await sb.storage.from('rental-documents').remove(paths);

  const { error } = await sb.from('rental_tenancies').delete().eq('id', tenancy.id);
  if (error) { reportFailure('tenancy.delete', error, msg); return; }

  if (currentTenancy && currentTenancy.id === tenancy.id) currentTenancy = null;
  if (editingTenancyId === tenancy.id) cancelTenancyEdit();
  setMsg(msg, '', '');
  await loadOwnerDashboard();
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

function tenancyLabel(tenancy) {
  return t('pay.tenancyOption', {
    name: tenancy.tenant_name || t('tenancy.defaultTenant'),
    start: fmtDate(tenancy.start_date),
    end: tenancy.end_date ? fmtDate(tenancy.end_date) : t('dash')
  });
}

// Every owner tab that is scoped to a tenancy fills its selector the same way.
function fillTenancySelect(selectId, selectedId, headingId, headingKey) {
  document.getElementById(selectId).innerHTML = allTenancies.map(item =>
    `<option value="${item.id}"${item.id === selectedId ? ' selected' : ''}>${
      escapeHtml(tenancyLabel(item))}${item.status === 'active' ? ' ✓' : ''}</option>`).join('');

  const tenancy = allTenancies.find(item => item.id === selectedId) || null;
  document.getElementById(headingId).textContent = tenancy
    ? t(headingKey, { name: tenancy.tenant_name || t('tenancy.defaultTenant') })
    : '';
  return tenancy;
}

function paymentsTenancy() {
  return allTenancies.find(item => item.id === paymentsTenancyId) || null;
}

function refreshPaymentsHeader() {
  // Without this the list was just "Payments", with no sign of whose.
  fillTenancySelect('paymentsTenancy', paymentsTenancyId, 'paymentForWho', 'pay.showing');

  const dueField = document.getElementById('paymentDue');
  if (!editingPaymentId && !dueField.value) {
    dueField.value = new Date().toISOString().slice(0, 10);
  }

}

async function refreshOwnerPayments() {
  const listEl = document.getElementById('ownerPaymentsList');
  refreshPaymentsHeader();

  const tenancy = paymentsTenancy();
  if (!tenancy) {
    listEl.innerHTML = `<span class="muted">${t('need.tenancyFirst')}</span>`;
    return;
  }
  const { data: rows, error } = await sb.from('rental_payments')
    .select('*').eq('tenancy_id', tenancy.id)
    .order('due_date', { ascending: false, nullsFirst: false });
  if (error) { reportFailure('payments.load', error); return; }

  if (!rows || rows.length === 0) {
    listEl.innerHTML = `<span class="muted">${t('pay.empty')}</span>`;
    return;
  }

  const statusFilter = document.getElementById('paymentsStatusFilter').value;
  const categoryFilter = document.getElementById('paymentsCategoryFilter').value;
  const payments = rows.filter(p =>
    (statusFilter === 'all' || effectiveStatus(p) === statusFilter) &&
    (categoryFilter === 'all' || p.category === categoryFilter));

  if (payments.length === 0) {
    listEl.innerHTML = `<span class="muted">${t('pay.noneForFilter')}</span>`;
    return;
  }

  const narrowed = statusFilter !== 'all' || categoryFilter !== 'all';
  const render = narrowed ? paymentFlatHtml : paymentSectionsHtml;
  listEl.innerHTML = render('ownerPaymentsList', payments, p => `
    <div class="list-item">
      <div class="main">
        <div class="title">${categoryLabel(p.category)} — ${fmtMoney(p.amount)}</div>
        <div class="sub">${[
          p.due_date ? t('pay.dueLabel') + ': ' + fmtDate(p.due_date) : '',
          p.paid_on ? t('pay.paidLabel') + ': ' + fmtDate(p.paid_on) : '',
          p.notes ? escapeHtml(p.notes) : ''
        ].filter(Boolean).join(' · ')}</div>
      </div>
      ${p.series_id ? `<span class="pill low">${t('pay.seriesBadge')}</span>` : ''}
      <span class="pill ${effectiveStatus(p)}">${statusLabel(effectiveStatus(p))}</span>
      ${p.proof_path ? `<button class="btn-small" data-open-proof="${escapeHtml(p.proof_path)}">${t('pay.openAttachment')}</button>` : ''}
      <button class="btn-small" data-edit-payment="${p.id}">${t('pay.edit')}</button>
      ${p.status !== 'paid' ? `<button class="btn-small" data-mark-paid="${p.id}">${t('pay.markPaid')}</button>` : ''}
    </div>`);

  wirePaymentList(listEl, 'ownerPaymentsList', refreshOwnerPayments);

  listEl.querySelectorAll('[data-open-proof]').forEach(btn => {
    btn.addEventListener('click', () => openStoredFile(btn.getAttribute('data-open-proof')));
  });

  listEl.querySelectorAll('[data-edit-payment]').forEach(btn => {
    btn.addEventListener('click', () => {
      startPaymentEdit(rows.find(p => p.id === btn.getAttribute('data-edit-payment')));
    });
  });

  listEl.querySelectorAll('[data-mark-paid]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await sb.from('rental_payments').update({ status: 'paid', paid_on: new Date().toISOString().slice(0, 10) })
        .eq('id', btn.getAttribute('data-mark-paid'));
      await refreshOwnerPayments();
    });
  });
}

// ---- Payment history: grouped by month, a page at a time -------------------
// A tenancy that runs for years piles up hundreds of charges. Rendering the lot
// on a phone is both slow and unreadable, and nobody asks "which charge is the
// 47th?" — they ask "what did I pay in September?". So the list is grouped by
// month, newest first, and only a page of rows is laid out until asked for more.
const PAY_PAGE_SIZE = 20;
const freshPayState = () => ({ upcoming: false, previous: false, history: PAY_PAGE_SIZE });
const payShown = { ownerPaymentsList: freshPayState(), tenantPaymentsList: freshPayState() };

// Rows arrive newest-first, so consecutive rows share a month and the groups
// fall out of a single pass.
function paymentMonthGroups(payments) {
  const groups = [];
  payments.forEach(p => {
    const key = p.due_date ? p.due_date.slice(0, 7) : '';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(p);
    else groups.push({ key, rows: [p] });
  });
  return groups;
}

// Three runs, each answering a different question: what is live now, what is
// coming, what already happened. Rows arrive newest-first, so the past run is
// already in order and the future only needs reversing.
function splitPaymentGroups(groups) {
  const thisMonth = isoDate(new Date()).slice(0, 7);
  return {
    now: groups.filter(g => !g.key || g.key === thisMonth),   // undated: owed, not planned
    previous: groups.filter(g => g.key && g.key < thisMonth),
    upcoming: groups.filter(g => g.key && g.key > thisMonth).reverse()
  };
}

// The header counts the whole month, even where a page cuts it short.
function paymentGroupHtml(g, rowHtml, limit) {
  const rows = limit === undefined ? g.rows : g.rows.slice(0, limit);
  return `<div class="group-head">
      <span class="group-title">${g.key ? escapeHtml(fmtMonth(g.key + '-01')) : t('pay.noDueGroup')}</span>
      <span class="group-count">${g.rows.length === 1 ? t('pay.groupCountOne') : t('pay.groupCount', { count: g.rows.length })}</span>
    </div>` + rows.map(rowHtml).join('');
}

const countRows = (groups) => groups.reduce((n, g) => n + g.rows.length, 0);

// A year of scheduled rent is twelve near-identical cards standing between the
// reader and everything else. Show the live month and what comes right after
// it; the rest of the schedule, and the history, each wait behind a line of
// their own. The months label themselves, so the sections carry no headings.
const PAY_PREVIEW_GROUPS = 2;

function paymentSectionsHtml(containerId, payments, rowHtml) {
  const state = payShown[containerId];
  const { now, previous, upcoming } = splitPaymentGroups(paymentMonthGroups(payments));

  // Two month groups up front: the current month and the next one, or the two
  // nearest ahead when this month has nothing of its own. An undated group is
  // not a month and must not eat into that budget.
  const currentMonths = now.filter(g => g.key).length;
  const preview = upcoming.slice(0, Math.max(PAY_PREVIEW_GROUPS - currentMonths, 0));
  const rest = upcoming.slice(preview.length);
  // With nothing live and nothing ahead, the history is all there is to show.
  const openPrevious = state.previous || (now.length === 0 && upcoming.length === 0);

  const parts = [...now, ...preview].map(g => paymentGroupHtml(g, rowHtml));

  if (rest.length) {
    parts.push(state.upcoming
      ? rest.map(g => paymentGroupHtml(g, rowHtml)).join('')
      : `<button type="button" class="btn-small section-toggle" data-open-section="upcoming">${t('pay.showUpcoming', { count: countRows(rest) })}</button>`);
  }

  if (previous.length && !openPrevious) {
    parts.push(`<button type="button" class="btn-small section-toggle" data-open-section="previous">${t('pay.showPrevious', { count: countRows(previous) })}</button>`);
  } else if (previous.length) {
    // History alone can run to hundreds of rows, so it keeps its own paging.
    let left = state.history;
    for (const g of previous) {
      if (left <= 0) break;
      parts.push(paymentGroupHtml(g, rowHtml, left));
      left -= Math.min(g.rows.length, left);
    }
    const total = countRows(previous);
    const rendered = Math.min(state.history, total);
    if (rendered < total) {
      parts.push(`<div class="list-more">
        <span class="muted">${t('list.showingCount', { shown: rendered, total })}</span>
        <button class="btn-small" data-load-more>${t('list.loadMore')}</button>
      </div>`);
    }
  }

  return parts.join('');
}

// A narrowed list is already the answer to a question, so it stays flat: the
// sections would hide most of what the reader just asked to see.
function paymentFlatHtml(containerId, payments, rowHtml) {
  const shown = payShown[containerId].history;
  let left = shown;
  const parts = [];
  for (const g of paymentMonthGroups(payments)) {
    if (left <= 0) break;
    parts.push(paymentGroupHtml(g, rowHtml, left));
    left -= Math.min(g.rows.length, left);
  }
  if (shown < payments.length) {
    parts.push(`<div class="list-more">
      <span class="muted">${t('list.showingCount', { shown, total: payments.length })}</span>
      <button class="btn-small" data-load-more>${t('list.loadMore')}</button>
    </div>`);
  }
  return parts.join('');
}

// Wires the two section toggles and the history pager, whichever are present.
function wirePaymentList(listEl, containerId, refresh) {
  listEl.querySelectorAll('[data-open-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      payShown[containerId][btn.getAttribute('data-open-section')] = true;
      refresh();
    });
  });
  const more = listEl.querySelector('[data-load-more]');
  if (more) more.addEventListener('click', () => {
    payShown[containerId].history += PAY_PAGE_SIZE;
    refresh();
  });
}

// Postgres clamps "+ 1 month" to the end of the target month; match that here so
// a charge due on the 31st does not slide into the following month.
function nextMonth(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const day = Math.min(d, new Date(ny, nm, 0).getDate());
  const pad = (n) => String(n).padStart(2, '0');
  return `${ny}-${pad(nm)}-${pad(day)}`;
}

// Nothing ever writes the 'overdue' status, so a charge months past its date
// still read as merely "pending" and the overdue filter matched nothing. It is
// derived from the date instead.
function isOverdue(p) {
  if (p.status !== 'pending' || !p.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDate(p.due_date) < today;
}
function effectiveStatus(p) {
  return isOverdue(p) ? 'overdue' : p.status;
}

// Late, wanted within the month, or merely scheduled. A charge with no date is
// owed rather than planned, so it counts as due soon.
const DUE_SOON_DAYS = 30;
function payBucket(p) {
  if (isOverdue(p)) return 'overdue';
  if (!p.due_date) return 'soon';
  const limit = new Date();
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + DUE_SOON_DAYS);
  return parseDate(p.due_date) <= limit ? 'soon' : 'scheduled';
}

function paymentSummary(payment) {
  const parts = [`${categoryLabel(payment.category)} — ${fmtMoney(payment.amount)}`];
  if (payment.due_date) parts.push(`${t('pay.dueLabel')} ${fmtDate(payment.due_date)}`);
  if (payment.notes) parts.push(payment.notes);
  return parts.join(' · ');
}

function startPaymentEdit(payment) {
  if (!payment) return;
  editingPaymentId = payment.id;
  editingPaymentDue = payment.due_date || null;

  const catSelect = document.getElementById('paymentCategory');
  catSelect.value = payment.category;
  if (!catSelect.value) catSelect.value = 'other';  // unknown category, do not blank it
  document.getElementById('paymentAmount').value = payment.amount;
  document.getElementById('paymentDue').value = payment.due_date || '';
  document.getElementById('paymentNotes').value = payment.notes || '';
  document.getElementById('paymentFile').value = '';
  document.getElementById('paymentRecurring').checked = false;

  // Say which charge this is; "Editing a charge" on its own tells the reader nothing.
  document.getElementById('paymentEditWhat').textContent =
    t('pay.editingWhat', { what: paymentSummary(payment) });
  document.getElementById('paymentFormTitle').textContent = t('pay.editTitle');
  document.getElementById('paymentFileLabel').textContent =
    payment.proof_path ? t('pay.replaceFile') : t('pay.attachFile');
  document.getElementById('paymentEditNote').hidden = false;
  document.querySelector('#paymentForm button[type=submit]').textContent = t('pay.update');
  document.getElementById('paymentForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelPaymentEdit() {
  editingPaymentId = null;
  editingPaymentDue = null;
  document.getElementById('paymentForm').reset();
  document.getElementById('paymentFile').disabled = false;
  document.getElementById('paymentFormTitle').textContent = t('pay.formTitle');
  document.getElementById('paymentFileLabel').textContent = t('pay.attachment');
  document.getElementById('paymentEditNote').hidden = true;
  document.getElementById('paymentNotesLabel').textContent = t('pay.notes');
  document.querySelector('#paymentForm button[type=submit]').textContent = t('pay.submit');
  setMsg(document.getElementById('paymentMsg'), '', '');
  // A new charge starts on today's date rather than an empty field.
  document.getElementById('paymentDue').value = new Date().toISOString().slice(0, 10);
}

document.getElementById('cancelPaymentEdit').addEventListener('click', cancelPaymentEdit);

['paymentsTenancy', 'paymentsStatusFilter', 'paymentsCategoryFilter'].forEach(id => {
  document.getElementById(id).addEventListener('change', async (e) => {
    if (id === 'paymentsTenancy') {
      paymentsTenancyId = e.target.value;
      cancelPaymentEdit();  // the charge being edited belongs to the other tenancy
    }
    payShown.ownerPaymentsList = freshPayState();   // a new filter or tenancy starts fresh
    await refreshOwnerPayments();
  });
});

// An attachment makes no sense across a whole series, only on one charge.
document.getElementById('paymentRecurring').addEventListener('change', (e) => {
  const file = document.getElementById('paymentFile');
  // While editing, the attachment belongs to the charge being edited, so it
  // stays available; only a brand-new series has no single charge to attach to.
  const blocked = e.target.checked && !editingPaymentId;
  file.disabled = blocked;
  if (blocked) file.value = '';
  document.getElementById('paymentFileLabel').textContent =
    blocked ? t('pay.attachmentNote') : t('pay.attachment');
  // The same note text lands on all twelve rows, so "September rent" would be
  // wrong on eleven of them.
  document.getElementById('paymentNotesLabel').textContent =
    e.target.checked ? t('pay.notesRecurring') : t('pay.notes');
});

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('paymentMsg');
  if (!paymentsTenancyId) { setMsg(msg, t('need.tenancyFirst'), 'error'); return; }

  const category = document.getElementById('paymentCategory').value;
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const due = document.getElementById('paymentDue').value || null;
  const notes = document.getElementById('paymentNotes').value.trim() || null;
  const recurring = document.getElementById('paymentRecurring').checked;
  const file = document.getElementById('paymentFile').files[0] || null;

  if (file && file.size > MAX_UPLOAD_BYTES) { setMsg(msg, t('doc.tooBig'), 'error'); return; }

  if (recurring && !editingPaymentId) {
    // Without a first date there is nothing to step monthly from.
    if (!due) { setMsg(msg, t('pay.needDueDate'), 'error'); return; }
    const { data: created, error } = await sb.rpc('rental_create_recurring_payments', {
      p_tenancy_id: paymentsTenancyId,
      p_category: category,
      p_amount: amount,
      p_first_due: due,
      p_notes: notes
    });
    if (error) { reportFailure('payments.recurring', error, msg); return; }
    alert(t('pay.recurringDone', { count: created }));
  } else {
    let proofPath;
    if (file) {
      setMsg(msg, t('doc.uploading'), '');
      const { path, error: upErr } = await uploadTenancyFile(file, 'payments', paymentsTenancyId);
      if (upErr) { reportFailure('payments.upload', upErr, msg); return; }
      proofPath = path;
    }

    const payload = { category, amount, due_date: due, notes };
    if (proofPath) payload.proof_path = proofPath;

    const { error } = editingPaymentId
      ? await sb.from('rental_payments').update(payload).eq('id', editingPaymentId)
      : await sb.from('rental_payments').insert({
          ...payload, tenancy_id: paymentsTenancyId, created_by: currentUser.id
        });

    if (error) {
      // Do not leave the just-uploaded file behind if the row did not take it.
      if (proofPath) await sb.storage.from('rental-documents').remove([proofPath]);
      reportFailure(editingPaymentId ? 'payments.update' : 'payments.add', error, msg);
      return;
    }

    // Ticking "repeat" while editing turns this charge into the first of a
    // series: the charge itself is already saved, so generate the months after
    // it rather than duplicating it.
    if (recurring && editingPaymentId) {
      if (!due) { setMsg(msg, t('pay.recurringNeedsDue'), 'error'); return; }
      const { data: created, error: recErr } = await sb.rpc('rental_create_recurring_payments', {
        p_tenancy_id: paymentsTenancyId,
        p_category: category,
        p_amount: amount,
        p_first_due: nextMonth(due),
        p_notes: notes
      });
      if (recErr) { reportFailure('payments.recurringFromEdit', recErr, msg); return; }
      alert(t('pay.recurringFromEdit', { count: created }));
    }
  }

  cancelPaymentEdit();
  await refreshOwnerPayments();
});

async function refreshOwnerMaintenance() {
  fillTenancySelect('maintTenancy', maintTenancyId, 'maintForWho', 'maint.showing');
  await renderMaintenanceList('ownerMaintenanceList', true);
}

['maintTenancy', 'maintStatusFilter', 'maintPriorityFilter'].forEach(id => {
  document.getElementById(id).addEventListener('change', async (e) => {
    if (id === 'maintTenancy') maintTenancyId = e.target.value;
    maintShown.ownerMaintenanceList = MAINT_PAGE_SIZE;   // start at the top again
    await refreshOwnerMaintenance();
  });
});

document.getElementById('tenantMaintStatusFilter').addEventListener('change', () => {
  maintShown.tenantMaintenanceList = MAINT_PAGE_SIZE;
  refreshTenantMaintenance();
});

async function refreshOwnerMessages() {
  const tenancy = fillTenancySelect('messagesTenancy', messagesTenancyId, 'messagesForWho', 'msg.showing');
  if (!tenancy) {
    document.getElementById('ownerMessagesList').innerHTML = `<span class="muted">${t('need.tenancyFirst')}</span>`;
    return;
  }
  await renderMessages('ownerMessagesList', tenancy.id);
}

document.getElementById('messagesTenancy').addEventListener('change', async (e) => {
  messagesTenancyId = e.target.value;
  await refreshOwnerMessages();
});

document.getElementById('ownerMessageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!messagesTenancyId) { alert(t('need.tenancyFirst')); return; }
  const input = document.getElementById('ownerMessageInput');
  // "required" lets a run of spaces through, which stored an empty message.
  const body = input.value.trim();
  if (!body) { alert(t('msg.blank')); return; }
  const { error } = await sb.from('rental_messages')
    .insert({ tenancy_id: messagesTenancyId, author_id: currentUser.id, body });
  if (error) { reportFailure('messages.send', error); return; }
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
  el.innerHTML = entries.map((entry, index) => `
    <div class="list-item">
      <div class="main">
        <div class="title">${escapeHtml(entry.title)}</div>
        ${entry.body ? `<div class="sub">${escapeHtml(entry.body)}</div>` : ''}
      </div>
      <span class="pill ${entry.visible_to_guests ? 'paid' : 'pending'}">
        ${entry.visible_to_guests ? t('info.badgeGuest') : t('info.badgeTenantOnly')}
      </span>
      <button class="btn-small" data-move-info="${entry.id}" data-dir="-1"${
        index === 0 ? ' disabled' : ''}>${t('info.moveUp')}</button>
      <button class="btn-small" data-move-info="${entry.id}" data-dir="1"${
        index === entries.length - 1 ? ' disabled' : ''}>${t('info.moveDown')}</button>
      <button class="btn-small" data-edit-info="${entry.id}">${t('info.edit')}</button>
      <button class="btn-small danger" data-delete-info="${entry.id}">${t('info.delete')}</button>
    </div>`).join('');

  el.querySelectorAll('[data-edit-info]').forEach(btn => {
    btn.addEventListener('click', () => {
      startInfoEdit(entries.find(x => x.id === btn.getAttribute('data-edit-info')));
    });
  });

  // Swap sort_order with the neighbour rather than renumbering the whole list.
  el.querySelectorAll('[data-move-info]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-move-info');
      const dir = Number(btn.getAttribute('data-dir'));
      const from = entries.findIndex(x => x.id === id);
      const to = from + dir;
      if (to < 0 || to >= entries.length) return;
      const a = entries[from];
      const b = entries[to];
      const { error: e1 } = await sb.from('rental_property_info')
        .update({ sort_order: b.sort_order }).eq('id', a.id);
      const { error: e2 } = await sb.from('rental_property_info')
        .update({ sort_order: a.sort_order }).eq('id', b.id);
      if (e1 || e2) { reportFailure('info.reorder', e1 || e2); return; }
      await refreshPropertyInfo();
    });
  });

  el.querySelectorAll('[data-delete-info]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('info.deleteConfirm'))) return;
      await sb.from('rental_property_info').delete().eq('id', btn.getAttribute('data-delete-info'));
      await refreshPropertyInfo();
    });
  });
}

function startInfoEdit(entry) {
  if (!entry) return;
  editingInfoId = entry.id;
  document.getElementById('infoTitle').value = entry.title;
  document.getElementById('infoBody').value = entry.body || '';
  document.getElementById('infoVisibleToGuests').checked = entry.visible_to_guests;
  document.getElementById('infoEditWhat').textContent = t('info.editing', { title: entry.title });
  document.getElementById('infoEditNote').hidden = false;
  document.querySelector('#infoForm button[type=submit]').textContent = t('info.update');
  document.getElementById('infoForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelInfoEdit() {
  editingInfoId = null;
  document.getElementById('infoForm').reset();
  document.getElementById('infoVisibleToGuests').checked = true;
  document.getElementById('infoEditNote').hidden = true;
  document.querySelector('#infoForm button[type=submit]').textContent = t('info.add');
}

document.getElementById('cancelInfoEdit').addEventListener('click', cancelInfoEdit);

document.getElementById('infoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('infoTitle').value.trim(),
    body: document.getElementById('infoBody').value.trim() || null,
    visible_to_guests: document.getElementById('infoVisibleToGuests').checked
  };

  let error;
  if (editingInfoId) {
    ({ error } = await sb.from('rental_property_info').update(payload).eq('id', editingInfoId));
  } else {
    // Nothing ever set sort_order, so every entry sat at 0 and the list came
    // back in whatever order the database felt like. New entries go last.
    const { data: last } = await sb.from('rental_property_info')
      .select('sort_order').eq('property_id', currentProperty.id)
      .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    ({ error } = await sb.from('rental_property_info').insert({
      ...payload,
      property_id: currentProperty.id,
      sort_order: ((last && last.sort_order) || 0) + 1,
      created_by: currentUser.id
    }));
  }
  if (error) { reportFailure('info.save', error); return; }
  cancelInfoEdit();
  await refreshPropertyInfo();
});

// The guest page sits next to this one, with the code in the fragment so it is
// never sent to a server or leaked through a referrer.
function guestLinkFor(code) {
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
  return base + GUEST_PAGE + '#' + encodeURIComponent(code);
}

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
      ${invite.revoked_at ? '' : `<button class="btn-small" data-copy-link="${escapeHtml(invite.code)}">${t('gcode.copyLink')}</button>`}
      ${invite.revoked_at ? '' : `<button class="btn-small danger" data-revoke="${invite.id}">${t('gcode.revoke')}</button>`}
    </div>`;
  }).join('');

  el.querySelectorAll('[data-copy-link]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const link = guestLinkFor(btn.getAttribute('data-copy-link'));
      try {
        await navigator.clipboard.writeText(link);
        btn.textContent = t('gcode.copied');
        setTimeout(() => { btn.textContent = t('gcode.copyLink'); }, 2000);
      } catch (e) {
        // Clipboard access can be refused; show the link so it can be copied by hand.
        prompt(t('gcode.copyLink'), link);
      }
    });
  });

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
// Calendar
// ============================================================

const calendarMonth = { owner: null, tenant: null };
const calendarDay = { owner: null, tenant: null };

// Monday-first weekday initials, taken from the active locale rather than a
// hardcoded list. 2024-01-01 was a Monday.
function weekdayNames() {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(dateLocale(), { weekday: 'short' }));
}

// Everything dated that the reader is allowed to see, keyed by 'YYYY-MM-DD'.
async function collectEvents(prefix) {
  const tenancies = prefix === 'owner'
    ? allTenancies
    : (currentTenancy ? [currentTenancy] : []);
  if (tenancies.length === 0) return {};

  const events = {};
  const add = (date, kind, label) => {
    if (!date) return;
    const key = String(date).slice(0, 10);
    (events[key] = events[key] || []).push({ kind, label });
  };

  for (const tenancy of tenancies) {
    add(tenancy.start_date, 'lease', `${t('cal.leaseStart')} — ${tenancy.tenant_name || t('tenancy.defaultTenant')}`);
    add(tenancy.end_date, 'lease', `${t('cal.leaseEnd')} — ${tenancy.tenant_name || t('tenancy.defaultTenant')}`);
  }

  const { data: payments } = await sb.from('rental_payments')
    .select('*').in('tenancy_id', tenancies.map(x => x.id));
  (payments || []).forEach(p => {
    add(p.due_date, p.status === 'paid' ? 'paid' : 'due',
      `${categoryLabel(p.category)} — ${fmtMoney(p.amount)} · ${statusLabel(p.status)}`);
  });

  if (prefix === 'owner') {
    const { data: invites } = await sb.from('rental_guest_invites')
      .select('*').eq('property_id', currentProperty.id).is('revoked_at', null);
    (invites || []).forEach(g => {
      add(g.expires_at, 'guest', `${t('cal.guestExpires')} — ${g.label || g.code}`);
    });
  }
  return events;
}

async function renderCalendar(prefix) {
  if (!calendarMonth[prefix]) {
    const now = new Date();
    calendarMonth[prefix] = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const month = calendarMonth[prefix];
  const events = await collectEvents(prefix);

  document.getElementById(prefix + 'CalTitle').textContent =
    month.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });

  // Monday-first: getDay() is 0 for Sunday, so Sunday sits at the end.
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayKey = isoDate(new Date());

  let cells = weekdayNames().map(n => `<div class="cal-wd">${escapeHtml(n)}</div>`).join('');
  cells += Array.from({ length: firstWeekday }, () => '<div class="cal-cell empty"></div>').join('');

  for (let day = 1; day <= daysInMonth; day++) {
    const key = isoDate(new Date(month.getFullYear(), month.getMonth(), day));
    const dayEvents = events[key] || [];
    const kinds = [...new Set(dayEvents.map(e => e.kind))];
    cells += `
      <button type="button" class="cal-cell${key === todayKey ? ' today' : ''}${
        key === calendarDay[prefix] ? ' selected' : ''}" data-day="${key}">
        <span class="n">${day}</span>
        <span class="dots">${kinds.map(k => `<i class="dot ${k}"></i>`).join('')}</span>
      </button>`;
  }
  document.getElementById(prefix + 'CalGrid').innerHTML = cells;

  const dayEl = document.getElementById(prefix + 'CalDay');
  const selected = calendarDay[prefix];
  const list = selected ? (events[selected] || []) : [];
  if (!selected) {
    const monthHas = Object.keys(events).some(k => k.slice(0, 7) === isoDate(month).slice(0, 7));
    dayEl.innerHTML = `<span class="muted">${monthHas ? t('cal.legend') : t('cal.monthEmpty')}</span>`;
  } else if (list.length === 0) {
    dayEl.innerHTML = `<span class="muted">${t('cal.noEvents')}</span>`;
  } else {
    dayEl.innerHTML = `<div class="cal-day-head">${escapeHtml(fmtDate(selected))}</div>` +
      list.map(e => `
        <div class="list-item">
          <div class="main"><div class="title">${escapeHtml(e.label)}</div></div>
          <i class="dot ${e.kind}"></i>
        </div>`).join('');
  }

  document.getElementById(prefix + 'CalGrid').querySelectorAll('[data-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-day');
      calendarDay[prefix] = calendarDay[prefix] === key ? null : key;
      renderCalendar(prefix);
    });
  });
}

['owner', 'tenant'].forEach(prefix => {
  document.getElementById(prefix + 'CalPrev').addEventListener('click', () => {
    const m = calendarMonth[prefix] || new Date();
    calendarMonth[prefix] = new Date(m.getFullYear(), m.getMonth() - 1, 1);
    calendarDay[prefix] = null;
    renderCalendar(prefix);
  });
  document.getElementById(prefix + 'CalNext').addEventListener('click', () => {
    const m = calendarMonth[prefix] || new Date();
    calendarMonth[prefix] = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    calendarDay[prefix] = null;
    renderCalendar(prefix);
  });
  document.getElementById(prefix + 'CalToday').addEventListener('click', () => {
    const now = new Date();
    calendarMonth[prefix] = new Date(now.getFullYear(), now.getMonth(), 1);
    calendarDay[prefix] = isoDate(now);
    renderCalendar(prefix);
  });
});

// ============================================================
// Documents (owner and tenant share this)
// ============================================================

function docCategoryLabel(v) { return enumLabel('doccat', v); }

// Property documents outlive tenancies; tenancy documents die with them.
async function renderDocumentList(el, filter, canManage, emptyText) {
  const { data: docs, error } = await sb.from('rental_documents')
    .select('*').match(filter).order('created_at', { ascending: false });
  if (error) { reportFailure('documents.load', error); return; }

  el.innerHTML = (!docs || docs.length === 0)
    ? `<span class="muted">${emptyText}</span>`
    : docs.map(d => `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(d.title)}</div>
          <div class="sub">${docCategoryLabel(d.category)} · ${fmtDate(d.created_at)}</div>
        </div>
        <button class="btn-small" data-open-doc="${d.id}" data-path="${escapeHtml(d.storage_path)}">${t('doc.open')}</button>
        ${canManage ? `<button class="btn-small danger" data-del-doc="${d.id}" data-path="${escapeHtml(d.storage_path)}">${t('doc.delete')}</button>` : ''}
      </div>`).join('');

  el.querySelectorAll('[data-open-doc]').forEach(btn => {
    btn.addEventListener('click', () => openStoredFile(btn.getAttribute('data-path')));
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
      await refreshDocuments(canManage ? 'owner' : 'tenant');
    });
  });
}

async function refreshDocuments(prefix) {
  const canManage = prefix === 'owner';

  await renderDocumentList(
    document.getElementById(prefix + 'PropDocList'),
    { property_id: currentProperty.id }, canManage, t('doc.propertyEmpty'));

  const tenancy = canManage
    ? fillTenancySelect('docsTenancy', docsTenancyId, 'docsForWho', 'doc.showing')
    : currentTenancy;
  const el = document.getElementById(prefix + 'DocList');
  if (!tenancy) {
    el.innerHTML = `<span class="muted">${t('need.tenancyFirst')}</span>`;
    return;
  }
  await renderDocumentList(el, { tenancy_id: tenancy.id }, canManage, t('doc.empty'));
}

function wireDocumentUpload(prefix) {
  document.getElementById(prefix + 'DocForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById(prefix + 'DocMsg');
    const scope = document.getElementById(prefix + 'DocScope').value;
    if (scope === 'tenancy' && !docsTenancyId) { setMsg(msg, t('need.tenancyFirst'), 'error'); return; }

    const file = document.getElementById(prefix + 'DocFile').files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setMsg(msg, t('doc.tooBig'), 'error'); return; }

    setMsg(msg, t('doc.uploading'), '');
    // Property files sit under property/<id>/ so the storage policies can tell
    // the two kinds apart by path.
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    const path = scope === 'property'
      ? `property/${currentProperty.id}/${crypto.randomUUID()}${ext}`
      : `${docsTenancyId}/documents/${crypto.randomUUID()}${ext}`;

    const { error: upErr } = await sb.storage.from('rental-documents').upload(path, file);
    if (upErr) { reportFailure('documents.upload', upErr, msg); return; }

    const { error: rowErr } = await sb.from('rental_documents').insert({
      tenancy_id: scope === 'tenancy' ? docsTenancyId : null,
      property_id: scope === 'property' ? currentProperty.id : null,
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

// Only the owner uploads; the tenant's tab is a read-only list.
document.getElementById('docsTenancy').addEventListener('change', async (e) => {
  docsTenancyId = e.target.value;
  await refreshDocuments('owner');
});

wireDocumentUpload('owner');

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
// TENANT DASHBOARD
// ============================================================

// Read-only list of the property information. RLS decides which entries a
// tenant gets back, so the query needs no role handling of its own.
async function renderInfoList(containerId) {
  const el = document.getElementById(containerId);
  const { data: entries, error } = await sb.from('rental_property_info')
    .select('*').eq('property_id', currentProperty.id)
    .order('sort_order', { ascending: true });
  if (error) { reportFailure('info.load', error); return; }

  el.innerHTML = (!entries || entries.length === 0)
    ? `<span class="muted">${t('guest.empty')}</span>`
    : entries.map(entry => `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(entry.title)}</div>
          ${entry.body ? `<div class="sub">${escapeHtml(entry.body)}</div>` : ''}
        </div>
      </div>`).join('');
}

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
  await renderCalendar('tenant');
}

async function refreshTenantPayments() {
  const listEl = document.getElementById('tenantPaymentsList');
  const sumEl = document.getElementById('tenantPaySummary');
  if (!currentTenancy) {
    sumEl.innerHTML = '';
    listEl.innerHTML = `<span class="muted">${t('need.noActiveTenancy')}</span>`;
    return;
  }
  const { data: rows, error } = await sb.from('rental_payments')
    .select('*').eq('tenancy_id', currentTenancy.id)
    .order('due_date', { ascending: false, nullsFirst: false });
  if (error) { reportFailure('payments.load', error); return; }

  if (!rows || rows.length === 0) {
    sumEl.innerHTML = '';
    listEl.innerHTML = `<span class="muted">${t('pay.empty')}</span>`;
    return;
  }

  // What is actually owed, before any filter narrows the list. A recurring
  // charge writes one row per month to the end of the lease, so a single total
  // of "everything unpaid" would read €6,600 the day a year of rent is
  // scheduled — money that is not wanted yet. Split it by when it is due.
  const unpaid = rows.filter(p => p.status !== 'paid');
  const buckets = { overdue: [], soon: [], scheduled: [] };
  unpaid.forEach(p => buckets[payBucket(p)].push(p));
  const total = (list) => list.reduce((sum, p) => sum + Number(p.amount), 0);
  const bucketPill = (cls, key, list) => list.length
    ? `<span class="pill ${cls}">${t(key, { amount: fmtMoney(total(list)), count: list.length })}</span>`
    : '';
  // The single next obligation, named with its amount — the second question a
  // tenant actually has after "do I owe anything now?".
  const nextUp = unpaid
    .filter(p => p.due_date && !isOverdue(p))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  // Deliberately no total for the scheduled months. It is a true number that
  // answers a question nobody asked, and reads as a debt that is not owed. The
  // list below carries every one of them for anyone who wants to look.
  sumEl.innerHTML = unpaid.length === 0
    ? `<span class="pill paid">${t('pay.allSettled')}</span>`
    : [
        bucketPill('overdue', 'pay.overdueCount', buckets.overdue),
        bucketPill('pending', 'pay.dueSoon', buckets.soon),
        nextUp ? `<span class="pill low">${t('pay.nextDue', { amount: fmtMoney(nextUp.amount), date: fmtDate(nextUp.due_date) })}</span>` : ''
      ].join('');

  const statusFilter = document.getElementById('tenantStatusFilter').value;
  const categoryFilter = document.getElementById('tenantCategoryFilter').value;
  const payments = rows.filter(p =>
    (statusFilter === 'all' || effectiveStatus(p) === statusFilter) &&
    (categoryFilter === 'all' || p.category === categoryFilter));

  if (payments.length === 0) {
    listEl.innerHTML = `<span class="muted">${t('pay.noneForFilter')}</span>`;
    return;
  }

  const narrowed = statusFilter !== 'all' || categoryFilter !== 'all';
  const render = narrowed ? paymentFlatHtml : paymentSectionsHtml;
  listEl.innerHTML = render('tenantPaymentsList', payments, p => `
    <div class="list-item">
      <div class="main">
        <div class="title">${categoryLabel(p.category)} — ${fmtMoney(p.amount)}</div>
        <div class="sub">${[
          p.due_date ? t('pay.dueLabel') + ': ' + fmtDate(p.due_date) : '',
          p.paid_on ? t('pay.paidLabel') + ': ' + fmtDate(p.paid_on) : '',
          p.notes ? escapeHtml(p.notes) : ''
        ].filter(Boolean).join(' · ')}</div>
      </div>
      <span class="pill ${effectiveStatus(p)}">${statusLabel(effectiveStatus(p))}</span>
      ${p.proof_path ? `<button class="btn-small" data-open-proof="${escapeHtml(p.proof_path)}">${t('pay.openAttachment')}</button>` : ''}
    </div>`);

  wirePaymentList(listEl, 'tenantPaymentsList', refreshTenantPayments);

  listEl.querySelectorAll('[data-open-proof]').forEach(btn => {
    btn.addEventListener('click', () => openStoredFile(btn.getAttribute('data-open-proof')));
  });
}

['tenantStatusFilter', 'tenantCategoryFilter'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    payShown.tenantPaymentsList = freshPayState();   // a new filter starts fresh
    refreshTenantPayments();
  });
});

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
  const files = Array.from(document.getElementById('maintPhotos').files || []);
  const msg = document.getElementById('maintMsg');
  if (files.length > MAX_PHOTOS) { setMsg(msg, t('maint.photosTooMany'), 'error'); return; }
  if (files.some(f => f.size > MAX_UPLOAD_BYTES)) { setMsg(msg, t('doc.tooBig'), 'error'); return; }

  const { data: created, error } = await sb.from('rental_maintenance_requests')
    .insert(payload).select().single();
  if (error) { reportFailure('maintenance.add', error, msg); return; }

  if (files.length) {
    setMsg(msg, t('maint.uploadingPhotos'), '');
    for (const file of files) {
      const { path, error: upErr } = await uploadTenancyFile(file, 'maintenance', currentTenancy.id);
      if (upErr) { reportFailure('maintenance.photoUpload', upErr, msg); return; }
      const { error: rowErr } = await sb.from('rental_maintenance_photos')
        .insert({ request_id: created.id, storage_path: path, uploaded_by: currentUser.id });
      if (rowErr) {
        await sb.storage.from('rental-documents').remove([path]);
        reportFailure('maintenance.photoRow', rowErr, msg);
        return;
      }
    }
  }

  e.target.reset();
  setMsg(msg, '', '');
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
  const body = input.value.trim();
  if (!body) { alert(t('msg.blank')); return; }
  const { error } = await sb.from('rental_messages')
    .insert({ tenancy_id: currentTenancy.id, author_id: currentUser.id, body });
  if (error) { reportFailure('messages.send', error); return; }
  input.value = '';
  await refreshTenantMessages();
});

// ============================================================
// Shared: Maintenance list + comments (used by both dashboards)
// ============================================================

// ---- Maintenance history: pageable, with foldable conversations -----------
const MAINT_PAGE_SIZE = 10;
// With only a handful of reports on screen every conversation is worth reading
// at once; past that the page turns into a wall of replies.
const MAINT_AUTO_OPEN_MAX = 3;
const COMMENT_PREVIEW = 3;
const maintShown = { ownerMaintenanceList: MAINT_PAGE_SIZE, tenantMaintenanceList: MAINT_PAGE_SIZE };
const openConversations = new Set();    // opened by hand, against the default
const closedConversations = new Set();  // folded by hand, against the default
const fullComments = new Set();         // showing every reply, not just the tail

// The status is the single source of truth for whether the work is done; a
// stale completion date must never contradict it on screen.
function isSettled(r) { return r.status === 'resolved' || r.status === 'closed'; }

function commentCountLabel(n) {
  if (n === 0) return t('maint.noComments');
  return n === 1 ? t('maint.commentCountOne') : t('maint.commentCount', { count: n });
}

async function renderMaintenanceList(containerId, isOwner) {
  const el = document.getElementById(containerId);

  // The owner picks a tenancy; the tenant only ever has their own.
  const tenancyId = isOwner ? maintTenancyId : (currentTenancy || {}).id;
  if (!tenancyId) {
    el.innerHTML = `<span class="muted">${isOwner ? t('need.tenancyFirst') : t('need.noActiveTenancy')}</span>`;
    return;
  }

  const { data: all, error } = await sb.from('rental_maintenance_requests')
    .select('*').eq('tenancy_id', tenancyId).order('created_at', { ascending: false });
  if (error) { reportFailure('maintenance.load', error); return; }

  if (!all || all.length === 0) {
    el.innerHTML = `<span class="muted">${t('maint.empty')}</span>`;
    return;
  }

  const statusFilter = document.getElementById(
    isOwner ? 'maintStatusFilter' : 'tenantMaintStatusFilter').value;
  const priorityFilter = isOwner ? document.getElementById('maintPriorityFilter').value : 'all';
  const requests = all.filter(r =>
    (statusFilter === 'all' || r.status === statusFilter) &&
    (priorityFilter === 'all' || r.priority === priorityFilter));

  if (requests.length === 0) {
    el.innerHTML = `<span class="muted">${t('maint.noneForFilter')}</span>`;
    return;
  }

  const shown = Math.max(maintShown[containerId] || MAINT_PAGE_SIZE, 1);
  const page = requests.slice(0, shown);
  // Every conversation open at once only reads well while there are few reports.
  const autoOpen = page.length <= MAINT_AUTO_OPEN_MAX;

  el.innerHTML = page.map(r => `
    <div class="request-card" data-request-id="${r.id}">
      <div class="head">
        <div>
          <div class="title">${escapeHtml(r.title)}</div>
          <div class="sub">${fmtDate(r.created_at)}${isSettled(r) && r.resolved_at ? ' · ' + t('maint.resolvedOn', { date: fmtDate(r.resolved_at) }) : ''}</div>
        </div>
        <div>
          <span class="pill ${r.priority}">${priorityLabel(r.priority)}</span>
          <span class="pill ${r.status}">${statusLabel(r.status)}</span>
        </div>
      </div>
      ${r.description ? `<div class="desc">${escapeHtml(r.description)}</div>` : ''}
      <div class="photo-strip" data-photos></div>
      ${isOwner ? `
        <div class="status-actions">
          ${['open', 'in_progress', 'resolved', 'closed'].map(s => `
            <button class="btn-small" data-set-status="${s}" ${r.status === s ? 'disabled' : ''}>${statusLabel(s)}</button>
          `).join('')}
          <button class="btn-small danger" data-delete-request="${escapeHtml(r.title)}">${t('maint.deleteReport')}</button>
        </div>` : ''}
      <div class="convo" data-convo></div>
    </div>
  `).join('');

  if (page.length < requests.length) {
    el.insertAdjacentHTML('beforeend', `<div class="list-more">
      <span class="muted">${t('list.showingCount', { shown: page.length, total: requests.length })}</span>
      <button class="btn-small" data-load-more>${t('list.loadMore')}</button>
    </div>`);
    el.querySelector('[data-load-more]').addEventListener('click', () => {
      maintShown[containerId] = shown + MAINT_PAGE_SIZE;
      renderMaintenanceList(containerId, isOwner);
    });
  }

  // One query for every card's reply count, rather than one query per card.
  const counts = {};
  const { data: commentRows } = await sb.from('rental_maintenance_comments')
    .select('request_id').in('request_id', page.map(r => r.id));
  (commentRows || []).forEach(c => { counts[c.request_id] = (counts[c.request_id] || 0) + 1; });

  el.querySelectorAll('[data-request-id]').forEach(card => {
    const requestId = card.getAttribute('data-request-id');
    renderConversation(card, requestId, counts[requestId] || 0,
      openConversations.has(requestId) || (autoOpen && !closedConversations.has(requestId)));
    loadPhotos(card, requestId);

    const delBtn = card.querySelector('[data-delete-request]');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm(t('maint.deleteConfirm', { title: delBtn.getAttribute('data-delete-request') }))) return;
        // Comments and photo rows cascade, but the image files do not.
        const { data: photos } = await sb.from('rental_maintenance_photos')
          .select('storage_path').eq('request_id', requestId);
        const paths = (photos || []).map(ph => ph.storage_path).filter(Boolean);
        if (paths.length) await sb.storage.from('rental-documents').remove(paths);
        const { error: delErr } = await sb.from('rental_maintenance_requests').delete().eq('id', requestId);
        if (delErr) { reportFailure('maintenance.delete', delErr); return; }
        await renderMaintenanceList(containerId, isOwner);
      });
    }

    card.querySelectorAll('[data-set-status]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.getAttribute('data-set-status');
        const patch = { status: newStatus, updated_at: new Date().toISOString() };
        // Sending a report back to open work clears the completion date, so a
        // card can never read "Resolved 10/09" beside IN PROGRESS. Closing one
        // keeps it: the work really was finished on that date.
        if (newStatus === 'resolved') patch.resolved_at = new Date().toISOString();
        else if (newStatus !== 'closed') patch.resolved_at = null;
        await sb.from('rental_maintenance_requests').update(patch).eq('id', requestId);
        await renderMaintenanceList(containerId, isOwner);
      });
    });
  });
}

// The conversation is a section of its own, folded away when there are enough
// reports on screen that the replies would drown the reports themselves.
function renderConversation(card, requestId, count, open) {
  const el = card.querySelector('[data-convo]');
  if (!open) {
    el.innerHTML = `<div class="convo-collapsed">
      <span class="muted">${commentCountLabel(count)}</span>
      <button class="btn-small" data-open-convo>${count ? t('maint.viewConversation') : t('maint.startConversation')}</button>
    </div>`;
    el.querySelector('[data-open-convo]').addEventListener('click', () => {
      openConversations.add(requestId);
      closedConversations.delete(requestId);
      renderConversation(card, requestId, count, true);
    });
    return;
  }

  el.innerHTML = `
    <div class="convo-head">
      <span class="section-head">${t('maint.conversation')}</span>
      <button type="button" class="btn-link" data-close-convo>${t('maint.hideConversation')}</button>
    </div>
    <div class="comments" data-comments></div>
    <form class="comment-form" data-comment-form>
      <input type="text" placeholder="${t('maint.commentPlaceholder')}" required>
      <button type="submit" class="btn-small">${t('maint.reply')}</button>
    </form>`;

  el.querySelector('[data-close-convo]').addEventListener('click', () => {
    closedConversations.add(requestId);
    openConversations.delete(requestId);
    renderConversation(card, requestId, count, false);
  });

  el.querySelector('[data-comment-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const body = input.value.trim();
    if (!body) return;   // 'required' lets a run of spaces through
    const { error } = await sb.from('rental_maintenance_comments').insert({
      request_id: requestId, author_id: currentUser.id, body
    });
    if (error) { reportFailure('maintenance.comment', error); return; }
    input.value = '';
    loadComments(card, requestId);
  });

  loadComments(card, requestId);
}

// The bucket is private, so thumbnails need signed URLs of their own.
async function loadPhotos(card, requestId) {
  const el = card.querySelector('[data-photos]');
  const { data: photos } = await sb.from('rental_maintenance_photos')
    .select('*').eq('request_id', requestId).order('created_at');
  if (!photos || photos.length === 0) { el.innerHTML = ''; return; }

  const { data: signed } = await sb.storage.from('rental-documents')
    .createSignedUrls(photos.map(p => p.storage_path), 300);
  el.innerHTML = (signed || [])
    .filter(item => item.signedUrl)
    .map(item => `<a href="${item.signedUrl}" target="_blank" rel="noopener">
        <img src="${item.signedUrl}" alt="" loading="lazy"></a>`).join('');
}

async function loadComments(card, requestId) {
  const { data: comments } = await sb.from('rental_maintenance_comments')
    .select('*').eq('request_id', requestId).order('created_at', { ascending: true });
  const el = card.querySelector('[data-comments]');
  if (!el) return;   // the conversation was folded away while this was loading
  if (!comments || comments.length === 0) {
    el.innerHTML = `<span class="muted">${t('maint.noComments')}</span>`;
    return;
  }

  // A fault that drags on collects dozens of replies; show the latest few and
  // let the reader ask for the rest.
  const showAll = fullComments.has(requestId) || comments.length <= COMMENT_PREVIEW;
  const visible = showAll ? comments : comments.slice(-COMMENT_PREVIEW);
  el.innerHTML =
    (showAll ? '' : `<button type="button" class="btn-small" data-show-all>${t('maint.showAllComments', { count: comments.length })}</button>`)
    + visible.map(c => `
    <div class="comment">
      <span class="author">${c.author_id === currentUser.id ? t('party.you') : otherPartyLabel()}</span>
      <span class="comment-time">${fmtChatTime(c.created_at)}</span>
      <div class="comment-body">${escapeHtml(c.body)}</div>
    </div>`).join('');

  const allBtn = el.querySelector('[data-show-all]');
  if (allBtn) allBtn.addEventListener('click', () => {
    fullComments.add(requestId);
    loadComments(card, requestId);
  });
}

// ============================================================
// Shared: Messages thread
// ============================================================

// A thread grows without limit, so only the tail is laid out; a chat reads
// from the bottom up, which is why this pages backwards rather than forwards.
const MSG_PAGE_SIZE = 30;
const msgShown = { ownerMessagesList: MSG_PAGE_SIZE, tenantMessagesList: MSG_PAGE_SIZE };
const MSG_TAB = {
  ownerMessagesList: '#view-owner .tab-btn[data-tab="messages"]',
  tenantMessagesList: '#view-tenant .tab-btn[data-tab="t-messages"]'
};

// What this device has already shown the reader. Kept locally: an unread mark
// is a property of the device, not of the tenancy, and needs no schema.
function seenKey(tenancyId) { return 'zanos_msgseen_' + tenancyId; }
function lastSeen(tenancyId) {
  try { return localStorage.getItem(seenKey(tenancyId)) || ''; } catch (e) { return ''; }
}
function markMessagesSeen(tenancyId, isoTime) {
  try { localStorage.setItem(seenKey(tenancyId), isoTime); } catch (e) { /* private window */ }
}

// The count rides on a data attribute, not on the button's text, which the
// language switch rewrites wholesale.
function setTabBadge(selector, count) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  if (count > 0) btn.dataset.badge = count > 9 ? '9+' : String(count);
  else delete btn.dataset.badge;
}

async function renderMessages(containerId, tenancyId, keepPosition) {
  const el = document.getElementById(containerId);
  const { data: messages } = await sb.from('rental_messages')
    .select('*').eq('tenancy_id', tenancyId).order('created_at', { ascending: true });
  if (!messages || messages.length === 0) {
    el.innerHTML = `<span class="muted">${t('msg.empty')}</span>`;
    setTabBadge(MSG_TAB[containerId], 0);
    return;
  }

  const newest = messages[messages.length - 1].created_at;
  el.dataset.tenancy = tenancyId;
  el.dataset.newest = newest;

  // Only the other side's messages can be unread, and only those this device
  // has not already had on screen.
  if (el.offsetParent !== null) {          // the tab is open; they are reading it
    markMessagesSeen(tenancyId, newest);
    setTabBadge(MSG_TAB[containerId], 0);
  } else {
    const seen = lastSeen(tenancyId);
    setTabBadge(MSG_TAB[containerId],
      messages.filter(m => m.author_id !== currentUser.id && m.created_at > seen).length);
  }

  const shown = Math.max(msgShown[containerId] || MSG_PAGE_SIZE, 1);
  const visible = messages.slice(-shown);
  const wasHeight = el.scrollHeight;
  const wasTop = el.scrollTop;

  el.innerHTML =
    (visible.length < messages.length
      ? `<button type="button" class="btn-small" data-load-earlier>${t('msg.loadEarlier')}</button>`
      : '')
    + visible.map(m => {
      const mine = m.author_id === currentUser.id;
      return `
    <div class="message-bubble ${mine ? 'mine' : 'theirs'}">
      <div class="sender">${mine ? t('party.you') : otherPartyLabel()}</div>
      ${escapeHtml(m.body)}
      <div class="meta">${fmtChatTime(m.created_at)}</div>
    </div>`;
    }).join('');

  const earlier = el.querySelector('[data-load-earlier]');
  if (earlier) earlier.addEventListener('click', () => {
    msgShown[containerId] = shown + MSG_PAGE_SIZE;
    renderMessages(containerId, tenancyId, true);
  });

  // Reading back through the history should not throw the reader to the end.
  el.scrollTop = keepPosition ? el.scrollHeight - wasHeight + wasTop : el.scrollHeight;
}

// ============================================================
// Boot sequence
// ============================================================

async function boot() {
  showView('view-loading');

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    currentUser = null;
    document.getElementById('userBox').hidden = true;
    document.getElementById('passwordPanel').hidden = true;
    // A guest is identified by their code alone, with no account at all.
    document.getElementById('signupCard').hidden = true;
    document.getElementById('signinCard').hidden = false;
    showView('view-login');
    return;
  }

  currentUser = session.user;
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

sb.auth.onAuthStateChange(async (event) => {
  await boot();
  if (event === 'PASSWORD_RECOVERY') {
    document.getElementById('passwordPanel').hidden = false;
    document.getElementById('accountHint').textContent = t('account.recoveryHint');
    document.getElementById('passwordPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// ---------- Language ----------
// i18n.js repaints the static labels and owns the switcher; here we re-render
// the data-driven lists so they pick up the new language too.
document.addEventListener('langchange', () => { boot(); });

boot();

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
async function sendMagicLink(email) {
  return sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const msg = document.getElementById('loginMsg');
  setMsg(msg, t('login.sending'), '');
  const { error } = await sendMagicLink(email);
  if (error) setMsg(msg, t('error', { msg: error.message }), 'error');
  else setMsg(msg, t('login.sent'), 'ok');
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
  if (error) { setMsg(msg, t('error', { msg: error.message }), 'error'); return; }
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
        <button class="btn-small danger" data-end-tenancy="${active.id}">${t('tenancy.endBtn')}</button>
      </div>`;
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
    internet_monthly: parseFloat(document.getElementById('internetMonthly').value) || null,
    created_by: currentUser.id
  };
  const { error } = await sb.from('rental_tenancies').insert(payload);
  if (error) { alert(t('error', { msg: error.message })); return; }
  e.target.reset();
  await refreshTenancies();
});

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
  const payload = {
    tenancy_id: currentTenancy.id,
    category: document.getElementById('paymentCategory').value,
    amount: parseFloat(document.getElementById('paymentAmount').value),
    due_date: document.getElementById('paymentDue').value || null,
    notes: document.getElementById('paymentNotes').value.trim() || null,
    created_by: currentUser.id
  };
  const { error } = await sb.from('rental_payments').insert(payload);
  if (error) { alert(t('error', { msg: error.message })); return; }
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
      <span class="author">${c.author_id === currentUser.id ? t('maint.you') : t('maint.other')}:</span>
      ${escapeHtml(c.body)}
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
  el.innerHTML = messages.map(m => `
    <div class="message-bubble ${m.author_id === currentUser.id ? 'mine' : 'theirs'}">
      ${escapeHtml(m.body)}
      <div class="meta">${fmtDateTime(m.created_at)}</div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

// ============================================================
// Boot sequence
// ============================================================

async function boot() {
  showView('view-loading');

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    document.getElementById('userBox').hidden = true;
    showView('view-login');
    return;
  }

  currentUser = session.user;
  document.getElementById('userBox').hidden = false;
  document.getElementById('userEmail').textContent = currentUser.email;

  const { data: membership } = await sb.from('rental_property_members')
    .select('*').eq('user_id', currentUser.id).limit(1).maybeSingle();

  if (!membership) {
    showView('view-onboarding');
    return;
  }
  currentMembership = membership;

  const { data: property } = await sb.from('rental_properties')
    .select('*').eq('id', membership.property_id).single();
  currentProperty = property;

  if (membership.role === 'owner') {
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

// ============================================================
// Zanos City — guest page
// Read-only, no account. The code alone is the credential and it arrives in the
// URL fragment. This page deliberately shares nothing with the owner/tenant app
// beyond the stylesheet and the translations.
// ============================================================

const SUPABASE_URL = 'https://fwkchszqkosjyesmsvlj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kjWHvwntT1U__wY_5K0F1w_cd_YhBT9';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GUEST_CODE_KEY = 'zanos_guest_code';

function showSection(id) {
  document.querySelectorAll('.view').forEach(v => v.hidden = (v.id !== id));
}

function setMsg(el, text, kind) {
  el.textContent = text;
  el.className = 'msg' + (kind ? ' ' + kind : '');
  el.hidden = !text;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function storedCode() {
  try { return localStorage.getItem(GUEST_CODE_KEY); } catch (e) { return null; }
}
function rememberCode(code) {
  try { localStorage.setItem(GUEST_CODE_KEY, code); } catch (e) { /* private mode */ }
}
function forgetCode() {
  try { localStorage.removeItem(GUEST_CODE_KEY); } catch (e) { /* private mode */ }
}

// Returns false for an unknown, revoked or expired code.
async function showInfo(code) {
  const { data: rows, error } = await sb.rpc('rental_guest_view', { p_code: code });
  if (error || !rows || rows.length === 0) return false;

  document.getElementById('guestPropName').textContent = rows[0].property_name;
  document.getElementById('guestPropAddress').textContent = rows[0].property_address || '';

  const entries = rows.filter(r => r.entry_title);
  document.getElementById('guestInfoList').innerHTML = entries.length === 0
    ? `<span class="muted">${t('guest.empty')}</span>`
    : entries.map(r => `
      <div class="list-item">
        <div class="main">
          <div class="title">${escapeHtml(r.entry_title)}</div>
          ${r.entry_body ? `<div class="sub">${escapeHtml(r.entry_body)}</div>` : ''}
        </div>
      </div>`).join('');

  showSection('guest-info');
  return true;
}

document.getElementById('guestCodeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('guestCodeInput').value.trim();
  const msg = document.getElementById('guestMsg');
  setMsg(msg, t('onb.guest.redeeming'), '');
  if (await showInfo(code)) {
    rememberCode(code);
    setMsg(msg, '', '');
  } else {
    setMsg(msg, t('onb.guest.invalid'), 'error');
  }
});

async function boot() {
  showSection('guest-loading');

  // The link wins over anything remembered, so a new code replaces an old one.
  const fromLink = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
  const code = fromLink || storedCode();

  if (code && await showInfo(code)) {
    if (fromLink) rememberCode(fromLink);
    return;
  }

  if (code) {
    forgetCode();
    setMsg(document.getElementById('guestMsg'), t('onb.guest.invalid'), 'error');
  }
  showSection('guest-code');
}

document.addEventListener('langchange', boot);
window.addEventListener('hashchange', boot);
boot();

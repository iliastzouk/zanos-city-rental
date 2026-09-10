// ============================================================
// Zanos City — i18n (el / en)
// ============================================================

const SUPPORTED_LANGS = ['el', 'en'];
const DEFAULT_LANG = 'el';
const LANG_STORAGE_KEY = 'zanos_lang';

const DATE_LOCALES = { el: 'el-GR', en: 'en-GB' };

const TRANSLATIONS = {
  el: {
    'app.title': 'Zanos City — Διαχείριση Ενοικίασης',
    'brand': '🏠 Zanos City — Διαχείριση',
    'signOut': 'Αποσύνδεση',
    'lang.other': 'EN',

    'login.title': 'Σύνδεση',
    'login.hint': 'Θα σου στείλουμε ένα link σύνδεσης στο email σου — χωρίς κωδικό.',
    'login.emailPlaceholder': 'you@email.com',
    'login.submit': 'Στείλε μου link σύνδεσης',
    'login.sending': 'Αποστολή...',
    'login.sent': 'Έλεγξε το email σου για το link σύνδεσης.',

    'loading': 'Φόρτωση…',

    'onb.owner.title': 'Είμαι ο ιδιοκτήτης',
    'onb.owner.hint': 'Φτιάξε το ακίνητο και πάρε έναν κωδικό πρόσκλησης για τον ενοικιαστή.',
    'onb.owner.nameLabel': 'Όνομα ακινήτου',
    'onb.owner.addrLabel': 'Διεύθυνση (προαιρετικό)',
    'onb.owner.addrPlaceholder': 'Αγλαντζιά, Λευκωσία',
    'onb.owner.submit': 'Δημιουργία ακινήτου',
    'onb.tenant.title': 'Είμαι ο ενοικιαστής',
    'onb.tenant.hint': 'Έχεις κωδικό πρόσκλησης από τον ιδιοκτήτη; Βάλ\' τον εδώ.',
    'onb.tenant.codeLabel': 'Κωδικός πρόσκλησης',
    'onb.tenant.codePlaceholder': 'π.χ. A1B2C3D4E5',
    'onb.tenant.submit': 'Σύνδεση με το ακίνητο',
    'onb.creating': 'Δημιουργία...',
    'onb.joining': 'Σύνδεση...',
    'onb.invalidCode': 'Μη έγκυρος κωδικός.',
    'onb.notAllowed': 'Ο λογαριασμός σου δεν έχει δικαίωμα δημιουργίας ακινήτου. Αν είσαι ενοικιαστής, ζήτα κωδικό πρόσκλησης από τον ιδιοκτήτη.',

    'owner.inviteLabel': 'Κωδικός πρόσκλησης ενοικιαστή',

    'tab.tenancy': 'Μίσθωση',
    'tab.payments': 'Πληρωμές',
    'tab.maintenance': 'Βλάβες',
    'tab.messages': 'Μηνύματα',

    'tenancy.currentTitle': 'Τρέχουσα μίσθωση',
    'tenancy.none': 'Δεν υπάρχει ενεργή μίσθωση αυτή τη στιγμή.',
    'tenancy.formTitle': 'Νέα / Επεξεργασία μίσθωσης',
    'tenancy.tenantName': 'Όνομα ενοικιαστή',
    'tenancy.tenantNamePlaceholder': 'π.χ. Γιάννης Παπαδόπουλος',
    'tenancy.tenantEmail': 'Email ενοικιαστή (προαιρετικό, για αναφορά)',
    'tenancy.tenantEmailPlaceholder': 'tenant@email.com',
    'tenancy.start': 'Έναρξη μίσθωσης',
    'tenancy.end': 'Λήξη μίσθωσης',
    'tenancy.rent': 'Ενοίκιο (€/μήνα)',
    'tenancy.commonYearly': 'Κοινόχρηστα (€/έτος)',
    'tenancy.internetMonthly': 'Internet (€/μήνα)',
    'tenancy.save': 'Αποθήκευση μίσθωσης',
    'tenancy.historyTitle': 'Ιστορικό μισθώσεων',
    'tenancy.historyEmpty': 'Καμία καταχώρηση ακόμα.',
    'tenancy.endBtn': 'Λήξη μίσθωσης',
    'tenancy.endConfirm': 'Να χαρακτηριστεί αυτή η μίσθωση ως ολοκληρωμένη;',
    'tenancy.defaultTenant': 'Ενοικιαστής',
    'tenancy.rentLine': 'Ενοίκιο {amount}/μήνα',
    'tenancy.statusActive': 'Ενεργή',
    'tenancy.statusEnded': 'Ολοκληρώθηκε',

    'pay.formTitle': 'Νέα καταχώρηση πληρωμής',
    'pay.category': 'Κατηγορία',
    'pay.amount': 'Ποσό (€)',
    'pay.due': 'Προθεσμία',
    'pay.notes': 'Σημειώσεις',
    'pay.notesPlaceholder': 'π.χ. Ενοίκιο Νοεμβρίου',
    'pay.submit': 'Καταχώρηση',
    'pay.listTitle': 'Πληρωμές',
    'pay.myTitle': 'Πληρωμές μου',
    'pay.empty': 'Καμία πληρωμή ακόμα.',
    'pay.markPaid': 'Σήμανση ως πληρωμένο',
    'pay.dueLabel': 'Προθεσμία',
    'pay.paidLabel': 'Πληρώθηκε',

    'maint.ownerTitle': 'Αναφορές βλαβών',
    'maint.formTitle': 'Αναφορά νέας βλάβης',
    'maint.title': 'Τίτλος',
    'maint.titlePlaceholder': 'π.χ. Βλάβη στο boiler',
    'maint.description': 'Περιγραφή',
    'maint.descriptionPlaceholder': 'Περιέγραψε το πρόβλημα…',
    'maint.priority': 'Προτεραιότητα',
    'maint.submit': 'Αποστολή αναφοράς',
    'maint.myTitle': 'Οι αναφορές μου',
    'maint.empty': 'Καμία αναφορά ακόμα.',
    'maint.commentPlaceholder': 'Σχόλιο…',
    'maint.reply': 'Απάντηση',
    'maint.you': 'Εσύ',
    'maint.other': 'Ο άλλος',

    'msg.ownerTitle': 'Μηνύματα με τον ενοικιαστή',
    'msg.tenantTitle': 'Μηνύματα με τον ιδιοκτήτη',
    'msg.placeholder': 'Γράψε μήνυμα…',
    'msg.send': 'Αποστολή',
    'msg.empty': 'Δεν υπάρχουν μηνύματα ακόμα.',

    'tenant.title': 'Το μίσθιό μου',
    'tenant.noActiveAccount': 'Δεν υπάρχει ενεργή μίσθωση συνδεδεμένη με τον λογαριασμό σου ακόμα.',
    'tenant.leaseLine': 'Ενοίκιο {rent}/μήνα · {start} → {end}',

    'need.tenancyFirst': 'Χρειάζεται ενεργή μίσθωση πρώτα.',
    'need.tenancyReport': 'Χρειάζεται ενεργή μίσθωση για να στείλεις αναφορά.',
    'need.noActiveTenancy': 'Καμία ενεργή μίσθωση.',

    'cat.rent': 'Ενοίκιο',
    'cat.common_expenses': 'Κοινόχρηστα',
    'cat.internet': 'Internet',
    'cat.deposit': 'Εγγύηση',
    'cat.other': 'Άλλο',

    'st.pending': 'Εκκρεμεί',
    'st.paid': 'Πληρώθηκε',
    'st.overdue': 'Καθυστερεί',
    'st.open': 'Ανοιχτό',
    'st.in_progress': 'Σε εξέλιξη',
    'st.resolved': 'Επιλύθηκε',
    'st.closed': 'Έκλεισε',

    'pri.low': 'Χαμηλή',
    'pri.medium': 'Μεσαία',
    'pri.high': 'Υψηλή',
    'pri.urgent': 'Επείγον',

    'error': 'Σφάλμα: {msg}',
    'dash': '—'
  },

  en: {
    'app.title': 'Zanos City — Rental Management',
    'brand': '🏠 Zanos City — Management',
    'signOut': 'Sign out',
    'lang.other': 'ΕΛ',

    'login.title': 'Sign in',
    'login.hint': 'We\'ll email you a sign-in link — no password needed.',
    'login.emailPlaceholder': 'you@email.com',
    'login.submit': 'Email me a sign-in link',
    'login.sending': 'Sending...',
    'login.sent': 'Check your email for the sign-in link.',

    'loading': 'Loading…',

    'onb.owner.title': 'I am the owner',
    'onb.owner.hint': 'Create the property and get an invite code for your tenant.',
    'onb.owner.nameLabel': 'Property name',
    'onb.owner.addrLabel': 'Address (optional)',
    'onb.owner.addrPlaceholder': 'Aglantzia, Nicosia',
    'onb.owner.submit': 'Create property',
    'onb.tenant.title': 'I am the tenant',
    'onb.tenant.hint': 'Got an invite code from the owner? Enter it here.',
    'onb.tenant.codeLabel': 'Invite code',
    'onb.tenant.codePlaceholder': 'e.g. A1B2C3D4E5',
    'onb.tenant.submit': 'Join the property',
    'onb.creating': 'Creating...',
    'onb.joining': 'Joining...',
    'onb.invalidCode': 'Invalid code.',
    'onb.notAllowed': 'Your account is not allowed to create a property. If you are a tenant, ask the owner for an invite code.',

    'owner.inviteLabel': 'Tenant invite code',

    'tab.tenancy': 'Tenancy',
    'tab.payments': 'Payments',
    'tab.maintenance': 'Maintenance',
    'tab.messages': 'Messages',

    'tenancy.currentTitle': 'Current tenancy',
    'tenancy.none': 'No active tenancy at the moment.',
    'tenancy.formTitle': 'New / edit tenancy',
    'tenancy.tenantName': 'Tenant name',
    'tenancy.tenantNamePlaceholder': 'e.g. John Smith',
    'tenancy.tenantEmail': 'Tenant email (optional, for reference)',
    'tenancy.tenantEmailPlaceholder': 'tenant@email.com',
    'tenancy.start': 'Lease start',
    'tenancy.end': 'Lease end',
    'tenancy.rent': 'Rent (€/month)',
    'tenancy.commonYearly': 'Common expenses (€/year)',
    'tenancy.internetMonthly': 'Internet (€/month)',
    'tenancy.save': 'Save tenancy',
    'tenancy.historyTitle': 'Tenancy history',
    'tenancy.historyEmpty': 'No entries yet.',
    'tenancy.endBtn': 'End tenancy',
    'tenancy.endConfirm': 'Mark this tenancy as ended?',
    'tenancy.defaultTenant': 'Tenant',
    'tenancy.rentLine': 'Rent {amount}/month',
    'tenancy.statusActive': 'Active',
    'tenancy.statusEnded': 'Ended',

    'pay.formTitle': 'New payment entry',
    'pay.category': 'Category',
    'pay.amount': 'Amount (€)',
    'pay.due': 'Due date',
    'pay.notes': 'Notes',
    'pay.notesPlaceholder': 'e.g. November rent',
    'pay.submit': 'Add entry',
    'pay.listTitle': 'Payments',
    'pay.myTitle': 'My payments',
    'pay.empty': 'No payments yet.',
    'pay.markPaid': 'Mark as paid',
    'pay.dueLabel': 'Due',
    'pay.paidLabel': 'Paid',

    'maint.ownerTitle': 'Maintenance requests',
    'maint.formTitle': 'Report a new issue',
    'maint.title': 'Title',
    'maint.titlePlaceholder': 'e.g. Boiler not working',
    'maint.description': 'Description',
    'maint.descriptionPlaceholder': 'Describe the problem…',
    'maint.priority': 'Priority',
    'maint.submit': 'Submit report',
    'maint.myTitle': 'My reports',
    'maint.empty': 'No reports yet.',
    'maint.commentPlaceholder': 'Comment…',
    'maint.reply': 'Reply',
    'maint.you': 'You',
    'maint.other': 'Them',

    'msg.ownerTitle': 'Messages with the tenant',
    'msg.tenantTitle': 'Messages with the owner',
    'msg.placeholder': 'Write a message…',
    'msg.send': 'Send',
    'msg.empty': 'No messages yet.',

    'tenant.title': 'My rental',
    'tenant.noActiveAccount': 'No active tenancy is linked to your account yet.',
    'tenant.leaseLine': 'Rent {rent}/month · {start} → {end}',

    'need.tenancyFirst': 'An active tenancy is required first.',
    'need.tenancyReport': 'An active tenancy is required to submit a report.',
    'need.noActiveTenancy': 'No active tenancy.',

    'cat.rent': 'Rent',
    'cat.common_expenses': 'Common expenses',
    'cat.internet': 'Internet',
    'cat.deposit': 'Deposit',
    'cat.other': 'Other',

    'st.pending': 'Pending',
    'st.paid': 'Paid',
    'st.overdue': 'Overdue',
    'st.open': 'Open',
    'st.in_progress': 'In progress',
    'st.resolved': 'Resolved',
    'st.closed': 'Closed',

    'pri.low': 'Low',
    'pri.medium': 'Medium',
    'pri.high': 'High',
    'pri.urgent': 'Urgent',

    'error': 'Error: {msg}',
    'dash': '—'
  }
};

function detectLang() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (SUPPORTED_LANGS.includes(stored)) return stored;
  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  return SUPPORTED_LANGS.includes(nav) ? nav : DEFAULT_LANG;
}

let currentLang = detectLang();

function getLang() {
  return currentLang;
}

function dateLocale() {
  return DATE_LOCALES[currentLang];
}

// t('pay.dueLabel') / t('error', { msg: '...' })
function t(key, params) {
  let s = TRANSLATIONS[currentLang][key];
  if (s === undefined) s = TRANSLATIONS[DEFAULT_LANG][key];
  if (s === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split('{' + k + '}').join(v);
    }
  }
  return s;
}

// Walks the DOM and fills every element carrying a data-i18n* attribute.
function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.title = t('app.title');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  applyStaticTranslations();
  document.dispatchEvent(new CustomEvent('langchange'));
}

function toggleLang() {
  setLang(currentLang === 'el' ? 'en' : 'el');
}

// Self-contained: the language switcher must work even if app.js fails to load.
document.addEventListener('DOMContentLoaded', () => {
  applyStaticTranslations();
  document.getElementById('langToggle').addEventListener('click', toggleLang);
});

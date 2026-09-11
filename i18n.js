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
    'login.hint': 'Μπες με email και κωδικό. Αν δεν έχεις λογαριασμό, φτιάξε έναν.',
    'login.emailPlaceholder': 'you@email.com',
    'login.sending': 'Αποστολή...',
    'login.sent': 'Έλεγξε το email σου για το link σύνδεσης.',

    'login.passwordLabel': 'Κωδικός πρόσβασης',
    'login.passwordPlaceholder': 'Ο κωδικός σου',
    'login.signIn': 'Σύνδεση',
    'login.magicLink': 'Στείλε μου link σύνδεσης',
    'login.magicHint': 'Δεν έχεις κωδικό; Ζήτα link σύνδεσης στο email και όρισε κωδικό αφού μπεις.',
    'login.badCredentials': 'Λάθος email ή κωδικός.',
    'login.rateLimited': 'Στάλθηκαν πολλά link σύνδεσης. Δοκίμασε ξανά σε λίγο ή μπες με κωδικό.',
    'login.guestTitle': 'Είσοδος επισκέπτη',
    'login.guestHint': 'Βάλε τον κωδικό που σου έδωσε ο ιδιοκτήτης. Δεν χρειάζεται λογαριασμός.',

    'login.magicTitle': 'Σύνδεση χωρίς κωδικό',
    'login.magicHint': 'Θα σου στείλουμε ένα link στο email σου και μπαίνεις με ένα πάτημα. Είναι κανονικός τρόπος σύνδεσης — δεν χρειάζεται ποτέ να ορίσεις κωδικό.',

    'signup.title': 'Δημιουργία λογαριασμού',
    'signup.hint': 'Θα σου στείλουμε email επιβεβαίωσης για να ενεργοποιήσεις τον λογαριασμό.',
    'signup.emailLabel': 'Email',
    'signup.passwordLabel': 'Κωδικός (τουλάχιστον 8 χαρακτήρες)',
    'signup.confirmLabel': 'Επιβεβαίωση κωδικού',
    'signup.submit': 'Δημιουργία λογαριασμού',
    'signup.mismatch': 'Οι δύο κωδικοί δεν ταιριάζουν.',
    'signup.back': '← Πίσω στη σύνδεση',
    'signup.checkEmail': 'Στάλθηκε email επιβεβαίωσης στο {email}. Άνοιξέ το για να ενεργοποιήσεις τον λογαριασμό σου.',

    'login.createAccount': 'Δημιουργία νέου λογαριασμού',
    'login.accountExists': 'Υπάρχει ήδη λογαριασμός με αυτό το email. Μπες με τον κωδικό σου ή ζήτα link σύνδεσης.',
    'login.passwordTooShort': 'Ο κωδικός θέλει τουλάχιστον 8 χαρακτήρες.',
    'login.passwordRequired': 'Συμπλήρωσε τον κωδικό σου.',
    'login.creating': 'Δημιουργία λογαριασμού...',

    'party.you': 'Εσύ',
    'party.owner': 'Ιδιοκτήτης',
    'party.tenant': 'Ενοικιαστής',

    'account.button': 'Κωδικός',
    'account.title': 'Ορισμός κωδικού πρόσβασης',
    'account.hint': 'Όρισε κωδικό για να μπαίνεις χωρίς να περιμένεις email.',
    'account.newPassword': 'Νέος κωδικός (τουλάχιστον 8 χαρακτήρες)',
    'account.save': 'Αποθήκευση κωδικού',
    'account.saving': 'Αποθήκευση...',
    'account.saved': 'Ο κωδικός αποθηκεύτηκε. Από εδώ και πέρα μπορείς να μπαίνεις με αυτόν.',

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
    'onb.guest.codePlaceholder': 'π.χ. G1H2J3K4L5',
    'onb.guest.submit': 'Είσοδος ως επισκέπτης',
    'onb.guest.invalid': 'Μη έγκυρος ή ληγμένος κωδικός επισκέπτη.',
    'onb.guest.redeeming': 'Έλεγχος κωδικού...',

    'tab.guests': 'Επισκέπτες',
    'pay.editTitle': 'Επεξεργασία χρέωσης',
    'pay.editingWhat': 'Επεξεργάζεσαι: {what}',
    'pay.attachFile': 'Λογαριασμός / απόδειξη (προαιρετικό)',
    'pay.recurringFromEdit': 'Δημιουργήθηκαν {count} επιπλέον μηνιαίες εγγραφές, από τον επόμενο μήνα.',
    'pay.recurringNeedsDue': 'Για επανάληψη χρειάζεται η χρέωση να έχει ημερομηνία.',
    'pay.attachment': 'Λογαριασμός / απόδειξη (προαιρετικό)',
    'pay.attachmentNote': 'Δεν επισυνάπτεται αρχείο σε επαναλαμβανόμενη σειρά.',
    'pay.openAttachment': 'Λογαριασμός',
    'pay.edit': 'Επεξεργασία',
    'pay.editing': 'Επεξεργασία χρέωσης',
    'pay.update': 'Ενημέρωση',
    'pay.cancelEdit': 'Ακύρωση',
    'pay.replaceFile': 'Νέο αρχείο (αντικαθιστά το υπάρχον)',
    'doc.readOnlyHint': 'Τα έγγραφα τα ανεβάζει ο ιδιοκτήτης.',
    'tab.documents': 'Έγγραφα',
    'tab.audit': 'Ιστορικό',

    'pay.recurring': 'Επαναλαμβανόμενο κάθε μήνα μέχρι τη λήξη της μίσθωσης',
    'pay.recurringDone': 'Δημιουργήθηκαν {count} μηνιαίες εγγραφές.',
    'pay.needDueDate': 'Για επαναλαμβανόμενη πληρωμή χρειάζεται ημερομηνία.',
    'pay.seriesBadge': 'Επαναλαμβανόμενη',

    'doc.formTitle': 'Ανέβασμα εγγράφου',
    'doc.title': 'Τίτλος',
    'doc.titlePlaceholder': 'π.χ. Λογαριασμός ΑΗΚ Σεπτεμβρίου',
    'doc.category': 'Κατηγορία',
    'doc.file': 'Αρχείο',
    'doc.upload': 'Ανέβασμα',
    'doc.uploading': 'Ανέβασμα...',
    'doc.listTitle': 'Έγγραφα',
    'doc.empty': 'Κανένα έγγραφο ακόμα.',
    'doc.open': 'Άνοιγμα',
    'doc.delete': 'Διαγραφή',
    'doc.deleteConfirm': 'Να διαγραφεί αυτό το έγγραφο;',
    'doc.tooBig': 'Το αρχείο ξεπερνά τα 10 MB.',
    'doccat.electricity': 'Ρεύμα',
    'doccat.water': 'Νερό',
    'doccat.internet': 'Internet',
    'doccat.common_expenses': 'Κοινόχρηστα',
    'doccat.contract': 'Συμβόλαιο',
    'doccat.receipt': 'Απόδειξη',
    'doccat.other': 'Άλλο',

    'people.title': 'Ποιοι έχουν πρόσβαση',
    'people.empty': 'Κανείς ακόμα.',
    'people.remove': 'Αφαίρεση',
    'people.removeConfirm': 'Να αφαιρεθεί η πρόσβαση αυτού του χρήστη;',
    'allowed.title': 'Εγκεκριμένοι ενοικιαστές',
    'allowed.hint': 'Μόνο αυτά τα email μπορούν να μπουν ως ενοικιαστές με τον κωδικό πρόσκλησης.',
    'allowed.email': 'Email ενοικιαστή',
    'allowed.label': 'Σημείωση (προαιρετικό)',
    'allowed.labelPlaceholder': 'π.χ. Μαρία, από Οκτώβριο',
    'allowed.add': 'Προσθήκη',
    'allowed.empty': 'Κανένα email ακόμα. Χωρίς λίστα, κανείς δεν μπορεί να μπει ως ενοικιαστής.',
    'allowed.remove': 'Αφαίρεση',
    'allowed.removeConfirm': 'Να αφαιρεθεί αυτό το email;',

    'tenancy.edit': 'Επεξεργασία',
    'tenancy.editing': 'Επεξεργασία τρέχουσας μίσθωσης',
    'tenancy.update': 'Ενημέρωση μίσθωσης',
    'tenancy.cancelEdit': 'Ακύρωση',

    'audit.title': 'Ιστορικό ενεργειών',
    'audit.hint': 'Κάθε αλλαγή και κάθε σφάλμα, με ποιον και πότε.',
    'audit.empty': 'Καμία καταγραφή ακόμα.',
    'audit.details': 'Λεπτομέρειες',
    'audit.filterAll': 'Όλα',
    'audit.filterErrors': 'Μόνο σφάλματα',
    'audit.refresh': 'Ανανέωση',
    'act.INSERT': 'Δημιουργία',
    'act.UPDATE': 'Αλλαγή',
    'act.DELETE': 'Διαγραφή',
    'act.ERROR': 'Σφάλμα',

    'tab.info': 'Πληροφορίες',
    'info.formTitle': 'Νέα πληροφορία',
    'info.title': 'Τίτλος',
    'info.titlePlaceholder': 'π.χ. Κωδικός εξώπορτας',
    'info.body': 'Περιεχόμενο',
    'info.bodyPlaceholder': 'π.χ. 1234# — κρατήστε το κουμπί πατημένο',
    'info.visibleToGuests': 'Ορατό και στους επισκέπτες',
    'info.add': 'Προσθήκη',
    'info.listTitle': 'Πληροφορίες χώρου',
    'info.empty': 'Καμία πληροφορία ακόμα.',
    'info.delete': 'Διαγραφή',
    'info.deleteConfirm': 'Να διαγραφεί αυτή η πληροφορία;',
    'info.badgeGuest': 'Ορατό σε επισκέπτες',
    'info.badgeTenantOnly': 'Μόνο ενοικιαστής',

    'gcode.title': 'Κωδικοί επισκεπτών',
    'gcode.label': 'Περιγραφή (για εσένα)',
    'gcode.labelPlaceholder': 'π.χ. Μαρία, Ιούλιος',
    'gcode.validDays': 'Ισχύς (ημέρες, κενό = χωρίς λήξη)',
    'gcode.create': 'Δημιουργία κωδικού',
    'gcode.empty': 'Κανένας κωδικός ακόμα.',
    'gcode.copyLink': 'Αντιγραφή συνδέσμου',
    'gcode.copied': 'Αντιγράφηκε ✓',
    'gcode.revoke': 'Ακύρωση',
    'gcode.revokeConfirm': 'Να ακυρωθεί αυτός ο κωδικός;',
    'gcode.expiresOn': 'Λήγει {date}',
    'gcode.noExpiry': 'Χωρίς λήξη',
    'gcode.statusActive': 'Ενεργός',
    'gcode.statusRevoked': 'Ακυρώθηκε',
    'gcode.statusExpired': 'Έληξε',

    'guest.title': 'Πληροφορίες χώρου',
    'guest.empty': 'Ο ιδιοκτήτης δεν έχει προσθέσει πληροφορίες ακόμα.',

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
    'tenancy.allTitle': 'Όλες οι μισθώσεις',
    'tenancy.delete': 'Διαγραφή',
    'tenancy.deleteConfirm': 'Οριστική διαγραφή της μίσθωσης:\n{what}\n\nΘα διαγραφούν μαζί:\n· {payments} πληρωμές\n· {messages} μηνύματα\n· {requests} αναφορές βλαβών\n· {documents} έγγραφα\n\nΔεν αναιρείται.',
    'tenancy.deleting': 'Διαγραφή...',
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
    'login.hint': 'Sign in with your email and password. No account yet? Create one.',
    'login.emailPlaceholder': 'you@email.com',
    'login.sending': 'Sending...',
    'login.sent': 'Check your email for the sign-in link.',

    'login.passwordLabel': 'Password',
    'login.passwordPlaceholder': 'Your password',
    'login.signIn': 'Sign in',
    'login.magicLink': 'Email me a sign-in link',
    'login.magicHint': 'No password yet? Get a sign-in link by email, then set one once you are in.',
    'login.badCredentials': 'Wrong email or password.',
    'login.rateLimited': 'Too many sign-in links sent. Try again shortly, or sign in with a password.',
    'login.guestTitle': 'Guest access',
    'login.guestHint': 'Enter the code the owner gave you. No account needed.',

    'login.magicTitle': 'Sign in without a password',
    'login.magicHint': 'We email you a link and you are in with one tap. This is a full sign-in method on its own — you never have to set a password.',

    'signup.title': 'Create an account',
    'signup.hint': 'We will send a confirmation email to activate the account.',
    'signup.emailLabel': 'Email',
    'signup.passwordLabel': 'Password (at least 8 characters)',
    'signup.confirmLabel': 'Confirm password',
    'signup.submit': 'Create account',
    'signup.mismatch': 'The two passwords do not match.',
    'signup.back': '← Back to sign in',
    'signup.checkEmail': 'A confirmation email was sent to {email}. Open it to activate your account.',

    'login.createAccount': 'Create a new account',
    'login.accountExists': 'An account with this email already exists. Sign in with your password, or ask for a sign-in link.',
    'login.passwordTooShort': 'The password needs at least 8 characters.',
    'login.passwordRequired': 'Enter your password.',
    'login.creating': 'Creating account...',

    'party.you': 'You',
    'party.owner': 'Owner',
    'party.tenant': 'Tenant',

    'account.button': 'Password',
    'account.title': 'Set a password',
    'account.hint': 'Set a password so you can sign in without waiting for an email.',
    'account.newPassword': 'New password (at least 8 characters)',
    'account.save': 'Save password',
    'account.saving': 'Saving...',
    'account.saved': 'Password saved. You can sign in with it from now on.',

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
    'onb.guest.codePlaceholder': 'e.g. G1H2J3K4L5',
    'onb.guest.submit': 'Enter as guest',
    'onb.guest.invalid': 'Invalid or expired guest code.',
    'onb.guest.redeeming': 'Checking code...',

    'tab.guests': 'Guests',
    'pay.editTitle': 'Edit charge',
    'pay.editingWhat': 'Editing: {what}',
    'pay.attachFile': 'Bill or receipt (optional)',
    'pay.recurringFromEdit': 'Created {count} further monthly entries, starting next month.',
    'pay.recurringNeedsDue': 'To repeat, the charge needs a date.',
    'pay.attachment': 'Bill or receipt (optional)',
    'pay.attachmentNote': 'A recurring series takes no attachment.',
    'pay.openAttachment': 'Bill',
    'pay.edit': 'Edit',
    'pay.editing': 'Editing a charge',
    'pay.update': 'Update',
    'pay.cancelEdit': 'Cancel',
    'pay.replaceFile': 'New file (replaces the current one)',
    'doc.readOnlyHint': 'Documents are uploaded by the owner.',
    'tab.documents': 'Documents',
    'tab.audit': 'History',

    'pay.recurring': 'Repeat every month until the lease ends',
    'pay.recurringDone': 'Created {count} monthly entries.',
    'pay.needDueDate': 'A recurring payment needs a date.',
    'pay.seriesBadge': 'Recurring',

    'doc.formTitle': 'Upload a document',
    'doc.title': 'Title',
    'doc.titlePlaceholder': 'e.g. September electricity bill',
    'doc.category': 'Category',
    'doc.file': 'File',
    'doc.upload': 'Upload',
    'doc.uploading': 'Uploading...',
    'doc.listTitle': 'Documents',
    'doc.empty': 'No documents yet.',
    'doc.open': 'Open',
    'doc.delete': 'Delete',
    'doc.deleteConfirm': 'Delete this document?',
    'doc.tooBig': 'The file is larger than 10 MB.',
    'doccat.electricity': 'Electricity',
    'doccat.water': 'Water',
    'doccat.internet': 'Internet',
    'doccat.common_expenses': 'Common expenses',
    'doccat.contract': 'Contract',
    'doccat.receipt': 'Receipt',
    'doccat.other': 'Other',

    'people.title': 'Who has access',
    'people.empty': 'Nobody yet.',
    'people.remove': 'Remove',
    'people.removeConfirm': 'Remove this person\'s access?',
    'allowed.title': 'Approved tenants',
    'allowed.hint': 'Only these addresses can join as tenants with the invite code.',
    'allowed.email': 'Tenant email',
    'allowed.label': 'Note (optional)',
    'allowed.labelPlaceholder': 'e.g. Maria, from October',
    'allowed.add': 'Add',
    'allowed.empty': 'No addresses yet. With an empty list, nobody can join as a tenant.',
    'allowed.remove': 'Remove',
    'allowed.removeConfirm': 'Remove this address?',

    'tenancy.edit': 'Edit',
    'tenancy.editing': 'Editing the current tenancy',
    'tenancy.update': 'Update tenancy',
    'tenancy.cancelEdit': 'Cancel',

    'audit.title': 'Activity history',
    'audit.hint': 'Every change and every error, with who and when.',
    'audit.empty': 'Nothing recorded yet.',
    'audit.details': 'Details',
    'audit.filterAll': 'All',
    'audit.filterErrors': 'Errors only',
    'audit.refresh': 'Refresh',
    'act.INSERT': 'Created',
    'act.UPDATE': 'Changed',
    'act.DELETE': 'Deleted',
    'act.ERROR': 'Error',

    'tab.info': 'Information',
    'info.formTitle': 'New entry',
    'info.title': 'Title',
    'info.titlePlaceholder': 'e.g. Front door code',
    'info.body': 'Content',
    'info.bodyPlaceholder': 'e.g. 1234# — hold the button down',
    'info.visibleToGuests': 'Also visible to guests',
    'info.add': 'Add',
    'info.listTitle': 'Property information',
    'info.empty': 'No information yet.',
    'info.delete': 'Delete',
    'info.deleteConfirm': 'Delete this entry?',
    'info.badgeGuest': 'Visible to guests',
    'info.badgeTenantOnly': 'Tenant only',

    'gcode.title': 'Guest codes',
    'gcode.label': 'Description (for you)', 
    'gcode.labelPlaceholder': 'e.g. Maria, July',
    'gcode.validDays': 'Valid for (days, blank = no expiry)',
    'gcode.create': 'Create code',
    'gcode.empty': 'No codes yet.',
    'gcode.copyLink': 'Copy link',
    'gcode.copied': 'Copied ✓',
    'gcode.revoke': 'Revoke',
    'gcode.revokeConfirm': 'Revoke this code?',
    'gcode.expiresOn': 'Expires {date}',
    'gcode.noExpiry': 'No expiry',
    'gcode.statusActive': 'Active',
    'gcode.statusRevoked': 'Revoked',
    'gcode.statusExpired': 'Expired',

    'guest.title': 'Property information',
    'guest.empty': 'The owner has not added any information yet.',

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
    'tenancy.allTitle': 'All tenancies',
    'tenancy.delete': 'Delete',
    'tenancy.deleteConfirm': 'Permanently delete this tenancy:\n{what}\n\nThis also deletes:\n· {payments} payments\n· {messages} messages\n· {requests} maintenance reports\n· {documents} documents\n\nThis cannot be undone.',
    'tenancy.deleting': 'Deleting...',
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

const KEY = 'ptm.lang';

export const STR = {
  ar: {
    dir: 'rtl',
    lang: 'ar',
    title: 'بريد مستمر — PersistMail v2.0.0',
    inboxTitle: 'صندوق الوارد — PersistMail',
    brandSub: '/ بريد مؤقت يبقى',
    kicker: 'خدمة البريد المؤقت المستمر',
    hero1: 'عنوان واحد.',
    hero2: 'كل المنصات.',
    hero3: 'يبقى لك.',
    lede: 'أنشئ صناديق بلا حد على النطاق الأساسي أو أي نطاق بديل. كل عنوان يُحفظ في الخادم لتعيد استخدامه في أي منصة دون فقدان الوارد.',
    statDomains: 'نطاقات متاحة',
    statGen: 'إنشاء العناوين',
    statSend: 'إرسال بلا حد',
    statVer: 'إصدار الخدمة',
    tabGen: 'إنشاء',
    tabLogin: 'دخول',
    createTitle: 'أنشئ صندوقاً قابلاً لإعادة الاستخدام',
    createHint: 'اختر نطاقاً، حدّد الجزء المحلي إن شئت، أو ولّد عنواناً عشوائياً. بلا حد.',
    domain: 'النطاق',
    localPart: 'الجزء المحلي (اختياري)',
    reserve: 'حجز العنوان',
    random: 'توليد عشوائي',
    keyOnce: 'مفتاح الوصول يُعرض مرة واحدة. هو السبيل الوحيد لفتح هذا الصندوق من جهاز آخر.',
    openInbox: 'فتح الصندوق',
    copyAddr: 'نسخ العنوان',
    copyKey: 'نسخ المفتاح',
    loginTitle: 'إعادة فتح عنوان محفوظ',
    loginHint: 'استخدم البريد ومفتاح الوصول الصادر عند الإنشاء. يعمل عبر المنصات.',
    email: 'البريد',
    accessKey: 'مفتاح الوصول',
    signIn: 'دخول الصندوق',
    vault: 'خزنة الجهاز',
    addresses: 'عناوين',
    noVault: 'لا عناوين محفوظة بعد. أنشئ واحداً — يبقى على هذا الجهاز وعلى الخادم.',
    primaryDom: 'نطاق أساسي',
    altDom: 'نطاق بديل',
    open: 'فتح الصندوق',
    copy: 'نسخ',
    forget: 'نسيان',
    copied: 'تم النسخ',
    reserved: 'تم حجز العنوان. احفظ مفتاح الوصول.',
    apiDown: 'تعذر الوصول إلى الواجهة. هل الخادم يعمل؟',
    inbox: 'الوارد',
    threads: 'خيوط',
    thread: 'خيط',
    emptyInbox: 'الصندوق فارغ. أرسل بريداً إلى هذا العنوان أو حقن رسالة تجريبية.',
    selectThread: 'اختر رسالة لعرض سجلها.',
    onlyThis: 'تُحمَّل رسائل هذا العنوان فقط.',
    noAddr: 'لا عناوين في الخزنة. أنشئ واحداً من الصفحة الرئيسية.',
    reply: 'رد',
    sendReply: 'إرسال الرد',
    compose: 'رسالة جديدة',
    send: 'إرسال',
    to: 'إلى',
    subject: 'الموضوع',
    body: 'النص',
    delete: 'حذف',
    deleted: 'حُذفت الرسالة',
    receive: 'استلام تجريبي',
    newAddr: 'عنوان جديد',
    unlimited: 'إرسال بلا حد',
    writeReply: 'اكتب رداً إلى',
    primary: 'أساسي',
    free: 'مجاني',
    inbound: 'وارد',
    outbound: 'صادر',
    emptyBody: '(بدون نص)',
    lang: 'English',
  },
  en: {
    dir: 'ltr',
    lang: 'en',
    title: 'PersistMail — Persistent Temp Mail v2.0.0',
    inboxTitle: 'Inbox — PersistMail',
    brandSub: '/ temp that stays',
    kicker: 'Persistent Temp Mail Service',
    hero1: 'One address.',
    hero2: 'Every platform.',
    hero3: 'Yours to keep.',
    lede: 'Generate unlimited mailboxes on the primary domain or any free alternative. Each address is stored server-side so you can sign back in and reuse it anywhere — without losing the inbox.',
    statDomains: 'available domains',
    statGen: 'address generation',
    statSend: 'outbound send',
    statVer: 'service version',
    tabGen: 'Generate',
    tabLogin: 'Sign in',
    createTitle: 'Create a reusable mailbox',
    createHint: 'Pick a domain, optionally claim a local-part, or mint a random one. Unlimited.',
    domain: 'Domain',
    localPart: 'Local-part (optional)',
    reserve: 'Reserve address',
    random: 'Generate random',
    keyOnce: 'This access key is shown once. It is the only way to reopen this inbox from another device.',
    openInbox: 'Open inbox',
    copyAddr: 'Copy address',
    copyKey: 'Copy key',
    loginTitle: 'Reopen a saved address',
    loginHint: 'Use the email plus the access key issued when it was created. Works across platforms.',
    email: 'Email',
    accessKey: 'Access key',
    signIn: 'Sign in to inbox',
    vault: 'Device vault',
    addresses: 'addresses',
    noVault: 'No saved addresses yet. Generate one — it stays on this device and on the server.',
    primaryDom: 'Primary domain',
    altDom: 'Alternative domain',
    open: 'Open inbox',
    copy: 'Copy',
    forget: 'Forget',
    copied: 'Copied',
    reserved: 'Address reserved. Save the access key.',
    apiDown: 'Could not reach API. Is the server running?',
    inbox: 'Inbox',
    threads: 'threads',
    thread: 'Thread',
    emptyInbox: 'This inbox is empty. Send mail to this address or inject a test message.',
    selectThread: 'Select a thread to read its history.',
    onlyThis: 'Only messages for this address are loaded.',
    noAddr: 'No addresses in your vault. Generate one on the landing page.',
    reply: 'Reply',
    sendReply: 'Send reply',
    compose: 'New message',
    send: 'Send',
    to: 'To',
    subject: 'Subject',
    body: 'Body',
    delete: 'Delete',
    deleted: 'Message deleted',
    receive: 'Inject test mail',
    newAddr: 'New address',
    unlimited: 'Unlimited send',
    writeReply: 'Write a reply to',
    primary: 'PRIMARY',
    free: 'FREE',
    inbound: 'inbound',
    outbound: 'outbound',
    emptyBody: '(empty body)',
    lang: 'العربية',
  },
};

export function getLang() {
  const saved = localStorage.getItem(KEY);
  if (saved === 'en' || saved === 'ar') return saved;
  return 'ar';
}

export function setLang(lang) {
  localStorage.setItem(KEY, lang === 'en' ? 'en' : 'ar');
}

export function t(key) {
  const pack = STR[getLang()] || STR.ar;
  return pack[key] || STR.en[key] || key;
}

export function applyI18n(root = document) {
  const pack = STR[getLang()] || STR.ar;
  document.documentElement.lang = pack.lang;
  document.documentElement.dir = pack.dir;
  if (pack.title && document.title) {
    const isInbox = location.pathname.includes('inbox');
    document.title = isInbox ? pack.inboxTitle : pack.title;
  }
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (pack[key]) el.textContent = pack[key];
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (pack[key]) el.setAttribute('placeholder', pack[key]);
  });
}

export function toggleLang() {
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  applyI18n();
  return getLang();
}

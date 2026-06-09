// ⚙️ CONFIG — remplace par ton URL Railway une fois déployé
const BACKEND_URL = 'https://cherkitime-backend.onrender.com';
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-5Oxvy_XHJQlDw_tHWytbdOcG2_jgMso",
  authDomain: "cherkitime-45e90.firebaseapp.com",
  projectId: "cherkitime-45e90",
  storageBucket: "cherkitime-45e90.firebasestorage.app",
  messagingSenderId: "704842274738",
  appId: "1:704842274738:web:cd93b589121b7b71a576ab",
  measurementId: "G-L8N17ZT4S5",
};
const VAPID_KEY = 'BJREOsjayvCMMGzkHyJSGVTG2w01fdm3oeCK3rklOaReNkBKGjhSsUQwyzlU4P-HpBdQ6QjfnKR8kbQ9NlSNhUs';

// --- Détection iOS ---
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
const isAndroid = /android/i.test(navigator.userAgent);
const LANG = navigator.language.startsWith('fr') ? 'fr' : 'en';

const TRANSLATIONS = {
  fr: {
    'subscribe-btn':    '🔔 Activer les notifications',
    'bell-hint':        'Appuie sur la cloche pour activer',
    'subscribed-title': 'Notifications activées !',
    'subscribed-text':  'Tu recevras une notification dès que Cherki est titulaire ou entre en jeu, même téléphone verrouillé.',
    'unsub-btn':        'Se désabonner',
    'share-btn':        'Partager l\'app',
    'subscribers-sub':  'dont toi ⚡',
    'counter-text':     ' fans en attente de cherkiball',
    'stats-title':      'SAISON 25/26',
    'stat-goals':       'Buts · TCC',
    'stat-assists':     'Passes · TCC',
    'status-watching':  'En attente de cherkiball... 🔴',
    'status-sub':       'Notif garantie dès que Cherki joue ⚡',
    'footer-text':      'fait par un fan ⚡',
    'ios-guide-title':  '📱 Pour activer les notifications sur iPhone',
  },
  en: {
    'subscribe-btn':    '🔔 Enable notifications',
    'bell-hint':        'Tap the bell to enable',
    'subscribed-title': 'Notifications enabled!',
    'subscribed-text':  "You'll get a notification as soon as Cherki starts or comes on, even with your phone locked.",
    'unsub-btn':        'Unsubscribe',
    'share-btn':        'Share the app',
    'subscribers-sub':  'including you ⚡',
    'counter-text':     ' enjoyers waiting for cherkiball',
    'stats-title':      'SEASON 25/26',
    'stat-goals':       'Goals · ACC',
    'stat-assists':     'Assists · ACC',
    'status-watching':  'Watching for cherkiball... 🔴',
    'status-sub':       'Notifications guaranteed when Cherki plays ⚡',
    'footer-text':      'made by a fan ⚡',
    'ios-guide-title':  '📱 To enable notifications on iPhone',
  },
};

function applyTranslations() {
  const t = TRANSLATIONS[LANG];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });
}

let messaging = null;
let retryTimeout = null;

// --- Init Firebase Messaging ---
async function initFirebaseMessaging() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    messaging = firebase.messaging();
    console.log('✅ Firebase Messaging initialisé');
  } catch (err) {
    console.error('❌ Erreur Firebase:', err);
  }
}

// --- Enregistrement du Service Worker ---
async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ Service Worker enregistré');
    return reg;
  } catch (err) {
    console.error('❌ SW error:', err);
    return null;
  }
}

// --- Demande de permission + abonnement FCM ---
async function subscribeToPush() {
  clearTimeout(retryTimeout);
  updateStatus('loading', 'Activation en cours...');

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      updateStatus('error', 'Notifications refusées. Active-les dans les réglages.');
      return;
    }

    const swReg = await registerSW();
    if (!swReg) {
      updateStatus('error', 'Service Worker non supporté sur ce navigateur.');
      return;
    }

    // Attendre que le service worker soit bien activé
    await navigator.serviceWorker.ready;

    // Récupération du token FCM
    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      updateStatus('error', 'Impossible d\'obtenir le token FCM.');
      return;
    }

    // Envoi du token au backend
    const res = await fetch(`${BACKEND_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, lang: navigator.language.startsWith('fr') ? 'fr' : 'en' }),
    });

    if (!res.ok) throw new Error('Erreur serveur');

    localStorage.setItem('cherkitime_subscribed', 'true');
    localStorage.setItem('cherkitime_token', token);
    updateStatus('success', 'Tu es abonné ! La notif arrive dès que Cherki joue. 🔴');
    showSubscribedUI();

  } catch (err) {
    console.error('❌ Erreur abonnement:', err);
    const msg = LANG === 'fr'
      ? 'Une petite erreur s\'est produite, réessaie dans quelques secondes ! 🔄'
      : 'A small error occurred, try again in a few seconds! 🔄';
    const btnLabel = LANG === 'fr' ? 'Réessayer' : 'Try again';
    const el = document.getElementById('status-message');
    if (el) {
      el.className = 'status-message status-error';
      el.innerHTML = `${msg}<br><button id="retry-btn" style="margin-top:8px;background:#c62828;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;">${btnLabel}</button>`;
      el.style.display = 'block';
      document.getElementById('retry-btn').onclick = () => {
        clearTimeout(retryTimeout);
        subscribeToPush();
      };
    }
    retryTimeout = setTimeout(() => subscribeToPush(), 3000);
  }
}

// --- Désabonnement ---
async function unsubscribe() {
  const token = localStorage.getItem('cherkitime_token');
  if (token) {
    try {
      await fetch(`${BACKEND_URL}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch (err) {
      console.error('❌ Erreur désabonnement:', err);
    }
  } else {
    console.warn('⚠️ Aucun token trouvé dans localStorage, désabonnement local uniquement.');
  }
  localStorage.removeItem('cherkitime_subscribed');
  localStorage.removeItem('cherkitime_token');
  location.reload();
}

// --- Compteur abonnés ---
async function loadSubscriberCount() {
  const tryFetch = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/subscribers`);
      if (!res.ok) throw new Error('not ok');
      const data = await res.json();
      const el = document.getElementById('subscriber-count');
      if (el) el.textContent = data.subscribers ?? '—';
      hideSkeleton();
    } catch (err) {
      setTimeout(tryFetch, 3000);
    }
  };
  tryFetch();
}

// --- Partage ---
async function shareApp() {
  const shareData = {
    title: 'CherkiTime ⚡',
    text: 'Reçois une notif dès que Cherki joue ! 🔴',
    url: 'https://cherkitime.com',
  };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (err) { /* annulé par l'utilisateur */ }
  } else {
    await navigator.clipboard.writeText(shareData.url);
    const btn = document.getElementById('share-btn');
    const original = btn.textContent;
    btn.textContent = '✅ Lien copié !';
    setTimeout(() => { btn.textContent = original; }, 2000);
  }
}

// --- Live status indicator ---
function setLiveStatus(isLive) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;
  if (isLive) {
    dot.style.background = '#22c55e';
    document.querySelector('.pulse-ring').style.borderColor = '#22c55e';
    text.textContent = LANG === 'fr' ? 'CHERKITIME EN DIRECT ⚡' : 'CHERKITIME LIVE ⚡';
  } else {
    dot.style.background = '#e63946';
    document.querySelector('.pulse-ring').style.borderColor = '#e63946';
    text.textContent = TRANSLATIONS[LANG]['status-watching'];
  }
}

// --- Skeleton loading ---
function hideSkeleton() {
  document.querySelectorAll('.skeleton').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[data-skeleton-hide]').forEach(el => el.style.display = '');
}

// --- UI helpers ---
function updateStatus(type, message) {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.className = `status-message status-${type}`;
  el.textContent = message;
  el.style.display = 'block';
}

async function loadMatchStatus() {
  try {
    const res = await fetch(`${BACKEND_URL}/match/status`);
    if (!res.ok) return;
    const data = await res.json();
    setLiveStatus(data.live === true);
  } catch (err) {
    console.error('❌ Erreur loadMatchStatus:', err);
  }
}

function showSubscribedUI() {
  document.getElementById('subscribe-section').style.display = 'none';
  document.getElementById('subscribed-section').style.display = 'flex';
  loadSubscriberCount();
  loadMatchStatus();
  setTimeout(hideSkeleton, 6000);
}

function showIOSGuide() {
  document.getElementById('ios-guide').style.display = 'block';
  document.getElementById('subscribe-section').style.display = 'none';
}

// --- Stats Cherki ---
async function loadCherkiStats() {
  try {
    const res = await fetch(`${BACKEND_URL}/cherki/stats`);
    if (!res.ok) return;
    const data = await res.json();
    const statNums = document.querySelectorAll('.stat-num');
    if (statNums[0]) statNums[0].textContent = data.goals ?? '—';
    if (statNums[1]) statNums[1].textContent = data.assists ?? '—';
    const titleEl = document.querySelector('[data-i18n="stats-title"]');
    if (titleEl && data.season) {
      titleEl.textContent = LANG === 'fr' ? `SAISON ${data.season}` : `SEASON ${data.season}`;
    }
    hideSkeleton();
  } catch (err) {
    console.error('❌ Erreur loadCherkiStats:', err);
  }
}

// Efface le badge PWA quand l'utilisateur revient sur l'app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    navigator.clearAppBadge?.();
  }
});
window.addEventListener('focus', () => navigator.clearAppBadge?.());

// --- Init au chargement ---
window.addEventListener('DOMContentLoaded', async () => {
  navigator.clearAppBadge?.();
  applyTranslations();
  loadSubscriberCount();
  loadCherkiStats();
  await initFirebaseMessaging();

  // iOS pas encore en mode standalone → montrer le guide d'installation
  if (isIOS && !isInStandaloneMode) {
    showIOSGuide();
    return;
  }

  // Déjà abonné ?
  if (localStorage.getItem('cherkitime_subscribed')) {
    showSubscribedUI();
    return;
  }

  // Android ou iOS standalone → prêt à s'abonner
  document.getElementById('subscribe-btn').style.display = 'block';
});

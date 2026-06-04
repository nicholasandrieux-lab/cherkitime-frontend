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

let messaging = null;

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
      body: JSON.stringify({ token }),
    });

    if (!res.ok) throw new Error('Erreur serveur');

    localStorage.setItem('cherkitime_subscribed', 'true');
    localStorage.setItem('cherkitime_token', token);
    updateStatus('success', 'Tu es abonné ! La notif arrive dès que Cherki joue. 🔴');
    showSubscribedUI();

  } catch (err) {
    console.error('❌ Erreur abonnement:', err);
    updateStatus('error', `Erreur : ${err.message}`);
  }
}

// --- Désabonnement ---
async function unsubscribe() {
  const token = localStorage.getItem('cherkitime_token');
  if (token) {
    await fetch(`${BACKEND_URL}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  }
  localStorage.removeItem('cherkitime_subscribed');
  localStorage.removeItem('cherkitime_token');
  location.reload();
}

// --- Test notification ---
async function testNotif() {
  try {
    const res = await fetch(`${BACKEND_URL}/test-notif`, { method: 'POST' });
    if (res.ok) {
      document.getElementById('test-feedback').textContent = '✅ Notif envoyée ! Tu devrais la recevoir dans quelques secondes.';
    }
  } catch (err) {
    document.getElementById('test-feedback').textContent = '❌ Erreur — vérifie que le backend est bien démarré.';
  }
}

// --- UI helpers ---
function updateStatus(type, message) {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.className = `status-message status-${type}`;
  el.textContent = message;
  el.style.display = 'block';
}

function showSubscribedUI() {
  document.getElementById('subscribe-section').style.display = 'none';
  document.getElementById('subscribed-section').style.display = 'flex';
}

function showIOSGuide() {
  document.getElementById('ios-guide').style.display = 'block';
  document.getElementById('subscribe-btn').style.display = 'none';
}

// --- Init au chargement ---
window.addEventListener('DOMContentLoaded', async () => {
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

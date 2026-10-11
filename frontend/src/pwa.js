// PWA install + service worker lifecycle. Everything here is additive to
// the existing app — nothing in here touches routing, auth, or API logic.
//
// Honest framing (this is why the UI hint matters): Chrome/Edge fire
// `beforeinstallprompt` and let a page trigger the native install dialog.
// Safari/iOS fires neither — there is no programmatic install there, only
// the user manually doing Share -> Add to Home Screen. canInstall() will
// just stay false on iOS forever; that's correct, not a bug to chase.
let deferredPrompt = null;
let waitingWorker = null;
const installListeners = new Set();
const updateListeners = new Set();

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function canInstall() {
  return !!deferredPrompt;
}

export async function promptInstall() {
  if (!deferredPrompt) return { outcome: 'unavailable' };
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installListeners.forEach((cb) => cb(canInstall()));
  return choice;
}

export function subscribeInstall(callback) {
  installListeners.add(callback);
  callback(canInstall());
  return () => installListeners.delete(callback);
}

// A new service worker is waiting (an update was fetched while the app was
// open). subscribeUpdate fires `true` when one shows up; applyUpdate tells
// it to take over, which triggers a one-time reload onto the new build.
// Without this, a customer's tab could silently stay pinned to a stale
// cached build until they manually close every tab.
export function subscribeUpdate(callback) {
  updateListeners.add(callback);
  return () => updateListeners.delete(callback);
}

export function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage('SKIP_WAITING');
}

export function registerPWA() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((cb) => cb(canInstall()));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((cb) => cb(canInstall()));
  });

  // Service worker registration is production-only — in dev, CRA's own
  // dev server and hot reload should never be shadowed by a cache.
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = newWorker;
              updateListeners.forEach((cb) => cb(true));
            }
          });
        });
      })
      .catch((err) => console.error('Service worker registration failed:', err));

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

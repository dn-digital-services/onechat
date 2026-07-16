// OneChat – Firebase Cloud Messaging Service Worker
// Uses the compat SDK (required for service workers – no ES module support).
// Config is loaded via importScripts("/sw-config.js") which the Node server
// serves as a plain global assignment (no export keyword).
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Load Firebase config injected by the server as a plain JS global.
// /sw-config.js sets: self.firebaseSwConfig = { apiKey, projectId, ... }
try {
    importScripts("/sw-config.js");
} catch(e){
    console.warn("[SW] Failed to load /sw-config.js:", e);
}

// Initialise Firebase only if we have a valid config
let messaging = null;
try {
    const cfg = self.firebaseSwConfig || {};
    if(cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId){
        if(!firebase.apps.length){
            firebase.initializeApp(cfg);
        }
        messaging = firebase.messaging();

        // Handle background messages (app backgrounded or closed).
        // Firebase SDK calls this automatically when a push arrives with a
        // 'notification' payload; we also handle it manually via the raw
        // 'push' listener below so data-only messages are shown too.
        messaging.onBackgroundMessage((payload) => {
            const { notification = {}, data = {} } = payload;
            const title = notification.title || data.title || "OneChat";
            return self.registration.showNotification(title, {
                body: notification.body || data.body || "You have a new message",
                icon: "/logo.PNG",
                badge: "/logo.PNG",
                tag: (data.chatId || notification.tag) || "onechat-msg",
                renotify: true,
                data: data,
                vibrate: [200, 100, 200],
            });
        });
    } else {
        console.warn("[SW] Firebase config missing – notifications will not work until env vars are set.");
    }
} catch(e){
    console.error("[SW] Firebase init failed:", e);
}

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// Fallback raw push handler – catches data-only FCM messages and any push
// that slips past the Firebase messaging handler (e.g. when messaging init
// failed above).  Firebase's own push handler runs first; this only fires
// for messages it didn't handle.
self.addEventListener("push", (event) => {

    if(!event.data) return;

    // If Firebase messaging is active it handles the push itself.
    // We only take over when messaging is not initialised.
    if(messaging) return;

    let payload;
    try {
        payload = event.data.json();
    } catch(e){
        payload = { notification: { title: "OneChat", body: event.data.text() } };
    }

    const { notification = {}, data = {} } = payload;
    const title = notification.title || data.title || "OneChat";

    event.waitUntil(
        self.registration.showNotification(title, {
            body: notification.body || data.body || "You have a new message",
            icon: "/logo.PNG",
            badge: "/logo.PNG",
            tag: (data.chatId || notification.tag) || "onechat-msg",
            renotify: true,
            data: data,
            vibrate: [200, 100, 200],
        })
    );

});

// Open the correct chat when a notification is tapped
self.addEventListener("notificationclick", (event) => {

    event.notification.close();

    const data = event.notification.data || {};
    const url = data.uid
        ? `/chat.html?uid=${encodeURIComponent(data.uid)}&name=${encodeURIComponent(data.name || "")}`
        : "/home.html";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            // Focus an existing window if one is open
            for(const client of clients){
                if(client.url.startsWith(self.location.origin)){
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }
            // Otherwise open a new window
            return self.clients.openWindow(url);
        })
    );

});

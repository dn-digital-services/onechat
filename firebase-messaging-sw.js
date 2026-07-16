// OneChat – Firebase Cloud Messaging Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// The config is injected at runtime via /firebase-config.js, but service
// workers can't use ES modules or dynamic imports, so we keep a copy here
// that will be populated by the server's /sw-config endpoint or remain as
// an empty stub (notifications will still work for foreground-only cases).

let firebaseConfigFromServer = {};

// Fetch config synchronously during SW install so the messaging instance
// has the right project details when a push arrives.
try {
    const resp = self.fetch("/firebase-config.js", { cache: "no-cache" });
    // We can't await here at the top level, so messaging is initialized lazily
} catch(e){ /* ignore */ }

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open("onechat-sw-v1").then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// Receive push messages when the app is in the background/closed
self.addEventListener("push", (event) => {

    if(!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch(e){
        payload = { notification: { title: "OneChat", body: event.data.text() } };
    }

    const { notification = {}, data = {} } = payload;

    const title = notification.title || "OneChat";
    const options = {
        body: notification.body || "You have a new message",
        icon: "/logo.PNG",
        badge: "/logo.PNG",
        tag: data.chatId || "onechat-msg",
        renotify: true,
        data,
        vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));

});

// Open the correct chat when a notification is tapped
self.addEventListener("notificationclick", (event) => {

    event.notification.close();

    const data = event.notification.data || {};
    const url = data.uid ? `/chat.html?uid=${data.uid}&name=${encodeURIComponent(data.name || "")}` : "/home.html";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {

            for(const client of clients){
                if(client.url.includes(self.location.origin)){
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }

            return self.clients.openWindow(url);

        })
    );

});

/*
=========================================
OneChat
Firebase init + shared helpers
=========================================
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";

import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider,
    signInWithCredential,
    onAuthStateChanged,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
    initializeFirestore,
    doc,
    getDoc,
    getDocFromServer,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    collection,
    addDoc,
    query,
    where,
    limit,
    orderBy,
    onSnapshot,
    serverTimestamp,
    increment,
    arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import {
    getStorage,
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

import {
    getMessaging,
    getToken,
    onMessage,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js";

import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// The dev preview is served through Replit's proxied iframe (mTLS terminated
// in front of the app), which blocks Firestore's default WebChannel/gRPC
// streaming connection. Firestore then silently falls back to its offline
// cache and every read throws "Failed to get document because the client is
// offline" even though the network is fine. Forcing long-polling makes
// Firestore use plain HTTP requests instead, which the proxy passes through.
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false,
});

export const storage = getStorage(app);

let _messaging = null;

export function getMessagingInstance(){
    if(!_messaging){
        try {
            _messaging = getMessaging(app);
        } catch(e){
            console.warn("FCM not available:", e);
        }
    }
    return _messaging;
}

export {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider,
    signInWithCredential,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    getDocFromServer,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    collection,
    addDoc,
    query,
    where,
    limit,
    orderBy,
    onSnapshot,
    serverTimestamp,
    increment,
    arrayUnion,
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    getToken,
    onMessage,
};

export function slugify(text){

    return (text || "")
        .toLowerCase()
        .trim()
        .replace(/\(you\)$/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "chat";

}

// Reads a doc, retrying once against the server directly if the cached/stream
// read fails with a transient "client is offline" style error (this can happen
// briefly while Firestore's long-polling stream is still establishing). A real,
// persistent connectivity failure still propagates so callers can handle it.
async function readDocWithRetry(ref){

    try {

        return await getDoc(ref);

    } catch(err) {

        const message = (err && err.message) || "";
        const looksTransient = (err && err.code === "unavailable") || /offline/i.test(message);

        if(looksTransient){
            return await getDocFromServer(ref);
        }

        throw err;

    }

}

// ==========================================================================
// Presence (online / offline / last seen)
// ==========================================================================
let presenceStarted = false;

export function startPresence(uid){

    if(presenceStarted || !uid) return;
    presenceStarted = true;

    const userRef = doc(db, "users", uid);

    function setOnline(){
        setDoc(userRef, { online: true, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }

    function setOffline(){
        setDoc(userRef, { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }

    setOnline();

    setInterval(() => {
        if(document.visibilityState === "visible"){
            setOnline();
        }
    }, 25000);

    document.addEventListener("visibilitychange", () => {

        if(document.visibilityState === "visible"){
            setOnline();
        } else {
            setOffline();
        }

    });

    window.addEventListener("beforeunload", setOffline);
    window.addEventListener("pagehide", setOffline);

}

export function waitForAuthUser(){

    return new Promise((resolve) => {

        const unsub = onAuthStateChanged(auth, (user) => {
            unsub();
            resolve(user);
        });

    });

}

// Ensures a users/{uid} profile doc exists for a freshly authenticated user
// (phone-OTP is the only auth method), then returns both the ref and the snap.
export async function ensureUserProfile(user, extra){

    const userRef = doc(db, "users", user.uid);
    const snap = await readDocWithRetry(userRef);

    if(!snap.exists()){

        await setDoc(userRef, {
            phone: user.phoneNumber || "",
            displayName: "",
            about: "Available",
            email: "",
            onboarded: false,
            createdAt: serverTimestamp(),
            ...extra,
        });

    }

    return { userRef, isNew: !snap.exists() };

}

// Standard guard used by every screen that requires a signed-in, onboarded user.
// Resolves to { user, profile } or redirects to `redirectTo` and resolves to null.
export async function requireAuthAndOnboarding(redirectTo){

    const target = redirectTo || "welcome.html";

    const user = await waitForAuthUser();

    if(!user){
        window.location.href = target;
        return null;
    }

    const userRef = doc(db, "users", user.uid);
    let snap = await readDocWithRetry(userRef);

    if(!snap.exists()){
        await ensureUserProfile(user);
        snap = await readDocWithRetry(userRef);
    }

    const profile = snap.exists() ? snap.data() : null;

    if(!profile || profile.onboarded !== true){
        window.location.href = target;
        return null;
    }

    startPresence(user.uid);

    return { user, profile };

}

// ==========================================================================
// FCM Token Registration
// ==========================================================================
export async function registerFCMToken(uid){

    try {

        const messaging = getMessagingInstance();
        if(!messaging) return null;

        // Service worker must be registered first
        if(!("serviceWorker" in navigator)) return null;

        const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => null);
        if(!reg) return null;

        const vapidKey = firebaseConfig.vapidKey || "";

        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: reg,
        });

        if(token){
            // Save token to Firestore
            await updateDoc(doc(db, "users", uid), { fcmToken: token }).catch(() => {});
        }

        return token;

    } catch(err) {
        console.warn("FCM token registration failed:", err);
        return null;
    }

}

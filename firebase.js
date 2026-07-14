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
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
    initializeFirestore,
    doc,
    getDoc,
    getDocFromServer,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

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

export {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider,
    signInWithCredential,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    getDocFromServer,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    ref,
    uploadBytes,
    getDownloadURL,
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

export function waitForAuthUser(){

    return new Promise((resolve) => {

        const unsub = onAuthStateChanged(auth, (user) => {
            unsub();
            resolve(user);
        });

    });

}

// Ensures a users/{uid} profile doc exists for a freshly authenticated user
// (used by both the phone-OTP flow and the email/password flow), then returns it.
export async function ensureUserProfile(user, extra){

    const userRef = doc(db, "users", user.uid);
    const snap = await readDocWithRetry(userRef);

    if(!snap.exists()){

        await setDoc(userRef, {
            phone: user.phoneNumber || "",
            email: user.email || "",
            displayName: "OneChat User",
            about: "Available",
            onboarded: false,
            createdAt: serverTimestamp(),
            ...extra,
        });

    }

    return userRef;

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

    // The user is authenticated but has no profile doc yet (e.g. it was never
    // created, or was lost) -- create it instead of treating this as an error,
    // then re-read so callers always get a real profile object back.
    if(!snap.exists()){
        await ensureUserProfile(user);
        snap = await readDocWithRetry(userRef);
    }

    const profile = snap.exists() ? snap.data() : null;

    if(!profile || profile.onboarded !== true){
        window.location.href = target;
        return null;
    }

    return { user, profile };

}

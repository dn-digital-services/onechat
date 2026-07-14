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
    getFirestore,
    doc,
    getDoc,
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
export const db = getFirestore(app);
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
    const snap = await getDoc(userRef);

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

    const snap = await getDoc(doc(db, "users", user.uid));
    const profile = snap.exists() ? snap.data() : null;

    if(!profile || profile.onboarded !== true){
        window.location.href = target;
        return null;
    }

    return { user, profile };

}

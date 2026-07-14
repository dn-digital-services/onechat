---
name: Firebase phone auth on static multi-page sites
description: Pitfalls when wiring Firebase Phone Authentication into a static, multi-page (non-SPA) site.
---

Firebase's `signInWithPhoneNumber` returns a `confirmationResult` object that only lives in memory. On a static multi-page site where each screen is a separate HTML file reached via full `window.location.href` navigation, that in-memory object is destroyed on navigation.

**Why:** the JS execution context resets on every full page load, so anything not persisted (localStorage/sessionStorage/Firestore) is lost between e.g. a login page and a verify-code page.

**How to apply:** extract `confirmationResult.verificationId` (a plain string) and store it in `sessionStorage` before navigating away. On the next page, rebuild the credential with `PhoneAuthProvider.credential(verificationId, code)` and call `signInWithCredential(auth, credential)` — no need to keep the original confirmationResult object alive.

Also: Firebase SMS OTP codes are always 6 digits and this isn't configurable. If a UI was designed around a 4-digit code (a common demo/mock assumption), the input needs to be widened to 6 boxes or real verification will never succeed.

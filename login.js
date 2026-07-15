import {
    auth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
} from "./firebase.js";

window.addEventListener("load", () => {

    const phoneForm = document.getElementById("phoneLoginForm");
    const phone = document.getElementById("phone");
    const errorMsg = document.getElementById("errorMsg");
    const loginBtn = document.getElementById("loginBtn");

    // ==========================================================================
    // reCAPTCHA singleton management
    // ==========================================================================
    // Firebase throws "reCAPTCHA has already been rendered in this element" if
    // `render()` (which signInWithPhoneNumber calls internally) ever runs twice
    // against the same live widget/container. To make that structurally
    // impossible we:
    //   1. Keep exactly ONE verifier instance for the whole app, stored on
    //      `window` (not a module-local variable) so it survives even if this
    //      script is re-evaluated.
    //   2. Never reuse the same DOM container across verifier instances --
    //      instead of trusting clear() to fully reset Firebase's internal
    //      grecaptcha widget bookkeeping (which is unreliable, especially on
    //      Safari/iOS and inside Replit's proxied preview iframe), we destroy
    //      the old container element outright and mint a brand new one with a
    //      unique id before ever constructing a new RecaptchaVerifier.
    //   3. Track an explicit "ready" promise for the current verifier's
    //      render() call so nothing ever invokes signInWithPhoneNumber (which
    //      internally calls render()) before the previous render has settled.

    let containerSeq = 0;

    function createFreshContainer(){

        const old = document.getElementById(window.recaptchaContainerId || "recaptcha-container");

        if(old && old.parentNode){
            old.parentNode.removeChild(old);
        }

        containerSeq += 1;

        const fresh = document.createElement("div");
        fresh.id = `recaptcha-container-${containerSeq}`;

        // Keep it in the same spot at the end of the login screen, matching the
        // original static markup's position (invisible reCAPTCHA renders no
        // visible UI, so placement only matters for consistent DOM structure).
        document.querySelector(".login-screen").appendChild(fresh);

        window.recaptchaContainerId = fresh.id;

        return fresh;

    }

    function destroyVerifier(){

        if(window.recaptchaVerifier){

            try {
                window.recaptchaVerifier.clear();
            } catch(clearErr) {
                console.warn("Failed to clear reCAPTCHA verifier:", clearErr);
            }

            window.recaptchaVerifier = null;

        }

        window.recaptchaReadyPromise = null;

    }

    // Builds (or returns the existing) singleton verifier and makes sure it has
    // actually finished rendering before resolving -- callers must await this
    // before passing the verifier into signInWithPhoneNumber, otherwise a
    // render() still in flight can collide with the one signInWithPhoneNumber
    // triggers itself, which is what produces "Cannot contact reCAPTCHA" on
    // flaky connections (including Safari's stricter iframe/cookie handling).
    function ensureRecaptchaReady(){

        if(window.recaptchaVerifier && window.recaptchaReadyPromise){
            return window.recaptchaReadyPromise;
        }

        const container = createFreshContainer();

        window.recaptchaVerifier = new RecaptchaVerifier(auth, container.id, { size: "invisible" });

        window.recaptchaReadyPromise = window.recaptchaVerifier.render()
            .catch((renderErr) => {

                console.error("reCAPTCHA render failed:", renderErr);

                // Leave nothing half-built behind for the next attempt to trip over.
                destroyVerifier();

                throw renderErr;

            });

        return window.recaptchaReadyPromise;

    }

    // After ANY failed sign-in attempt the widget must be torn down completely
    // (not just visually reset) -- Firebase marks a used/failed invisible
    // widget as spent, so reusing it is exactly what causes "reCAPTCHA has
    // already been rendered" / "Cannot contact reCAPTCHA" on the second try.
    function resetRecaptchaAfterFailure(){
        destroyVerifier();
    }

    // Warm up the verifier as soon as the page loads so the first submit is
    // fast; failures here are swallowed since the submit handler will retry
    // via ensureRecaptchaReady() anyway.
    ensureRecaptchaReady().catch(() => {});

    // ---- Phone OTP login (only auth method) ----

    // Explicit re-entrancy guard, checked synchronously before anything else --
    // this is belt-and-suspenders alongside disabling the button, so even a
    // second "submit" event fired before the disabled attribute has visually
    // taken effect (double-tap on mobile, Enter key + click, etc.) is dropped.
    let isSending = false;

    phoneForm.addEventListener("submit", (e) => {

        e.preventDefault();

        if(isSending || loginBtn.disabled){
            return;
        }

        errorMsg.textContent = "";

        const digits = phone.value.trim().replace(/[\s()-]/g, "");

        if(!/^[6-9]\d{9}$/.test(digits)){
            errorMsg.textContent = "Enter a valid 10-digit Indian mobile number.";
            return;
        }

        const fullPhone = `+91${digits}`;

        isSending = true;
        loginBtn.disabled = true;
        loginBtn.textContent = "Sending code...";

        ensureRecaptchaReady()
            .then((widgetId) => {

                void widgetId;

                return signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);

            })
            .then((confirmationResult) => {

                sessionStorage.setItem("oc_verification_id", confirmationResult.verificationId);
                sessionStorage.setItem("oc_phone", fullPhone);

                window.location.href = "otp.html";

            })
            .catch((err) => {

                console.error("Phone sign-in failed:", err);

                const code = (err && err.code) || "unknown";
                const detail = (err && err.message) || String(err);

                if(code === "auth/invalid-phone-number"){
                    errorMsg.textContent = "That phone number looks invalid.";
                } else if(code === "auth/too-many-requests"){
                    errorMsg.textContent = "Too many attempts. Please try again later.";
                } else if(code === "auth/network-request-failed"){
                    errorMsg.textContent = "Network error contacting reCAPTCHA. Check your connection and try again.";
                } else {
                    // Surface the exact Firebase error code/message so it's visible without
                    // needing devtools open (useful on mobile where console access is limited).
                    errorMsg.textContent = `Couldn't send the code (${code}): ${detail}`;
                }

                // Firebase invalidates the widget after a failed attempt (successful or
                // not -- an invisible widget is single-use either way), so it must be
                // fully torn down. The NEXT submit attempt will lazily rebuild it via
                // ensureRecaptchaReady() with a brand new container, rather than eagerly
                // rebuilding here -- that avoids a second render() racing anything still
                // settling from the failed one.
                resetRecaptchaAfterFailure();

                isSending = false;
                loginBtn.disabled = false;
                loginBtn.textContent = "Send OTP";

            });

    });

});

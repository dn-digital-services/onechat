import {
    auth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
} from "./firebase.js";

window.addEventListener("load", () => {

    const phoneForm = document.getElementById("phoneSignupForm");
    const phone = document.getElementById("phone");
    const errorMsg = document.getElementById("errorMsg");
    const sendOtpBtn = document.getElementById("sendOtpBtn");

    // ==========================================================================
    // reCAPTCHA singleton – identical pattern to login.js to avoid
    // "reCAPTCHA already rendered" and "Cannot contact reCAPTCHA" errors.
    // ==========================================================================

    let containerSeq = 0;

    function createFreshContainer(){

        const old = document.getElementById(window.recaptchaContainerId || "recaptcha-container");

        if(old && old.parentNode){
            old.parentNode.removeChild(old);
        }

        containerSeq += 1;

        const fresh = document.createElement("div");
        fresh.id = `recaptcha-container-${containerSeq}`;

        document.getElementById("signupPhoneScreen").appendChild(fresh);

        window.recaptchaContainerId = fresh.id;

        return fresh;

    }

    function destroyVerifier(){

        if(window.recaptchaVerifier){
            try {
                window.recaptchaVerifier.clear();
            } catch(clearErr){
                console.warn("Failed to clear reCAPTCHA verifier:", clearErr);
            }
            window.recaptchaVerifier = null;
        }

        window.recaptchaReadyPromise = null;

    }

    function ensureRecaptchaReady(){

        if(window.recaptchaVerifier && window.recaptchaReadyPromise){
            return window.recaptchaReadyPromise;
        }

        const container = createFreshContainer();

        window.recaptchaVerifier = new RecaptchaVerifier(auth, container.id, { size: "invisible" });

        window.recaptchaReadyPromise = window.recaptchaVerifier.render()
            .catch((renderErr) => {
                console.error("reCAPTCHA render failed:", renderErr);
                destroyVerifier();
                throw renderErr;
            });

        return window.recaptchaReadyPromise;

    }

    function resetRecaptchaAfterFailure(){
        destroyVerifier();
    }

    // Warm up reCAPTCHA immediately so the first submit is fast.
    ensureRecaptchaReady().catch(() => {});

    // ── Form submit ────────────────────────────────────────────────────────────

    let isSending = false;

    phoneForm.addEventListener("submit", (e) => {

        e.preventDefault();

        if(isSending || sendOtpBtn.disabled) return;

        errorMsg.textContent = "";

        const digits = phone.value.trim().replace(/[\s()-]/g, "");

        if(!/^[6-9]\d{9}$/.test(digits)){
            errorMsg.textContent = "Enter a valid 10-digit Indian mobile number.";
            return;
        }

        const fullPhone = `+91${digits}`;

        isSending = true;
        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = "Sending code...";

        ensureRecaptchaReady()
            .then(() => signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier))
            .then((confirmationResult) => {

                sessionStorage.setItem("oc_verification_id", confirmationResult.verificationId);
                sessionStorage.setItem("oc_phone", fullPhone);
                // Mark this as the sign-up flow so otp.js can apply the right routing.
                sessionStorage.setItem("oc_flow", "signup");

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
                    errorMsg.textContent = "Network error. Check your connection and try again.";
                } else {
                    errorMsg.textContent = `Couldn't send the code (${code}): ${detail}`;
                }

                resetRecaptchaAfterFailure();

                isSending = false;
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = "Send OTP";

            });

    });

});

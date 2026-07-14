import {
    auth,
    db,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    ensureUserProfile,
} from "./firebase.js";

window.addEventListener("load", () => {

    const phoneForm = document.getElementById("phoneLoginForm");
    const phone = document.getElementById("phone");
    const errorMsg = document.getElementById("errorMsg");
    const loginBtn = document.getElementById("loginBtn");

    const emailForm = document.getElementById("emailLoginForm");
    const email = document.getElementById("email");
    const emailPassword = document.getElementById("emailPassword");
    const emailErrorMsg = document.getElementById("emailErrorMsg");
    const emailLoginBtn = document.getElementById("emailLoginBtn");

    document.getElementById("showEmailLogin").addEventListener("click", (e) => {
        e.preventDefault();
        phoneForm.classList.add("hidden");
        emailForm.classList.remove("hidden");
    });

    document.getElementById("showPhoneLogin").addEventListener("click", (e) => {
        e.preventDefault();
        emailForm.classList.add("hidden");
        phoneForm.classList.remove("hidden");
    });

    // Exactly ONE RecaptchaVerifier must exist for this page at any time. It is
    // stored on `window` (not just a module-local variable) so that even if this
    // script were ever evaluated more than once, or another script checked for it,
    // everyone agrees on whether a verifier already exists. Firebase throws
    // "reCAPTCHA has already been rendered in this element" if `render()` (which
    // signInWithPhoneNumber calls internally) runs a second time on a verifier
    // still attached to #recaptcha-container -- so we only ever create a new one
    // when none currently exists, and explicitly clear() the old one first if we
    // ever need to replace it.
    function getRecaptchaVerifier(){

        if(!window.recaptchaVerifier){
            window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
        }

        return window.recaptchaVerifier;

    }

    function resetRecaptchaVerifier(){

        if(window.recaptchaVerifier){

            try {
                window.recaptchaVerifier.clear();
            } catch(clearErr) {
                console.warn("Failed to clear reCAPTCHA:", clearErr);
            }

            window.recaptchaVerifier = null;

        }

        return getRecaptchaVerifier();

    }

    // Create the single verifier up front so it is ready before the user submits.
    getRecaptchaVerifier();

    // ---- Phone OTP login ----

    phoneForm.addEventListener("submit", (e) => {

        e.preventDefault();

        errorMsg.textContent = "";

        const digits = phone.value.trim().replace(/[\s()-]/g, "");

        if(!/^[6-9]\d{9}$/.test(digits)){
            errorMsg.textContent = "Enter a valid 10-digit Indian mobile number.";
            return;
        }

        const fullPhone = `+91${digits}`;

        loginBtn.disabled = true;
        loginBtn.textContent = "Sending code...";

        signInWithPhoneNumber(auth, fullPhone, getRecaptchaVerifier())
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
                } else {
                    // Surface the exact Firebase error code/message so it's visible without
                    // needing devtools open (useful on mobile where console access is limited).
                    errorMsg.textContent = `Couldn't send the code (${code}): ${detail}`;
                }

                loginBtn.disabled = false;
                loginBtn.textContent = "Continue";

                // Firebase invalidates the widget after a failed verification attempt,
                // so it must be explicitly cleared and rebuilt once (not lazily on next
                // click) before it can be reused for the next signInWithPhoneNumber call.
                resetRecaptchaVerifier();

            });

    });

    // ---- Email/password login (optional, separate from phone OTP) ----

    emailForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        emailErrorMsg.textContent = "";

        const emailValue = email.value.trim();
        const passwordValue = emailPassword.value;

        if(!emailValue || passwordValue.length < 6){
            emailErrorMsg.textContent = "Enter a valid email and a password of at least 6 characters.";
            return;
        }

        emailLoginBtn.disabled = true;
        emailLoginBtn.textContent = "Logging in...";

        try {

            let userCredential;
            let isNewAccount = false;

            try {

                userCredential = await signInWithEmailAndPassword(auth, emailValue, passwordValue);

            } catch(err) {

                if(err.code === "auth/user-not-found" || err.code === "auth/invalid-credential"){
                    userCredential = await createUserWithEmailAndPassword(auth, emailValue, passwordValue);
                    isNewAccount = true;
                } else {
                    throw err;
                }

            }

            await ensureUserProfile(userCredential.user, { email: emailValue });

            // Existing accounts go straight to the home/chat screen; only a brand
            // new account needs the onboarding/permissions step first.
            window.location.href = isNewAccount ? "permissions.html" : "home.html";

        } catch(err) {

            console.error("Email sign-in failed:", err);

            // Surface the actual Firebase error message so the user sees exactly
            // why the login failed, instead of a generic message.
            emailErrorMsg.textContent = (err && err.message) ? err.message : "Couldn't sign in. Please try again.";

            emailLoginBtn.disabled = false;
            emailLoginBtn.textContent = "Login";

        }

    });

});

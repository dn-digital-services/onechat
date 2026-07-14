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

    // Create exactly ONE RecaptchaVerifier for the lifetime of this page and reuse
    // it for every login attempt. Firebase's own docs warn that calling `render()`
    // (which signInWithPhoneNumber does internally) a second time on a verifier
    // already bound to this container throws "reCAPTCHA has already been rendered
    // in this element" -- so we must never construct a second instance while the
    // first is still attached, even after a failed attempt.
    let recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });

    function resetRecaptcha(){

        try {
            recaptchaVerifier.clear();
        } catch(clearErr) {
            console.warn("Failed to clear reCAPTCHA:", clearErr);
        }

        recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });

    }

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

        signInWithPhoneNumber(auth, fullPhone, recaptchaVerifier)
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
                resetRecaptcha();

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
        emailLoginBtn.textContent = "Please wait...";

        try {

            let userCredential;

            try {

                userCredential = await signInWithEmailAndPassword(auth, emailValue, passwordValue);

            } catch(err) {

                if(err.code === "auth/user-not-found" || err.code === "auth/invalid-credential"){
                    userCredential = await createUserWithEmailAndPassword(auth, emailValue, passwordValue);
                } else {
                    throw err;
                }

            }

            await ensureUserProfile(userCredential.user, { email: emailValue });

            window.location.href = "permissions.html";

        } catch(err) {

            console.error("Email sign-in failed:", err);

            if(err.code === "auth/wrong-password"){
                emailErrorMsg.textContent = "Incorrect password.";
            } else if(err.code === "auth/weak-password"){
                emailErrorMsg.textContent = "Password must be at least 6 characters.";
            } else if(err.code === "auth/invalid-email"){
                emailErrorMsg.textContent = "That email address looks invalid.";
            } else {
                emailErrorMsg.textContent = "Couldn't sign in. Please try again.";
            }

            emailLoginBtn.disabled = false;
            emailLoginBtn.textContent = "Continue";

        }

    });

});

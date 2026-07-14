import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "./firebase.js";

window.addEventListener("load", () => {

    const form = document.getElementById("loginForm");
    const phone = document.getElementById("phone");
    const password = document.getElementById("password");
    const errorMsg = document.getElementById("errorMsg");
    const loginBtn = document.getElementById("loginBtn");

    let recaptchaVerifier = null;

    function getRecaptcha(){

        if(!recaptchaVerifier){
            recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
        }

        return recaptchaVerifier;

    }

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        errorMsg.textContent = "";

        const rawPhone = phone.value.trim().replace(/[\s()-]/g, "");

        if(!/^\+[1-9]\d{6,14}$/.test(rawPhone)){
            errorMsg.textContent = "Enter a valid phone number with country code (e.g. +15551234567).";
            return;
        }

        if(password.value.trim().length < 4){
            errorMsg.textContent = "Password must be at least 4 characters.";
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "Sending code...";

        signInWithPhoneNumber(auth, rawPhone, getRecaptcha())
            .then((confirmationResult) => {

                sessionStorage.setItem("oc_verification_id", confirmationResult.verificationId);
                sessionStorage.setItem("oc_phone", rawPhone);

                window.location.href = "otp.html";

            })
            .catch((err) => {

                console.error("Phone sign-in failed:", err);

                if(err && err.code === "auth/invalid-phone-number"){
                    errorMsg.textContent = "That phone number looks invalid.";
                } else if(err && err.code === "auth/too-many-requests"){
                    errorMsg.textContent = "Too many attempts. Please try again later.";
                } else {
                    errorMsg.textContent = "Couldn't send the code. Please try again.";
                }

                loginBtn.disabled = false;
                loginBtn.textContent = "Continue";

                recaptchaVerifier = null;

            });

    });

});

import { auth, PhoneAuthProvider, signInWithCredential, ensureUserProfile } from "./firebase.js";

window.addEventListener("load", () => {

    const identifierText = document.getElementById("identifierText");
    const boxes = Array.from(document.querySelectorAll(".otp-box"));
    const form = document.getElementById("otpForm");
    const errorMsg = document.getElementById("errorMsg");
    const verifyBtn = document.getElementById("verifyBtn");
    const resendLink = document.getElementById("resendLink");
    const resendTimer = document.getElementById("resendTimer");

    const phone = sessionStorage.getItem("oc_phone");
    const verificationId = sessionStorage.getItem("oc_verification_id");

    if(!verificationId){
        window.location.href = "login.html";
        return;
    }

    if(phone){
        identifierText.textContent = phone;
    }

    boxes.forEach((box, i) => {

        box.addEventListener("input", () => {

            box.value = box.value.replace(/[^0-9]/g, "");

            if(box.value && i < boxes.length - 1){
                boxes[i + 1].focus();
            }

        });

        box.addEventListener("keydown", (e) => {

            if(e.key === "Backspace" && !box.value && i > 0){
                boxes[i - 1].focus();
            }

        });

    });

    let seconds = 30;

    function startTimer(){

        resendLink.classList.add("disabled");

        resendTimer.textContent = "(" + seconds + "s)";

        const interval = setInterval(() => {

            seconds--;

            if(seconds <= 0){

                clearInterval(interval);

                resendLink.classList.remove("disabled");

                resendTimer.textContent = "";

            } else {

                resendTimer.textContent = "(" + seconds + "s)";

            }

        }, 1000);

    }

    startTimer();

    resendLink.addEventListener("click", (e) => {

        e.preventDefault();

        if(resendLink.classList.contains("disabled")) return;

        // Re-sending requires a fresh reCAPTCHA challenge, so send the user
        // back to the login screen to request a new code.
        window.location.href = "login.html";

    });

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        const code = boxes.map((b) => b.value).join("");

        errorMsg.textContent = "";

        if(code.length < boxes.length){
            errorMsg.textContent = `Enter the ${boxes.length}-digit code.`;
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verifying...";

        const credential = PhoneAuthProvider.credential(verificationId, code);

        signInWithCredential(auth, credential)
            .then(async (result) => {

                await ensureUserProfile(result.user, { phone: phone || result.user.phoneNumber || "" });

                sessionStorage.removeItem("oc_verification_id");
                sessionStorage.removeItem("oc_phone");

                window.location.href = "permissions.html";

            })
            .catch((err) => {

                console.error("OTP verification failed:", err);

                errorMsg.textContent = "Invalid code. Please try again.";

                verifyBtn.disabled = false;
                verifyBtn.textContent = "Verify";

            });

    });

});

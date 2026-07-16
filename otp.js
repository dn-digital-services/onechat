import { auth, PhoneAuthProvider, signInWithCredential, ensureUserProfile, doc, getDoc, db } from "./firebase.js";

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

                const { isNew } = await ensureUserProfile(result.user, { phone: phone || result.user.phoneNumber || "" });

                sessionStorage.removeItem("oc_verification_id");
                sessionStorage.removeItem("oc_phone");

                // Check if user is already onboarded
                const userSnap = await getDoc(doc(db, "users", result.user.uid));
                const profile = userSnap.exists() ? userSnap.data() : null;

                if(profile && profile.onboarded === true){
                    // Returning user – go straight home
                    window.location.href = "home.html";
                } else {
                    // New user – must complete sign-up
                    window.location.href = "signup.html";
                }

            })
            .catch((err) => {

                console.error("OTP verification failed:", err);

                errorMsg.textContent = "Invalid code. Please try again.";

                verifyBtn.disabled = false;
                verifyBtn.textContent = "Verify";

            });

    });

});

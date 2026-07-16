import {
    auth,
    PhoneAuthProvider,
    signInWithCredential,
    ensureUserProfile,
    doc,
    getDoc,
    db,
} from "./firebase.js";

window.addEventListener("load", () => {

    const identifierText = document.getElementById("identifierText");
    const boxes = Array.from(document.querySelectorAll(".otp-box"));
    const form = document.getElementById("otpForm");
    const errorMsg = document.getElementById("errorMsg");
    const verifyBtn = document.getElementById("verifyBtn");
    const resendLink = document.getElementById("resendLink");
    const resendTimer = document.getElementById("resendTimer");
    const actionMsg = document.getElementById("otpActionMsg");
    const actionText = document.getElementById("otpActionText");
    const actionBtn = document.getElementById("otpActionBtn");

    const phone = sessionStorage.getItem("oc_phone");
    const verificationId = sessionStorage.getItem("oc_verification_id");
    // Read flow before any cleanup so resend knows where to go back.
    const flow = sessionStorage.getItem("oc_flow") || "login";

    if(!verificationId){
        window.location.href = flow === "signup" ? "signup-phone.html" : "login.html";
        return;
    }

    if(phone){
        identifierText.textContent = phone;
    }

    // Resend goes back to whichever phone-entry page the user came from.
    const backPage = flow === "signup" ? "signup-phone.html" : "login.html";

    // ── OTP input boxes ─────────────────────────────────────────────────────

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

        // Support pasting a full code into the first box.
        box.addEventListener("paste", (e) => {

            if(i !== 0) return;

            e.preventDefault();

            const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");

            boxes.forEach((b, idx) => {
                b.value = text[idx] || "";
            });

            const lastFilled = Math.min(text.length - 1, boxes.length - 1);
            if(lastFilled >= 0) boxes[lastFilled].focus();

        });

    });

    // ── Resend timer ─────────────────────────────────────────────────────────

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
        window.location.href = backPage;
    });

    // ── Show blocking action message (already registered / no account) ───────

    function showActionMsg(text, btnLabel, btnHref){

        errorMsg.textContent = "";

        actionText.textContent = text;
        actionBtn.textContent = btnLabel;
        actionBtn.href = btnHref;
        actionMsg.classList.remove("hidden");

        // Lock the form so the user engages with the message.
        boxes.forEach((b) => { b.disabled = true; });
        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verify";

    }

    // ── Form submit ──────────────────────────────────────────────────────────

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const code = boxes.map((b) => b.value).join("");

        errorMsg.textContent = "";
        actionMsg.classList.add("hidden");

        if(code.length < boxes.length){
            errorMsg.textContent = `Enter the ${boxes.length}-digit code.`;
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verifying...";

        const credential = PhoneAuthProvider.credential(verificationId, code);

        try {

            const result = await signInWithCredential(auth, credential);

            // Clean up session data (flow is cleaned per-branch below).
            sessionStorage.removeItem("oc_verification_id");
            sessionStorage.removeItem("oc_phone");

            // Fetch the Firestore profile for this auth user.
            const userSnap = await getDoc(doc(db, "users", result.user.uid));
            const profile = userSnap.exists() ? userSnap.data() : null;

            // ── SIGN-UP flow ──────────────────────────────────────────────
            if(flow === "signup"){

                sessionStorage.removeItem("oc_flow");

                // A profile with a displayName means this phone was already
                // used to complete sign-up – block and ask them to log in.
                if(profile && profile.displayName){
                    showActionMsg(
                        "This phone number is already registered.",
                        "Log in instead",
                        "login.html"
                    );
                    return;
                }

                // Brand-new phone – create the stub profile and go to profile setup.
                await ensureUserProfile(result.user, { phone: phone || result.user.phoneNumber || "" });
                window.location.href = "signup.html";

            // ── LOGIN flow ────────────────────────────────────────────────
            } else {

                sessionStorage.removeItem("oc_flow");

                // A logged-in phone with no Firestore profile (or no displayName)
                // means they never completed sign-up.
                if(!profile || !profile.displayName){
                    showActionMsg(
                        "No account found for this number. Please sign up first.",
                        "Sign up",
                        "signup-phone.html"
                    );
                    return;
                }

                // Fully onboarded → home; otherwise finish profile setup.
                if(profile.onboarded === true){
                    window.location.href = "home.html";
                } else {
                    window.location.href = "signup.html";
                }

            }

        } catch(err){

            console.error("OTP verification failed:", err);

            errorMsg.textContent = "Invalid code. Please try again.";

            verifyBtn.disabled = false;
            verifyBtn.textContent = "Verify";

        }

    });

});

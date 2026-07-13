window.addEventListener("load", () => {

    const identifierText = document.getElementById("identifierText");
    const boxes = Array.from(document.querySelectorAll(".otp-box"));
    const form = document.getElementById("otpForm");
    const errorMsg = document.getElementById("errorMsg");
    const verifyBtn = document.getElementById("verifyBtn");
    const resendLink = document.getElementById("resendLink");
    const resendTimer = document.getElementById("resendTimer");

    const identifier = localStorage.getItem("oc_identifier");

    if(identifier){
        identifierText.textContent = identifier;
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

        seconds = 30;

        boxes.forEach((b) => b.value = "");
        boxes[0].focus();

        startTimer();

    });

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        const code = boxes.map((b) => b.value).join("");

        errorMsg.textContent = "";

        if(code.length < 4){
            errorMsg.textContent = "Enter the 4-digit code.";
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verifying...";

        localStorage.setItem("oc_verified", "true");

        setTimeout(() => {
            window.location.href = "permissions.html";
        }, 600);

    });

});

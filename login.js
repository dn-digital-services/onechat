window.addEventListener("load", () => {

    const form = document.getElementById("loginForm");
    const phone = document.getElementById("phone");
    const password = document.getElementById("password");
    const errorMsg = document.getElementById("errorMsg");
    const loginBtn = document.getElementById("loginBtn");

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        errorMsg.textContent = "";

        if(phone.value.trim().length < 3){
            errorMsg.textContent = "Enter a valid phone number or email.";
            return;
        }

        if(password.value.trim().length < 4){
            errorMsg.textContent = "Password must be at least 4 characters.";
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "Sending code...";

        localStorage.setItem("oc_identifier", phone.value.trim());

        setTimeout(() => {
            window.location.href = "otp.html";
        }, 700);

    });

});

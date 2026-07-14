import { db, doc, setDoc, waitForAuthUser } from "./firebase.js";

window.addEventListener("load", async () => {

    const user = await waitForAuthUser();

    if(!user){
        window.location.href = "welcome.html";
        return;
    }

    const continueBtn = document.getElementById("continueBtn");
    const skipLink = document.getElementById("skipLink");

    let saving = false;

    async function saveAndGo(){

        if(saving) return;
        saving = true;

        const permissions = {};

        document.querySelectorAll(".permission-item").forEach((item) => {

            const key = item.getAttribute("data-permission");
            const checked = item.querySelector(".permission-toggle").checked;

            permissions[key] = checked;

        });

        continueBtn.disabled = true;

        try {

            await setDoc(doc(db, "users", user.uid), {
                permissions,
                onboarded: true,
            }, { merge: true });

            window.location.href = "home.html";

        } catch(e) {

            console.error("Failed to save permissions:", e);
            continueBtn.disabled = false;
            saving = false;

        }

    }

    continueBtn.addEventListener("click", saveAndGo);

    skipLink.addEventListener("click", (e) => {

        e.preventDefault();

        saveAndGo();

    });

});

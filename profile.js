window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const identifier = localStorage.getItem("oc_identifier");
    const nameEl = document.getElementById("profileName");
    const identifierEl = document.getElementById("profileIdentifier");
    const avatarEl = document.getElementById("profileAvatar");

    if(identifier){

        identifierEl.textContent = identifier;

        const initials = identifier.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "OC";

        avatarEl.textContent = initials;
        nameEl.textContent = "OneChat User";

    }

    document.getElementById("logoutBtn").addEventListener("click", () => {

        localStorage.removeItem("oc_identifier");
        localStorage.removeItem("oc_verified");
        localStorage.removeItem("oc_onboarded");
        localStorage.removeItem("oc_permissions");

        window.location.href = "welcome.html";

    });

});

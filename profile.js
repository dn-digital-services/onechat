window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const identifier = localStorage.getItem("oc_identifier");
    const nameEl = document.getElementById("profileName");
    const headerNameEl = document.getElementById("headerName");
    const identifierEl = document.getElementById("profileIdentifier");
    const avatarEl = document.getElementById("profileAvatar");
    const navAvatarEl = document.getElementById("navAvatar");

    if(identifier){

        identifierEl.textContent = identifier;

        const initials = identifier.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "OC";

        avatarEl.textContent = initials;
        navAvatarEl.textContent = initials;
        nameEl.textContent = "OneChat User";
        headerNameEl.textContent = "OneChat User";

    }

    document.querySelectorAll(".settings-item[data-item]").forEach((item) => {

        item.addEventListener("click", () => {

            // Placeholder navigation hook for future settings sub-pages.
            console.log("Open settings section:", item.getAttribute("data-item"));

        });

    });

    document.getElementById("logoutBtn").addEventListener("click", () => {

        localStorage.removeItem("oc_identifier");
        localStorage.removeItem("oc_verified");
        localStorage.removeItem("oc_onboarded");
        localStorage.removeItem("oc_permissions");

        window.location.href = "welcome.html";

    });

});

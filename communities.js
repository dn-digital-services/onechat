window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const identifier = localStorage.getItem("oc_identifier");
    const navAvatar = document.getElementById("navAvatar");

    if(identifier){
        const initials = identifier.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "OC";
        navAvatar.textContent = initials;
    }

});

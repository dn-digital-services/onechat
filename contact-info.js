window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);

    const name = params.get("name") || "OneChat User";
    const isSelf = params.get("self") === "1";
    const numberParam = params.get("number") || "";

    document.getElementById("infoName").textContent = name.replace(/\s*\(You\)\s*$/, "");

    const numberEl = document.getElementById("infoNumber");
    const statusEl = document.getElementById("infoStatus");

    if(isSelf){

        numberEl.style.display = "none";
        statusEl.textContent = localStorage.getItem("oc_about") || "Available";

    } else if(numberParam){

        numberEl.textContent = numberParam;
        statusEl.textContent = "Available";

    } else {

        numberEl.style.display = "none";
        statusEl.textContent = "Available";

    }

    const infoAvatar = document.getElementById("infoAvatar");
    const initials = ocGetInitials(name);

    if(isSelf){
        ocApplyAvatar(infoAvatar, initials);
    } else {
        infoAvatar.textContent = initials;
    }

    document.getElementById("backBtn").addEventListener("click", () => {
        window.history.back();
    });

    document.getElementById("editBtn").addEventListener("click", () => {

        if(isSelf){
            window.location.href = "myprofile.html";
        } else {
            alert("You can only edit your own contact info from your profile.");
        }

    });

    ["audioBtn", "videoBtn"].forEach((id) => {

        document.getElementById(id).addEventListener("click", () => {
            window.location.href = "calls.html";
        });

    });

    const lockToggle = document.getElementById("lockToggle");

    lockToggle.addEventListener("change", () => {

        if(lockToggle.checked){
            alert("This chat is now locked and hidden on this device.");
        }

    });

});

window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const identifier = localStorage.getItem("oc_identifier") || "";

    const bigAvatar = document.getElementById("bigAvatar");
    const navAvatar = document.getElementById("navAvatar");
    const nameValue = document.getElementById("nameValue");
    const usernameValue = document.getElementById("usernameValue");
    const phoneValue = document.getElementById("phoneValue");
    const linksValue = document.getElementById("linksValue");
    const thoughtText = document.getElementById("thoughtText");

    const isPhone = /^[+\d][\d\s-]{5,}$/.test(identifier.trim());

    function refresh(){

        const name = ocGetDisplayName();
        const initials = ocGetInitials(name);

        ocApplyAvatar(bigAvatar, initials);
        ocApplyAvatar(navAvatar, initials);

        nameValue.textContent = name;

        const username = localStorage.getItem("oc_username");

        if(username){
            usernameValue.textContent = "@" + username;
            usernameValue.classList.remove("accent");
        } else {
            usernameValue.textContent = "Reserve username";
            usernameValue.classList.add("accent");
        }

        const phone = localStorage.getItem("oc_phone") || (isPhone ? identifier : "");
        phoneValue.textContent = phone || "Not set";

        const links = localStorage.getItem("oc_links");

        if(links){
            linksValue.textContent = links;
            linksValue.classList.remove("accent");
        } else {
            linksValue.textContent = "Add links";
            linksValue.classList.add("accent");
        }

        thoughtText.textContent = localStorage.getItem("oc_about") || "Share a thought!";

    }

    refresh();

    document.getElementById("backBtn").addEventListener("click", () => {
        window.location.href = "profile.html";
    });

    const avatarInput = document.getElementById("avatarInput");

    function openPhotoPicker(){
        avatarInput.click();
    }

    document.getElementById("cameraBadge").addEventListener("click", openPhotoPicker);
    document.getElementById("bigAvatar").addEventListener("click", openPhotoPicker);
    document.getElementById("editLink").addEventListener("click", openPhotoPicker);

    avatarInput.addEventListener("change", (e) => {

        const file = e.target.files && e.target.files[0];

        if(!file) return;

        if(!file.type.startsWith("image/")){
            alert("Please choose an image file.");
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            localStorage.setItem("oc_avatar", reader.result);
            refresh();
        };

        reader.readAsDataURL(file);

    });

    document.getElementById("thoughtBtn").addEventListener("click", () => {

        const current = localStorage.getItem("oc_about") || "";
        const value = prompt("Share a thought", current);

        if(value !== null){
            if(value.trim()){
                localStorage.setItem("oc_about", value.trim());
            } else {
                localStorage.removeItem("oc_about");
            }
            refresh();
        }

    });

    document.getElementById("nameItem").addEventListener("click", () => {

        const current = ocGetDisplayName();
        const value = prompt("Your name", current === "OneChat User" ? "" : current);

        if(value !== null && value.trim()){
            localStorage.setItem("oc_name", value.trim());
            refresh();
        }

    });

    document.getElementById("usernameItem").addEventListener("click", () => {

        const current = localStorage.getItem("oc_username") || "";
        const value = prompt("Choose a username", current);

        if(value !== null){
            const clean = value.trim().replace(/^@/, "");
            if(clean){
                localStorage.setItem("oc_username", clean);
            } else {
                localStorage.removeItem("oc_username");
            }
            refresh();
        }

    });

    document.getElementById("phoneItem").addEventListener("click", () => {

        alert("Changing your phone number requires verification and isn't available yet.");

    });

    document.getElementById("linksItem").addEventListener("click", () => {

        const current = localStorage.getItem("oc_links") || "";
        const value = prompt("Add a link", current);

        if(value !== null){
            if(value.trim()){
                localStorage.setItem("oc_links", value.trim());
            } else {
                localStorage.removeItem("oc_links");
            }
            refresh();
        }

    });

});

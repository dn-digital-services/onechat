/*
=========================================
OneChat
Shared helpers (avatar + display name)
=========================================
*/

function ocGetInitials(text){

    if(!text) return "OC";

    const cleaned = text.replace(/[^a-zA-Z]/g, "");

    return (cleaned.slice(0, 2) || "OC").toUpperCase();

}

function ocGetDisplayName(){

    return localStorage.getItem("oc_name") || "OneChat User";

}

function ocApplyAvatar(el, initials){

    if(!el) return;

    const url = localStorage.getItem("oc_avatar");

    if(url){

        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";

        el.textContent = "";

    } else {

        el.style.backgroundImage = "";

        el.textContent = initials;

    }

}

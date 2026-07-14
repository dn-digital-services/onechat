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

function ocApplyAvatar(el, initials, photoURL){

    if(!el) return;

    if(photoURL){

        el.style.backgroundImage = `url(${photoURL})`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";

        el.textContent = "";

    } else {

        el.style.backgroundImage = "";

        el.textContent = initials;

    }

}

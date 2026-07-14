import { requireAuthAndOnboarding } from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { profile } = session;

    const navAvatar = document.getElementById("navAvatar");
    ocApplyAvatar(navAvatar, ocGetInitials(profile.displayName || "OneChat User"), profile.photoURL);

});

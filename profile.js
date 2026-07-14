import { auth, signOut, requireAuthAndOnboarding } from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { profile } = session;

    const nameEl = document.getElementById("profileName");
    const headerNameEl = document.getElementById("headerName");
    const identifierEl = document.getElementById("profileIdentifier");
    const avatarEl = document.getElementById("profileAvatar");
    const navAvatarEl = document.getElementById("navAvatar");

    const name = profile.displayName || "OneChat User";
    const initials = ocGetInitials(name);

    identifierEl.textContent = profile.phone || "Not signed in";

    ocApplyAvatar(avatarEl, initials, profile.photoURL);
    ocApplyAvatar(navAvatarEl, initials, profile.photoURL);

    nameEl.textContent = name;
    headerNameEl.textContent = name;

    document.querySelectorAll(".settings-item[data-item]").forEach((item) => {

        item.addEventListener("click", () => {

            // Placeholder navigation hook for future settings sub-pages.
            console.log("Open settings section:", item.getAttribute("data-item"));

        });

    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {

        await signOut(auth);

        window.location.href = "welcome.html";

    });

});

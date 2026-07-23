import {
    db,
    requireAuthAndOnboarding,
    collection,
    query,
    where,
    getDocs,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    const navAvatar = document.getElementById("navAvatar");
    ocApplyAvatar(navAvatar, ocGetInitials(profile.displayName || "OneChat User"), profile.photoURL);

    // Dynamic nav Chats badge (non-blocking).
    loadNavChatsBadge(user.uid).catch(() => {});

});

async function loadNavChatsBadge(uid){

    const snap = await getDocs(
        query(
            collection(db, "chats"),
            where("participants", "array-contains", uid),
        )
    );

    let total = 0;
    snap.forEach((d) => { total += (d.data().unreadCount || {})[uid] || 0; });

    const badge = document.getElementById("navChatsBadge");
    if(!badge) return;

    if(total > 0){
        badge.textContent   = total > 99 ? "99+" : String(total);
        badge.style.display = "";
    } else {
        badge.style.display = "none";
    }

}

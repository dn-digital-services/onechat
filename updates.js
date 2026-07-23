import { Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import {
    db,
    requireAuthAndOnboarding,
    collection,
    query,
    where,
    getDocs,
    orderBy,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    // ── Avatars ────────────────────────────────────────────────────────────────

    const navAvatar = document.getElementById("navAvatar");
    const myAvatar  = document.getElementById("myAvatar");
    const initials  = ocGetInitials(profile.displayName || "OneChat User");

    ocApplyAvatar(navAvatar, initials, profile.photoURL);
    ocApplyAvatar(myAvatar,  initials, profile.photoURL);

    // ── DOM refs ───────────────────────────────────────────────────────────────

    const recentContainer = document.getElementById("recentUpdates");
    const viewedContainer = document.getElementById("viewedUpdates");
    const viewedSection   = document.querySelector(".viewed-section");
    const viewedToggle    = document.getElementById("viewedToggle");
    const recentTitle     = document.querySelector(".section-title.muted");

    // ── Helpers ────────────────────────────────────────────────────────────────

    function showEmptyState(container){
        container.innerHTML = `
            <div class="updates-empty">
                <p class="updates-empty-title">No status updates yet</p>
                <p class="updates-empty-sub">Statuses from your contacts will appear here.</p>
            </div>
        `;
    }

    function formatRelativeTime(ts){
        if(!ts || typeof ts.toDate !== "function") return "Just now";
        const diffMs  = Date.now() - ts.toDate().getTime();
        const mins    = Math.floor(diffMs / 60000);
        if(mins < 1)  return "Just now";
        if(mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if(hrs < 24)  return `${hrs}h ago`;
        return "Yesterday";
    }

    function renderStatusItem(container, status, viewed){

        const name     = status.displayName || "Unknown";
        const avatarInitials = ocGetInitials(name);
        const time     = formatRelativeTime(status.createdAt);
        const photoURL = status.photoURL || "";

        const item = document.createElement("div");
        item.className = "update-item";

        item.innerHTML = `
            <div class="ring ${viewed ? "viewed" : ""}">
                <div class="avatar"></div>
            </div>
            <div class="update-info">
                <h3>${name}</h3>
                <p>${time}</p>
            </div>
        `;

        // Apply avatar (photo or initials) consistently with the rest of the app.
        ocApplyAvatar(item.querySelector(".avatar"), avatarInitials, photoURL);

        item.addEventListener("click", () => {
            const params = new URLSearchParams({
                name,
                time,
                from: "updates.html",
                statusId: status.id,
            });
            window.location.href = `status-view.html?${params.toString()}`;
        });

        container.appendChild(item);

    }

    // ── Load statuses from Firestore ───────────────────────────────────────────

    // Start with an invisible "loading" state — keep the section title visible
    // so layout does not jump; clear it once data arrives.
    recentContainer.innerHTML = "";
    viewedSection.style.visibility = "hidden";

    try {

        // Step 1 – collect contact UIDs from chats the current user participates in.
        const chatsSnap = await getDocs(
            query(
                collection(db, "chats"),
                where("participants", "array-contains", user.uid),
            )
        );

        const contactUidSet = new Set();
        chatsSnap.forEach((docSnap) => {
            const data = docSnap.data();
            (data.participants || []).forEach((uid) => {
                if(uid !== user.uid) contactUidSet.add(uid);
            });
        });

        const contactUids = Array.from(contactUidSet);

        // Step 2 – if the user has no contacts yet, show empty state immediately.
        if(contactUids.length === 0){
            showEmptyState(recentContainer);
            viewedSection.style.display = "none";
            recentTitle.style.display   = "none";
            return;
        }

        // Step 3 – query non-expired statuses for those contacts.
        // Firestore "in" supports up to 30 values; chunk if needed.
        const now          = Timestamp.now();
        const CHUNK_SIZE   = 30;
        const allSnapDocs  = [];

        for(let i = 0; i < contactUids.length; i += CHUNK_SIZE){

            const chunk = contactUids.slice(i, i + CHUNK_SIZE);

            const snap = await getDocs(
                query(
                    collection(db, "statuses"),
                    where("uid",       "in",  chunk),
                    where("expiresAt", ">",   now),
                    orderBy("expiresAt", "desc"),
                )
            );

            snap.forEach((d) => allSnapDocs.push(d));

        }

        // Step 4 – keep only the most-recent status per contact.
        const byUid = new Map();
        allSnapDocs.forEach((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() };
            if(!byUid.has(data.uid)){
                byUid.set(data.uid, data);
            }
        });

        const statuses = Array.from(byUid.values());

        // Step 5 – show empty state if no active statuses found.
        if(statuses.length === 0){
            showEmptyState(recentContainer);
            viewedSection.style.display = "none";
            return;
        }

        // Step 6 – split into unviewed (recent) and viewed.
        const recent = statuses.filter((s) => !(s.viewedBy || []).includes(user.uid));
        const viewed = statuses.filter((s) =>  (s.viewedBy || []).includes(user.uid));

        // Render recent.
        recentContainer.innerHTML = "";
        if(recent.length === 0){
            // All statuses have been viewed — nothing to show in "Recent updates".
            recentTitle.style.display = "none";
        } else {
            recent.forEach((s) => renderStatusItem(recentContainer, s, false));
        }

        // Render viewed.
        if(viewed.length === 0){
            viewedSection.style.display = "none";
        } else {
            viewedSection.style.visibility = "visible";
            viewed.forEach((s) => renderStatusItem(viewedContainer, s, true));
        }

        // Restore viewed section visibility (it was hidden during load).
        if(viewed.length > 0){
            viewedSection.style.visibility = "visible";
        }

    } catch(err){

        console.error("Failed to load statuses:", err);

        showEmptyState(recentContainer);
        viewedSection.style.display = "none";

    }

    // ── Viewed toggle ──────────────────────────────────────────────────────────

    viewedToggle.addEventListener("click", () => {
        viewedContainer.classList.toggle("collapsed");
        viewedToggle.classList.toggle("collapsed");
    });

});

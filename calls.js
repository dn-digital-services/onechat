import { Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import {
    db,
    requireAuthAndOnboarding,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    // ── Nav avatar ─────────────────────────────────────────────────────────────

    const navAvatar = document.getElementById("navAvatar");
    ocApplyAvatar(navAvatar, ocGetInitials(profile.displayName || "OneChat User"), profile.photoURL);

    // ── DOM ────────────────────────────────────────────────────────────────────

    const callsList    = document.getElementById("callsList");
    const sectionTitle = document.querySelector(".section-title");

    // ── SVG icons (unchanged from original) ───────────────────────────────────

    const ICONS = {

        incoming: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7L7 17"/><path d="M9 17H7v-2"/><path d="M4 5c0 8.5 6.5 15 15 15l1-4-5-2-2 2A13 13 0 0 1 8 9l2-2-2-5z" fill="currentColor" fill-opacity="0" stroke="none" opacity="0"/><path d="M17.5 4.5c1 4-1 7-4 9"/></svg>`,

        outgoing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M11 7h6v6"/></svg>`,

        missed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7L7 17"/><path d="M15 17h2v-2"/></svg>`,

        phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c0 8.5 6.5 15 15 15l1-4-5-2-2 2A13 13 0 0 1 8 9l2-2-2-5z"/></svg>`,

        video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l5-3v10l-5-3"/><rect x="2" y="6" width="13" height="12" rx="2"/></svg>`,

        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>`,

    };

    // ── Helpers ────────────────────────────────────────────────────────────────

    function formatRelativeTime(ts){
        if(!ts || typeof ts.toDate !== "function") return "";
        const date  = ts.toDate();
        const now   = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / 86400000);

        if(diffDays === 0){
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        if(diffDays === 1) return "Yesterday";

        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - now.getDay());
        thisWeekStart.setHours(0, 0, 0, 0);

        if(date >= thisWeekStart){
            return date.toLocaleDateString([], { weekday: "long" });
        }

        return date.toLocaleDateString([], { day: "numeric", month: "short" });
    }

    function renderCallItem(c){

        const name      = c.peerName || c.peerPhone || "Unknown";
        const initials  = ocGetInitials(name);
        const photoURL  = c.peerPhotoURL || "";
        const type      = c.type || "incoming";   // "incoming" | "outgoing" | "missed"
        const isVideo   = Boolean(c.video);
        const isMissed  = type === "missed";
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        const timeLabel = formatRelativeTime(c.createdAt);
        const typeIcon  = ICONS[type] || ICONS.incoming;

        const item = document.createElement("div");
        item.className = "call-item";

        item.innerHTML = `
            <div class="avatar"></div>
            <div class="call-info">
                <h3 class="${isMissed ? "missed" : ""}">${name}</h3>
                <div class="call-type ${isMissed ? "missed" : ""}">
                    ${isVideo ? ICONS.video : typeIcon}
                    <span>${typeLabel}</span>
                </div>
            </div>
            <div class="call-meta">
                <span class="call-time">${timeLabel}</span>
                <span class="call-info-btn">${ICONS.info}</span>
            </div>
        `;

        ocApplyAvatar(item.querySelector(".avatar"), initials, photoURL);

        callsList.appendChild(item);

    }

    function showEmptyState(){
        sectionTitle.style.display = "none";
        callsList.innerHTML = `
            <div class="calls-empty">
                <p class="calls-empty-title">No calls yet</p>
                <p class="calls-empty-sub">Your recent voice and video calls will appear here.</p>
            </div>
        `;
    }

    // ── Load from Firestore ────────────────────────────────────────────────────

    try {

        const snap = await getDocs(
            query(
                collection(db, "calls"),
                where("participants", "array-contains", user.uid),
                orderBy("createdAt", "desc"),
                limit(100),
            )
        );

        if(snap.empty){
            showEmptyState();
            return;
        }

        snap.forEach((docSnap) => {
            renderCallItem({ id: docSnap.id, ...docSnap.data() });
        });

    } catch(err){

        console.error("Failed to load calls:", err);
        showEmptyState();

    }

});

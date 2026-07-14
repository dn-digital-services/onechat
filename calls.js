import { requireAuthAndOnboarding } from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { profile } = session;

    const navAvatar = document.getElementById("navAvatar");
    ocApplyAvatar(navAvatar, ocGetInitials(profile.displayName || "OneChat User"), profile.photoURL);

    const callsList = document.getElementById("callsList");

    const ICONS = {

        incoming: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7L7 17"/><path d="M9 17H7v-2"/><path d="M4 5c0 8.5 6.5 15 15 15l1-4-5-2-2 2A13 13 0 0 1 8 9l2-2-2-5z" fill="currentColor" fill-opacity="0" stroke="none" opacity="0"/><path d="M17.5 4.5c1 4-1 7-4 9"/></svg>`,

        outgoing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M11 7h6v6"/></svg>`,

        missed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7L7 17"/><path d="M15 17h2v-2"/></svg>`,

        phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c0 8.5 6.5 15 15 15l1-4-5-2-2 2A13 13 0 0 1 8 9l2-2-2-5z"/></svg>`,

        video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l5-3v10l-5-3"/><rect x="2" y="6" width="13" height="12" rx="2"/></svg>`,

        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>`,

    };

    const calls = [
        { name: "Priya Sharma", video: true, type: "incoming", time: "Yesterday" },
        { name: "Rohan Verma", video: true, type: "incoming", time: "Yesterday" },
        { name: "Ananya Iyer", video: false, type: "outgoing", time: "Sunday" },
        { name: "+1 555 019 4821", type: "missed", time: "Sunday", unknown: true },
        { name: "+1 555 019 4821", video: false, type: "incoming", time: "Sunday", unknown: true },
        { name: "Kabir Malhotra", video: false, type: "outgoing", time: "Sunday" },
        { name: "Kabir Malhotra", video: true, type: "incoming", time: "Sunday" },
        { name: "Kabir Malhotra", video: false, type: "incoming", time: "Sunday" },
    ];

    calls.forEach((c) => {

        const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

        const typeIcon = ICONS[c.type];
        const typeLabel = c.type.charAt(0).toUpperCase() + c.type.slice(1);
        const isMissed = c.type === "missed";

        const item = document.createElement("div");
        item.className = "call-item";

        item.innerHTML = `
            <div class="avatar">${initials}</div>
            <div class="call-info">
                <h3 class="${isMissed ? "missed" : ""}">${c.name}</h3>
                <div class="call-type ${isMissed ? "missed" : ""}">
                    ${c.video ? ICONS.video : typeIcon}
                    <span>${typeLabel}</span>
                </div>
            </div>
            <div class="call-meta">
                <span class="call-time">${c.time}</span>
                <span class="call-info-btn">${ICONS.info}</span>
            </div>
        `;

        callsList.appendChild(item);

    });

});

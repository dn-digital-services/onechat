import {
    db,
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    requireAuthAndOnboarding,
} from "./firebase.js";

const SEED_CONVERSATIONS = [
    { id: "self", name: "You", subtitle: "Message yourself", type: "text", lastMessage: "Business card.png", lastMessageType: "file", unreadCount: 0, self: true },
    { id: "ava-thompson", name: "Ava Thompson", subtitle: "tap for contact info", type: "call", lastMessage: "Video call", lastMessageType: "call", unreadCount: 2, favourite: true },
    { id: "liam-chen", name: "Liam Chen", subtitle: "tap for contact info", type: "text", lastMessage: "Sent the files, check your inbox", lastMessageType: "text", unreadCount: 0, read: true },
    { id: "onechat-team", name: "OneChat Team", subtitle: "tap for group info", type: "text", lastMessage: "Welcome to OneChat! \uD83C\uDF89", lastMessageType: "text", unreadCount: 1, group: true },
    { id: "design-squad", name: "Design Squad", subtitle: "tap for group info", type: "photo", lastMessage: "Photo", lastMessageType: "image", unreadCount: 0, read: true, group: true },
    { id: "maya-patel", name: "Maya Patel", subtitle: "tap for contact info", type: "text", lastMessage: "Sounds good, talk soon!", lastMessageType: "text", unreadCount: 0, read: true, favourite: true },
    { id: "noah-rivera", name: "Noah Rivera", subtitle: "tap for contact info", type: "text", lastMessage: "Can you call me later?", lastMessageType: "text", unreadCount: 0 },
];

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    const navAvatar = document.getElementById("navAvatar");
    const displayName = profile.displayName || "OneChat User";
    ocApplyAvatar(navAvatar, ocGetInitials(displayName), profile.photoURL);

    const chatsCol = collection(db, "users", user.uid, "chats");

    // Seed the demo conversation list once, in reverse so "You" ends up most recent.
    const firstChatSnap = await getDoc(doc(chatsCol, "self"));

    if(!firstChatSnap.exists()){

        for(let i = SEED_CONVERSATIONS.length - 1; i >= 0; i--){

            const seed = SEED_CONVERSATIONS[i];

            await setDoc(doc(chatsCol, seed.id), {
                ...seed,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                seeded: false,
            });

        }

    }

    const chatList = document.getElementById("chatList");

    const ICONS = {

        videoCall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l5-3v10l-5-3"/><rect x="2" y="6" width="13" height="12" rx="2"/></svg>`,

        photo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-4 4-3-3-4 4"/></svg>`,

        checkRead: `<svg class="check-read" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,

    };

    let allConversations = [];
    let activeFilter = "all";

    function formatTime(ts){

        if(!ts) return "";

        const date = ts.toDate ? ts.toDate() : new Date(ts);
        const now = new Date();

        const sameDay = date.toDateString() === now.toDateString();

        if(sameDay){
            return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);

        if(date.toDateString() === yesterday.toDateString()){
            return "Yesterday";
        }

        return date.toLocaleDateString([], { weekday: "short" });

    }

    function renderList(filter){

        activeFilter = filter;

        chatList.innerHTML = "";

        const filtered = allConversations.filter((c) => {

            if(filter === "unread") return c.unreadCount > 0;
            if(filter === "favourites") return !!c.favourite;
            if(filter === "groups") return !!c.group;
            return true;

        });

        if(filtered.length === 0){
            chatList.innerHTML = '<p class="empty-state">No conversations here yet.</p>';
            return;
        }

        filtered.forEach((c) => {

            const chatName = c.self ? `${displayName} (You)` : c.name;
            const initials = ocGetInitials(c.self ? displayName : c.name);

            let previewIcon = "";
            const msgClass = c.unreadCount > 0 ? "bold" : "";
            const message = c.lastMessageType === "file" ? (c.lastMessage || "Document") : (c.lastMessageType === "image" ? "Photo" : c.lastMessage);
            const time = formatTime(c.updatedAt);
            const isRead = c.lastMessageType === "text" ? true : c.read;

            if(c.lastMessageType === "call") previewIcon = ICONS.videoCall;
            else if(c.lastMessageType === "image" && !c.seeded) previewIcon = ICONS.photo;
            else if(isRead) previewIcon = ICONS.checkRead;

            const item = document.createElement("div");
            item.className = "chat-item";

            item.innerHTML = `
                <div class="avatar">${initials}</div>
                <div class="chat-info">
                    <div class="chat-top">
                        <h3>${c.name}</h3>
                        <span class="chat-time ${c.unreadCount > 0 ? "unread-time" : ""}">${time}</span>
                    </div>
                    <div class="chat-preview">
                        <span class="chat-preview-text">
                            ${previewIcon}
                            <span class="msg-text ${msgClass}">${message}</span>
                        </span>
                        ${c.unreadCount > 0 ? `<span class="unread-badge">${c.unreadCount}</span>` : ""}
                    </div>
                </div>
            `;

            item.addEventListener("click", () => {

                const query = new URLSearchParams({
                    chatId: c.id,
                    name: chatName,
                    subtitle: c.subtitle || "tap for contact info",
                });

                if(c.self) query.set("self", "1");

                window.location.href = `chat.html?${query.toString()}`;

            });

            chatList.appendChild(item);

        });

    }

    onSnapshot(query(chatsCol, orderBy("updatedAt", "desc")), (snap) => {

        allConversations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        renderList(activeFilter);

    });

    document.querySelectorAll(".chip[data-filter]").forEach((chip) => {

        chip.addEventListener("click", () => {

            document.querySelectorAll(".chip[data-filter]").forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");

            renderList(chip.getAttribute("data-filter"));

        });

    });

});

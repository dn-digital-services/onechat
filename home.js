import {
    db,
    doc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    getDocs,
    writeBatch,
    requireAuthAndOnboarding,
    registerFCMToken,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    const navAvatar = document.getElementById("navAvatar");
    const displayName = profile.displayName || "OneChat User";
    ocApplyAvatar(navAvatar, ocGetInitials(displayName), profile.photoURL);

    // Register for push notifications in the background (non-blocking)
    if("Notification" in window && Notification.permission === "granted"){
        registerFCMToken(user.uid).catch(() => {});
    } else if("Notification" in window && Notification.permission !== "denied"){
        Notification.requestPermission().then((perm) => {
            if(perm === "granted") registerFCMToken(user.uid).catch(() => {});
        });
    }

    document.getElementById("newChatBtn").addEventListener("click", () => {
        window.location.href = "new-chat.html";
    });

    const chatList = document.getElementById("chatList");
    const searchInput = document.getElementById("chatSearchInput");
    const unreadChipCount = document.getElementById("unreadChipCount");
    const chatsBadge = document.getElementById("chatsBadge");

    const ICONS = {
        checkSent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`,
        checkDelivered: `<svg class="check-delivered" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,
        checkRead: `<svg class="check-read" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,
    };

    let allConversations = [];
    let activeFilter = "all";

    // Mark individual messages as "delivered" for a chat where the recipient
    // has received them but hasn't opened the conversation yet.
    async function markMessagesDelivered(chatId){
        try {
            const msgsRef = collection(db, "chats", chatId, "messages");
            const q = query(msgsRef, where("receiverId", "==", user.uid), where("status", "==", "sent"));
            const snap = await getDocs(q);
            if(snap.empty) return;
            const batch = writeBatch(db);
            snap.forEach((d) => batch.update(d.ref, { status: "delivered" }));
            await batch.commit();
        } catch(err){
            console.error("markMessagesDelivered failed:", err);
        }
    }

    function renderList(){

        chatList.innerHTML = "";

        const searchTerm = (searchInput.value || "").trim().toLowerCase();

        const filtered = allConversations.filter((c) => {

            if(activeFilter === "unread" && !(c.unreadCount > 0)) return false;

            if(searchTerm){
                return (c.name || "").toLowerCase().includes(searchTerm);
            }

            return true;

        });

        const totalUnread = allConversations.reduce((sum, c) => sum + (c.unreadCount > 0 ? 1 : 0), 0);

        unreadChipCount.textContent = totalUnread;

        if(totalUnread > 0){
            chatsBadge.textContent = totalUnread > 99 ? "99+" : totalUnread;
            chatsBadge.style.display = "flex";
        } else {
            chatsBadge.style.display = "none";
        }

        if(filtered.length === 0){

            chatList.innerHTML = allConversations.length === 0
                ? '<p class="empty-state">No chats yet. Tap + to message a friend by phone number.</p>'
                : '<p class="empty-state">No conversations here yet.</p>';

            return;

        }

        filtered.forEach((c) => {

            const initials = ocGetInitials(c.name);

            const isOutgoingLast = c.lastMessageSenderId === user.uid;
            const msgClass = c.unreadCount > 0 ? "bold" : "";

            let previewText = c.lastMessageType === "file" ? (c.lastMessage || "Document")
                : c.lastMessageType === "image" ? "📷 Photo"
                : c.lastMessageType === "video" ? "🎥 Video"
                : (c.lastMessage || "Say hi 👋");

            let previewIcon = "";

            if(isOutgoingLast && c.lastMessage){
                if(c.lastMessageStatus === "seen") previewIcon = ICONS.checkRead;
                else if(c.lastMessageStatus === "delivered") previewIcon = ICONS.checkDelivered;
                else previewIcon = ICONS.checkSent;
            }

            const time = ocFormatListTime(c.updatedAt);

            const item = document.createElement("div");
            item.className = "chat-item";

            item.innerHTML = `
                <div class="avatar" data-avatar></div>
                <div class="chat-info">
                    <div class="chat-top">
                        <h3>${escapeHtml(c.name)}</h3>
                        <span class="chat-time ${c.unreadCount > 0 ? "unread-time" : ""}">${time}</span>
                    </div>
                    <div class="chat-preview">
                        <span class="chat-preview-text">
                            ${previewIcon}
                            <span class="msg-text ${msgClass}">${escapeHtml(previewText)}</span>
                        </span>
                        ${c.unreadCount > 0 ? `<span class="unread-badge">${c.unreadCount}</span>` : ""}
                    </div>
                </div>
            `;

            ocApplyAvatar(item.querySelector("[data-avatar]"), initials, c.photoURL);

            item.addEventListener("click", () => {

                const params = new URLSearchParams({
                    uid: c.otherUid,
                    name: c.name,
                });

                window.location.href = `chat.html?${params.toString()}`;

            });

            chatList.appendChild(item);

        });

    }

    function escapeHtml(str){
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

    // Per-chat: track the last updatedAt we triggered a delivery update for,
    // so we re-run whenever a new incoming message arrives (updatedAt changes)
    // but skip redundant fires when nothing new has come in.
    const deliveredTimestamps = new Map();

    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", user.uid),
        orderBy("updatedAt", "desc"),
    );

    onSnapshot(chatsQuery, (snap) => {

        allConversations = snap.docs.map((docSnap) => {

            const data = docSnap.data();
            const otherUid = (data.participants || []).find((uid) => uid !== user.uid);
            const info = (data.participantInfo && data.participantInfo[otherUid]) || {};

            // Mark incoming "sent" messages as "delivered" whenever the chat
            // doc shows a "sent" status from the other user AND the updatedAt
            // timestamp is newer than the last time we ran delivery for this chat.
            // Using updatedAt as a change signal means each new incoming message
            // triggers one delivery pass rather than suppressing all future ones.
            const isIncomingUnread = data.lastMessageSenderId
                && data.lastMessageSenderId !== user.uid
                && data.lastMessageStatus === "sent";

            const updatedAtMs = data.updatedAt && data.updatedAt.toMillis
                ? data.updatedAt.toMillis()
                : (data.updatedAt ? Number(data.updatedAt) : 0);

            const lastProcessed = deliveredTimestamps.get(docSnap.id) || 0;

            if(isIncomingUnread && updatedAtMs > lastProcessed){
                deliveredTimestamps.set(docSnap.id, updatedAtMs);
                // Update the chat summary doc
                updateDoc(doc(db, "chats", docSnap.id), { lastMessageStatus: "delivered" }).catch(() => {});
                // Update individual message docs so the sender sees double grey ticks
                markMessagesDelivered(docSnap.id);
            }

            return {
                id: docSnap.id,
                otherUid,
                name: info.displayName || data.participantInfo?.[otherUid]?.displayName || "OneChat User",
                photoURL: info.photoURL || "",
                lastMessage: data.lastMessage || "",
                lastMessageType: data.lastMessageType || "text",
                lastMessageSenderId: data.lastMessageSenderId || "",
                lastMessageStatus: data.lastMessageStatus || "sent",
                unreadCount: (data.unreadCount && data.unreadCount[user.uid]) || 0,
                updatedAt: data.updatedAt,
            };

        });

        renderList();

    }, (err) => {

        console.error("Failed to load chats:", err);

        chatList.innerHTML = '<p class="empty-state">Couldn\'t load your chats. Please try again.</p>';

    });

    searchInput.addEventListener("input", renderList);

    document.querySelectorAll(".chip[data-filter]").forEach((chip) => {

        chip.addEventListener("click", () => {

            document.querySelectorAll(".chip[data-filter]").forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");

            activeFilter = chip.getAttribute("data-filter");

            renderList();

        });

    });

});

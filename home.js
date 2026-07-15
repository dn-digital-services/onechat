import {
    db,
    doc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    requireAuthAndOnboarding,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    const navAvatar = document.getElementById("navAvatar");
    const displayName = profile.displayName || "OneChat User";
    ocApplyAvatar(navAvatar, ocGetInitials(displayName), profile.photoURL);

    document.getElementById("newChatBtn").addEventListener("click", () => {
        window.location.href = "new-chat.html";
    });

    const chatList = document.getElementById("chatList");
    const searchInput = document.getElementById("chatSearchInput");
    const unreadChipCount = document.getElementById("unreadChipCount");
    const chatsBadge = document.getElementById("chatsBadge");

    const ICONS = {
        checkSent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`,
        checkRead: `<svg class="check-read" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,
    };

    let allConversations = [];
    let activeFilter = "all";

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

        // Chip/badge counts reflect the full list, independent of the search box.
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
                : (c.lastMessageType === "image" ? "Photo" : (c.lastMessage || "Say hi \uD83D\uDC4B"));

            let previewIcon = "";

            if(isOutgoingLast && c.lastMessage){
                previewIcon = c.lastMessageStatus === "seen" ? ICONS.checkRead : ICONS.checkSent;
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

            // A message the other person sent that hasn't been marked "delivered"
            // yet is now known to have reached this device -- reflect that at the
            // chat-list level (the message itself is bumped to delivered/seen
            // once the specific chat is opened in chat.js).
            if(data.lastMessageSenderId && data.lastMessageSenderId !== user.uid && data.lastMessageStatus === "sent"){
                updateDoc(doc(db, "chats", docSnap.id), { lastMessageStatus: "delivered" }).catch(() => {});
            }

            return {
                id: docSnap.id,
                otherUid,
                name: info.displayName || "OneChat User",
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

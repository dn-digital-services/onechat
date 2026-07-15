import {
    db,
    storage,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    writeBatch,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    increment,
    ref,
    uploadBytes,
    getDownloadURL,
    requireAuthAndOnboarding,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    const params = new URLSearchParams(window.location.search);

    const otherUid = params.get("uid");
    const nameFromParams = params.get("name") || "OneChat User";

    if(!otherUid || otherUid === user.uid){
        window.location.href = "home.html";
        return;
    }

    const chatId = ocChatIdFor(user.uid, otherUid);

    const chatDocRef = doc(db, "chats", chatId);
    const messagesRef = collection(chatDocRef, "messages");
    const otherUserRef = doc(db, "users", otherUid);

    // Make sure the chat document exists even if this page was reached in some
    // way other than the New Chat search flow (e.g. a bookmarked/shared link).
    await setDoc(chatDocRef, {
        participants: [user.uid, otherUid],
        unreadCount: { [user.uid]: 0, [otherUid]: 0 },
        typing: { [user.uid]: false, [otherUid]: false },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    document.getElementById("chatName").textContent = nameFromParams;

    const chatSubtitle = document.getElementById("chatSubtitle");
    const presenceDot = document.getElementById("presenceDot");
    const chatAvatar = document.getElementById("chatAvatar");

    ocApplyAvatar(chatAvatar, ocGetInitials(nameFromParams), "");

    let otherProfile = {};
    let otherIsTyping = false;

    function renderSubtitle(){

        if(otherIsTyping){
            chatSubtitle.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span> typing...`;
            return;
        }

        if(ocIsOnline(otherProfile)){
            chatSubtitle.textContent = "Online";
            presenceDot.classList.remove("hidden");
        } else {
            chatSubtitle.textContent = ocFormatLastSeen(otherProfile);
            presenceDot.classList.add("hidden");
        }

    }

    onSnapshot(otherUserRef, (snap) => {

        if(!snap.exists()) return;

        otherProfile = snap.data();

        const name = otherProfile.displayName || nameFromParams;
        document.getElementById("chatName").textContent = name;

        ocApplyAvatar(chatAvatar, ocGetInitials(name), otherProfile.photoURL);

        renderSubtitle();

    }, (err) => console.error("Failed to watch contact presence:", err));

    document.getElementById("backBtn").addEventListener("click", () => {
        setTyping(false);
        window.location.href = "home.html";
    });

    chatAvatar.parentElement.style.cursor = "pointer";

    document.getElementById("chatTitleBtn").addEventListener("click", () => {

        const p = new URLSearchParams({
            chatId,
            name: document.getElementById("chatName").textContent,
            subtitle: "tap for contact info",
            number: otherProfile.phone || "",
        });

        window.location.href = `contact-info.html?${p.toString()}`;

    });

    const messagesEl = document.getElementById("chatMessages");

    const ICONS = {
        share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>`,
        sentTick: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`,
        deliveredTicks: `<svg class="tick-delivered" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,
        readTicks: `<svg class="tick-read" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,
        lock: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
    };

    function statusTicksHtml(status){
        if(status === "seen") return ICONS.readTicks;
        if(status === "delivered") return ICONS.deliveredTicks;
        return ICONS.sentTick;
    }

    function escapeHtml(str){
        const div = document.createElement("div");
        div.textContent = str || "";
        return div.innerHTML;
    }

    function addDateDivider(label){
        const el = document.createElement("div");
        el.className = "date-divider";
        el.textContent = label;
        messagesEl.appendChild(el);
    }

    function addSystemNote(icon, html, muted){
        const el = document.createElement("div");
        el.className = "system-note" + (muted ? " muted" : "");
        el.innerHTML = `${icon}<span class="system-note-text">${html}</span>`;
        messagesEl.appendChild(el);
    }

    function addFileMessage({ outgoing, fileName, meta, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");

        row.innerHTML = `
            <span class="share-btn">${ICONS.share}</span>
            <div class="bubble">
                <div class="file-preview">
                    <div class="thumb"></div>
                    <div class="file-row">
                        <span class="file-icon">DOC</span>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(fileName)}</div>
                            <div class="file-meta">${escapeHtml(meta || "")}</div>
                        </div>
                    </div>
                </div>
                <span class="bubble-time">${time} ${outgoing ? statusTicksHtml(status) : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function addImageMessage({ outgoing, fileURL, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");

        row.innerHTML = `
            <span class="share-btn">${ICONS.share}</span>
            <div class="bubble">
                <div class="image-preview">${fileURL ? `<img src="${fileURL}" alt="Photo">` : ""}</div>
                <span class="bubble-time">${time} ${outgoing ? statusTicksHtml(status) : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function addTextMessage({ outgoing, message, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");

        const timeLabel = time;

        row.innerHTML = `
            <div class="bubble text">
                <span class="msg-body">${escapeHtml(message)}<span class="time-spacer">${timeLabel}</span></span>
                <span class="bubble-time">${time} ${outgoing ? statusTicksHtml(status) : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function scrollToBottom(){
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    addSystemNote(ICONS.lock, "Messages are private to this conversation. Only you and the other participant can see them.");

    let firstSnapshot = true;

    onSnapshot(query(messagesRef, orderBy("timestamp")), (snap) => {

        Array.from(messagesEl.querySelectorAll(".msg-row, .date-divider")).forEach((el) => el.remove());

        addDateDivider("Today");

        const batch = writeBatch(db);
        let hasUpdates = false;
        let sawUnseenIncoming = false;

        snap.forEach((docSnap) => {

            const msg = docSnap.data();
            const outgoing = msg.senderId === user.uid;
            const time = ocFormatMessageTime(msg.timestamp);

            if(msg.type === "file"){
                addFileMessage({ ...msg, outgoing, time });
            } else if(msg.type === "image"){
                addImageMessage({ ...msg, outgoing, time });
            } else {
                addTextMessage({ ...msg, outgoing, time });
            }

            // We have this chat open right now, so any incoming message that
            // isn't already marked "seen" gets bumped straight there -- the
            // recipient is actively looking at it.
            if(!outgoing && msg.status !== "seen"){
                batch.update(docSnap.ref, { status: "seen" });
                hasUpdates = true;
                sawUnseenIncoming = true;
            }

        });

        if(hasUpdates){

            batch.commit().catch((err) => console.error("Failed to update message status:", err));

            updateDoc(chatDocRef, {
                [`unreadCount.${user.uid}`]: 0,
                ...(sawUnseenIncoming ? { lastMessageStatus: "seen" } : {}),
            }).catch((err) => console.error("Failed to reset unread count:", err));

        } else if(firstSnapshot){

            updateDoc(chatDocRef, { [`unreadCount.${user.uid}`]: 0 }).catch(() => {});

        }

        firstSnapshot = false;

        scrollToBottom();

    }, (err) => console.error("Failed to load messages:", err));

    // ---- Typing indicator ----

    let typingState = false;
    let typingTimeout = null;

    function setTyping(state){

        if(typingState === state) return;
        typingState = state;

        updateDoc(chatDocRef, { [`typing.${user.uid}`]: state }).catch(() => {});

    }

    onSnapshot(chatDocRef, (snap) => {

        if(!snap.exists()) return;

        const data = snap.data();

        otherIsTyping = !!(data.typing && data.typing[otherUid]);

        renderSubtitle();

    }, (err) => console.error("Failed to watch typing status:", err));

    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");

    messageInput.addEventListener("input", () => {

        if(messageInput.value.trim().length > 0){
            setTyping(true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => setTyping(false), 2000);
        } else {
            clearTimeout(typingTimeout);
            setTyping(false);
        }

    });

    async function refreshMyDenormalizedInfo(){

        await updateDoc(chatDocRef, {
            [`participantInfo.${user.uid}`]: {
                displayName: profile.displayName || "OneChat User",
                photoURL: profile.photoURL || "",
                phone: profile.phone || "",
            },
        }).catch(() => {});

    }

    async function sendTextMessage(){

        const value = messageInput.value.trim();

        if(!value) return;

        messageInput.value = "";
        clearTimeout(typingTimeout);
        setTyping(false);

        await addDoc(messagesRef, {
            type: "text",
            senderId: user.uid,
            receiverId: otherUid,
            message: value,
            status: "sent",
            timestamp: serverTimestamp(),
        });

        await updateDoc(chatDocRef, {
            lastMessage: value,
            lastMessageType: "text",
            lastMessageSenderId: user.uid,
            lastMessageStatus: "sent",
            updatedAt: serverTimestamp(),
            [`unreadCount.${otherUid}`]: increment(1),
        });

        refreshMyDenormalizedInfo();

    }

    sendBtn.addEventListener("click", sendTextMessage);

    messageInput.addEventListener("keydown", (e) => {

        if(e.key === "Enter"){
            e.preventDefault();
            sendTextMessage();
        }

    });

    async function sendFile(file, asImage){

        if(!file) return;

        const path = `users/${user.uid}/chats/${chatId}/files/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        const base = {
            senderId: user.uid,
            receiverId: otherUid,
            status: "sent",
            timestamp: serverTimestamp(),
            fileURL: url,
        };

        if(asImage){

            await addDoc(messagesRef, { ...base, type: "image", message: "Photo" });

            await updateDoc(chatDocRef, {
                lastMessage: "Photo",
                lastMessageType: "image",
                lastMessageSenderId: user.uid,
                lastMessageStatus: "sent",
                updatedAt: serverTimestamp(),
                [`unreadCount.${otherUid}`]: increment(1),
            });

        } else {

            const sizeKb = Math.max(1, Math.round(file.size / 1024));

            await addDoc(messagesRef, {
                ...base,
                type: "file",
                message: file.name,
                fileName: file.name,
                meta: `${sizeKb} KB \u00b7 ${(file.name.split(".").pop() || "file")}`,
            });

            await updateDoc(chatDocRef, {
                lastMessage: file.name,
                lastMessageType: "file",
                lastMessageSenderId: user.uid,
                lastMessageStatus: "sent",
                updatedAt: serverTimestamp(),
                [`unreadCount.${otherUid}`]: increment(1),
            });

        }

        refreshMyDenormalizedInfo();

    }

    const attachInput = document.getElementById("attachInput");
    const cameraInput = document.getElementById("cameraInput");

    document.getElementById("attachBtn").addEventListener("click", () => {
        attachInput.click();
    });

    document.getElementById("cameraBtn").addEventListener("click", () => {
        cameraInput.click();
    });

    attachInput.addEventListener("change", (e) => {

        const file = e.target.files && e.target.files[0];

        if(file){
            sendFile(file, file.type.startsWith("image/"));
        }

        attachInput.value = "";

    });

    cameraInput.addEventListener("change", (e) => {

        const file = e.target.files && e.target.files[0];

        if(file){
            sendFile(file, true);
        }

        cameraInput.value = "";

    });

    window.addEventListener("beforeunload", () => setTyping(false));
    window.addEventListener("pagehide", () => setTyping(false));

});

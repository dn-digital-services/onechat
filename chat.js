window.addEventListener("load", () => {

    if(localStorage.getItem("oc_onboarded") !== "true"){
        window.location.href = "welcome.html";
        return;
    }

    const params = new URLSearchParams(window.location.search);

    const name = params.get("name") || "OneChat User";
    const subtitle = params.get("subtitle") || "tap for contact info";
    const isSelf = params.get("self") === "1";
    const unread = parseInt(params.get("unread") || "0", 10);

    document.getElementById("chatName").textContent = name;
    document.getElementById("chatSubtitle").textContent = subtitle;

    const backBadge = document.getElementById("backBadge");

    if(unread > 0){
        backBadge.textContent = unread;
    } else {
        backBadge.classList.add("hidden");
    }

    const chatAvatar = document.getElementById("chatAvatar");
    const initials = ocGetInitials(name);

    if(isSelf){
        ocApplyAvatar(chatAvatar, initials);
    } else {
        chatAvatar.textContent = initials;
    }

    document.getElementById("backBtn").addEventListener("click", () => {
        window.location.href = "home.html";
    });

    document.getElementById("chatAvatar").parentElement.style.cursor = "pointer";

    document.getElementById("chatTitleBtn").addEventListener("click", () => {

        const query = new URLSearchParams({ name, subtitle });

        if(isSelf) query.set("self", "1");

        window.location.href = `contact-info.html?${query.toString()}`;

    });

    const messagesEl = document.getElementById("chatMessages");

    const ICONS = {

        lock: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,

        clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,

        share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>`,

        sentTick: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`,

        readTicks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4 4L14 8"/><path d="M9 12l4 4 9-10"/></svg>`,

    };

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
                        <span class="file-icon">PDF</span>
                        <div class="file-info">
                            <div class="file-name">${fileName}</div>
                            <div class="file-meta">${meta}</div>
                        </div>
                    </div>
                </div>
                <span class="bubble-time">${time} ${status === "read" ? `<span class="tick-read">${ICONS.readTicks}</span>` : status === "sent" ? ICONS.sentTick : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function addImageMessage({ outgoing, imageHtml, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");

        row.innerHTML = `
            <span class="share-btn">${ICONS.share}</span>
            <div class="bubble">
                <div class="image-preview">${imageHtml}</div>
                <span class="bubble-time">${time} ${status === "read" ? `<span class="tick-read">${ICONS.readTicks}</span>` : status === "sent" ? ICONS.sentTick : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function addTextMessage({ outgoing, text, time, status }){

        const row = document.createElement("div");
        row.className = "msg-row " + (outgoing ? "outgoing" : "incoming");

        const timeLabel = `${time}${outgoing ? " \u2713\u2713" : ""}`;

        row.innerHTML = `
            <div class="bubble text">
                <span class="msg-body">${escapeHtml(text)}<span class="time-spacer">${timeLabel}</span></span>
                <span class="bubble-time">${time} ${outgoing ? (status === "read" ? `<span class="tick-read">${ICONS.readTicks}</span>` : ICONS.sentTick) : ""}</span>
            </div>
        `;

        messagesEl.appendChild(row);

    }

    function escapeHtml(str){
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function scrollToBottom(){
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    addSystemNote(ICONS.lock, "Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. <b>Learn more</b>");
    addSystemNote(ICONS.clock, "You use a default timer for disappearing messages in new chats. New messages will disappear from this chat 90 days after they're sent, except when kept. <b>Change timer</b>", true);
    addDateDivider("Today");

    if(isSelf){

        addFileMessage({
            outgoing: true,
            fileName: "8B0D5E5B-8D90-4916-A16F-1F39985A6543.pdf",
            meta: "2 pages · 101 KB · pdf",
            time: "12:45 PM",
            status: "sent",
        });

        addImageMessage({
            outgoing: true,
            imageHtml: `
                <div style="background:#fff;padding:14px;font-family:Arial,sans-serif;">
                    <div style="font-weight:800;font-size:22px;color:#0B2E6B;">DN <span style="color:#0B2E6B;">DIGITAL SERVICES</span></div>
                    <div style="font-size:10px;color:#0B2E6B;margin-top:2px;">SOLUTIONS · GROWTH · SUCCESS</div>
                    <div style="margin-top:10px;background:#0B2E6B;color:#fff;text-align:center;padding:6px 0;font-weight:700;font-size:12px;">OUR SERVICES</div>
                </div>
            `,
            time: "12:55 PM",
            status: "read",
        });

    } else {

        addTextMessage({
            outgoing: false,
            text: `Hey! This is the start of your conversation with ${name}.`,
            time: "9:12 AM",
        });

        addTextMessage({
            outgoing: true,
            text: "Hey, how's it going?",
            time: "9:15 AM",
            status: "read",
        });

    }

    scrollToBottom();

    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");

    function updateSendState(){
        if(messageInput.value.trim().length > 0){
            sendBtn.classList.add("has-text");
        } else {
            sendBtn.classList.remove("has-text");
        }
    }

    messageInput.addEventListener("input", updateSendState);

    function sendMessage(){

        const value = messageInput.value.trim();

        if(!value) return;

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

        addTextMessage({ outgoing: true, text: value, time, status: "sent" });

        messageInput.value = "";
        updateSendState();
        scrollToBottom();

    }

    sendBtn.addEventListener("click", () => {

        if(sendBtn.classList.contains("has-text")){
            sendMessage();
        }

    });

    messageInput.addEventListener("keydown", (e) => {

        if(e.key === "Enter"){
            e.preventDefault();
            sendMessage();
        }

    });

    ["attachBtn", "cameraBtn", "stickerBtn"].forEach((id) => {

        document.getElementById(id).addEventListener("click", () => {
            messageInput.focus();
        });

    });

});

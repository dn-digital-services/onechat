import {
    db,
    doc,
    setDoc,
    collection,
    query,
    where,
    limit,
    getDocs,
    serverTimestamp,
    requireAuthAndOnboarding,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    const { user, profile } = session;

    document.getElementById("backBtn").addEventListener("click", () => {
        window.location.href = "home.html";
    });

    const phoneForm = document.getElementById("phoneForm");
    const nameForm = document.getElementById("nameForm");
    const phoneInput = document.getElementById("phoneInput");
    const nameInput = document.getElementById("nameInput");
    const searchBtn = document.getElementById("searchBtn");
    const nameSearchBtn = document.getElementById("nameSearchBtn");
    const errorMsg = document.getElementById("errorMsg");
    const resultArea = document.getElementById("resultArea");

    // ── Tab switching ──────────────────────────────────────────────────────────

    document.querySelectorAll(".nc-tab").forEach((tab) => {

        tab.addEventListener("click", () => {

            document.querySelectorAll(".nc-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");

            const which = tab.dataset.tab;

            if(which === "phone"){
                phoneForm.classList.remove("hidden");
                nameForm.classList.add("hidden");
                phoneInput.focus();
            } else {
                phoneForm.classList.add("hidden");
                nameForm.classList.remove("hidden");
                nameInput.focus();
            }

            errorMsg.textContent = "";
            resultArea.innerHTML = "";

        });

    });

    phoneInput.addEventListener("input", () => {
        phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "");
    });

    // ── Open/Create chat ───────────────────────────────────────────────────────

    async function ensureChatAndOpen(otherUser, otherUid){

        const chatId = ocChatIdFor(user.uid, otherUid);
        const chatRef = doc(db, "chats", chatId);

        await setDoc(chatRef, {

            participants: [user.uid, otherUid],

            participantInfo: {
                [user.uid]: {
                    displayName: profile.displayName || "OneChat User",
                    photoURL: profile.photoURL || "",
                    phone: profile.phone || "",
                },
                [otherUid]: {
                    displayName: otherUser.displayName || "OneChat User",
                    photoURL: otherUser.photoURL || "",
                    phone: otherUser.phone || "",
                },
            },

            unreadCount: {
                [user.uid]: 0,
                [otherUid]: 0,
            },

            typing: {
                [user.uid]: false,
                [otherUid]: false,
            },

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),

        }, { merge: true });

        const params = new URLSearchParams({
            uid: otherUid,
            name: otherUser.displayName || "OneChat User",
        });

        window.location.href = `chat.html?${params.toString()}`;

    }

    // ── Render a result card ───────────────────────────────────────────────────

    function renderUserCard(otherUser, otherUid){

        if(otherUid === user.uid){
            resultArea.innerHTML = `<p class="nc-empty">That's your own number.</p>`;
            return;
        }

        const initials = ocGetInitials(otherUser.displayName || "OneChat User");

        const card = document.createElement("div");
        card.className = "nc-user-card";

        card.innerHTML = `
            <div class="nc-avatar" data-avatar></div>
            <div class="nc-user-info">
                <h3>${escapeHtml(otherUser.displayName || "OneChat User")}</h3>
                <p>${escapeHtml(otherUser.phone || "")}</p>
            </div>
            <button class="nc-message-btn">Message</button>
        `;

        ocApplyAvatar(card.querySelector("[data-avatar]"), initials, otherUser.photoURL);

        card.querySelector(".nc-message-btn").addEventListener("click", () => {
            ensureChatAndOpen(otherUser, otherUid);
        });

        resultArea.appendChild(card);

    }

    function escapeHtml(str){
        const d = document.createElement("div");
        d.textContent = str || "";
        return d.innerHTML;
    }

    // ── Phone number search ────────────────────────────────────────────────────

    phoneForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        errorMsg.textContent = "";
        resultArea.innerHTML = "";

        const digits = phoneInput.value.trim();

        if(!/^[6-9]\d{9}$/.test(digits)){
            errorMsg.textContent = "Enter a valid 10-digit Indian mobile number.";
            return;
        }

        const fullPhone = ocNormalizePhone(digits);

        searchBtn.disabled = true;
        searchBtn.textContent = "…";

        try {

            const usersQuery = query(collection(db, "users"), where("phone", "==", fullPhone), limit(1));
            const snap = await getDocs(usersQuery);

            if(snap.empty){
                resultArea.innerHTML = `<p class="nc-empty">No OneChat user found with this number.<br>Invite them to join!</p>`;
            } else {
                const foundDoc = snap.docs[0];
                renderUserCard(foundDoc.data(), foundDoc.id);
            }

        } catch(err){
            console.error("Phone search failed:", err);
            errorMsg.textContent = "Search failed. Please try again.";
        } finally {
            searchBtn.disabled = false;
            searchBtn.textContent = "Search";
        }

    });

    // ── Name search ────────────────────────────────────────────────────────────

    nameForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        errorMsg.textContent = "";
        resultArea.innerHTML = "";

        const rawName = nameInput.value.trim();

        if(rawName.length < 2){
            errorMsg.textContent = "Enter at least 2 characters to search.";
            return;
        }

        nameSearchBtn.disabled = true;
        nameSearchBtn.textContent = "…";

        try {

            // Firestore prefix search: displayName >= "Name" and <= "Name\uf8ff"
            const end = rawName + "\uf8ff";
            const q = query(
                collection(db, "users"),
                where("displayName", ">=", rawName),
                where("displayName", "<=", end),
                limit(10),
            );

            const snap = await getDocs(q);

            if(snap.empty){
                resultArea.innerHTML = `<p class="nc-empty">No users found for "${escapeHtml(rawName)}".</p>`;
            } else {
                snap.docs.forEach((d) => {
                    if(d.id !== user.uid){
                        renderUserCard(d.data(), d.id);
                    }
                });
                if(resultArea.innerHTML === ""){
                    resultArea.innerHTML = `<p class="nc-empty">No other users found.</p>`;
                }
            }

        } catch(err){
            console.error("Name search failed:", err);
            // Firestore range queries require an index for this field combination.
            // If the index doesn't exist yet, fall back to a client-side filter
            // on the first 50 users (limited but functional without an index).
            try {
                const fallback = await getDocs(query(collection(db, "users"), limit(50)));
                const lower = rawName.toLowerCase();
                const matches = fallback.docs.filter((d) => {
                    if(d.id === user.uid) return false;
                    return (d.data().displayName || "").toLowerCase().includes(lower);
                });
                if(matches.length === 0){
                    resultArea.innerHTML = `<p class="nc-empty">No users found for "${escapeHtml(rawName)}".</p>`;
                } else {
                    matches.forEach((d) => renderUserCard(d.data(), d.id));
                }
            } catch(fallbackErr){
                errorMsg.textContent = "Search failed. Please try again.";
            }
        } finally {
            nameSearchBtn.disabled = false;
            nameSearchBtn.textContent = "Search";
        }

    });

});

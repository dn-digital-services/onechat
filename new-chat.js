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

    const searchForm = document.getElementById("searchForm");
    const phoneInput = document.getElementById("phoneInput");
    const searchBtn = document.getElementById("searchBtn");
    const errorMsg = document.getElementById("errorMsg");
    const resultArea = document.getElementById("resultArea");

    phoneInput.addEventListener("input", () => {
        phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "");
    });

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

    searchForm.addEventListener("submit", async (e) => {

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
        searchBtn.textContent = "...";

        try {

            const usersQuery = query(collection(db, "users"), where("phone", "==", fullPhone), limit(1));
            const snap = await getDocs(usersQuery);

            if(snap.empty){

                resultArea.innerHTML = `<p class="nc-empty">No OneChat user found with this number.<br>Invite them to join OneChat!</p>`;

            } else {

                const foundDoc = snap.docs[0];
                const otherUid = foundDoc.id;

                if(otherUid === user.uid){

                    resultArea.innerHTML = `<p class="nc-empty">That's your own number.</p>`;

                } else {

                    const otherUser = foundDoc.data();
                    const initials = ocGetInitials(otherUser.displayName || "OneChat User");

                    const card = document.createElement("div");
                    card.className = "nc-user-card";

                    card.innerHTML = `
                        <div class="nc-avatar" data-avatar></div>
                        <div class="nc-user-info">
                            <h3>${otherUser.displayName || "OneChat User"}</h3>
                            <p>${fullPhone}</p>
                        </div>
                        <button class="nc-message-btn" id="messageBtn">Message</button>
                    `;

                    ocApplyAvatar(card.querySelector("[data-avatar]"), initials, otherUser.photoURL);

                    resultArea.appendChild(card);

                    card.querySelector("#messageBtn").addEventListener("click", () => {
                        ensureChatAndOpen(otherUser, otherUid);
                    });

                }

            }

        } catch(err){

            console.error("Phone search failed:", err);
            errorMsg.textContent = "Something went wrong searching for that number. Please try again.";

        } finally {

            searchBtn.disabled = false;
            searchBtn.textContent = "Search";

        }

    });

});

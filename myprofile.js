import {
    db,
    storage,
    doc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    ref,
    uploadBytes,
    getDownloadURL,
    requireAuthAndOnboarding,
} from "./firebase.js";



window.addEventListener("load", async () => {

    const session = await requireAuthAndOnboarding("welcome.html");

    if(!session) return;

    let { user, profile } = session;

    const bigAvatar = document.getElementById("bigAvatar");
    const navAvatar = document.getElementById("navAvatar");
    const nameValue = document.getElementById("nameValue");
    const usernameValue = document.getElementById("usernameValue");
    const phoneValue = document.getElementById("phoneValue");
    const linksValue = document.getElementById("linksValue");
    const thoughtText = document.getElementById("thoughtText");

    const userRef = doc(db, "users", user.uid);

    async function save(patch){
        profile = { ...profile, ...patch };
        await setDoc(userRef, patch, { merge: true });
        // If name or photo changed, propagate to all chat participantInfo docs
        if(patch.displayName !== undefined || patch.photoURL !== undefined){
            propagateProfileToChats(patch).catch(() => {});
        }
        refresh();
    }

    // Keep the denormalised participantInfo in every chat document up to date
    // so the other person always sees the latest name/photo.
    async function propagateProfileToChats(patch){
        try {
            const chatsSnap = await getDocs(
                query(collection(db, "chats"), where("participants", "array-contains", user.uid))
            );
            if(chatsSnap.empty) return;
            const batch = writeBatch(db);
            chatsSnap.forEach((chatDoc) => {
                const update = {};
                if(patch.displayName !== undefined){
                    update[`participantInfo.${user.uid}.displayName`] = patch.displayName;
                }
                if(patch.photoURL !== undefined){
                    update[`participantInfo.${user.uid}.photoURL`] = patch.photoURL;
                }
                batch.update(chatDoc.ref, update);
            });
            await batch.commit();
        } catch(err){
            console.error("Failed to propagate profile update:", err);
        }
    }

    function refresh(){

        const name = profile.displayName || "OneChat User";
        const initials = ocGetInitials(name);

        ocApplyAvatar(bigAvatar, initials, profile.photoURL);
        ocApplyAvatar(navAvatar, initials, profile.photoURL);

        nameValue.textContent = name;

        if(profile.username){
            usernameValue.textContent = "@" + profile.username;
            usernameValue.classList.remove("accent");
        } else {
            usernameValue.textContent = "Reserve username";
            usernameValue.classList.add("accent");
        }

        phoneValue.textContent = profile.phone || "Not set";

        if(profile.links){
            linksValue.textContent = profile.links;
            linksValue.classList.remove("accent");
        } else {
            linksValue.textContent = "Add links";
            linksValue.classList.add("accent");
        }

        thoughtText.textContent = profile.about || "Share a thought!";

    }

    refresh();

    // Dynamic nav Chats badge (non-blocking).
    loadNavChatsBadge(user.uid).catch(() => {});

    document.getElementById("backBtn").addEventListener("click", () => {
        window.location.href = "profile.html";
    });

    const avatarInput = document.getElementById("avatarInput");

    function openPhotoPicker(){
        avatarInput.click();
    }

    document.getElementById("cameraBadge").addEventListener("click", openPhotoPicker);
    document.getElementById("bigAvatar").addEventListener("click", openPhotoPicker);
    document.getElementById("editLink").addEventListener("click", openPhotoPicker);

    avatarInput.addEventListener("change", async (e) => {

        const file = e.target.files && e.target.files[0];

        if(!file) return;

        if(!file.type.startsWith("image/")){
            alert("Please choose an image file.");
            return;
        }

        try {

            const storageRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}`);

            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            await save({ photoURL: url });

        } catch(err) {

            console.error("Avatar upload failed:", err);
            alert("Couldn't upload photo. Please try again.");

        }

    });

    document.getElementById("thoughtBtn").addEventListener("click", async () => {

        const current = profile.about || "";
        const value = prompt("Share a thought", current);

        if(value !== null){
            await save({ about: value.trim() || "Available" });
        }

    });

    document.getElementById("nameItem").addEventListener("click", async () => {

        const current = profile.displayName === "OneChat User" ? "" : (profile.displayName || "");
        const value = prompt("Your name", current);

        if(value !== null && value.trim()){
            await save({ displayName: value.trim() });
        }

    });

    document.getElementById("usernameItem").addEventListener("click", async () => {

        const current = profile.username || "";
        const value = prompt("Choose a username", current);

        if(value !== null){
            const clean = value.trim().replace(/^@/, "");
            await save({ username: clean || null });
        }

    });

    document.getElementById("phoneItem").addEventListener("click", () => {

        alert("Changing your phone number requires verification and isn't available yet.");

    });

    document.getElementById("linksItem").addEventListener("click", async () => {

        const current = profile.links || "";
        const value = prompt("Add a link", current);

        if(value !== null){
            await save({ links: value.trim() || null });
        }

    });

});

async function loadNavChatsBadge(uid){

    const snap = await getDocs(
        query(
            collection(db, "chats"),
            where("participants", "array-contains", uid),
        )
    );

    let total = 0;
    snap.forEach((d) => { total += (d.data().unreadCount || {})[uid] || 0; });

    const badge = document.getElementById("navChatsBadge");
    if(!badge) return;

    if(total > 0){
        badge.textContent   = total > 99 ? "99+" : String(total);
        badge.style.display = "";
    } else {
        badge.style.display = "none";
    }

}

import {
    auth,
    db,
    storage,
    doc,
    setDoc,
    ref,
    uploadBytes,
    getDownloadURL,
    waitForAuthUser,
    serverTimestamp,
} from "./firebase.js";

window.addEventListener("load", async () => {

    const user = await waitForAuthUser();

    if(!user){
        window.location.href = "welcome.html";
        return;
    }

    const signupAvatar    = document.getElementById("signupAvatar");
    const signupAvatarBtn = document.getElementById("signupAvatarBtn");
    const avatarInput     = document.getElementById("avatarInput");
    const nameInput       = document.getElementById("nameInput");
    const emailInput      = document.getElementById("emailInput");
    const aboutInput      = document.getElementById("aboutInput");
    const signupForm      = document.getElementById("signupForm");
    const signupBtn       = document.getElementById("signupBtn");
    const signupError     = document.getElementById("signupError");
    const progressWrap    = document.getElementById("uploadProgressWrap");
    const progressBar     = document.getElementById("uploadProgressBar");
    const progressLabel   = document.getElementById("uploadProgressLabel");

    // File chosen by the user but not yet uploaded (upload happens on submit).
    let pendingAvatarFile = null;
    let pendingLocalURL = null;

    // ── Avatar picker ─────────────────────────────────────────────────────────

    function openPicker(){
        avatarInput.click();
    }

    signupAvatarBtn.addEventListener("click", openPicker);
    signupAvatar.addEventListener("click", openPicker);

    avatarInput.addEventListener("change", (e) => {

        const file = e.target.files && e.target.files[0];
        if(!file) return;

        if(!file.type.startsWith("image/")){
            signupError.textContent = "Please choose an image file.";
            return;
        }

        signupError.textContent = "";

        // Keep file for upload on submit.
        pendingAvatarFile = file;

        // Revoke old object URL to free memory.
        if(pendingLocalURL) URL.revokeObjectURL(pendingLocalURL);
        pendingLocalURL = URL.createObjectURL(file);

        // Show preview immediately without waiting for upload.
        signupAvatar.style.backgroundImage = `url(${pendingLocalURL})`;
        signupAvatar.style.backgroundSize = "cover";
        signupAvatar.style.backgroundPosition = "center";
        signupAvatar.textContent = "";

        avatarInput.value = "";

    });

    // ── Progress bar helpers ──────────────────────────────────────────────────

    function showProgressBar(pct, label){
        progressWrap.classList.remove("hidden");
        progressBar.style.width = pct + "%";
        progressLabel.textContent = label || "";
    }

    function hideProgressBar(){
        progressWrap.classList.add("hidden");
        progressBar.style.width = "0%";
        progressLabel.textContent = "";
    }

    // ── Form submit ───────────────────────────────────────────────────────────

    signupForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        signupError.textContent = "";

        const name = nameInput.value.trim();

        if(!name){
            signupError.textContent = "Please enter your name.";
            nameInput.focus();
            return;
        }

        signupBtn.disabled = true;

        let photoURL = "";

        // ── Step 1: Upload photo if one was selected ──────────────────────

        if(pendingAvatarFile){

            signupBtn.textContent = "Uploading photo…";

            // Animate the progress bar from 0 → 90 % while the upload runs.
            let prog = 0;
            showProgressBar(0, "Uploading photo…");

            const progInterval = setInterval(() => {
                prog = Math.min(prog + 3, 90);
                showProgressBar(prog, "Uploading photo…");
            }, 250);

            try {

                const storageRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}`);

                // Race the upload against a 30-second timeout so it can never
                // hang forever (e.g. due to Storage rules blocking the write).
                const uploadPromise = uploadBytes(storageRef, pendingAvatarFile)
                    .then(() => getDownloadURL(storageRef));

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(
                        () => reject(Object.assign(new Error("Upload timed out"), { code: "upload/timeout" })),
                        30000
                    )
                );

                photoURL = await Promise.race([uploadPromise, timeoutPromise]);

                clearInterval(progInterval);
                showProgressBar(100, "Photo uploaded ✓");
                await new Promise((r) => setTimeout(r, 400)); // brief visual confirmation

            } catch(err){

                clearInterval(progInterval);
                hideProgressBar();

                console.error("Avatar upload failed:", err);

                const code = err.code || "";

                let msg;
                if(code === "upload/timeout"){
                    msg = "Photo upload timed out. Check your connection, or continue without a photo.";
                } else if(code === "storage/unauthorized"){
                    msg = "Photo upload failed (permission denied). You can still create your profile without a photo.";
                } else if(code === "storage/canceled"){
                    msg = "Photo upload was cancelled.";
                } else {
                    msg = "Photo upload failed. You can continue without a photo or try again.";
                }

                signupError.textContent = msg;

                // Offer recovery: either retry or skip photo
                signupBtn.disabled = false;
                signupBtn.textContent = "Continue without photo";
                pendingAvatarFile = null; // Clear so next submit skips upload
                return;

            }

        }

        // ── Step 2: Save profile to Firestore ─────────────────────────────

        signupBtn.textContent = "Saving profile…";
        showProgressBar(photoURL ? 100 : 50, "Saving profile…");

        try {

            const email = emailInput.value.trim();
            const about = aboutInput.value.trim() || "Available";

            await setDoc(doc(db, "users", user.uid), {
                displayName: name,
                email,
                about,
                photoURL,
                phone: user.phoneNumber || "",
                onboarded: true,        // mark as fully onboarded here (skip permissions page)
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // Clean up the local object URL now that we're done.
            if(pendingLocalURL) URL.revokeObjectURL(pendingLocalURL);

            window.location.href = "home.html";

        } catch(err){

            console.error("Profile save failed:", err);

            hideProgressBar();
            signupError.textContent = "Couldn't save your profile. Please try again.";

            signupBtn.disabled = false;
            signupBtn.textContent = "Continue";

        }

    });

});

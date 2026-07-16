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

    const signupAvatar = document.getElementById("signupAvatar");
    const signupAvatarBtn = document.getElementById("signupAvatarBtn");
    const avatarInput = document.getElementById("avatarInput");
    const nameInput = document.getElementById("nameInput");
    const emailInput = document.getElementById("emailInput");
    const aboutInput = document.getElementById("aboutInput");
    const signupForm = document.getElementById("signupForm");
    const signupBtn = document.getElementById("signupBtn");
    const signupError = document.getElementById("signupError");

    let photoURL = "";

    function openPhotoPicker(){
        avatarInput.click();
    }

    signupAvatarBtn.addEventListener("click", openPhotoPicker);
    signupAvatar.addEventListener("click", openPhotoPicker);

    avatarInput.addEventListener("change", async (e) => {

        const file = e.target.files && e.target.files[0];
        if(!file) return;

        if(!file.type.startsWith("image/")){
            alert("Please choose an image file.");
            return;
        }

        // Show preview immediately using local object URL
        const localURL = URL.createObjectURL(file);
        signupAvatar.style.backgroundImage = `url(${localURL})`;
        signupAvatar.style.backgroundSize = "cover";
        signupAvatar.style.backgroundPosition = "center";
        signupAvatar.textContent = "";

        try {

            const storageRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}`);
            await uploadBytes(storageRef, file);
            photoURL = await getDownloadURL(storageRef);

        } catch(err){

            console.error("Avatar upload failed:", err);
            // Keep local preview but don't save URL
            photoURL = "";

        }

        avatarInput.value = "";

    });

    signupForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        signupError.textContent = "";

        const name = nameInput.value.trim();

        if(!name){
            signupError.textContent = "Please enter your name.";
            nameInput.focus();
            return;
        }

        const email = emailInput.value.trim();
        const about = aboutInput.value.trim() || "Available";

        signupBtn.disabled = true;
        signupBtn.textContent = "Saving...";

        try {

            const userRef = doc(db, "users", user.uid);

            await setDoc(userRef, {
                displayName: name,
                email,
                about,
                photoURL,
                phone: user.phoneNumber || "",
                onboarded: false, // permissions page will set this true
                updatedAt: serverTimestamp(),
            }, { merge: true });

            window.location.href = "permissions.html";

        } catch(err){

            console.error("Profile save failed:", err);
            signupError.textContent = "Couldn't save your profile. Please try again.";
            signupBtn.disabled = false;
            signupBtn.textContent = "Continue";

        }

    });

});

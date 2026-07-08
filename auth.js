// =========================================
// AUTH.JS
// Handles:
// - Sign Up
// - Login
// - Logout
// - Page Protection
// =========================================

// -----------------------------------------
// SIGN UP
// -----------------------------------------
const signupForm = document.getElementById("signup-form");

if (signupForm) {

    signupForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const message = document.getElementById("auth-message");

        if (message) {
            message.textContent = "";
        }

        const name = document.getElementById("signup-name").value.trim();
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;

        try {

            console.log("Creating Authentication account...");

            const userCredential =
                await auth.createUserWithEmailAndPassword(
                    email,
                    password
                );

            const user = userCredential.user;

            console.log("Authentication successful.");
            console.log("UID:", user.uid);

            console.log("Creating Firestore user document...");

            await db.collection("users")
                .doc(user.uid)
                .set({

                    name: name,
                    email: email,
                    role: "user",
                    createdAt:
                        firebase.firestore.FieldValue.serverTimestamp()

                });

            console.log("Firestore document created successfully.");

            window.location.href = "dashboard.html";

        }
        catch (error) {

            console.error("Signup Error:", error);

            if (message) {
                message.textContent = error.message;
            }

        }

    });

}

// -----------------------------------------
// LOGIN
// -----------------------------------------
const loginForm = document.getElementById("login-form");

if (loginForm) {

    loginForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const message = document.getElementById("auth-message");

        if (message) {
            message.textContent = "";
        }

        const email =
            document.getElementById("login-email").value.trim();

        const password =
            document.getElementById("login-password").value;

        try {

            await auth.signInWithEmailAndPassword(
                email,
                password
            );

            console.log("Login successful.");

            window.location.href = "dashboard.html";

        }
        catch (error) {

            console.error("Login Error:", error);

            if (message) {
                message.textContent = error.message;
            }

        }

    });

}

// -----------------------------------------
// LOGOUT
// -----------------------------------------
const logoutBtn = document.getElementById("logout-btn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", async function () {

        try {

            await auth.signOut();

            window.location.href = "index.html";

        }
        catch (error) {

            console.error("Logout Error:", error);

        }

    });

}

// -----------------------------------------
// PAGE PROTECTION
// -----------------------------------------
auth.onAuthStateChanged(function (user) {

    const currentPage =
        window.location.pathname.split("/").pop();

    if (user) {

        if (
            currentPage === "" ||
            currentPage === "index.html"
        ) {

            window.location.href = "dashboard.html";

        }

    }
    else {

        const protectedPages = [

            "dashboard.html",
            "course.html",
            "analytics.html"

        ];

        if (protectedPages.includes(currentPage)) {

            window.location.href = "index.html";

        }

    }

});
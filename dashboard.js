// =========================================
// DASHBOARD.JS
// =========================================

let currentUser = null;
let currentUserData = null;

auth.onAuthStateChanged(async (user) => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    try {

        const doc = await db.collection("users")
            .doc(user.uid)
            .get();

        if (!doc.exists) {

            alert("User profile not found.");

            await auth.signOut();

            window.location.href = "index.html";

            return;

        }

        currentUserData = doc.data();

        document.getElementById("welcome-message").textContent =
            `Welcome, ${currentUserData.name}!`;

        if (currentUserData.role === "admin") {

            const adminSection =
                document.getElementById("admin-section");

            if (adminSection) {

                adminSection.style.display = "block";

            }

        }

        loadCourses();

    }

    catch (error) {

        console.error(error);

    }

});

async function loadCourses() {

    const list =
        document.getElementById("courses-list");

    list.innerHTML = "";

    const snapshot =
        await db.collection("courses")
            .orderBy("name")
            .get();

    if (snapshot.empty) {

        list.innerHTML =
            "<p>No courses available.</p>";

        return;

    }

    for (const courseDoc of snapshot.docs) {

        await createCourseCard(courseDoc);

    }

}

async function createCourseCard(courseDoc) {

    const course = courseDoc.data();

    const topics =
        await db.collection("courses")
            .doc(courseDoc.id)
            .collection("topics")
            .get();

    let completed = 0;

    for (const topic of topics.docs) {

        const progressId =
            currentUser.uid + "_" + topic.id;

        const progress =
            await db.collection("progress")
                .doc(progressId)
                .get();

        if (
            progress.exists &&
            progress.data().completed
        ) {

            completed++;

        }

    }

    renderCourseCard(

        courseDoc,
        course.name,
        topics.size,
        completed

    );

}

function renderCourseCard(

    courseDoc,
    courseName,
    total,
    completed

) {

    const list =
        document.getElementById("courses-list");

    const percent =
        total === 0
            ? 0
            : Math.round((completed / total) * 100);

    const card =
        document.createElement("div");

    card.className = "course-card";

    card.innerHTML = `
        <h3>${courseName}</h3>

        <p>
            Progress:
            ${completed}/${total}
            (${percent}%)
        </p>

        <button class="open-course-btn">
            Open Course
        </button>

        ${currentUserData.role === "admin"
            ? `
                <button class="edit-course-btn">
                    Edit
                </button>

                <button class="delete-course-btn">
                    Delete
                </button>
            `
            : ""
        }
    `;

    card.querySelector(".open-course-btn")
        .onclick = () => {

            window.location.href =
                "course.html?id=" + courseDoc.id;

        };

    if (currentUserData.role === "admin") {

        card.querySelector(".edit-course-btn")
            .onclick = async () => {

                const newName =
                    prompt(
                        "Enter new course name",
                        courseName
                    );

                if (!newName) return;

                await db.collection("courses")
                    .doc(courseDoc.id)
                    .update({

                        name: newName.trim()

                    });

                loadCourses();

            };

        card.querySelector(".delete-course-btn")
            .onclick = async () => {

                if (!confirm("Delete this course?"))
                    return;

                await db.collection("courses")
                    .doc(courseDoc.id)
                    .delete();

                loadCourses();

            };

    }

    list.appendChild(card);

}
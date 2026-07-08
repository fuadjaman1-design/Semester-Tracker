// =========================================
// COURSE.JS
// Handles:
// - Load Course
// - Load Topics
// - Topic Completion
// - Notes (Always Available)
// - Admin Edit/Delete
// =========================================

const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get("id");

let currentUser = null;
let currentUserData = null;
let currentTopicId = null;

// =========================================
// AUTH STATE
// =========================================

auth.onAuthStateChanged(async function (user) {

    if (!user) {

        window.location.href = "index.html";
        return;

    }

    currentUser = user;

    try {

        const userDoc =
            await db.collection("users")
                .doc(user.uid)
                .get();

        if (!userDoc.exists) {

            alert("User profile not found.");

            return;

        }

        currentUserData = userDoc.data();

        if (currentUserData.role === "admin") {

            const adminSection =
                document.getElementById("admin-topic-section");

            if (adminSection) {

                adminSection.style.display = "block";

            }

        }

        await loadCourse();
        await loadTopics();

    }

    catch (error) {

        console.error(error);
        alert(error.message);

    }

});

// =========================================
// LOAD COURSE
// =========================================

async function loadCourse() {

    try {

        const doc =
            await db.collection("courses")
                .doc(courseId)
                .get();

        if (!doc.exists) {

            alert("Course not found.");

            window.location.href = "dashboard.html";

            return;

        }

        document.getElementById("course-title").textContent =
            doc.data().name;

    }

    catch (error) {

        console.error(error);

    }

}

// =========================================
// LOAD TOPICS
// =========================================

async function loadTopics() {

    const topicsList =
        document.getElementById("topics-list");

    topicsList.innerHTML = "";

    try {

        const snapshot =
            await db.collection("courses")
                .doc(courseId)
                .collection("topics")
                .orderBy("name")
                .get();

        if (snapshot.empty) {

            topicsList.innerHTML =
                "<p>No topics available.</p>";

            return;

        }

        for (const topicDoc of snapshot.docs) {

            await createTopicRow(topicDoc);

        }

    }

    catch (error) {

        console.error(error);

    }

}

// =========================================
// CREATE TOPIC ROW
// =========================================

async function createTopicRow(topicDoc) {

    const topic = topicDoc.data();

    const progressId =
        currentUser.uid + "_" + topicDoc.id;

    let completed = false;

    try {

        const progressDoc =
            await db.collection("progress")
                .doc(progressId)
                .get();

        if (
            progressDoc.exists &&
            progressDoc.data().completed
        ) {

            completed = true;

        }

    }

    catch (error) {

        console.error(error);

    }

    const row =
        document.createElement("div");

    row.className = "topic-row";

    row.innerHTML = `

        <label>

            <input
                type="checkbox"
                class="complete-checkbox"
                ${completed ? "checked" : ""}
            >

            ${topic.name}

        </label>

        <button class="notes-btn">

            Notes

        </button>

        ${currentUserData.role === "admin"
            ? `

                <button class="edit-topic-btn">

                    Edit

                </button>

                <button class="delete-topic-btn">

                    Delete

                </button>

            `
            : ""
        }

    `;

    // =====================================
    // COMPLETE / INCOMPLETE
    // =====================================

    row.querySelector(".complete-checkbox")
        .addEventListener("change", async function () {

            try {

                if (this.checked) {

                    await db.collection("progress")
                        .doc(progressId)
                        .set({

                            userId:
                                currentUser.uid,

                            courseId:
                                courseId,

                            topicId:
                                topicDoc.id,

                            completed: true,

                            completedDate:
                                firebase.firestore.FieldValue.serverTimestamp()

                        });

                }

                else {

                    await db.collection("progress")
                        .doc(progressId)
                        .delete();

                }

            }

            catch (error) {

                console.error(error);

            }

        });

    // =====================================
    // NOTES
    // =====================================

    row.querySelector(".notes-btn")
        .addEventListener("click", function () {

            openNotes(topicDoc);

        });

    // =====================================
    // ADMIN BUTTONS
    // =====================================

    if (currentUserData.role === "admin") {

        row.querySelector(".edit-topic-btn")
            .addEventListener("click", async function () {

                const newName =
                    prompt(
                        "Enter new topic name",
                        topic.name
                    );

                if (!newName) {

                    return;

                }

                try {

                    await db.collection("courses")
                        .doc(courseId)
                        .collection("topics")
                        .doc(topicDoc.id)
                        .update({

                            name:
                                newName.trim()

                        });

                    loadTopics();

                }

                catch (error) {

                    console.error(error);

                }

            });

        row.querySelector(".delete-topic-btn")
            .addEventListener("click", async function () {

                if (
                    !confirm(
                        "Delete this topic?"
                    )
                ) {

                    return;

                }

                try {

                    await db.collection("courses")
                        .doc(courseId)
                        .collection("topics")
                        .doc(topicDoc.id)
                        .delete();

                    loadTopics();

                }

                catch (error) {

                    console.error(error);

                }

            });

    }

    document
        .getElementById("topics-list")
        .appendChild(row);

}
// =========================================
// NOTES
// =========================================

async function openNotes(topicDoc) {

    currentTopicId = topicDoc.id;

    const notesSection =
        document.getElementById("notes-section");

    notesSection.style.display = "block";

    document.getElementById("notes-topic-title").textContent =
        "Notes for: " + topicDoc.data().name;

    const noteId =
        currentUser.uid + "_" + topicDoc.id;

    try {

        const noteDoc =
            await db.collection("notes")
                .doc(noteId)
                .get();

        if (noteDoc.exists) {

            document.getElementById("notes-textarea").value =
                noteDoc.data().noteText || "";

        }

        else {

            document.getElementById("notes-textarea").value = "";

        }

    }

    catch (error) {

        console.error(error);

    }

}

// =========================================
// SAVE NOTES
// =========================================

const saveNotesBtn =
    document.getElementById("save-notes-btn");

if (saveNotesBtn) {

    saveNotesBtn.addEventListener("click", async function () {

        if (!currentTopicId) {

            return;

        }

        const noteText =
            document.getElementById("notes-textarea").value;

        const noteId =
            currentUser.uid + "_" + currentTopicId;

        try {

            await db.collection("notes")
                .doc(noteId)
                .set({

                    userId:
                        currentUser.uid,

                    topicId:
                        currentTopicId,

                    noteText:
                        noteText,

                    updatedAt:
                        firebase.firestore.FieldValue.serverTimestamp()

                });

            alert("Notes saved successfully.");

        }

        catch (error) {

            console.error(error);

            alert(error.message);

        }

    });

}

// =========================================
// CLOSE NOTES
// =========================================

const closeNotesBtn =
    document.getElementById("close-notes-btn");

if (closeNotesBtn) {

    closeNotesBtn.addEventListener("click", function () {

        document.getElementById("notes-section").style.display =
            "none";

        document.getElementById("notes-textarea").value = "";

        currentTopicId = null;

    });

}
// =========================================
// ADMIN.JS
// =========================================

// ----------------------------
// ADD COURSE
// ----------------------------

const addCourseForm =
    document.getElementById("add-course-form");

if (addCourseForm) {

    addCourseForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const input =
            document.getElementById("new-course-name");

        const courseName =
            input.value.trim();

        if (courseName === "") {

            alert("Enter course name.");

            return;

        }

        try {

            await db.collection("courses").add({

                name: courseName,
                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp()

            });

            input.value = "";

            if (typeof loadCourses === "function") {

                loadCourses();

            }

        }

        catch (error) {

            console.error(error);

            alert(error.message);

        }

    });

}

// ----------------------------
// ADD TOPIC
// ----------------------------

const addTopicForm =
    document.getElementById("add-topic-form");

if (addTopicForm) {

    addTopicForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const input =
            document.getElementById("new-topic-name");

        const topicName =
            input.value.trim();

        if (topicName === "") {

            alert("Enter topic name.");

            return;

        }

        try {

            await db.collection("courses")

                .doc(courseId)

                .collection("topics")

                .add({

                    name: topicName,
                    createdAt:
                        firebase.firestore.FieldValue.serverTimestamp()

                });

            input.value = "";

            if (typeof loadTopics === "function") {

                loadTopics();

            }

        }

        catch (error) {

            console.error(error);

            alert(error.message);

        }

    });

}

// ----------------------------
// PROMOTE USER
// ----------------------------

const promoteForm =
    document.getElementById("promote-user-form");

if (promoteForm) {

    promoteForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const email =
            document.getElementById("promote-email")
                .value
                .trim();

        try {

            const snapshot =
                await db.collection("users")
                    .where("email", "==", email)
                    .get();

            if (snapshot.empty) {

                alert("User not found.");

                return;

            }

            for (const doc of snapshot.docs) {

                await db.collection("users")

                    .doc(doc.id)

                    .update({

                        role: "admin"

                    });

            }

            promoteForm.reset();

            alert("User promoted successfully.");

        }

        catch (error) {

            console.error(error);

            alert(error.message);

        }

    });

}
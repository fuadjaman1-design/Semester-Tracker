// =========================================
// ANALYTICS.JS
// =========================================

let currentUser = null;

// =========================================
// AUTH STATE
// =========================================

auth.onAuthStateChanged(async function (user) {

    if (!user) {

        window.location.href = "index.html";
        return;

    }

    currentUser = user;

    await loadAnalytics();

});

// =========================================
// LOAD ANALYTICS
// =========================================

async function loadAnalytics() {

    const list =
        document.getElementById("weekly-breakdown-list");

    list.innerHTML = "";

    try {

        const snapshot =
            await db.collection("progress")
                .where("userId", "==", currentUser.uid)
                .get();

        let completedTotal = 0;
        let completedThisWeek = 0;

        const dailyCount = {

            Sun: 0,
            Mon: 0,
            Tue: 0,
            Wed: 0,
            Thu: 0,
            Fri: 0,
            Sat: 0

        };

        const today = new Date();

        const startOfWeek = new Date(today);

        startOfWeek.setHours(0, 0, 0, 0);

        startOfWeek.setDate(

            today.getDate() - today.getDay()

        );

        snapshot.forEach(function (doc) {

            const progress = doc.data();

            if (!progress.completed) {

                return;

            }

            completedTotal++;

            if (!progress.completedDate) {

                return;

            }

            const completedDate =
                progress.completedDate.toDate();

            if (completedDate >= startOfWeek) {

                completedThisWeek++;

                const day =
                    completedDate.toLocaleDateString(

                        "en-US",

                        {

                            weekday: "short"

                        }

                    );

                if (dailyCount[day] !== undefined) {

                    dailyCount[day]++;

                }

            }

        });

        list.innerHTML = `

            <div class="analysis-card">

                <h3>This Week</h3>

                <p>

                    Completed Topics:

                    <strong>

                        ${completedThisWeek}

                    </strong>

                </p>

            </div>

            <div class="analysis-card">

                <h3>Overall</h3>

                <p>

                    Total Completed Topics:

                    <strong>

                        ${completedTotal}

                    </strong>

                </p>

            </div>

        `;

        drawChart(dailyCount);

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// =========================================
// GRAPH
// =========================================

let chart = null;

function drawChart(dailyCount) {

    const canvas =
        document.getElementById("progress-graph");

    if (!canvas) {

        return;

    }

    if (chart) {

        chart.destroy();

    }

    chart = new Chart(canvas, {

        type: "bar",

        data: {

            labels: [

                "Sun",
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat"

            ],

            datasets: [

                {

                    label: "Completed Topics",

                    data: [

                        dailyCount.Sun,
                        dailyCount.Mon,
                        dailyCount.Tue,
                        dailyCount.Wed,
                        dailyCount.Thu,
                        dailyCount.Fri,
                        dailyCount.Sat

                    ]

                }

            ]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            scales: {

                y: {

                    beginAtZero: true,

                    ticks: {

                        precision: 0

                    }

                }

            }

        }

    });

}
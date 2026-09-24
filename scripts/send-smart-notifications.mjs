import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import webpush from "web-push";
import { pathToFileURL } from "node:url";

export const VAPID_PUBLIC_KEY = "BC77wS_RRV5jRF-zSX0b4AED_e0Sy8v5fzfvhHBGT3igDYxknT1Eo_9fPAgyb_Q74xZXczWUNROa8s8PkOdW0i0";
const VAPID_SUBJECT = "https://semester-tracker-1-2-6018d.web.app";
const ALLOWED_ORIGINS = new Set([
  "https://semester-tracker-1-2-6018d.web.app",
  "https://semester-tracker-1-2-d2d32.web.app"
]);
const ASSESSMENTS = [
  { key: "ct1", label: "CT 1", max: 10 },
  { key: "ct2", label: "CT 2", max: 10 },
  { key: "ct3", label: "CT 3", max: 10 },
  { key: "ct4", label: "CT 4", max: 10 },
  { key: "mid", label: "Mid", max: 20 }
];

function formatNumber(value) {
  return Number(Number(value).toFixed(1)).toString();
}

function formatTopicNames(topics) {
  const names = topics.map(topic => topic.name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function buildReminderCandidates({ marks, completedProgress, courseCatalog }) {
  const completed = new Set(completedProgress
    .filter(item => item.completed === true)
    .map(item => `${item.courseId}:${item.topicId}`));
  const candidates = [];
  const weakTopicKeys = new Set();

  marks.forEach(mark => {
    const course = courseCatalog.get(mark.courseId);
    if (!course) return;

    ASSESSMENTS.forEach(assessment => {
      const value = mark[assessment.key];
      if (!Number.isFinite(value)) return;
      const percent = value / assessment.max * 100;
      if (percent >= 80) return;

      const mappedTopics = (course.coverage[assessment.key] || [])
        .map(topicId => course.topics.find(topic => topic.id === topicId))
        .filter(Boolean);
      if (!mappedTopics.length) return;

      const incompleteTopics = mappedTopics.filter(topic =>
        !completed.has(`${course.id}:${topic.id}`)
      );
      const selectedTopics = (incompleteTopics.length ? incompleteTopics : mappedTopics).slice(0, 2);
      selectedTopics.forEach(topic => weakTopicKeys.add(`${course.id}:${topic.id}`));
      const topicNames = formatTopicNames(selectedTopics);
      const action = incompleteTopics.length ? "Revise" : "Review";

      candidates.push({
        key: `${course.id}:assessment:${assessment.key}`,
        priority: percent <= 60 ? 5 : 3,
        courseId: course.id,
        title: `${course.name} needs attention`,
        body: `You scored ${formatNumber(value)}/${assessment.max} in ${assessment.label}. ${action} ${topicNames} today.`
      });
    });
  });

  courseCatalog.forEach(course => {
    course.topics.forEach(topic => {
      const topicKey = `${course.id}:${topic.id}`;
      if (completed.has(topicKey) || weakTopicKeys.has(topicKey)) return;
      candidates.push({
        key: `${course.id}:topic:${topic.id}`,
        priority: 1,
        courseId: course.id,
        title: `${course.name} topic pending`,
        body: `You have not completed ${topic.name} yet. A short study session could help.`
      });
    });
  });

  return candidates;
}

export function chooseReminder(candidates, recentKeys = [], random = Math.random) {
  if (!candidates.length) return null;
  const recent = new Set(recentKeys);
  const unused = candidates.filter(candidate => !recent.has(candidate.key));
  const pool = unused.length ? unused : candidates;
  const totalWeight = pool.reduce((sum, candidate) => sum + candidate.priority, 0);
  let target = random() * totalWeight;

  for (const candidate of pool) {
    target -= candidate.priority;
    if (target <= 0) return candidate;
  }
  return pool[pool.length - 1];
}

function getDhakaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function loadCourseCatalog(db) {
  const coursesSnapshot = await db.collection("courses").get();
  const catalog = new Map();

  await Promise.all(coursesSnapshot.docs.map(async courseDoc => {
    const [topicsSnapshot, coverageSnapshot] = await Promise.all([
      courseDoc.ref.collection("topics").get(),
      courseDoc.ref.collection("ctCoverage").get()
    ]);
    const topics = topicsSnapshot.docs
      .map(topicDoc => ({ id: topicDoc.id, ...topicDoc.data() }))
      .sort((first, second) => (first.order || 0) - (second.order || 0));
    const coverage = {};
    coverageSnapshot.docs.forEach(document => {
      coverage[document.id] = Array.isArray(document.data().topicIds)
        ? document.data().topicIds
        : [];
    });
    catalog.set(courseDoc.id, {
      id: courseDoc.id,
      name: courseDoc.data().name || "Course",
      topics,
      coverage
    });
  }));

  return catalog;
}

function parseServiceAccount() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT secret.");
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
}

async function sendForUser(db, userId, devices, courseCatalog) {
  const deliveryRef = db.collection("notificationDelivery").doc(userId);
  const deliverySnapshot = await deliveryRef.get();
  const delivery = deliverySnapshot.exists ? deliverySnapshot.data() : {};
  const dateKey = getDhakaDateKey();
  const sentToday = delivery.dateKey === dateKey ? Number(delivery.sentCount || 0) : 0;
  const recentKeys = Array.isArray(delivery.recentKeys) ? delivery.recentKeys : [];
  if (sentToday >= 3) return { sent: 0, skipped: "daily-limit" };

  const [marksSnapshot, progressSnapshot] = await Promise.all([
    db.collection("marks").where("userId", "==", userId).get(),
    db.collection("progress").where("userId", "==", userId).get()
  ]);
  const candidates = buildReminderCandidates({
    marks: marksSnapshot.docs.map(document => document.data()),
    completedProgress: progressSnapshot.docs.map(document => document.data()),
    courseCatalog
  });
  const reminder = chooseReminder(candidates, recentKeys);
  if (!reminder) return { sent: 0, skipped: "no-reminders" };

  let sent = 0;
  await Promise.all(devices.map(async device => {
    const origin = ALLOWED_ORIGINS.has(device.data.origin)
      ? device.data.origin
      : "https://semester-tracker-1-2-6018d.web.app";
    const url = `${origin}/course.html?id=${encodeURIComponent(reminder.courseId)}`;
    try {
      await webpush.sendNotification({
        endpoint: device.data.endpoint,
        keys: device.data.keys
      }, JSON.stringify({
        title: reminder.title,
        body: reminder.body,
        url,
        tag: `study-${reminder.key}`
      }), { TTL: 14400, urgency: "normal" });
      sent += 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await device.ref.delete();
        return;
      }
      throw error;
    }
  }));

  if (sent > 0) {
    await deliveryRef.set({
      dateKey,
      sentCount: sentToday + 1,
      recentKeys: [reminder.key, ...recentKeys.filter(key => key !== reminder.key)].slice(0, 12),
      lastSentAt: FieldValue.serverTimestamp()
    });
  }
  return { sent, reminder: reminder.key };
}

export async function main() {
  if (!process.env.VAPID_PRIVATE_KEY) {
    throw new Error("Missing VAPID_PRIVATE_KEY secret.");
  }
  const app = initializeApp({ credential: cert(parseServiceAccount()) });
  const db = getFirestore(app);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const [subscriptionsSnapshot, courseCatalog] = await Promise.all([
    db.collection("notificationSubscriptions").where("enabled", "==", true).get(),
    loadCourseCatalog(db)
  ]);
  const devicesByUser = new Map();
  subscriptionsSnapshot.docs.forEach(document => {
    const data = document.data();
    if (!data.userId || !data.endpoint || !data.keys?.p256dh || !data.keys?.auth) return;
    if (!devicesByUser.has(data.userId)) devicesByUser.set(data.userId, []);
    devicesByUser.get(data.userId).push({ ref: document.ref, data });
  });

  const results = [];
  for (const [userId, devices] of devicesByUser) {
    results.push({ userId, ...await sendForUser(db, userId, devices, courseCatalog) });
  }
  console.log(JSON.stringify({ users: results.length, results }));
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entryUrl === import.meta.url) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}


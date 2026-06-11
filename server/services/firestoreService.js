// ==========================================================
//  Firestore data-access service
//  Collections: users, chats, messages
//  All methods no-op gracefully when Firebase is disabled.
// ==========================================================
import { db, admin, firebaseEnabled } from "../config/firebase.js";

const now = () => admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date();

// ---------- USERS ----------
export async function upsertUser(uid, data) {
  if (!firebaseEnabled) return null;
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const payload = {
    uid,
    username: data.username || "",
    email: data.email || "",
    gender: data.gender || "",
    dateOfBirth: data.dateOfBirth || "",
    updatedAt: now(),
  };
  if (!snap.exists) payload.createdAt = now();
  await ref.set(payload, { merge: true });
  return (await ref.get()).data();
}

export async function getUser(uid) {
  if (!firebaseEnabled) return null;
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data() : null;
}

// ---------- CHATS ----------
export async function createChat(uid, title = "New Chat") {
  if (!firebaseEnabled) return null;
  const ref = await db.collection("chats").add({ uid, title, createdAt: now() });
  return { chatId: ref.id, uid, title };
}

export async function listChats(uid) {
  if (!firebaseEnabled) return [];
  // Note: we intentionally DON'T combine .where() with .orderBy() here,
  // because that requires a composite index that may not be deployed yet
  // (the cause of "Could not load history"). We sort in memory instead.
  const snap = await db.collection("chats").where("uid", "==", uid).get();
  const toMs = (t) => (t?.toMillis ? t.toMillis() : t?._seconds ? t._seconds * 1000 : 0);
  return snap.docs
    .map((d) => ({ chatId: d.id, ...d.data() }))
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
}

export async function renameChat(uid, chatId, title) {
  if (!firebaseEnabled) return;
  const ref = db.collection("chats").doc(chatId);
  const snap = await ref.get();
  if (snap.exists && snap.data().uid === uid) await ref.update({ title });
}

export async function deleteChat(uid, chatId) {
  if (!firebaseEnabled) return;
  const ref = db.collection("chats").doc(chatId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().uid !== uid) return;
  // delete messages first
  const msgs = await db.collection("messages").where("chatId", "==", chatId).get();
  const batch = db.batch();
  msgs.forEach((m) => batch.delete(m.ref));
  batch.delete(ref);
  await batch.commit();
}

// ---------- MESSAGES ----------
export async function addMessage(chatId, role, content) {
  if (!firebaseEnabled) return null;
  const ref = await db.collection("messages").add({
    chatId,
    role,
    content,
    timestamp: now(),
  });
  return { messageId: ref.id, chatId, role, content };
}

export async function listMessages(chatId) {
  if (!firebaseEnabled) return [];
  const snap = await db.collection("messages").where("chatId", "==", chatId).get();
  const toMs = (t) => (t?.toMillis ? t.toMillis() : t?._seconds ? t._seconds * 1000 : 0);
  return snap.docs
    .map((d) => ({ messageId: d.id, ...d.data() }))
    .sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
}

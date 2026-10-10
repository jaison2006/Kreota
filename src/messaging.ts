import { useEffect, useState } from "react";
import { get, increment, limitToLast, onValue, push, query, ref, serverTimestamp, set, update } from "firebase/database";
import { db } from "./firebase";
import type { Profile, Role } from "./session";
import { CLIENTS, CREATORS } from "./data/india";
import { creatorAvatar } from "./data/avatars";

/** Public card at directory/{uid}, so signed-in people can find each other without reading private profiles. */
export interface DirectoryEntry {
  uid: string;
  name: string;
  photoURL: string | null;
  roles: Role[];
  headline: string;
  updatedAt: number;
}

/** Per-user inbox row at userConversations/{uid}/{cid}. */
export interface InboxRow {
  cid: string;
  with: string;
  lastText?: string;
  lastSender?: string;
  lastAt?: number;
  updatedAt: number;
  unread?: number;
}

export interface Message {
  file?: FileMeta;
  id: string;
  senderId: string;
  text: string;
  at: number;
}

/** One conversation per pair of people, so its id is both uids in a stable order. */
export const conversationId = (a: string, b: string) => [a, b].sort().join("_");

export function directoryEntryFor(p: Profile): Omit<DirectoryEntry, "updatedAt"> {
  const roles = (["client", "creator"] as Role[]).filter((r) => p.onboarded?.[r]);
  const creator = [p.creator?.category, p.creator?.location].filter(Boolean).join(" · ");
  const client = [p.client?.brand, p.client?.industry].filter(Boolean).join(" · ");
  return {
    uid: p.uid,
    name: p.name,
    photoURL: p.photoURL ?? null,
    roles,
    headline: (p.role === "creator" ? creator || client : client || creator) || "",
  };
}

const lastPublished = new Map<string, string>();
/** Keeps the public directory card in step with the private profile. */
export function publishDirectoryEntry(p: Profile) {
  const entry = directoryEntryFor(p);
  const key = JSON.stringify(entry);
  if (lastPublished.get(p.uid) === key) return;
  lastPublished.set(p.uid, key);
  set(ref(db, `directory/${p.uid}`), { ...entry, updatedAt: serverTimestamp() }).catch(() => lastPublished.delete(p.uid));
}

function useLive<T>(path: string | null, map: (val: unknown) => T, initial: T, limit?: number): { data: T; loading: boolean; error: string } {
  const [state, setState] = useState({ data: initial, loading: true, error: "" });
  useEffect(() => {
    if (!path) { setState({ data: initial, loading: false, error: "" }); return; }
    setState((s) => ({ ...s, loading: true, error: "" }));
    const r = limit ? query(ref(db, path), limitToLast(limit)) : ref(db, path);
    return onValue(
      r,
      (snap) => setState({ data: map(snap.val()), loading: false, error: "" }),
      (e) => setState({ data: initial, loading: false, error: /permission/i.test(e.message) ? "permission" : e.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, limit]);
  return state;
}

export const useDirectory = () =>
  useLive<DirectoryEntry[]>("directory", (v) => Object.values((v as Record<string, DirectoryEntry>) ?? {}), []);

export const useInbox = (uid: string) =>
  useLive<InboxRow[]>(`userConversations/${uid}`, (v) =>
    Object.entries((v as Record<string, Omit<InboxRow, "cid">>) ?? {})
      .map(([cid, row]) => ({ ...row, cid }))
      .sort((a, b) => (b.lastAt ?? b.updatedAt ?? 0) - (a.lastAt ?? a.updatedAt ?? 0)), []);

export const useMessages = (cid: string | null) =>
  useLive<Message[]>(cid ? `messages/${cid}` : null, (v) =>
    Object.entries((v as Record<string, Omit<Message, "id">>) ?? {})
      .map(([id, m]) => ({ ...m, id }))
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0)), [], 300);

/** Creates the conversation (and both inbox rows) the first time two people talk. */
export async function openConversation(me: string, other: string, existing: boolean): Promise<string> {
  const cid = conversationId(me, other);
  if (existing) return cid;
  await update(ref(db), {
    [`conversations/${cid}/members`]: { [me]: true, [other]: true },
    [`conversations/${cid}/createdAt`]: serverTimestamp(),
    [`userConversations/${me}/${cid}`]: { with: other, updatedAt: serverTimestamp(), unread: 0 },
    [`userConversations/${other}/${cid}`]: { with: me, updatedAt: serverTimestamp(), unread: 0 },
  });
  return cid;
}

export async function sendMessage(cid: string, me: string, other: string, text: string) {
  const body = text.trim().slice(0, 4000);
  if (!body) return;
  const id = push(ref(db, `messages/${cid}`)).key!;
  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  await update(ref(db), {
    [`messages/${cid}/${id}`]: { senderId: me, text: body, at: serverTimestamp() },
    [`conversations/${cid}/lastMessage`]: { text: preview, senderId: me, at: serverTimestamp() },
    [`conversations/${cid}/updatedAt`]: serverTimestamp(),
    [`userConversations/${me}/${cid}/with`]: other,
    [`userConversations/${me}/${cid}/lastText`]: preview,
    [`userConversations/${me}/${cid}/lastSender`]: me,
    [`userConversations/${me}/${cid}/lastAt`]: serverTimestamp(),
    [`userConversations/${me}/${cid}/updatedAt`]: serverTimestamp(),
    [`userConversations/${me}/${cid}/unread`]: 0,
    [`userConversations/${other}/${cid}/with`]: me,
    [`userConversations/${other}/${cid}/lastText`]: preview,
    [`userConversations/${other}/${cid}/lastSender`]: me,
    [`userConversations/${other}/${cid}/lastAt`]: serverTimestamp(),
    [`userConversations/${other}/${cid}/updatedAt`]: serverTimestamp(),
    [`userConversations/${other}/${cid}/unread`]: increment(1),
  });
}

export const markRead = (me: string, cid: string) => update(ref(db, `userConversations/${me}/${cid}`), { unread: 0 });

/* ---------- demo contacts (the seeded creators and brands) ---------- */

/** A directory card for one of the demo creators or brands; `demo` marks it as not a real account. */
export type Contact = DirectoryEntry & { demo?: boolean };

export const DEMO_CONTACTS: Contact[] = [
  ...CREATORS.map((c) => ({
    uid: c.id, name: c.name, photoURL: creatorAvatar(c), roles: ["creator"] as Role[],
    headline: `${c.title} · ${c.city}`, updatedAt: 0, demo: true,
  })),
  ...CLIENTS.map((b) => ({
    uid: b.id, name: b.brand, photoURL: null, roles: ["client"] as Role[],
    headline: `${b.industry} · ${b.city}`, updatedAt: 0, demo: true,
  })),
];
export const isDemoId = (id: string) => /^[cb]\d\d$/.test(id);
export const demoCid = (id: string) => `demo:${id}`;
export const demoIdOf = (cid: string) => (cid.startsWith("demo:") ? cid.slice(5) : null);

const demoPath = (me: string, id: string) => `users/${me}/demoChats/${id}`;

export const useDemoInbox = (me: string) =>
  useLive<InboxRow[]>(`users/${me}/demoChats`, (v) =>
    Object.entries((v as Record<string, { lastText?: string; lastSender?: string; lastAt?: number; unread?: number }>) ?? {})
      .map(([id, row]) => ({ cid: demoCid(id), with: id, lastText: row.lastText, lastSender: row.lastSender, lastAt: row.lastAt, updatedAt: row.lastAt ?? 0, unread: row.unread })), []);

export const useDemoMessages = (me: string | null, id: string | null) =>
  useLive<(Message & { auto?: boolean })[]>(me && id ? `${demoPath(me, id)}/messages` : null, (v) =>
    Object.entries((v as Record<string, Omit<Message, "id"> & { auto?: boolean }>) ?? {})
      .map(([mid, m]) => ({ ...m, id: mid }))
      .sort((a, b) => (a.at ?? 0) - (b.at ?? 0)), [], 300);

/** Writes the demo inbox row the first time, so the chat shows up before anyone has typed. */
export const openDemoConversation = (me: string, id: string) =>
  update(ref(db, demoPath(me, id)), { lastAt: serverTimestamp(), unread: 0 }).then(() => demoCid(id));

function demoReply(id: string, myName: string, turn: number): string {
  const first = myName.split(" ")[0] || "there";
  const creator = CREATORS.find((c) => c.id === id);
  if (creator) {
    const replies = [
      `Hi ${first}! Thanks for reaching out 🙌 I'm ${creator.name.split(" ")[0]}, ${creator.title.toLowerCase()} in ${creator.city}. I'd love to hear more — what's the product, timeline and budget you have in mind?`,
      `Sounds exciting! My typical project is ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(creator.rateFrom)}–${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(creator.rateTo)} and I usually deliver in ${creator.turnaroundDays} days. I create in ${creator.languages.join(", ")}.`,
      `Could you share the brief and a couple of reference reels you like? I can send a rough concept within 48 hours.`,
      `Perfect, noted 👍 Send over the invite on Kreota whenever you're ready and I'll lock in the dates.`,
    ];
    return replies[Math.min(turn, replies.length - 1)];
  }
  const brand = CLIENTS.find((b) => b.id === id);
  if (brand) {
    const replies = [
      `Hi ${first}, thanks for your message! I'm ${brand.contact.name.split(" ")[0]}, ${brand.contact.title} at ${brand.brand}. We're casting for "${brand.brief.title}" — could you share your portfolio and rate card?`,
      `Great to hear. The budget for this brief is ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(brand.brief.budget[0])}–${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(brand.brief.budget[1])} and we need delivery within ${brand.brief.deadlineDays} days. Deliverables: ${brand.brief.deliverables.join(", ")}.`,
      `Our tone is ${brand.tone}. Could you pitch one hook idea for the first 3 seconds?`,
      `Love it! We'll review and get back to you shortly. Please also mark the brief as "interested" on Kreota so it's on our shortlist.`,
    ];
    return replies[Math.min(turn, replies.length - 1)];
  }
  return "Thanks for your message!";
}

/** Saves your message, then adds an automatic reply from the demo profile (marked `auto`). */
export async function sendDemoMessage(me: string, id: string, text: string, myName: string, turn: number) {
  const body = text.trim().slice(0, 4000);
  if (!body) return;
  const base = demoPath(me, id);
  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  const mine = push(ref(db, `${base}/messages`)).key!;
  await update(ref(db), {
    [`${base}/messages/${mine}`]: { senderId: me, text: body, at: serverTimestamp() },
    [`${base}/lastText`]: preview,
    [`${base}/lastSender`]: me,
    [`${base}/lastAt`]: serverTimestamp(),
    [`${base}/unread`]: 0,
  });
  const reply = demoReply(id, myName, turn);
  setTimeout(() => {
    const rid = push(ref(db, `${base}/messages`)).key!;
    update(ref(db), {
      [`${base}/messages/${rid}`]: { senderId: id, text: reply, at: serverTimestamp(), auto: true },
      [`${base}/lastText`]: reply.length > 120 ? `${reply.slice(0, 117)}…` : reply,
      [`${base}/lastSender`]: id,
      [`${base}/lastAt`]: serverTimestamp(),
      [`${base}/unread`]: increment(1),
    }).catch(() => {});
  }, 1400 + Math.min(2000, reply.length * 12));
}

export const markDemoRead = (me: string, id: string) => update(ref(db, demoPath(me, id)), { unread: 0 });

/* ---------- file sharing ---------- */

/** Files live in the Realtime Database (Firebase Storage needs the paid plan), so they're capped. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface FileMeta { id: string; name: string; type: string; size: number }

export class FileTooLargeError extends Error {}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function packFile(file: File, owner: string) {
  if (file.size > MAX_FILE_BYTES) throw new FileTooLargeError(`${file.name} is larger than 5 MB.`);
  const data = await readAsDataUrl(file);
  const meta = { name: file.name.slice(0, 200) || "file", type: file.type || "application/octet-stream", size: file.size };
  return { meta, record: { ...meta, owner, data, at: serverTimestamp() } };
}

const filePreview = (name: string) => `📎 ${name}`;

export async function sendFile(cid: string, me: string, other: string, file: File) {
  const { meta, record } = await packFile(file, me);
  const id = push(ref(db, `files/${cid}`)).key!;
  const mid = push(ref(db, `messages/${cid}`)).key!;
  const preview = filePreview(meta.name);
  await update(ref(db), {
    [`files/${cid}/${id}`]: record,
    [`messages/${cid}/${mid}`]: { senderId: me, text: "", file: { id, ...meta }, at: serverTimestamp() },
    [`conversations/${cid}/lastMessage`]: { text: preview, senderId: me, at: serverTimestamp() },
    [`conversations/${cid}/updatedAt`]: serverTimestamp(),
    [`userConversations/${me}/${cid}/with`]: other,
    [`userConversations/${me}/${cid}/lastText`]: preview,
    [`userConversations/${me}/${cid}/lastSender`]: me,
    [`userConversations/${me}/${cid}/lastAt`]: serverTimestamp(),
    [`userConversations/${me}/${cid}/updatedAt`]: serverTimestamp(),
    [`userConversations/${other}/${cid}/with`]: me,
    [`userConversations/${other}/${cid}/lastText`]: preview,
    [`userConversations/${other}/${cid}/lastSender`]: me,
    [`userConversations/${other}/${cid}/lastAt`]: serverTimestamp(),
    [`userConversations/${other}/${cid}/updatedAt`]: serverTimestamp(),
    [`userConversations/${other}/${cid}/unread`]: increment(1),
  });
}

export async function sendDemoFile(me: string, id: string, file: File) {
  const { meta, record } = await packFile(file, me);
  const fid = push(ref(db, `demoFiles/${me}`)).key!;
  const base = demoPath(me, id);
  const mid = push(ref(db, `${base}/messages`)).key!;
  const preview = filePreview(meta.name);
  await update(ref(db), {
    [`demoFiles/${me}/${fid}`]: record,
    [`${base}/messages/${mid}`]: { senderId: me, text: "", file: { id: fid, ...meta }, at: serverTimestamp() },
    [`${base}/lastText`]: preview,
    [`${base}/lastSender`]: me,
    [`${base}/lastAt`]: serverTimestamp(),
    [`${base}/unread`]: 0,
  });
  const reply = isDemoId(id) && id.startsWith("b")
    ? `Thanks for sending "${meta.name}"! Our team will review it and come back with feedback within two working days.`
    : `Got "${meta.name}" — thanks! I'll go through it and share my thoughts and a rough concept soon.`;
  setTimeout(() => {
    const rid = push(ref(db, `${base}/messages`)).key!;
    update(ref(db), {
      [`${base}/messages/${rid}`]: { senderId: id, text: reply, at: serverTimestamp(), auto: true },
      [`${base}/lastText`]: reply.length > 120 ? `${reply.slice(0, 117)}…` : reply,
      [`${base}/lastSender`]: id,
      [`${base}/lastAt`]: serverTimestamp(),
      [`${base}/unread`]: increment(1),
    }).catch(() => {});
  }, 1800);
}

const fileCache = new Map<string, Promise<string>>();
/** Loads a shared file's contents as a data URL (cached per session). */
export function loadFileData(cid: string, me: string, fileId: string): Promise<string> {
  const path = cid.startsWith("demo:") ? `demoFiles/${me}/${fileId}` : `files/${cid}/${fileId}`;
  let p = fileCache.get(path);
  if (!p) {
    p = get(ref(db, path)).then((s) => {
      const data = s.val()?.data;
      if (typeof data !== "string") throw new Error("This file is no longer available.");
      return data;
    });
    p.catch(() => fileCache.delete(path));
    fileCache.set(path, p);
  }
  return p;
}

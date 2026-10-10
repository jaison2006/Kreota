import { useEffect, useState } from "react";
import { increment, limitToLast, onValue, push, query, ref, serverTimestamp, set, update } from "firebase/database";
import { db } from "./firebase";
import type { Profile, Role } from "./session";

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

import { onDisconnect, onValue, push, ref, remove, set } from 'firebase/database';
import { rtdb } from './firebase';

/**
 * Marks this tab as present in the room until the returned function runs or the connection drops.
 * Each call is its own connection entry, so a student on two devices still counts once.
 */
export function joinPresence(roomId: string, sid: string): () => void {
  const conn = push(ref(rtdb, `presence/${roomId}/${sid}`));
  let left = false;
  const stop = onValue(ref(rtdb, '.info/connected'), (snap) => {
    if (snap.val() !== true) return;
    // Register the cleanup first so a crash right after set() cannot leave a ghost entry.
    void onDisconnect(conn).remove().then(() => (left ? undefined : set(conn, true))).catch(() => {});
  });
  return () => {
    left = true;
    stop();
    void onDisconnect(conn).cancel().catch(() => {});
    void remove(conn).catch(() => {});
  };
}

/** Number of distinct students with at least one live connection in the room. */
export function watchOnlineCount(roomId: string, cb: (n: number) => void): () => void {
  return onValue(ref(rtdb, `presence/${roomId}`), (snap) => cb(snap.size), () => cb(0));
}

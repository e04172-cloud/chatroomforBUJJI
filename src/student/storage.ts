const LAST_STUDENT = 'budae.lastStudentId';

/** Convenience only: storage may be blocked (private mode, previews), so every access is guarded. */
export function loadLastStudentId(): string | null {
  try {
    return localStorage.getItem(LAST_STUDENT);
  } catch {
    return null;
  }
}

export function saveLastStudentId(id: string): void {
  try {
    localStorage.setItem(LAST_STUDENT, id);
  } catch {
    // ignore
  }
}

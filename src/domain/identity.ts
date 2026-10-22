export const STUDENT_EMAIL_DOMAIN = 'students.budae.invalid';

export function authEmail(studentId: string, gen: number): string {
  return `${studentId}-${gen}@${STUDENT_EMAIL_DOMAIN}`;
}

export function parseAuthEmail(email: string): { studentId: string; gen: number } | null {
  const m = /^([a-z0-9]+)-(\d+)@students\.budae\.invalid$/.exec(email);
  return m ? { studentId: m[1], gen: Number(m[2]) } : null;
}

export function toAuthPassword(pin: string): string {
  return 'budae!' + pin;
}

export function validatePin(pin: string): string | null {
  return pin.length < 4 ? '암호는 4자리 이상이에요' : null;
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newStudentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join('');
}

import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';

/** Asks before something that cannot be undone. */
export function Confirm({ open, title, children, confirmLabel, onConfirm, onClose }: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch {
      setError('하지 못했어요. 잠시 후 다시 해 보세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {children && <div style={{ fontSize: 14, lineHeight: 1.6 }}>{children}</div>}
      {error && <p className="err" role="alert">{error}</p>}
      <button type="button" className="btn danger" disabled={busy} onClick={() => void confirm()}>{confirmLabel}</button>
      <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={onClose}>취소</button>
    </Sheet>
  );
}

import { useEffect, type ReactNode } from 'react';

/** Panel that slides up from the bottom on phones (a centred dialog on wide screens). */
export function Sheet({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        {title != null && (
          <div className="sheet-head">
            <h3>{title}</h3>
            <button type="button" className="link-btn" onClick={onClose}>닫기</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

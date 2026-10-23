import type { ReactNode } from 'react';

export function Flame() {
  return <span className="flame" aria-hidden>🔥</span>;
}

/** Broth-coloured band with a wavy edge; cools to grey-brown when the fire is off. */
export function PotHeader({ title, subtitle, logo, fireOn, right }: {
  title: ReactNode;
  subtitle?: ReactNode;
  logo: ReactNode;
  fireOn: boolean;
  right?: ReactNode;
}) {
  return (
    <header className={fireOn ? 'pot' : 'pot off'} data-fire={fireOn ? 'on' : 'off'}>
      <div className="pot-logo" aria-hidden>{logo}</div>
      <div className="grow">
        <div className="pot-title">{title}</div>
        {subtitle != null && <div className="pot-sub">{subtitle}</div>}
      </div>
      {right != null && <div className="pot-right">{right}</div>}
    </header>
  );
}

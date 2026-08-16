import { useEffect, useRef } from 'react';

const cx = (...c) => c.filter(Boolean).join(' ');

export function Button({ variant, size, className, as: As = 'button', ...props }) {
  return <As className={cx('btn', variant && `btn-${variant}`, size && `btn-${size}`, className)} {...props} />;
}

export function Card({ accent, hover, tight, feature, className, as: As = 'div', ...props }) {
  return (
    <As
      className={cx(
        'card',
        accent && `card-accent-${accent}`,
        hover && 'card-hover',
        tight && 'card-tight',
        feature && 'card-feature',
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ tone, solid, className, ...props }) {
  return <span className={cx('badge', tone && (solid ? `badge-solid-${tone}` : `badge-${tone}`), className)} {...props} />;
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}{hint ? ` · ${hint}` : ''}</span>
      {children}
    </label>
  );
}

export function Input(props) { return <input className="input" {...props} />; }
export function TextArea(props) { return <textarea {...props} />; }
export function Select({ children, ...props }) { return <select {...props}>{children}</select>; }

export function Modal({ open, onClose, title, subtitle, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog className="modal" ref={ref} onClose={onClose} onCancel={onClose}>
      {open && (
        <div className="modal-body">
          <div className="modal-head">
            <div>
              <h2 className="display display-md">{title}</h2>
              {subtitle && <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>{subtitle}</p>}
            </div>
            <div className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">✕</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function Loading({ label = 'Loading…' }) {
  return <p className="muted" role="status">{label}</p>;
}

export function ErrorNote({ error }) {
  return error ? <p className="err" role="alert">{error}</p> : null;
}

export function Stat({ label, value, tone }) {
  return (
    <Card tight className="stat left-rule" style={{ '--rule': tone ? `var(--${tone})` : 'var(--ink)' }}>
      <b className="display">{value}</b>
      <span className="eyebrow">{label}</span>
    </Card>
  );
}

export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="row-between reveal" style={{ marginBottom: 32 }}>
      <div>
        {eyebrow && <p className="eyebrow" style={{ margin: '0 0 6px' }}>{eyebrow}</p>}
        <h1 className="display display-lg">{title}</h1>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

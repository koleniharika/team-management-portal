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

/** Little star / triangle marks for the bold areas. Decorative only. */
export function Star({ size = 22, color = 'var(--orange)', className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      className={className} style={style}>
      <path fill={color} d="M12 0c.6 6 5.4 10.8 12 12-6.6 1.2-11.4 6-12 12-.6-6-5.4-10.8-12-12C6.6 10.8 11.4 6 12 0Z" />
    </svg>
  );
}

export function Triangle({ size = 18, color = 'var(--lilac)', className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      className={className} style={style}>
      <path fill={color} d="M12 2 23 21H1Z" />
    </svg>
  );
}

export function Empty({ children }) {
  return (
    <div className="empty">
      <Star size={26} style={{ display: 'block', margin: '0 auto 12px' }} />
      {children}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <p className="muted" role="status">{label}</p>;
}

export function ErrorNote({ error }) {
  return error ? <p className="err" role="alert">{error}</p> : null;
}

export function Stat({ label, value, tone = 'lime' }) {
  return (
    <Card tight className={`stat stat-${tone} reveal`}>
      <b>{value}</b>
      <span className="eyebrow">{label}</span>
    </Card>
  );
}

export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="row-between reveal" style={{ marginBottom: 32 }}>
      <div>
        {eyebrow && <p className="eyebrow" style={{ margin: '0 0 8px' }}>{eyebrow}</p>}
        <h1 className="display display-lg" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {title}
          <Star size={18} style={{ flex: 'none', marginTop: 4 }} />
        </h1>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

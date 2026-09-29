import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Card, ErrorNote, Field, Input, Loading, Star, Triangle } from '../components/ui';

const STRIP = ['Studio ERP', '★', 'Briefs', '★', 'Deadlines', '★', 'Payroll', '★', 'Invoices', '★'];

export default function Login() {
  const { employee, isAdmin, loading, signIn } = useAuth();
  const { theme, toggle } = useTheme();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="wrap page"><Loading label="Checking your session…" /></div>;
  if (employee) return <Navigate to={isAdmin ? '/admin' : '/me'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(form.email.trim(), form.password);
    } catch (err) {
      setError(err.message || 'Could not sign in.');
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <button className="icon-btn" onClick={toggle} aria-label="Toggle theme"
        style={{ position: 'fixed', top: 18, right: 22, zIndex: 5 }}>
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      {/* abstract pastel shapes */}
      <div className="blob" aria-hidden="true"
        style={{ width: 420, height: 420, background: 'var(--lilac)', top: -140, left: -120, opacity: 0.55 }} />
      <div className="blob" aria-hidden="true"
        style={{ width: 260, height: 260, background: 'var(--lime)', bottom: 60, left: '38%', opacity: 0.45 }} />
      <div className="blob" aria-hidden="true"
        style={{ width: 320, height: 320, background: 'var(--yellow)', top: '18%', right: -110, opacity: 0.5 }} />

      <div className="wrap login-grid">
        <div className="login-copy">
          <span className="chip chip-lilac chip-float" style={{ top: -18, right: '12%', rotate: '-6deg' }}>on time ✓</span>
          <span className="chip chip-orange chip-float" style={{ bottom: '6%', right: '4%', rotate: '5deg' }}>15 briefs</span>

          <p className="eyebrow" style={{ margin: '0 0 14px' }}>Internal tool · team of 20</p>
          <h1 className="display display-xl" style={{ marginBottom: 24 }}>
            Run the <span className="hl">whole</span> studio from one tab.
          </h1>
          <p className="muted" style={{ maxWidth: '40ch', fontSize: 17, margin: 0 }}>
            Briefs, deadlines, payroll and invoices. Sign in with the credentials your admin gave you —
            there is no public sign-up.
          </p>

          <div className="row" style={{ marginTop: 30, gap: 10 }}>
            <span className="chip">Tasks</span>
            <span className="chip chip-blue">Payroll</span>
            <span className="chip chip-pink">Invoicing</span>
            <Star size={26} className="spin" />
            <Triangle size={20} />
          </div>
        </div>

        <Card className="login-card reveal">
          <h2 className="display display-md" style={{ marginBottom: 4 }}>Sign in</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 24, fontSize: 14 }}>
            Employees and admins, same door.
          </p>
          <form onSubmit={submit}>
            <Field label="Email">
              <Input type="email" autoComplete="username" required autoFocus
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" required
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <ErrorNote error={error} />
            <Button size="lg" className="btn-block" style={{ marginTop: 12 }} disabled={busy}>
              {busy ? 'Signing in…' : 'Enter'}
            </Button>
          </form>
        </Card>
      </div>

      <div className="marquee" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i}>{STRIP.map((w, j) => <span key={j}>{w}</span>)}</div>
        ))}
      </div>
    </div>
  );
}

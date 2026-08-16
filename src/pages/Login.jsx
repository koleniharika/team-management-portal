import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Card, ErrorNote, Field, Input, Loading } from '../components/ui';

export default function Login() {
  const { user, employee, isAdmin, loading, signIn } = useAuth();
  const { theme, toggle } = useTheme();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="wrap page"><Loading label="Checking your session…" /></div>;
  if (user && employee) return <Navigate to={isAdmin ? '/admin' : '/me'} replace />;

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
    <div className="shell" style={{ justifyContent: 'center' }}>
      <button className="icon-btn" onClick={toggle} aria-label="Toggle theme"
        style={{ position: 'fixed', top: 20, right: 24, zIndex: 2 }}>
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <div className="wrap" style={{ display: 'grid', gap: 48, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'center', padding: '64px 0' }}>
        <div className="reveal" style={{ position: 'relative' }}>
          <div className="deco deco-ring deco-spin" style={{ width: 220, height: 220, right: -40, top: -70, color: 'var(--purple)' }} />
          <p className="eyebrow">Internal tool · team of 20</p>
          <h1 className="display display-xl" style={{ margin: '12px 0 20px' }}>
            Run the <span style={{ color: 'var(--green)' }}>whole</span> studio<br />from one tab.
          </h1>
          <p className="muted" style={{ maxWidth: '38ch', fontSize: 17 }}>
            Briefs, deadlines, payroll and invoices. Sign in with the credentials your admin gave you —
            there is no public sign-up.
          </p>
          <div className="row" style={{ marginTop: 28 }}>
            <span className="badge badge-green">Tasks</span>
            <span className="badge badge-purple">Payroll</span>
            <span className="badge badge-orange">Invoicing</span>
          </div>
        </div>

        <Card feature className="reveal" style={{ maxWidth: 460, width: '100%', justifySelf: 'end' }}>
          <h2 className="display display-md" style={{ marginBottom: 4 }}>Sign in</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 24, fontSize: 14 }}>Employees and admins, same door.</p>
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
    </div>
  );
}

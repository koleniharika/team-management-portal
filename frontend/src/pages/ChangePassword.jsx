import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, ErrorNote, Field, Input, Star } from '../components/ui';

/**
 * Shown instead of the app while `mustChangePassword` is set — that is, right
 * after an admin hands someone a temporary password. Old password is required,
 * so nobody can take over a tab that was left open.
 */
export default function ChangePassword() {
  const { employee, changePassword, signOut } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(form.currentPassword, form.newPassword);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="wrap page" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <Card feature className="reveal" style={{ width: 'min(460px, 100%)' }}>
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <Star size={20} />
          <p className="eyebrow" style={{ margin: 0 }}>First things first</p>
        </div>
        <h1 className="display display-md" style={{ marginBottom: 8 }}>Set your own password</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          {employee?.name}, the password you were given is temporary. Pick one only you know.
        </p>

        <form onSubmit={submit}>
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" required autoFocus
              value={form.currentPassword} onChange={set('currentPassword')} />
          </Field>
          <Field label="New password" hint="min 8 characters">
            <Input type="password" autoComplete="new-password" required minLength={8}
              value={form.newPassword} onChange={set('newPassword')} />
          </Field>
          <Field label="Repeat new password">
            <Input type="password" autoComplete="new-password" required minLength={8}
              value={form.confirm} onChange={set('confirm')} />
          </Field>

          <ErrorNote error={error} />
          <Button size="lg" className="btn-block" style={{ marginTop: 12 }} disabled={busy}>
            {busy ? 'Saving…' : 'Save and continue'}
          </Button>
        </form>

        <Button variant="ghost" size="sm" onClick={signOut} style={{ marginTop: 16 }}>Sign out instead</Button>
      </Card>
    </div>
  );
}

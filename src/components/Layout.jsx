import { useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Loading } from './ui';
import { initials } from '../lib/util';

const ADMIN_NAV = [
  ['/admin', 'Dashboard'],
  ['/completed-tasks', 'Review'],
  ['/team', 'Team'],
  ['/brands', 'Brands'],
  ['/salary', 'Salary'],
  ['/invoices', 'Invoices'],
  ['/analytics', 'Analytics'],
];

export function ProtectedRoute({ adminOnly = false }) {
  const { user, employee, isAdmin, loading, signOut } = useAuth();

  if (loading) return <div className="wrap page"><Loading label="Checking your session…" /></div>;
  if (!user) return <Navigate to="/" replace />;

  if (!employee) {
    return (
      <div className="wrap page stack">
        <h1 className="display display-lg">No employee record</h1>
        <p className="muted">
          Your login exists but there is no row for it in the employees table. Ask an admin to add you.
        </p>
        <div><Button onClick={signOut}>Sign out</Button></div>
      </div>
    );
  }

  if (adminOnly && !isAdmin) return <Navigate to="/me" replace />;
  return <Outlet />;
}

export default function Layout() {
  const { employee, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = isAdmin ? ADMIN_NAV : [['/me', 'My work']];
  const go = (to) => { setMenuOpen(false); navigate(to); };

  return (
    <div className="shell">
      <header className="topbar no-print">
        <div className="wrap topbar-inner">
          <a className="logo" href={isAdmin ? '/admin' : '/me'}
            onClick={(e) => { e.preventDefault(); go(isAdmin ? '/admin' : '/me'); }}>
            studio<em>.</em>erp
          </a>

          <button
            className="icon-btn nav-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? '✕' : '☰'}
          </button>

          <nav id="main-nav" className={`nav ${menuOpen ? 'open' : ''}`} aria-label="Main">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="spacer" />
          <button
            className="icon-btn"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <div className="avatar" aria-hidden="true">{initials(employee?.name)}</div>
            <div className="user-meta" style={{ lineHeight: 1.2 }}>
              <strong style={{ fontSize: 14 }}>{employee?.name}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{employee?.subRole || employee?.role}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>
      <main className="wrap page"><Outlet /></main>
    </div>
  );
}

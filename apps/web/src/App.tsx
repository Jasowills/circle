import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { ThemeProvider, useTheme } from './theme';
import { Logo } from './Logo';
import { I } from './icons';
import { Login, AuthCallback } from './pages/Login';
import { Setup } from './pages/Setup';
import { Overview } from './pages/Overview';
import { WalletPage } from './pages/Wallet';
import { SettingsPage } from './pages/Settings';
import { NotificationsPage } from './pages/Notifications';
import { ProfilePage } from './pages/Profile';
import { CirclesList } from './pages/CirclesList';
import { CircleDetailPage } from './pages/CircleDetail';

function Shell() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <Logo />
          Circle
        </Link>
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'navlink on' : 'navlink')}>
          <I.home size={17} /> Overview
        </NavLink>
        <NavLink to="/circles" className={({ isActive }) => (isActive ? 'navlink on' : 'navlink')}>
          <I.grid size={17} /> Circles
        </NavLink>
        <NavLink to="/wallet" className={({ isActive }) => (isActive ? 'navlink on' : 'navlink')}>
          <I.wallet size={17} /> Wallet
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'navlink on' : 'navlink')}>
          <I.bell size={17} /> Activity
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'navlink on' : 'navlink')}>
          <I.gear size={17} /> Settings
        </NavLink>
        <div className="side-foot">
          <span className="muted" style={{ fontSize: 13 }}>{user.name}</span>
          <div className="row">
            <button className="ghost" onClick={toggle} title="Toggle light / dark" aria-label="Toggle light and dark mode" style={{ padding: '9px 12px' }}>
              {theme === 'dark' ? <I.sun size={17} /> : <I.moon size={17} />}
            </button>
            <button className="ghost" onClick={() => signOut().then(() => nav('/login'))}>
              Logout
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/circles" element={<CirclesList />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/users/:id" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/circles/:id" element={<CircleDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/*" element={<Shell />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

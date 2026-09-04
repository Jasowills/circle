import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { ThemeProvider, useTheme } from './theme';
import { Logo } from './Logo';
import { Login, AuthCallback } from './pages/Login';
import { Setup } from './pages/Setup';
import { Overview } from './pages/Overview';
import { WalletPage } from './pages/Wallet';
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
          Overview
        </NavLink>
        <NavLink to="/circles" className={({ isActive }) => (isActive ? 'navlink on' : 'navlink')}>
          Circles
        </NavLink>
        <NavLink to="/wallet" className={({ isActive }) => (isActive ? 'navlink on' : 'navlink')}>
          Wallet
        </NavLink>
        <div className="side-foot">
          <span className="muted" style={{ fontSize: 13 }}>{user.name}</span>
          <div className="row">
            <button className="ghost" onClick={toggle} title="Toggle light / dark">
              {theme === 'dark' ? 'Light' : 'Dark'}
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

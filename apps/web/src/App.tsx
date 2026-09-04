import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { ThemeProvider, useTheme } from './theme';
import { Logo } from './Logo';
import { Login, AuthCallback } from './pages/Login';
import { Setup } from './pages/Setup';
import { CirclesList } from './pages/CirclesList';
import { CircleDetailPage } from './pages/CircleDetail';

function Shell() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <div className="topbar">
        <Link to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Logo />
          Circle
        </Link>
        <div className="row">
          <span className="muted" style={{ fontSize: 13 }}>{user.name}</span>
          <button className="ghost" onClick={toggle} title="Toggle light / dark">
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button
            className="ghost"
            onClick={() => signOut().then(() => nav('/login'))}
          >
            Logout
          </button>
        </div>
      </div>
      <Routes>
        <Route path="/" element={<CirclesList />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/circles/:id" element={<CircleDetailPage />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="wrap">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/*" element={<Shell />} />
          </Routes>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

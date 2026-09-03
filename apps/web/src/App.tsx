import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Login, AuthCallback } from './pages/Login';
import { CirclesList } from './pages/CirclesList';
import { CircleDetailPage } from './pages/CircleDetail';

function Shell() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <div className="topbar">
        <Link to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          Circle<span>.</span>
        </Link>
        <div className="row">
          <span className="muted" style={{ fontSize: 13 }}>{user.name}</span>
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
        <Route path="/circles/:id" element={<CircleDetailPage />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <div className="wrap">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/*" element={<Shell />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

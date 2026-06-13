import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Glassmorphism Navbar */}
      <nav className="glass sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-slate-800 hover:opacity-80 transition-opacity">
            <span className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center text-white text-sm shadow-md">S</span>
            SplitEase
          </Link>

          <div className="flex items-center gap-4">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full shadow-sm border-2 border-white" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold shadow-sm border-2 border-white">
                {user?.name?.charAt(0)}
              </span>
            )}
            <span className="font-semibold text-slate-700 hidden md:block">{user?.name}</span>
            <button onClick={handleLogout} className="ml-2 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg shadow-sm hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}

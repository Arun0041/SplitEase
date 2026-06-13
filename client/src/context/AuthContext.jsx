import { createContext, useState, useEffect, useContext } from 'react';
import api from '../lib/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch (error) {
      console.error('Failed to fetch user', error);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const loginWithToken = async (token) => {
    localStorage.setItem('token', token);
    await fetchUser();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, logout }}>
      {loading ? (
        <div className="min-h-screen bg-slate-50">
          {/* Skeleton Navbar */}
          <div className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6">
            <div className="w-32 h-6 bg-slate-200 rounded-md animate-pulse"></div>
            <div className="flex gap-4 items-center">
              <div className="w-20 h-8 bg-slate-200 rounded-xl animate-pulse"></div>
              <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse"></div>
            </div>
          </div>
          {/* Skeleton Content */}
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="w-48 h-8 bg-slate-200 rounded-md animate-pulse mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-48 flex flex-col justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-200 rounded-2xl animate-pulse"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-slate-200 rounded-md w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-slate-200 rounded-md w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-10 bg-slate-100 rounded-xl w-full animate-pulse mt-4"></div>
                </div>
              ))}
            </div>
            
            <div className="mt-12 text-center">
              <p className="text-sm font-medium text-slate-400 animate-pulse">
                Waking up the server... This may take up to a minute on the first load.
              </p>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      if (token) {
        await loginWithToken(token);
        navigate('/', { replace: true });
      } else {
        navigate('/login?error=no_token', { replace: true });
      }
    };
    handleCallback();
  }, [searchParams, loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Mail, Lock, User as UserIcon, Phone, ShieldCheck, ArrowRight } from 'lucide-react';

const Login = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('resident');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [societyAddress, setSocietyAddress] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, phone, password, role, {
          name: societyName,
          address: societyAddress,
        });
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(typeof err === 'string' ? err : err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-sky-900/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-indigo-950/20 blur-[150px]" />

      <div className="z-10 w-full max-w-md animate-slide-in">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 shadow-lg shadow-sky-500/25 ring-4 ring-sky-950 mb-3">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-sans font-bold text-2xl text-white tracking-tight">
            SOCIETY<span className="text-sky-500"> MAINTENANCE</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Powered by Supabase Auth</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-900/50 bg-red-950/20 text-red-400 text-sm flex items-start gap-2.5">
            <span className="h-5 w-5 shrink-0 rounded-full bg-red-950 flex items-center justify-center text-xs font-bold font-sans">!</span>
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-md">
          <div className="flex rounded-lg bg-slate-950 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2 text-center text-sm font-medium rounded-md transition-all duration-200 ${
                isLogin ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2 text-center text-sm font-medium rounded-md transition-all duration-200 ${
                !isLogin ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Join Us
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Account Type</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('resident')}
                      className={`flex-1 py-2 px-3 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        role === 'resident'
                          ? 'border-sky-500 bg-sky-950/30 text-sky-400'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <UserIcon className="h-3.5 w-3.5" />
                      Resident
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('super_admin')}
                      className={`flex-1 py-2 px-3 border rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        role === 'super_admin'
                          ? 'border-sky-500 bg-sky-950/30 text-sky-400'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Secretary
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                {role === 'super_admin' && (
                  <div className="p-3 border border-slate-800 rounded-xl bg-slate-950/40 space-y-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">New Society Setup</span>
                    <input
                      type="text"
                      placeholder="Society Name (e.g. Greenwood Res.)"
                      value={societyName}
                      onChange={(e) => setSocietyName(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Society Address"
                      value={societyAddress}
                      onChange={(e) => setSocietyAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                )}
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@society.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-lg bg-sky-600 py-3 text-center text-sm font-semibold text-white shadow-lg hover:bg-sky-500 hover:shadow-sky-500/10 focus:outline-none transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In to Portal' : 'Create Account'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

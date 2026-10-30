import React, { FormEvent, useState } from 'react';
import { clearAccessToken, getAccessToken, setAccessToken } from '../lib/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const AuthGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!API_BASE) throw new Error('Backend URL is not configured. Set VITE_API_BASE_URL in Vercel.');
      if (mode === 'register') {
        const registered = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!registered.ok) {
          const body = await registered.json().catch(() => ({}));
          throw new Error(body.detail || `Registration failed (HTTP ${registered.status})`);
        }
      }
      const form = new URLSearchParams({ username: email, password });
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.access_token) throw new Error(body.detail || 'Login failed');
      setAccessToken(body.access_token);
      setToken(body.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to backend');
    } finally {
      setBusy(false);
    }
  };

  if (token) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7 space-y-5 shadow-2xl">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-cyan-400">TORRENTWIDE</p>
          <h1 className="mt-2 text-2xl font-extrabold">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in or create your Torrentwide account.</p>
        </div>
        <div className="flex rounded-lg bg-slate-950 p-1">
          <button type="button" onClick={() => setMode('login')} className={`flex-1 rounded-md py-2 text-sm ${mode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Login</button>
          <button type="button" onClick={() => setMode('register')} className={`flex-1 rounded-md py-2 text-sm ${mode === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Create account</button>
        </div>
        <label className="block text-sm text-slate-300">Email
          <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500" />
        </label>
        <label className="block text-sm text-slate-300">Password
          <input required minLength={12} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500" />
          <span className="mt-1 block text-xs text-slate-500">At least 12 characters.</span>
        </label>
        {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
    </div>
  );
};

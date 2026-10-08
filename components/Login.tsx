import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { AfLogo } from './AfLogo';
import {
  loadStoredUsers,
  saveStoredUsers,
  DEFAULT_ADMIN_PERMISSIONS
} from '../services/userService';
import { syncToGoogleDriveCloud, pullFromCloudAndDriveByEmail } from '../services/driveService';
import { signInWithGoogleDrive } from '../services/googleDriveAuth';
import { LanguageCode, getTranslation } from '../utils/translations';

interface LoginProps {
  users?: UserAccount[];
  onLogin: (user: UserAccount) => void;
  onUpdateUsers?: (newUsers: UserAccount[]) => void;
  language?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
}

export const Login: React.FC<LoginProps> = ({
  users,
  onLogin,
  onUpdateUsers,
  language = 'en'
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RESET'>('LOGIN');

  // Sign In State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Simple Create Account State
  const [regName, setRegName] = useState('');
  const [regEmailOrUser, setRegEmailOrUser] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Simple Password Reset State
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);

  // 1. Standard Sign In
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
    const cleanId = identifier.trim().toLowerCase();

    const matched = (activeList || []).find(
      u =>
        u.username.toLowerCase() === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId)
    );

    if (matched && matched.password === password) {
      if (matched.email) {
        pullFromCloudAndDriveByEmail(matched.email, 'merge').catch(() => {});
      }
      setIsLoading(false);
      onLogin(matched);
    } else {
      setIsLoading(false);
      setError('Invalid username/email or password.');
    }
  };

  // 2. One-Click Google Sign-In & Auto Sync
  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await signInWithGoogleDrive();
      if (res?.user) {
        const gEmail = (res.user.email || '').toLowerCase().trim();
        const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
        let account = activeList.find(
          u => u.email?.toLowerCase() === gEmail || u.username.toLowerCase() === gEmail
        );

        if (!account) {
          account = {
            id: `u-${Date.now()}`,
            username: gEmail ? gEmail.split('@')[0] : 'admin',
            name: res.user.displayName || 'Administrator',
            email: gEmail || undefined,
            role: UserRole.ADMIN,
            permissions: DEFAULT_ADMIN_PERMISSIONS,
            createdAt: new Date().toISOString().split('T')[0]
          };
          const updated = [...activeList, account];
          saveStoredUsers(updated);
          if (onUpdateUsers) onUpdateUsers(updated);
        }

        if (gEmail) {
          await pullFromCloudAndDriveByEmail(gEmail, 'merge').catch(() => {});
        }
        setIsLoading(false);
        onLogin(account);
        return;
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in was cancelled.');
    }
    setIsLoading(false);
  };

  // 3. Simple Create Account
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanInput = regEmailOrUser.trim().toLowerCase();
    if (!cleanInput || regPassword.length < 4) {
      setError('Please enter a valid username/email and a password (min 4 characters).');
      return;
    }

    const isEmail = cleanInput.includes('@');
    const cleanUsername = isEmail ? cleanInput.split('@')[0] : cleanInput;
    const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();

    if (
      activeList.some(
        u =>
          u.username.toLowerCase() === cleanUsername ||
          (isEmail && u.email?.toLowerCase() === cleanInput)
      )
    ) {
      setError('An account with this username or email already exists.');
      return;
    }

    setIsLoading(true);
    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      username: cleanUsername,
      name: regName.trim() || cleanUsername,
      password: regPassword,
      role: UserRole.ADMIN,
      email: isEmail ? cleanInput : undefined,
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updatedUsers = [...activeList, newUser];
    saveStoredUsers(updatedUsers);
    if (onUpdateUsers) onUpdateUsers(updatedUsers);

    if (isEmail) {
      await syncToGoogleDriveCloud(cleanInput).catch(() => {});
    }

    setIsLoading(false);
    onLogin(newUser);
  };

  // 4. Simple Password Reset
  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanId = resetIdentifier.trim().toLowerCase();
    const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
    const found = activeList.find(
      u =>
        u.username.toLowerCase() === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId)
    );

    if (!found) {
      setError('No account found with that username or email.');
      return;
    }
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }

    const updatedUsers = activeList.map(u =>
      u.id === found.id ? { ...u, password: newPassword } : u
    );
    saveStoredUsers(updatedUsers);
    if (onUpdateUsers) onUpdateUsers(updatedUsers);

    setSuccessMsg('Password updated. You can now sign in.');
    setMode('LOGIN');
    setIdentifier(found.username);
    setPassword('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-lg space-y-6">
        {/* Clean Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1.5">
            <AfLogo size={48} variant="black" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Af© ACCOUNTS
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'LOGIN'
                ? 'Sign in to your account'
                : mode === 'REGISTER'
                ? 'Create a new account'
                : 'Reset your password'}
            </p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* VIEW 1: SIMPLE SIGN IN                                            */}
        {/* ================================================================= */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('login.username', 'Username or Email')}
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('login.password', 'Password')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setResetIdentifier(identifier);
                    setMode('RESET');
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <span>Sign In</span>}
            </button>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode('REGISTER');
                }}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                Don&apos;t have an account? <span className="underline">Create Account</span>
              </button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 2: SIMPLE CREATE ACCOUNT                                     */}
        {/* ================================================================= */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                required
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder="Your Name"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email or Username
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  required
                  value={regEmailOrUser}
                  onChange={e => setRegEmailOrUser(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                placeholder="Minimum 4 characters"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors"
            >
              {isLoading ? 'Creating...' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('LOGIN');
              }}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>Back to Sign In</span>
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 3: SIMPLE PASSWORD RESET                                     */}
        {/* ================================================================= */}
        {mode === 'RESET' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Username or Email
              </label>
              <input
                type="text"
                required
                value={resetIdentifier}
                onChange={e => setResetIdentifier(e.target.value)}
                placeholder="Enter your username or email"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors"
            >
              Update Password
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('LOGIN');
              }}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>Back to Sign In</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;

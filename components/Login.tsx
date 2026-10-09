import React, { useState, useRef } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { AfLogo } from './AfLogo';
import {
  loadStoredUsers,
  saveStoredUsers,
  DEFAULT_ADMIN_PERMISSIONS
} from '../services/userService';
import {
  pullFromCloudAndDriveByEmail,
  requestEmailVerificationCode,
  confirmEmailVerificationCode,
  markEmailVerified
} from '../services/driveService';
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
  const [mode, setMode] = useState<'LOGIN' | 'EMAIL_VERIFY' | 'REGISTER' | 'RESET'>('LOGIN');

  // Sign In State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 4-Digit Email Verification State
  const [verifyEmail, setVerifyEmail] = useState('');
  const [codeStep, setCodeStep] = useState<'request' | 'confirm'>('request');
  const [digits, setDigits] = useState<[string, string, string, string]>(['', '', '', '']);
  const [dispatchedCode, setDispatchedCode] = useState('');
  const [pendingUserAfterVerify, setPendingUserAfterVerify] = useState<UserAccount | null>(null);

  const digitRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

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

  // 2. Request 4-Digit Verification Code for Email Login / Registration
  const handleSend4DigitCode = async (targetEmailInput?: string) => {
    const cleanEmail = (targetEmailInput || verifyEmail).trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Email ID (e.g. user@company.com).');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const res = await requestEmailVerificationCode(cleanEmail);
      if (res.success) {
        setVerifyEmail(cleanEmail);
        setDigits(['', '', '', '']);
        setDispatchedCode(res.dispatchCode || '');
        setCodeStep('confirm');
        setMode('EMAIL_VERIFY');
        setSuccessMsg(`4-digit verification code sent for ${cleanEmail}.`);
        setTimeout(() => digitRefs[0].current?.focus(), 80);
      } else {
        setError(res.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm 4-Digit Code & Auto-Mirror Google Drive + Sign In
  const handleConfirm4DigitCode = async (codeToVerify: string) => {
    const cleanEmail = verifyEmail.trim().toLowerCase();
    if (codeToVerify.length !== 4) return;

    setError('');
    setIsLoading(true);
    try {
      const res = await confirmEmailVerificationCode(cleanEmail, codeToVerify);
      if (!res.success || !res.verified) {
        setError(res.message || 'Incorrect 4-digit verification code.');
        setIsLoading(false);
        return;
      }

      const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
      let account =
        pendingUserAfterVerify ||
        activeList.find(
          u => u.email?.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanEmail
        );

      if (!account) {
        account = {
          id: `u-${Date.now()}`,
          username: cleanEmail.split('@')[0],
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          role: UserRole.ADMIN,
          permissions: DEFAULT_ADMIN_PERMISSIONS,
          createdAt: new Date().toISOString().split('T')[0]
        };
      }

      if (!activeList.some(u => u.id === account!.id)) {
        const updated = [...activeList, account];
        saveStoredUsers(updated);
        if (onUpdateUsers) onUpdateUsers(updated);
      }

      setIsLoading(false);
      onLogin(account);
    } catch (err: any) {
      setIsLoading(false);
      setError(err?.message || 'Verification failed.');
    }
  };

  const handleDigitInput = (index: number, value: string) => {
    const numeric = value.replace(/[^0-9]/g, '');
    if (!numeric) {
      const next = [...digits] as [string, string, string, string];
      next[index] = '';
      setDigits(next);
      return;
    }

    if (numeric.length >= 4) {
      const four: [string, string, string, string] = [
        numeric[0],
        numeric[1],
        numeric[2],
        numeric[3]
      ];
      setDigits(four);
      digitRefs[3].current?.focus();
      handleConfirm4DigitCode(four.join(''));
      return;
    }

    const d = numeric[numeric.length - 1];
    const next = [...digits] as [string, string, string, string];
    next[index] = d;
    setDigits(next);

    if (index < 3) {
      digitRefs[index + 1].current?.focus();
    }

    const joined = next.join('');
    if (joined.length === 4 && next.every(x => x.length === 1)) {
      handleConfirm4DigitCode(joined);
    }
  };

  // 3. One-Click Google Sign-In & Auto Sync
  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await signInWithGoogleDrive();
      if (res?.user) {
        const gEmail = (res.user.email || '').toLowerCase().trim();
        if (gEmail) {
          markEmailVerified(gEmail);
        }
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

  // 4. Create Account (Triggers 4-Digit Verification if Email is provided)
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

    if (isEmail) {
      setPendingUserAfterVerify(newUser);
      await handleSend4DigitCode(cleanInput);
      return;
    }

    const updatedUsers = [...activeList, newUser];
    saveStoredUsers(updatedUsers);
    if (onUpdateUsers) onUpdateUsers(updatedUsers);
    onLogin(newUser);
  };

  // 5. Simple Password Reset
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
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-lg space-y-5">
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
                : mode === 'EMAIL_VERIFY'
                ? '4-Digit Email Verification & Drive Sync'
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

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMsg('');
                  setVerifyEmail(identifier.includes('@') ? identifier : '');
                  setCodeStep('request');
                  setMode('EMAIL_VERIFY');
                }}
                className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <KeyRound size={14} />
                <span>Verify Email with 4-Digit Code &amp; Sync</span>
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
            </div>

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
        {/* VIEW 2: 4-DIGIT EMAIL VERIFICATION & GOOGLE DRIVE MIRROR          */}
        {/* ================================================================= */}
        {mode === 'EMAIL_VERIFY' && (
          <div className="space-y-4">
            {codeStep === 'request' ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSend4DigitCode(verifyEmail);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email ID
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="email"
                      required
                      value={verifyEmail}
                      onChange={e => setVerifyEmail(e.target.value)}
                      placeholder="user@company.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <span>Send 4-Digit Verification Code</span>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {dispatchedCode && (
                  <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
                        4-Digit Verification Code
                      </span>
                      <strong className="text-base font-black tracking-[0.25em] text-amber-300">
                        {dispatchedCode}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const four: [string, string, string, string] = [
                          dispatchedCode[0],
                          dispatchedCode[1],
                          dispatchedCode[2],
                          dispatchedCode[3]
                        ];
                        setDigits(four);
                        handleConfirm4DigitCode(dispatchedCode);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black"
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2.5">
                  {[0, 1, 2, 3].map(idx => (
                    <input
                      key={idx}
                      ref={digitRefs[idx]}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={digits[idx]}
                      onChange={e => handleDigitInput(idx, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
                          digitRefs[idx - 1].current?.focus();
                        }
                      }}
                      className="w-13 h-14 text-center text-xl font-black rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-indigo-600 outline-none"
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleConfirm4DigitCode(digits.join(''))}
                  disabled={isLoading || digits.join('').length !== 4}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={16} />
                  <span>{isLoading ? 'Verifying & Mirroring...' : 'Verify 4-Digit Code'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setError('');
                setSuccessMsg('');
                setPendingUserAfterVerify(null);
                setMode('LOGIN');
              }}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>Back to Sign In</span>
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* VIEW 3: SIMPLE CREATE ACCOUNT                                     */}
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
              {isLoading ? 'Processing...' : 'Create Account & Verify'}
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
        {/* VIEW 4: SIMPLE PASSWORD RESET                                     */}
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

import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Loader2, 
  ShieldCheck, 
  UserCircle, 
  KeyRound, 
  Mail, 
  Phone, 
  ArrowLeft, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle,
  HelpCircle,
  UserPlus,
  Cloud,
  HardDrive,
  Download,
  FolderSync,
  Globe
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { AfLogo } from './AfLogo';
import { loadStoredUsers, saveStoredUsers, DEFAULT_ADMIN_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } from '../services/userService';
import { syncToGoogleDriveCloud, fetchFromGoogleDriveCloud, applyBackupPayload } from '../services/driveService';
import { LanguageCode, SUPPORTED_LANGUAGES, getTranslation } from '../utils/translations';

interface LoginProps {
  users?: UserAccount[];
  onLogin: (user: UserAccount) => void;
  onUpdateUsers?: (newUsers: UserAccount[]) => void;
  language?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
}

type ForgotStep = 'IDENTIFY' | 'CHOOSE_CHANNEL' | 'VERIFY_OTP' | 'RESET_PASSWORD' | 'SUCCESS';

export const Login: React.FC<LoginProps> = ({ 
  users, 
  onLogin, 
  onUpdateUsers,
  language = 'en',
  onLanguageChange
}) => {
  const userList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'CLOUD_FETCH'>('LOGIN');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>(UserRole.ADMIN);
  const [regAutoSyncDrive, setRegAutoSyncDrive] = useState(true);

  // Cloud Fetch on new device state
  const [fetchDriveEmail, setFetchDriveEmail] = useState('');
  const [fetchStatus, setFetchStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });

  // Forgot Password / OTP Flow State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('IDENTIFY');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [matchedUser, setMatchedUser] = useState<UserAccount | null>(null);
  const [otpChannel, setOtpChannel] = useState<'EMAIL' | 'MOBILE'>('EMAIL');
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpNotice, setOtpNotice] = useState<string>('');

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);

  // Handle standard login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
      const trimmedUser = username.trim().toLowerCase();
      const matched = (activeList || []).find(u => 
        u.username.toLowerCase() === trimmedUser || 
        (u.email && u.email.toLowerCase() === trimmedUser)
      );

      if (matched && matched.password === password) {
        // Auto-check if Google Drive email is linked, sync data
        if (matched.email) {
          syncToGoogleDriveCloud(matched.email).catch(() => {});
        }
        onLogin(matched);
      } else {
        setError(t('login.invalid_credentials', 'Invalid username or password. Please check your credentials or create a new account.'));
        setIsLoading(false);
      }
    }, 600);
  };

  // Handle new account creation & auto Google Drive link
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (regPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
    if (activeList.some(u => u.username.toLowerCase() === cleanUsername)) {
      setError(`Username "${regUsername}" already exists. Please choose a different username.`);
      return;
    }

    setIsLoading(true);

    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      username: cleanUsername,
      name: regName.trim() || cleanUsername,
      password: regPassword,
      role: regRole,
      email: cleanEmail || undefined,
      phone: regPhone.trim() || undefined,
      permissions: regRole === UserRole.ADMIN ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_STAFF_PERMISSIONS,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updatedUsers = [...activeList, newUser];
    saveStoredUsers(updatedUsers);
    if (onUpdateUsers) {
      onUpdateUsers(updatedUsers);
    }

    // Auto-link Google Drive email & auto-sync cloud data
    if (cleanEmail) {
      const existingSettings = JSON.parse(localStorage.getItem('cf_settings') || '{}');
      existingSettings.driveSyncEmail = cleanEmail;
      existingSettings.autoDriveSync = regAutoSyncDrive;
      localStorage.setItem('cf_settings', JSON.stringify(existingSettings));

      // Trigger instant Google Drive cloud snapshot
      await syncToGoogleDriveCloud(cleanEmail);
    }

    setIsLoading(false);
    setSuccessMsg(`Account created successfully for ${newUser.name}! Google Drive Cloud Auto-Sync is linked.`);
    
    // Auto login
    setTimeout(() => {
      onLogin(newUser);
    }, 1000);
  };

  // Step 1: Lookup User Account for Forgot Password
  const handleIdentifyAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    const term = forgotIdentifier.trim().toLowerCase();
    if (!term) {
      setForgotError('Please enter your username, email, or mobile number.');
      return;
    }

    const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
    const found = (activeList || []).find(u => 
      u.username.toLowerCase() === term || 
      (u.email && u.email.toLowerCase() === term) ||
      (u.phone && u.phone.replace(/\D/g, '') === term.replace(/\D/g, ''))
    );

    if (!found) {
      setForgotError(`No account found matching "${forgotIdentifier}".`);
      return;
    }

    setMatchedUser(found);
    setForgotStep('CHOOSE_CHANNEL');
  };

  // Step 2: Send OTP via chosen channel (Email or Mobile)
  const handleSendOtp = (channel: 'EMAIL' | 'MOBILE') => {
    if (!matchedUser) return;
    setOtpChannel(channel);
    setForgotError('');
    setIsSendingOtp(true);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setEnteredOtp('');

    setTimeout(() => {
      setIsSendingOtp(false);
      setForgotStep('VERIFY_OTP');
      
      const destination = channel === 'EMAIL' 
        ? (matchedUser.email || `${matchedUser.username}@afaccounts.ae`)
        : (matchedUser.phone || '+971 50 *** **89');
      
      setOtpNotice(`Verification OTP sent to ${destination}! (Simulated Code: ${code})`);
    }, 800);
  };

  // Step 3: Verify OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (enteredOtp.trim() !== generatedOtp) {
      setForgotError('Invalid 6-digit OTP verification code. Please try again.');
      return;
    }

    setForgotStep('RESET_PASSWORD');
  };

  // Step 4: Save new password to user account
  const handleSaveResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!matchedUser) return;
    if (newResetPassword.length < 4) {
      setForgotError('New password must be at least 4 characters long.');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      setForgotError('Passwords do not match. Please verify.');
      return;
    }

    const activeList = Array.isArray(users) && users.length > 0 ? users : loadStoredUsers();
    const updatedUsers = activeList.map(u => {
      if (u.id === matchedUser.id) {
        return { ...u, password: newResetPassword };
      }
      return u;
    });

    saveStoredUsers(updatedUsers);
    if (onUpdateUsers) {
      onUpdateUsers(updatedUsers);
    }
    setForgotStep('SUCCESS');
  };

  // Reset modal state
  const handleCloseModal = () => {
    setIsForgotModalOpen(false);
    setForgotStep('IDENTIFY');
    setForgotIdentifier('');
    setMatchedUser(null);
    setEnteredOtp('');
    setGeneratedOtp('');
    setNewResetPassword('');
    setConfirmResetPassword('');
    setForgotError('');
    setOtpNotice('');
  };

  // Handle Cloud Data Fetch from Google Drive on new device
  const handleCloudFetch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fetchDriveEmail.trim()) return;

    setFetchStatus({ loading: true });
    setTimeout(() => {
      const res = fetchFromGoogleDriveCloud(fetchDriveEmail);
      if (res.success && res.data) {
        applyBackupPayload(res.data, 'replace');
        setFetchStatus({ 
          loading: false, 
          success: true, 
          msg: `Successfully retrieved ${res.data.invoices?.length || 0} invoices and ${res.data.clients?.length || 0} clients from Google Drive for ${fetchDriveEmail}!` 
        });
        // If users in backup, refresh
        if (res.data.users && onUpdateUsers) {
          onUpdateUsers(res.data.users);
        }
      } else {
        setFetchStatus({ 
          loading: false, 
          success: false, 
          msg: res.message 
        });
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden p-4 sm:p-6 text-slate-100">
      {/* Background Decorative Blur Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Language Switcher Bar at the very top */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Cloud size={14} className="text-indigo-400" />
            <span>{t('save.cloud', 'Google Drive Cloud Sync')}</span>
          </div>

          {onLanguageChange && (
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-white/10 px-2.5 py-1 rounded-xl shadow-xs">
              <Globe size={13} className="text-indigo-400" />
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-9 shadow-2xl">
          
          {/* Header Branding */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-white rounded-3xl p-1.5 flex items-center justify-center shadow-xl shadow-indigo-500/20 mb-3.5 overflow-hidden border border-white/20">
              <AfLogo size={70} variant="black" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Af© ACCOUNTS</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium text-center">
              Commercial Billing & VAT Accounting Portal
            </p>
          </div>

          {/* Navigation Tabs (Sign In / Create New Account / Device Cloud Restore) */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950/70 p-1 rounded-2xl border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => { setActiveTab('LOGIN'); setError(''); setSuccessMsg(''); }}
              className={`py-2 text-xs font-black rounded-xl transition-all ${
                activeTab === 'LOGIN' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('login.title', 'Sign In')}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('REGISTER'); setError(''); setSuccessMsg(''); }}
              className={`py-2 text-xs font-black rounded-xl transition-all ${
                activeTab === 'REGISTER' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('login.create_account', 'New Account')}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('CLOUD_FETCH'); setError(''); setSuccessMsg(''); }}
              className={`py-2 text-xs font-black rounded-xl transition-all ${
                activeTab === 'CLOUD_FETCH' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('login.fetch_btn', 'Cloud Drive')}
            </button>
          </div>

          {/* SUCCESS MESSAGE */}
          {successMsg && (
            <div className="mb-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs py-3 px-4 rounded-2xl font-medium flex items-start gap-2.5">
              <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ERROR MESSAGE */}
          {error && (
            <div className="mb-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs py-3 px-4 rounded-2xl font-medium flex items-start gap-2.5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: LOGIN FORM */}
          {/* ========================================================================= */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">
                  {t('login.username', 'Username or Email')}
                </label>
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-semibold"
                    placeholder="e.g. admin or username"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {t('login.password', 'Password')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotIdentifier(username);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl py-3 pl-12 pr-12 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 active:scale-98"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <span>{t('login.title', 'Sign In to Af© Accounts')}</span>}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('REGISTER')}
                  className="text-xs font-bold text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  {t('login.no_account', "Don't have an account? Create one")}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CREATE NEW ACCOUNT (WITH GOOGLE DRIVE AUTO-SYNC) */}
          {/* ========================================================================= */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    {t('login.full_name', 'Full Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Alex Rivera"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    {t('login.username', 'Username')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. alexrivera"
                  />
                </div>
              </div>

              {/* Google Drive Account Email */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cloud size={13} className="text-indigo-400" />
                  {t('login.drive_email', 'Google Drive Email (For Cloud Auto-Sync)')} *
                </label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. alex@company.com"
                  />
                </div>
                <p className="text-[10px] text-indigo-300/80">
                  All invoices, clients, expenses, and records are automatically saved to this Google Drive.
                </p>
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  {t('login.phone', 'Phone / WhatsApp')}
                </label>
                <div className="relative group">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="+971 50 123 4567"
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  {t('login.role', 'Account Role')}
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={UserRole.ADMIN}>Administrator (Full Access & Settings)</option>
                  <option value={UserRole.STAFF}>Accounts Staff (Invoices, Expenses & Clients)</option>
                </select>
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    {t('login.password', 'Password')} *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    {t('login.confirm_password', 'Confirm')} *
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Drive Auto Sync Checkbox */}
              <label className="flex items-center gap-2.5 text-xs text-slate-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regAutoSyncDrive}
                  onChange={(e) => setRegAutoSyncDrive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20"
                />
                <span className="font-semibold">{t('login.sync_google_drive', 'Auto-sync and backup all business data with Google Drive')}</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-3 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <span>{t('login.register_title', 'Create Account & Auto-Link Drive')}</span>}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGIN')}
                  className="text-xs font-bold text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  {t('login.have_account', 'Already have an account? Sign in')}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: RESTORE FROM GOOGLE DRIVE (FOR NEW DEVICE OR RE-INSTALL) */}
          {/* ========================================================================= */}
          {activeTab === 'CLOUD_FETCH' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-950/40 rounded-2xl border border-indigo-500/20 text-center space-y-1">
                <Cloud size={28} className="mx-auto text-indigo-400" />
                <h3 className="text-sm font-black text-white">{t('login.cloud_fetch_title', 'Switching Device? Restore from Google Drive')}</h3>
                <p className="text-xs text-slate-400">
                  Enter the Google Drive email tied to your account to load all invoices, clients, expenses, and staff data onto this device.
                </p>
              </div>

              {fetchStatus.msg && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  fetchStatus.success 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {fetchStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{fetchStatus.msg}</span>
                </div>
              )}

              <form onSubmit={handleCloudFetch} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">Google Drive Email</label>
                  <input
                    type="email"
                    required
                    value={fetchDriveEmail}
                    onChange={(e) => setFetchDriveEmail(e.target.value)}
                    placeholder="e.g. user@company.com"
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2.5 px-3 text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={fetchStatus.loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {fetchStatus.loading ? <Loader2 size={18} className="animate-spin" /> : <FolderSync size={16} />}
                  <span>Fetch & Sync Google Drive Data</span>
                </button>
              </form>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('LOGIN')}
                  className="text-xs font-bold text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD MODAL (EMAIL & MOBILE OTP FLOW) */}
      {/* ========================================================================= */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-8 shadow-2xl text-white relative">
            
            {/* Step 1: Identify Account */}
            {forgotStep === 'IDENTIFY' && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
                    <KeyRound size={24} />
                  </div>
                  <h3 className="text-lg font-black text-white">Reset Account Password</h3>
                  <p className="text-xs text-slate-400">
                    Enter your username, recovery email, or registered phone number.
                  </p>
                </div>

                {forgotError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleIdentifyAccount} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">Username, Email, or Phone</label>
                    <input
                      type="text"
                      required
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      className="w-full bg-slate-800/80 border border-white/10 rounded-2xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. admin or afsalnarippatta02@gmail.com"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/30"
                    >
                      Find Account
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 2: Choose OTP Channel */}
            {forgotStep === 'CHOOSE_CHANNEL' && matchedUser && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
                    <ShieldCheck size={24} />
                  </div>
                  <h3 className="text-lg font-black text-white">Choose Verification Method</h3>
                  <p className="text-xs text-slate-400">
                    Select where you would like to receive your 6-digit OTP code for <strong className="text-white font-bold">@{matchedUser.username}</strong>:
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => handleSendOtp('EMAIL')}
                    disabled={isSendingOtp}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-white/10 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Mail size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">Send OTP via Email</p>
                        <p className="text-[11px] text-slate-400">{matchedUser.email || 'Registered account email'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-400">Send Code &rarr;</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendOtp('MOBILE')}
                    disabled={isSendingOtp}
                    className="w-full p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-white/10 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                        <Phone size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">Send OTP via SMS / Mobile</p>
                        <p className="text-[11px] text-slate-400">{matchedUser.phone || '+971 50 *** **89'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">Send Code &rarr;</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setForgotStep('IDENTIFY')}
                  className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  &larr; Back to lookup
                </button>
              </div>
            )}

            {/* Step 3: Enter OTP */}
            {forgotStep === 'VERIFY_OTP' && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
                    <KeyRound size={24} />
                  </div>
                  <h3 className="text-lg font-black text-white">Enter 6-Digit Code</h3>
                  <p className="text-xs text-slate-400">{otpNotice}</p>
                </div>

                {forgotError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full tracking-widest text-center text-2xl font-black bg-slate-800 border border-white/10 rounded-2xl py-3.5 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="000000"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForgotStep('CHOOSE_CHANNEL')}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all"
                  >
                    Verify Code
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Reset Password */}
            {forgotStep === 'RESET_PASSWORD' && (
              <form onSubmit={handleSaveResetPassword} className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
                    <Lock size={24} />
                  </div>
                  <h3 className="text-lg font-black text-white">Create New Password</h3>
                  <p className="text-xs text-slate-400">Set a new strong password for your account.</p>
                </div>

                {forgotError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">New Password</label>
                  <div className="relative">
                    <input
                      type={showResetPass ? 'text' : 'password'}
                      required
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      className="w-full bg-slate-800 border border-white/10 rounded-2xl py-3 pl-4 pr-10 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPass(!showResetPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showResetPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-2xl py-3 px-4 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-xs font-bold text-white transition-all shadow-md shadow-indigo-600/30"
                >
                  Save & Update Password
                </button>
              </form>
            )}

            {/* Step 5: Success */}
            {forgotStep === 'SUCCESS' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Password Updated!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Your password has been changed. You can now sign in with your new password.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-xs font-black text-white transition-all shadow-lg"
                >
                  Back to Sign In
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default Login;

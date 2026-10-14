import React, { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Share2,
  X,
  AlertCircle,
  Cloud,
  ArrowRight
} from 'lucide-react';
import {
  linkAndSyncGoogleDriveEmail,
  pullFromCloudAndDriveByEmail,
  shareLocalDataOffline,
  AppBackupPayload
} from '../services/driveService';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail: string;
  driveConnected: boolean;
  onConnectGoogleDrive: () => Promise<void>;
  onVerifiedAndMirrored: (verifiedEmail: string, payload?: AppBackupPayload) => void;
  onManualSyncNow: () => Promise<void>;
  isSyncingExternal?: boolean;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  onClose,
  initialEmail,
  driveConnected,
  onConnectGoogleDrive,
  onVerifiedAndMirrored,
  onManualSyncNow,
  isSyncingExternal = false
}) => {
  const [emailInput, setEmailInput] = useState(initialEmail || '');
  const [isEditingEmail, setIsEditingEmail] = useState<boolean>(!initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const clean = (initialEmail || '').trim().toLowerCase();
      setEmailInput(clean);
      setIsEditingEmail(!clean);
      setStatusMsg(null);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleDirectLinkEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = emailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setStatusMsg({
        type: 'error',
        text: 'Please enter a valid Google Drive Email ID (e.g. yourname@gmail.com).'
      });
      return;
    }

    setIsLoading(true);
    setStatusMsg({
      type: 'info',
      text: `Linking ${clean} and syncing Google Drive workspace across all devices...`
    });
    try {
      const res = await linkAndSyncGoogleDriveEmail(clean);
      if (res.success) {
        setIsEditingEmail(false);
        setStatusMsg({
          type: 'success',
          text: res.message || `Linked ${clean}! All changes now auto-save to Google Drive and sync across all linked devices.`
        });
        onVerifiedAndMirrored(clean, res.data);
      } else {
        setStatusMsg({
          type: 'error',
          text: res.message || 'Could not link Google Drive email.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullLatest = async () => {
    const clean = (emailInput || initialEmail || '').trim().toLowerCase();
    if (!clean || !clean.includes('@')) return;
    setIsLoading(true);
    setStatusMsg({ type: 'info', text: `Pulling latest saved data from Google Drive (${clean})...` });
    try {
      const res = await pullFromCloudAndDriveByEmail(clean, 'replace');
      if (res.success && res.data) {
        onVerifiedAndMirrored(clean, res.data);
        setStatusMsg({
          type: 'success',
          text: res.message || `Loaded latest workspace from Google Drive (${clean})!`
        });
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md text-white ${
                !isEditingEmail && emailInput ? 'bg-emerald-600' : 'bg-indigo-600'
              }`}
            >
              <Cloud size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {!isEditingEmail && emailInput
                  ? 'Google Drive Linked & Auto-Sync Active'
                  : 'Link Google Drive & Multi-Device Sync'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {!isEditingEmail && emailInput
                  ? 'Changes auto-save to Google Drive and reflect across all linked devices'
                  : 'Link your Google Drive email to auto-save and sync across PC & Mobile'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Banner */}
        {statusMsg && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-start space-x-2.5 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : statusMsg.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200'
                : 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
            }`}
          >
            {statusMsg.type === 'error' ? (
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            ) : (
              <CheckCircle2
                size={16}
                className={`shrink-0 mt-0.5 ${
                  statusMsg.type === 'success' ? 'text-emerald-600' : 'text-indigo-600'
                }`}
              />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* LINK GOOGLE DRIVE EMAIL FORM */}
        {isEditingEmail ? (
          <form onSubmit={handleDirectLinkEmail} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Google Drive Email ID (For Auto-Save &amp; All-Device Sync)
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isSyncingExternal}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <>
                  <span>Link Google Drive Email &amp; Auto-Sync</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-slate-200 dark:border-slate-800" />
              <span className="shrink mx-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Or Connect via Google Sign-In
              </span>
              <div className="grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <button
              type="button"
              disabled={isLoading || isSyncingExternal}
              onClick={async () => {
                setStatusMsg({ type: 'info', text: 'Connecting to Google Drive...' });
                await onConnectGoogleDrive();
                setIsEditingEmail(false);
                setStatusMsg({
                  type: 'success',
                  text: 'Google Drive connected and workspace auto-sync is active!'
                });
              }}
              className="w-full py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-2xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isSyncingExternal ? 'Connecting Google Drive...' : 'Sign in with Google Drive'}</span>
            </button>

            <p className="text-[11px] text-slate-400 leading-relaxed text-center">
              Once linked, all your data automatically stores in Google Drive. Logging in from any other device with this Google Drive or email automatically links and syncs all changes in real time.
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 truncate">
                      {emailInput}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase">
                      Linked &amp; Active
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Auto-saving to Google Drive &amp; syncing live across all devices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingEmail(true)}
                className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 hover:underline shrink-0 ml-2"
              >
                Change Email
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={async () => {
                  setStatusMsg({ type: 'info', text: 'Saving & syncing all changes to Google Drive...' });
                  await onManualSyncNow();
                  setStatusMsg({
                    type: 'success',
                    text: `All invoices, clients, expenses & settings saved to Google Drive (${emailInput})!`
                  });
                }}
                disabled={isSyncingExternal || isLoading}
                className="p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 flex items-center space-x-3 text-left transition-all"
              >
                <RefreshCw
                  size={20}
                  className={`text-indigo-600 shrink-0 ${isSyncingExternal ? 'animate-spin' : ''}`}
                />
                <div>
                  <p className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                    {isSyncingExternal ? 'Syncing Data...' : 'Save & Sync to Drive Now'}
                  </p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                    Push all changes to Google Drive &amp; other devices
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handlePullLatest}
                disabled={isSyncingExternal || isLoading}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center space-x-3 text-left transition-all"
              >
                <HardDrive size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    Pull Latest from Drive
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Fetch latest changes from other linked devices
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={async () => {
                const msg = await shareLocalDataOffline(emailInput);
                setStatusMsg({ type: 'success', text: msg });
              }}
              className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all"
            >
              <Share2 size={15} className="text-purple-600" />
              <span>Offline Local Share (AirDrop / Nearby Share / File)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerificationModal;

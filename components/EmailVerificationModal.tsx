import React, { useState, useRef, useEffect } from 'react';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Share2,
  X,
  KeyRound,
  AlertCircle,
  Cloud,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  requestEmailVerificationCode,
  confirmEmailVerificationCode,
  isEmailVerified,
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
  const [step, setStep] = useState<'enter-email' | 'enter-code' | 'verified'>(() =>
    initialEmail && isEmailVerified(initialEmail) ? 'verified' : 'enter-email'
  );
  const [digits, setDigits] = useState<[string, string, string, string]>(['', '', '', '']);
  const [dispatchedCode, setDispatchedCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  useEffect(() => {
    if (isOpen) {
      const clean = (initialEmail || '').trim().toLowerCase();
      setEmailInput(clean);
      if (clean && isEmailVerified(clean)) {
        setStep('verified');
      } else {
        setStep('enter-email');
      }
      setStatusMsg(null);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSend4DigitCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = emailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setStatusMsg({
        type: 'error',
        text: 'Please enter a valid Email ID (e.g. user@company.com).'
      });
      return;
    }

    setIsLoading(true);
    setStatusMsg(null);
    try {
      const res = await requestEmailVerificationCode(clean);
      if (res.success) {
        setDigits(['', '', '', '']);
        setDispatchedCode(res.dispatchCode || '');
        setStep('enter-code');
        setStatusMsg({
          type: 'info',
          text: `A 4-digit verification code has been generated for ${clean}. Enter the 4 digits below to verify and activate automatic Google Drive mirroring.`
        });
        setTimeout(() => inputRefs[0].current?.focus(), 80);
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verify4DigitCode = async (codeStr: string) => {
    const clean = emailInput.trim().toLowerCase();
    if (codeStr.length !== 4) return;

    setIsLoading(true);
    setStatusMsg(null);
    try {
      const res = await confirmEmailVerificationCode(clean, codeStr);
      if (res.success && res.verified) {
        setStep('verified');
        setStatusMsg({
          type: 'success',
          text: res.message
        });
        onVerifiedAndMirrored(clean, res.data);
      } else {
        setStatusMsg({
          type: 'error',
          text: res.message || 'Invalid 4-digit verification code. Please try again.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const numeric = value.replace(/[^0-9]/g, '');
    if (!numeric) {
      const next = [...digits] as [string, string, string, string];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Support pasting all 4 digits at once
    if (numeric.length >= 4) {
      const four: [string, string, string, string] = [
        numeric[0],
        numeric[1],
        numeric[2],
        numeric[3]
      ];
      setDigits(four);
      inputRefs[3].current?.focus();
      verify4DigitCode(four.join(''));
      return;
    }

    const digit = numeric[numeric.length - 1];
    const next = [...digits] as [string, string, string, string];
    next[index] = digit;
    setDigits(next);

    if (index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    const joined = next.join('');
    if (joined.length === 4 && next.every(d => d.length === 1)) {
      verify4DigitCode(joined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleAutoFillCode = () => {
    if (dispatchedCode.length === 4) {
      const four: [string, string, string, string] = [
        dispatchedCode[0],
        dispatchedCode[1],
        dispatchedCode[2],
        dispatchedCode[3]
      ];
      setDigits(four);
      verify4DigitCode(dispatchedCode);
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
                step === 'verified' ? 'bg-emerald-600' : 'bg-indigo-600'
              }`}
            >
              {step === 'verified' ? <ShieldCheck size={22} /> : <KeyRound size={22} />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {step === 'verified'
                  ? 'Verified Email & Live Google Drive Mirror'
                  : '4-Digit Email Verification & Drive Sync'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'verified'
                  ? 'Real-time mirroring active across PC, Mobile & Google Drive'
                  : 'Verify your Email ID with a 4-digit code to mirror data everywhere'}
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

        {/* STEP 1: ENTER EMAIL ID TO RECEIVE 4-DIGIT CODE */}
        {step === 'enter-email' && (
          <form onSubmit={handleSend4DigitCode} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Enter Your Email ID (Google Drive &amp; Multi-Device Account)
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="e.g. user@company.com"
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
                  <span>Send 4-Digit Verification Code</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-slate-200 dark:border-slate-800" />
              <span className="shrink mx-3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Or Connect Directly
              </span>
              <div className="grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <button
              type="button"
              disabled={isLoading || isSyncingExternal}
              onClick={async () => {
                setStatusMsg({ type: 'info', text: 'Connecting to Google Drive...' });
                await onConnectGoogleDrive();
                setStatusMsg({
                  type: 'success',
                  text: 'Google Drive connected and workspace mirrored successfully!'
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
              Once verified with the 4-digit code or Google sign-in, your app data mirrors and syncs automatically to Google Drive and all devices connected with this Email ID.
            </p>
          </form>
        )}

        {/* STEP 2: ENTER 4-NUMBER VERIFICATION CODE */}
        {step === 'enter-code' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Verifying: <strong className="text-indigo-600 dark:text-indigo-400">{emailInput}</strong>
              </span>
              <button
                type="button"
                onClick={() => setStep('enter-email')}
                className="text-[11px] font-black text-slate-400 hover:text-indigo-600"
              >
                Change Email
              </button>
            </div>

            {/* Instant Verification Code Dispatch Banner */}
            {dispatchedCode && (
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block">
                    Instant Verification Dispatch
                  </span>
                  <span className="text-xs text-slate-300">
                    Your 4-Digit Code:{' '}
                    <strong className="text-base font-black tracking-[0.25em] text-amber-300 ml-1">
                      {dispatchedCode}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoFillCode}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black transition-all"
                >
                  Auto-Fill &amp; Verify
                </button>
              </div>
            )}

            {/* 4-Box OTP Input */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                Enter 4-Digit Verification Code
              </label>
              <div className="flex items-center justify-center gap-3 py-1">
                {[0, 1, 2, 3].map(idx => (
                  <input
                    key={idx}
                    ref={inputRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={digits[idx]}
                    onChange={e => handleDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    className="w-14 h-16 text-center text-2xl font-black rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSend4DigitCode()}
                disabled={isLoading}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-all"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => verify4DigitCode(digits.join(''))}
                disabled={isLoading || digits.join('').length !== 4}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                <ShieldCheck size={16} />
                <span>{isLoading ? 'Verifying & Mirroring...' : 'Verify & Mirror Now'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFIED & AUTOMATIC REAL-TIME MIRROR ACTIVE */}
        {step === 'verified' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 truncate">
                      {emailInput}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase">
                      4-Digit Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Auto-mirroring &amp; syncing live across PC, Mobile &amp; Google Drive
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('enter-email');
                  setDigits(['', '', '', '']);
                }}
                className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 hover:underline shrink-0 ml-2"
              >
                Change
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={async () => {
                  setStatusMsg({ type: 'info', text: 'Connecting & syncing with Google Drive...' });
                  await onConnectGoogleDrive();
                  setStatusMsg({
                    type: 'success',
                    text: `Google Drive Mirror active for ${emailInput}! All records are backed up.`
                  });
                }}
                disabled={isSyncingExternal || isLoading}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center space-x-3 text-left transition-all"
              >
                <HardDrive size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {driveConnected ? 'Google Drive Mirror Active' : 'Connect Google Drive'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {driveConnected
                      ? 'Master file auto-syncs on every edit'
                      : 'Authorize direct Google Drive file mirror'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setStatusMsg({ type: 'info', text: 'Mirroring & syncing workspace data...' });
                  await onManualSyncNow();
                  setStatusMsg({
                    type: 'success',
                    text: `All invoices, clients, and settings synced with ${emailInput}!`
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
                    {isSyncingExternal ? 'Mirroring Data...' : 'Mirror & Sync Now'}
                  </p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                    Instant two-way sync across all systems
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

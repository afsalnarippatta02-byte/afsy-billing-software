import React, { useState, useEffect, useRef } from 'react';
import { CompanySettings, UserAccount, AppBackupPayload } from '../types';
import { CURRENCIES, SUPPORTED_COUNTRIES } from '../constants';
import { AF_LOGO_SVG_DATA_URI, AF_LOGO_DARK_SVG_DATA_URI } from './AfLogo';
import { 
  Save, 
  Upload, 
  Building2, 
  Mail, 
  MapPin, 
  Percent, 
  CheckCircle2, 
  Sparkles, 
  X, 
  Image as ImageIcon, 
  RotateCcw, 
  ShieldCheck, 
  Coins, 
  FileText, 
  Clock, 
  Eye,
  Trash2,
  Check,
  Globe,
  Sliders,
  FileCheck2,
  Film,
  Camera,
  Layers,
  LayoutTemplate,
  User,
  Users,
  KeyRound,
  Cloud,
  HardDrive,
  Download,
  FolderSync,
  Database,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  FileCode,
  Smartphone
} from 'lucide-react';
import UserManagementSettings from './UserManagementSettings';
import { 
  gatherAppBackupPayload, 
  downloadLocalBackupJSON, 
  syncToGoogleDriveCloud, 
  fetchFromGoogleDriveCloud, 
  applyBackupPayload, 
  exportModuleToCSV, 
  parseAndImportClientsCSV, 
  parseAndImportExpensesCSV,
  backupDirectlyToGoogleDrive,
  fetchGoogleDriveBackupList,
  restoreFromGoogleDriveFile
} from '../services/driveService';
import {
  signInWithGoogleDrive,
  signOutGoogleDrive,
  initGoogleAuth,
  getGoogleDriveUser,
  isGoogleDriveConnected,
  GoogleDriveUser,
  GoogleDriveFile
} from '../services/googleDriveAuth';
import { LanguageCode, getTranslation } from '../utils/translations';

interface SettingsProps {
  settings: CompanySettings;
  onUpdate: (s: CompanySettings) => void;
  currentUser?: UserAccount;
  users?: UserAccount[];
  onUpdateUsers?: (newUsers: UserAccount[]) => void;
  onUpdateCurrentUser?: (updatedUser: UserAccount) => void;
  onRestoreData?: (payload: AppBackupPayload) => void;
  language?: LanguageCode;
}

const LOGO_PRESETS = [
  {
    id: 'preset-af-official',
    name: 'Af© Signature',
    subtitle: 'Official App Logo',
    svg: AF_LOGO_SVG_DATA_URI
  },
  {
    id: 'preset-af-dark',
    name: 'Af© Dark Edition',
    subtitle: 'Official Dark Canvas',
    svg: AF_LOGO_DARK_SVG_DATA_URI
  },
  {
    id: 'preset-gold',
    name: 'Gold Crest',
    subtitle: 'Corporate / Luxury',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%230F172A"/><path d="M30 32C30 27.5817 33.5817 24 38 24H62C66.4183 24 70 27.5817 70 32V42H54V38H44V62H54V58H70V68C70 72.4183 66.4183 76 62 76H38C33.5817 76 30 72.4183 30 68V32Z" fill="%23F59E0B"/><circle cx="62" cy="50" r="6" fill="%23FBBF24"/></svg>'
  },
  {
    id: 'preset-teal',
    name: 'Apex Modern',
    subtitle: 'Tech / Consulting',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%230D9488"/><path d="M50 20L78 72H64L50 44L36 72H22L50 20Z" fill="white"/><circle cx="50" cy="62" r="5" fill="%2399F6E4"/></svg>'
  },
  {
    id: 'preset-monochrome',
    name: 'Modern Noir',
    subtitle: 'Minimalist / Commerce',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%23000000"/><path d="M28 28H72V38H38V45H68V55H38V62H72V72H28V28Z" fill="%23FFFFFF"/><circle cx="70" cy="50" r="4" fill="%23E2E8F0"/></svg>'
  },
  {
    id: 'preset-blue',
    name: 'Cobalt Shield',
    subtitle: 'Services / Enterprise',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%231E40AF"/><path d="M50 22L76 34V54C76 70 50 82 50 82C50 82 24 70 24 54V34L50 22Z" fill="white"/><path d="M50 32L66 40V54C66 64 50 72 50 72C50 72 34 64 34 54V40L50 32Z" fill="%233B82F6"/></svg>'
  },
];

export const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  onUpdate,
  currentUser,
  users = [],
  onUpdateUsers,
  onUpdateCurrentUser,
  onRestoreData,
  language = 'en'
}) => {
  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'backup'>('company');
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<{ show: boolean; msg?: string; type?: 'success' | 'error' }>({ show: false });
  const [saveTimestamp, setSaveTimestamp] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [urlInput, setUrlInput] = useState(settings.logoUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup Center & Real Google Drive State
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isCloudFetching, setIsCloudFetching] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleDriveUser | null>(() => getGoogleDriveUser());
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(() => isGoogleDriveConnected());
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [backupRestoreModal, setBackupRestoreModal] = useState<{ open: boolean; payload?: AppBackupPayload }>({ open: false });
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const csvClientInputRef = useRef<HTMLInputElement>(null);
  const csvExpenseInputRef = useRef<HTMLInputElement>(null);

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);

  useEffect(() => {
    setFormData(settings);
    setUrlInput(settings.logoUrl || '');
  }, [settings]);

  // Listen to Google Auth state
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setIsGoogleConnected(true);
        setGoogleUser({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        });
        if (user.email && !formData.driveSyncEmail) {
          handleFieldChange('driveSyncEmail', user.email);
        }
      },
      () => {
        setIsGoogleConnected(false);
        setGoogleUser(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // When Google Drive is connected and Backup tab is active, fetch Drive backup files
  useEffect(() => {
    if (activeTab === 'backup' && isGoogleConnected) {
      handleFetchDriveFiles();
    }
  }, [activeTab, isGoogleConnected]);

  const handleGoogleSignInClick = async () => {
    setIsSigningInGoogle(true);
    try {
      const res = await signInWithGoogleDrive();
      if (res?.user) {
        setIsGoogleConnected(true);
        setGoogleUser({
          uid: res.user.uid,
          displayName: res.user.displayName,
          email: res.user.email,
          photoURL: res.user.photoURL
        });
        if (res.user.email) {
          handleFieldChange('driveSyncEmail', res.user.email);
        }
        setSaveToast({ show: true, msg: `Connected to Google Drive as ${res.user.email || res.user.displayName}!`, type: 'success' });
        handleFetchDriveFiles();
      }
    } catch (err: any) {
      console.error('Google Sign in failed', err);
      setSaveToast({ show: true, msg: err?.message || 'Google Drive connection failed.', type: 'error' });
    } finally {
      setIsSigningInGoogle(false);
      setTimeout(() => setSaveToast({ show: false }), 4000);
    }
  };

  const handleGoogleSignOutClick = async () => {
    try {
      await signOutGoogleDrive();
      setIsGoogleConnected(false);
      setGoogleUser(null);
      setDriveFiles([]);
      setSaveToast({ show: true, msg: 'Disconnected from Google Drive.', type: 'success' });
    } catch (err: any) {
      setSaveToast({ show: true, msg: err?.message || 'Failed to sign out', type: 'error' });
    }
    setTimeout(() => setSaveToast({ show: false }), 3000);
  };

  const handleFetchDriveFiles = async () => {
    setIsLoadingDriveFiles(true);
    try {
      const files = await fetchGoogleDriveBackupList();
      setDriveFiles(files);
    } catch (err) {
      console.error('Failed to list drive files', err);
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  const handleDirectBackupToDrive = async () => {
    if (!isGoogleConnected) {
      await handleGoogleSignInClick();
      return;
    }

    setIsUploadingToDrive(true);
    const result = await backupDirectlyToGoogleDrive(gatherAppBackupPayload(googleUser?.email || formData.driveSyncEmail));
    setIsUploadingToDrive(false);

    if (result.success) {
      setSaveToast({ show: true, msg: result.message, type: 'success' });
      handleFetchDriveFiles();
    } else {
      setSaveToast({ show: true, msg: result.message, type: 'error' });
    }
    setTimeout(() => setSaveToast({ show: false }), 5000);
  };

  const handleDirectRestoreFromDrive = async (fileId: string) => {
    setIsCloudFetching(true);
    const res = await restoreFromGoogleDriveFile(fileId);
    setIsCloudFetching(false);
    if (res.success && res.payload) {
      setBackupRestoreModal({ open: true, payload: res.payload });
    } else {
      alert(res.message);
    }
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  const handleFieldChange = (field: keyof CompanySettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, SVG, WebP, GIF).');
      return;
    }

    setIsProcessingImage(true);

    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const svgData = event.target.result as string;
          handleFieldChange('logoUrl', svgData);
          setUrlInput('');
          setIsProcessingImage(false);
          setSaveToast({ show: true, msg: 'Vector SVG logo ready! Click "Save Changes" to apply.', type: 'success' });
          setTimeout(() => setSaveToast({ show: false }), 3500);
        }
      };
      reader.onerror = () => {
        setIsProcessingImage(false);
        alert('Failed to read image file.');
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 480;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/png', 0.92);
          handleFieldChange('logoUrl', compressedDataUrl);
          setUrlInput('');
          setIsProcessingImage(false);
          setSaveToast({ show: true, msg: 'Logo ready! Click "Save Changes" to apply.', type: 'success' });
          setTimeout(() => setSaveToast({ show: false }), 3500);
        } else {
          setIsProcessingImage(false);
        }
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleApplyPreset = (presetSvg: string, presetName: string) => {
    handleFieldChange('logoUrl', presetSvg);
    setUrlInput('');
    setSaveToast({ show: true, msg: `Selected "${presetName}". Click "Save Changes" to apply.`, type: 'success' });
    setTimeout(() => setSaveToast({ show: false }), 3000);
  };

  const handleRemoveLogo = () => {
    handleFieldChange('logoUrl', '');
    setUrlInput('');
    setSaveToast({ show: true, msg: 'Logo cleared. Default AF monogram will be used.', type: 'success' });
    setTimeout(() => setSaveToast({ show: false }), 3000);
  };

  const handleRestoreDefaultLogo = () => {
    handleFieldChange('logoUrl', AF_LOGO_SVG_DATA_URI);
    setUrlInput('');
    setSaveToast({ show: true, msg: 'Restored original Af© brand logo!', type: 'success' });
    setTimeout(() => setSaveToast({ show: false }), 3000);
  };

  const handleCountryChange = (countryCode: string) => {
    const selectedCountry = SUPPORTED_COUNTRIES.find(c => c.code === countryCode);
    if (selectedCountry) {
      setFormData(prev => ({
        ...prev,
        country: selectedCountry.code,
        countryName: selectedCountry.name,
        currency: selectedCountry.defaultCurrency,
        defaultCurrency: selectedCountry.defaultCurrency,
        currencySymbol: selectedCountry.currencySymbol,
        taxName: selectedCountry.taxName,
        taxRate: selectedCountry.defaultTaxRate,
        defaultTaxRate: selectedCountry.defaultTaxRate
      }));
      setSaveToast({ 
        show: true, 
        msg: `Applied country settings for ${selectedCountry.name} (${selectedCountry.defaultCurrency} - ${selectedCountry.currencySymbol})`, 
        type: 'success' 
      });
      setTimeout(() => setSaveToast({ show: false }), 3500);
    } else {
      handleFieldChange('country', countryCode);
    }
  };

  const handleCurrencyChange = (currencyCode: string) => {
    const curr = CURRENCIES.find(c => c.code === currencyCode);
    setFormData(prev => ({
      ...prev,
      currency: currencyCode,
      defaultCurrency: currencyCode,
      currencySymbol: curr ? curr.symbol : (prev.currencySymbol || '$')
    }));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a valid Company Name.');
      return;
    }

    setIsSaving(true);
    
    setTimeout(() => {
      onUpdate(formData);
      setIsSaving(false);
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      setSaveTimestamp(`${dateStr} at ${timeStr}`);
      
      setIsSavedModalOpen(true);
      setSaveToast({ show: true, msg: 'Company Settings Saved Successfully!', type: 'success' });
      setTimeout(() => setSaveToast({ show: false }), 4500);

      // Auto-trigger Google Drive Cloud sync if email set
      if (formData.driveSyncEmail || currentUser?.email) {
        syncToGoogleDriveCloud(formData.driveSyncEmail || currentUser?.email || '').catch(() => {});
      }
    }, 200);
  };

  const handleReset = () => {
    setFormData(settings);
    setUrlInput(settings.logoUrl || '');
  };

  // Google Drive Manual Cloud Snapshot Sync
  const handleTriggerCloudSync = async () => {
    const syncEmail = formData.driveSyncEmail || currentUser?.email;
    if (!syncEmail) {
      alert('Please enter your Google Drive Email first to link cloud synchronization.');
      return;
    }

    setIsCloudSyncing(true);
    const result = await syncToGoogleDriveCloud(syncEmail);
    setIsCloudSyncing(false);

    if (result.success) {
      setSaveToast({ show: true, msg: `Backed up successfully to Google Drive (${syncEmail}) at ${new Date(result.timestamp).toLocaleTimeString()}`, type: 'success' });
    } else {
      setSaveToast({ show: true, msg: result.message, type: 'error' });
    }
    setTimeout(() => setSaveToast({ show: false }), 5000);
  };

  // Google Drive Cloud Fetch / Restore
  const handleTriggerCloudFetch = async () => {
    const syncEmail = formData.driveSyncEmail || currentUser?.email;
    if (!syncEmail) {
      alert('Please specify your Google Drive Email to fetch cloud records.');
      return;
    }

    setIsCloudFetching(true);
    setTimeout(() => {
      const res = fetchFromGoogleDriveCloud(syncEmail);
      setIsCloudFetching(false);
      if (res.success && res.data) {
        setBackupRestoreModal({ open: true, payload: res.data });
      } else {
        alert(res.message);
      }
    }, 800);
  };

  // Handle JSON File Selection for Restore
  const handleJSONFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as AppBackupPayload;
        if (!parsed.schema || (!parsed.invoices && !parsed.clients && !parsed.expenses)) {
          alert('Invalid backup file format. Please select a valid Af© Accounts JSON backup.');
          return;
        }
        setBackupRestoreModal({ open: true, payload: parsed });
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Confirm Apply Backup
  const handleApplyBackup = (mode: 'replace' | 'merge') => {
    if (!backupRestoreModal.payload) return;

    applyBackupPayload(backupRestoreModal.payload, mode);

    if (onRestoreData) {
      onRestoreData(backupRestoreModal.payload);
    }
    if (backupRestoreModal.payload.settings) {
      onUpdate(backupRestoreModal.payload.settings);
    }
    if (backupRestoreModal.payload.users && onUpdateUsers) {
      onUpdateUsers(backupRestoreModal.payload.users);
    }

    setBackupRestoreModal({ open: false });
    setSaveToast({ show: true, msg: `Workspace data restored successfully in "${mode}" mode!`, type: 'success' });
    setTimeout(() => setSaveToast({ show: false }), 5000);
  };

  // CSV Import Clients
  const handleImportClientsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const imported = parseAndImportClientsCSV(text);
      if (imported.length > 0) {
        const existingClients = JSON.parse(localStorage.getItem('cf_clients') || '[]');
        const updated = [...imported, ...existingClients];
        localStorage.setItem('cf_clients', JSON.stringify(updated));
        if (onRestoreData) {
          onRestoreData(gatherAppBackupPayload());
        }
        setSaveToast({ show: true, msg: `Successfully imported ${imported.length} clients from CSV!`, type: 'success' });
      } else {
        alert('No valid client records found in CSV file.');
      }
      setTimeout(() => setSaveToast({ show: false }), 4000);
    };
    reader.readAsText(file);
  };

  // CSV Import Expenses
  const handleImportExpensesCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const imported = parseAndImportExpensesCSV(text);
      if (imported.length > 0) {
        const existingExp = JSON.parse(localStorage.getItem('cf_expenses') || '[]');
        const updated = [...imported, ...existingExp];
        localStorage.setItem('cf_expenses', JSON.stringify(updated));
        if (onRestoreData) {
          onRestoreData(gatherAppBackupPayload());
        }
        setSaveToast({ show: true, msg: `Successfully imported ${imported.length} expenses from CSV!`, type: 'success' });
      } else {
        alert('No valid expense records found in CSV file.');
      }
      setTimeout(() => setSaveToast({ show: false }), 4000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-16 relative">
      {/* Toast Notification */}
      {saveToast.show && (
        <div className={`fixed top-6 right-6 z-50 flex items-center space-x-3 text-white px-5 py-3.5 rounded-2xl shadow-2xl animate-in slide-in-from-top-3 fade-in duration-200 ${
          saveToast.type === 'error' ? 'bg-rose-600 border border-rose-400/40' : 'bg-emerald-600 border border-emerald-400/40'
        }`}>
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            {saveToast.type === 'error' ? <AlertTriangle size={18} className="text-white" /> : <CheckCircle2 size={18} className="text-white" />}
          </div>
          <div>
            <p className="text-sm font-black tracking-tight">{saveToast.msg || 'Saved Successfully'}</p>
          </div>
          <button 
            onClick={() => setSaveToast({ show: false })}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 ml-2"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header with Save Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="text-indigo-600 dark:text-indigo-400" size={26} />
            {t('settings.title', 'System Settings & Branding')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Manage company profile, tax registration, Google Drive cloud auto-sync, and user credentials.
          </p>
        </div>

        {hasChanges && (
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-2xs"
            >
              <RotateCcw size={14} />
              <span>Discard</span>
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-md shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
            >
              <Save size={15} />
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl w-fit border border-slate-200/80 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'company'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Building2 size={16} className={activeTab === 'company' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
          <span>{t('settings.company_tab', 'Company Identity')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Users size={16} className={activeTab === 'users' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
          <span>{t('settings.users_tab', 'User Accounts & Access')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'backup'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <Cloud size={16} className={activeTab === 'backup' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
          <span>{t('settings.backup_tab', 'Google Drive & Backup Center')}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USERS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'users' && currentUser && onUpdateUsers && onUpdateCurrentUser && (
        <UserManagementSettings
          currentUser={currentUser}
          users={users}
          onUpdateUsers={onUpdateUsers}
          onUpdateCurrentUser={onUpdateCurrentUser}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GOOGLE DRIVE & DATA BACKUP CENTER */}
      {/* ========================================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Section 1: Official Google Drive Integration */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800">
                  <Cloud size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {t('backup.title', 'Google Drive Cloud Storage')}
                    {isGoogleConnected && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 size={11} /> Connected
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Store and sync your commercial invoices, customers, and financial records securely to your Google Drive.
                  </p>
                </div>
              </div>

              {/* Google Connection Actions */}
              <div className="flex items-center gap-2">
                {!isGoogleConnected ? (
                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={isSigningInGoogle}
                    className="inline-flex items-center gap-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>{isSigningInGoogle ? 'Connecting...' : 'Sign in with Google Drive'}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDirectBackupToDrive}
                      disabled={isUploadingToDrive}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <FolderSync size={15} className={isUploadingToDrive ? 'animate-spin' : ''} />
                      <span>{isUploadingToDrive ? 'Uploading to Drive...' : 'Backup to Google Drive'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleSignOutClick}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-700 transition-colors"
                      title="Disconnect Google Drive"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Google Profile Badge & Email */}
            {isGoogleConnected && googleUser && (
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt="Google Avatar"
                      className="w-10 h-10 rounded-full border border-indigo-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                      {googleUser.displayName ? googleUser.displayName.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      {googleUser.displayName || 'Google Drive User'}
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-md">
                        Active Account
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {googleUser.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleFetchDriveFiles}
                  disabled={isLoadingDriveFiles}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={13} className={isLoadingDriveFiles ? 'animate-spin' : ''} />
                  <span>Refresh Cloud List</span>
                </button>
              </div>
            )}

            {/* Drive Backups List */}
            {isGoogleConnected && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Google Drive Backup Files ({driveFiles.length})
                  </h4>
                </div>

                {isLoadingDriveFiles ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Fetching files from Google Drive...
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">
                      No AfAccounts backup archives found in your Google Drive yet.
                    </p>
                    <button
                      type="button"
                      onClick={handleDirectBackupToDrive}
                      disabled={isUploadingToDrive}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                    >
                      Create First Backup Now
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {driveFiles.map((f) => (
                      <div key={f.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <FileCode size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white">{f.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {f.createdTime ? new Date(f.createdTime).toLocaleString() : 'Recent'} &bull; {f.size ? `${Math.round(parseInt(f.size) / 1024)} KB` : 'JSON Backup'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDirectRestoreFromDrive(f.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5"
                        >
                          <Download size={13} />
                          <span>Restore</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Email Sync & Continuous Backup Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Linked Google Drive Email */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={14} className="text-indigo-600 dark:text-indigo-400" />
                  Linked Account Email
                </label>
                <input
                  type="email"
                  value={formData.driveSyncEmail || ''}
                  onChange={(e) => handleFieldChange('driveSyncEmail', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. user@company.com"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  When you sign in on another computer or browser, all records auto-load.
                </p>
              </div>

              {/* Auto Sync Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderSync size={14} className="text-indigo-600 dark:text-indigo-400" />
                  Auto-Sync on Every Data Change
                </label>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Continuous Cloud Sync</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Maintains real-time backup across sessions.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoDriveSync ?? true}
                    onChange={(e) => handleFieldChange('autoDriveSync', e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Comprehensive Local JSON Backup & Restore */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800">
                <HardDrive size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Local Hard Drive Full Backup (.JSON)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Export complete encrypted JSON archives to keep on your computer or USB drive.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export Button */}
              <button
                type="button"
                onClick={() => downloadLocalBackupJSON()}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Download size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">{t('backup.download_json', 'Download Full JSON Backup')}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">All invoices, clients, expenses, staff & settings</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">&darr;</span>
              </button>

              {/* Import Button */}
              <div>
                <input
                  type="file"
                  ref={jsonFileInputRef}
                  onChange={handleJSONFileSelected}
                  accept=".json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => jsonFileInputRef.current?.click()}
                  className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <Upload size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">{t('backup.import_json', 'Restore from JSON Backup')}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Load previously saved archive file</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">&uarr;</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: CSV Export & Import Center */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/50 dark:border-blue-800">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Excel & Spreadsheet CSV Center
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Export or import individual modules in Microsoft Excel / Google Sheets compatible CSV format.
                </p>
              </div>
            </div>

            {/* CSV Exports */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Export Module to CSV</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => exportModuleToCSV('invoices')}
                  className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <FileText size={14} />
                  <span>Invoices CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportModuleToCSV('clients')}
                  className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Users size={14} />
                  <span>Clients CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportModuleToCSV('expenses')}
                  className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Coins size={14} />
                  <span>Expenses CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportModuleToCSV('staff')}
                  className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <ShieldCheck size={14} />
                  <span>Staff CSV</span>
                </button>
              </div>
            </div>

            {/* CSV Imports */}
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Import Records from CSV</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="file"
                    ref={csvClientInputRef}
                    onChange={handleImportClientsCSV}
                    accept=".csv"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => csvClientInputRef.current?.click()}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <Upload size={14} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Import Clients CSV</span>
                  </button>
                </div>

                <div>
                  <input
                    type="file"
                    ref={csvExpenseInputRef}
                    onChange={handleImportExpensesCSV}
                    accept=".csv"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => csvExpenseInputRef.current?.click()}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <Upload size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Import Expenses CSV</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COMPANY BRANDING & LOGO FORM */}
      {/* ========================================================================= */}
      {activeTab === 'company' && (
        <form onSubmit={handleSave} className="space-y-8 animate-in fade-in">
        
        {/* DEDICATED SECTION 1: COMPANY LOGO & VISUAL BRANDING */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <ImageIcon className="text-indigo-600 dark:text-indigo-400" size={22} />
                Company Brand Logo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Upload or select your studio logo to appear automatically on all Invoices, Quotations, and Account Statements.
              </p>
            </div>
            {formData.logoUrl ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-xl self-start sm:self-auto">
                <CheckCircle2 size={13} />
                <span>Custom Logo Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl self-start sm:self-auto">
                <span>Default Monogram (AF)</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Live Preview Box */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Live Header Preview</span>
              <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden p-2 shadow-xs">
                {formData.logoUrl ? (
                  <img 
                    src={formData.logoUrl} 
                    alt="Company Logo Preview" 
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-black text-xl tracking-tight">
                    {formData.name ? formData.name.substring(0, 2).toUpperCase() : 'AF'}
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[180px]">
                  {formData.name || 'Your Company Name'}
                </p>
                <p className="text-[10px] text-slate-400">Printed on official PDFs</p>
              </div>

              {formData.logoUrl && (
                <div className="flex flex-col gap-1 w-full">
                  <button
                    type="button"
                    onClick={handleRestoreDefaultLogo}
                    className="flex items-center justify-center space-x-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 transition-colors"
                  >
                    <RotateCcw size={13} />
                    <span>Restore Original Logo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="flex items-center justify-center space-x-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 p-1 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Clear Logo</span>
                  </button>
                </div>
              )}
            </div>

            {/* Upload Area */}
            <div className="md:col-span-8 space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" 
                className="hidden" 
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDraggingOver 
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40' 
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <Upload size={22} className={isProcessingImage ? 'animate-bounce' : ''} />
                </div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">Click or Drag & Drop Image Here</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Supports PNG, JPG, SVG, WebP. Automatically optimized for crisp rendering.
                </p>
              </div>

              {/* Preset Logos */}
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Quick Presets</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LOGO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.svg, preset.name)}
                      className={`p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all ${
                        formData.logoUrl === preset.svg 
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/20' 
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <img src={preset.svg} alt={preset.name} className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-[11px] font-black text-slate-900 dark:text-white truncate">{preset.name}</p>
                        <p className="text-[9px] text-slate-400 truncate">{preset.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: COMPANY LEGAL IDENTITY */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="pb-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={22} />
              Company Legal Identity & Registration
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Official company name, TRN tax number, and registered contact information.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Company Legal Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Afsal Creative Services LLC"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                UAE TRN / Tax Registration Number
              </label>
              <input
                type="text"
                value={formData.trnNumber || ''}
                onChange={(e) => handleFieldChange('trnNumber', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 100234567890003"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Official Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="info@yourcompany.ae"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Official Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="+971 50 123 4567"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Registered Physical / Billing Address
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Office #104, Business Bay, Dubai, United Arab Emirates"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: BILLING, VAT & BANK DEFAULTS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="pb-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <Coins className="text-indigo-600 dark:text-indigo-400" size={22} />
              Country, Currency & Financial Defaults
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Configure country region, local currency symbols (e.g. ₹ INR, د.إ AED, $ USD), tax percentages, and bank remittance wire instructions.
            </p>
          </div>

          {/* Country Selection */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-4 sm:p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-2">
                <Globe size={16} className="text-indigo-600 dark:text-indigo-400" />
                Select Operating Country & Region
              </label>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                Auto-configures Currency & Tax
              </span>
            </div>
            <select
              value={formData.country || 'AE'}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            >
              {SUPPORTED_COUNTRIES.map(country => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name} — {country.defaultCurrency} ({country.currencySymbol}) · {country.taxName} {country.defaultTaxRate}%
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Default Currency
              </label>
              <select
                value={formData.currency || formData.defaultCurrency || 'AED'}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code}>{curr.code} - {curr.name} ({curr.symbol})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Currency Symbol
              </label>
              <input
                type="text"
                value={formData.currencySymbol || 'د.إ'}
                onChange={(e) => handleFieldChange('currencySymbol', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. ₹, د.إ, $, €, £"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Tax Label & Rate (%)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.taxName || 'VAT'}
                  onChange={(e) => handleFieldChange('taxName', e.target.value)}
                  className="w-24 px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="VAT/GST"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.taxRate ?? formData.defaultTaxRate ?? 5}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    handleFieldChange('taxRate', val);
                    handleFieldChange('defaultTaxRate', val);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Bank Name
              </label>
              <input
                type="text"
                value={formData.bankName || ''}
                onChange={(e) => handleFieldChange('bankName', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Emirates NBD"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Account Number / IBAN
              </label>
              <input
                type="text"
                value={formData.bankAccount || ''}
                onChange={(e) => handleFieldChange('bankAccount', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="AE00 0000 0000 0000 0000"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Default Terms & Conditions / Footer Note
              </label>
              <textarea
                rows={2}
                value={formData.invoiceFooterNote || ''}
                onChange={(e) => handleFieldChange('invoiceFooterNote', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Thank you for your business. Payment is due within 30 days."
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 dark:shadow-none flex items-center gap-2 transition-all active:scale-95"
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving Settings...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BACKUP PRE-RESTORE CONFIRMATION */}
      {/* ========================================================================= */}
      {backupRestoreModal.open && backupRestoreModal.payload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Database size={28} />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Confirm Data Restoration</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Backup file from {backupRestoreModal.payload.exportedAt ? new Date(backupRestoreModal.payload.exportedAt).toLocaleDateString() : 'Cloud Archive'}
              </p>
            </div>

            {/* Counts breakdown */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="p-2">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Invoices</span>
                <span className="text-slate-900 dark:text-white font-black text-base">{backupRestoreModal.payload.invoices?.length || 0}</span>
              </div>
              <div className="p-2">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Clients</span>
                <span className="text-slate-900 dark:text-white font-black text-base">{backupRestoreModal.payload.clients?.length || 0}</span>
              </div>
              <div className="p-2">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Expenses</span>
                <span className="text-slate-900 dark:text-white font-black text-base">{backupRestoreModal.payload.expenses?.length || 0}</span>
              </div>
              <div className="p-2">
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Staff</span>
                <span className="text-slate-900 dark:text-white font-black text-base">{backupRestoreModal.payload.staffList?.length || 0}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Choose whether you want to <strong>Replace</strong> all records with this backup or <strong>Merge</strong> without deleting existing items.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleApplyBackup('replace')}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md"
              >
                {t('backup.replace_mode', 'Replace All Workspace Data')}
              </button>
              <button
                type="button"
                onClick={() => handleApplyBackup('merge')}
                className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all"
              >
                {t('backup.merge_mode', 'Merge with Existing Records')}
              </button>
              <button
                type="button"
                onClick={() => setBackupRestoreModal({ open: false })}
                className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;

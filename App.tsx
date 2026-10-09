import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings as SettingsIcon,
  Search,
  Sparkles,
  ClipboardList,
  Wallet,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  CheckCircle2,
  UserCheck,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
  Share2,
  Wifi,
  WifiOff,
  Mail,
  X,
  Smartphone,
  HardDrive,
  ShieldCheck
} from 'lucide-react';
import {
  View,
  Invoice,
  Client,
  CompanySettings,
  Expense,
  UserAccount,
  UserRole,
  StaffMember,
  StaffAdvance,
  StaffAttendanceRecord,
  AppBackupPayload
} from './types';
import {
  MOCK_CLIENTS,
  MOCK_INVOICES,
  INITIAL_SETTINGS,
  MOCK_EXPENSES,
  DEFAULT_EXPENSE_CATEGORIES,
  MOCK_STAFF,
  MOCK_STAFF_ADVANCES,
  MOCK_STAFF_ATTENDANCE
} from './constants';
import { loadStoredUsers, saveStoredUsers } from './services/userService';
import {
  syncToGoogleDriveCloud,
  pullFromCloudAndDriveByEmail,
  shareLocalDataOffline,
  getLinkedDriveAccount,
  setLinkedDriveAccount,
  gatherAppBackupPayload,
  backupDirectlyToGoogleDrive,
  isEmailVerified,
  markEmailVerified
} from './services/driveService';
import {
  signInWithGoogleDrive,
  isGoogleDriveConnected,
  getGoogleDriveUser,
  linkGoogleDriveAccountByEmail,
  initGoogleAuth
} from './services/googleDriveAuth';
import { LanguageCode, SUPPORTED_LANGUAGES, getTranslation } from './utils/translations';
import Dashboard from './components/Dashboard';
import InvoiceList from './components/InvoiceList';
import InvoiceBuilder from './components/InvoiceBuilder';
import ClientList from './components/ClientList';
import StaffPayroll from './components/StaffPayroll';
import AIHelper from './components/AIHelper';
import Statements from './components/Statements';
import Settings from './components/Settings';
import ExpenseTracker from './components/ExpenseTracker';
import Login from './components/Login';
import FloatingAIChat from './components/FloatingAIChat';
import EmailVerificationModal from './components/EmailVerificationModal';

const App: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>(() => loadStoredUsers());
  const [user, setUser] = useState<UserAccount | null>(() => {
    const savedUser = localStorage.getItem('af_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  });

  // Global Theme & Language State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('af_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  });

  const [language, setLanguage] = useState<LanguageCode>(() => {
    const savedLang = localStorage.getItem('af_language');
    if (savedLang && SUPPORTED_LANGUAGES.some(l => l.code === savedLang)) {
      return savedLang as LanguageCode;
    }
    return 'en';
  });

  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isInitialMountRef = useRef<boolean>(true);
  const saveBlinkTimeoutRef = useRef<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Responsive Navigation States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Invoice Selection & Creation Mode
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [newInvoiceDocType, setNewInvoiceDocType] = useState<'INVOICE' | 'PROFORMA' | 'QUOTATION'>('INVOICE');
  const [autoPrint, setAutoPrint] = useState(false);

  // Multi-Device Email & Google Drive Sync Modal State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncEmailInput, setSyncEmailInput] = useState<string>(() => {
    return getLinkedDriveAccount() || '';
  });
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  const [isPullingCloud, setIsPullingCloud] = useState<boolean>(false);
  const [driveConnected, setDriveConnected] = useState<boolean>(() => isGoogleDriveConnected());

  // Persistence Loading from Local Device Storage
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('cf_invoices');
    return saved ? JSON.parse(saved) : MOCK_INVOICES;
  });
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('cf_expenses');
    return saved ? JSON.parse(saved) : MOCK_EXPENSES;
  });
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('cf_clients');
    return saved ? JSON.parse(saved) : MOCK_CLIENTS;
  });
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem('cf_staff_list');
    return saved ? JSON.parse(saved) : MOCK_STAFF;
  });
  const [staffAdvances, setStaffAdvances] = useState<StaffAdvance[]>(() => {
    const saved = localStorage.getItem('cf_staff_advances');
    return saved ? JSON.parse(saved) : MOCK_STAFF_ADVANCES;
  });
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceRecord[]>(() => {
    const saved = localStorage.getItem('cf_staff_attendance');
    return saved ? JSON.parse(saved) : MOCK_STAFF_ATTENDANCE;
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('cf_expense_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_EXPENSE_CATEGORIES;
  });
  const [settings, setSettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem('cf_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          currencySymbol:
            !parsed.currencySymbol || parsed.currencySymbol === 'د.إ'
              ? '\u20C3'
              : parsed.currencySymbol,
          logoUrl: parsed.logoUrl || INITIAL_SETTINGS.logoUrl,
          name: parsed.name && !parsed.name.includes('CreativeFlow') ? parsed.name : INITIAL_SETTINGS.name
        };
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_SETTINGS;
  });

  const activeSyncEmail =
    user?.email || settings.driveSyncEmail || getLinkedDriveAccount() || syncEmailInput || '';

  // Sync Theme to HTML Root and localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('af_theme', theme);
  }, [theme]);

  // Sync Language & RTL to HTML Root and localStorage
  useEffect(() => {
    const root = document.documentElement;
    const isRtl = language === 'ar' || language === 'ur';
    root.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);
    localStorage.setItem('af_language', language);
  }, [language]);

  // Online / Offline Listener + Google Auth Listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (activeSyncEmail) {
        pullFromCloudAndDriveByEmail(activeSyncEmail, 'merge')
          .then(res => {
            if (res.success && res.data) handleRestoreAllData(res.data);
          })
          .catch(() => {});
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubAuth = initGoogleAuth(
      gUser => {
        setDriveConnected(true);
        if (gUser.email) {
          setSyncEmailInput(gUser.email);
          setLinkedDriveAccount(gUser.email);
        }
      },
      () => setDriveConnected(false)
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubAuth) unsubAuth();
    };
  }, [activeSyncEmail]);

  // Automatic Pull from Cloud & Google Drive when User Logs In or Email is Linked + Real-Time Live Mirroring
  const hasInitialPulledRef = useRef<string>('');
  useEffect(() => {
    const emailToSync = (user?.email || settings.driveSyncEmail || getLinkedDriveAccount() || '').trim().toLowerCase();
    if (!emailToSync) return;

    if (hasInitialPulledRef.current !== emailToSync) {
      hasInitialPulledRef.current = emailToSync;
      setSyncEmailInput(emailToSync);

      pullFromCloudAndDriveByEmail(emailToSync, 'merge')
        .then(res => {
          if (res.success && res.data) {
            handleRestoreAllData(res.data);
          }
        })
        .catch(err => console.warn('Initial email sync check:', err));
    }

    // Continuous Real-Time Background Mirroring once Email ID is verified
    const mirrorInterval = window.setInterval(() => {
      if (isEmailVerified(emailToSync) && (typeof navigator === 'undefined' || navigator.onLine)) {
        pullFromCloudAndDriveByEmail(emailToSync, 'merge')
          .then(res => {
            if (res.success && res.data) {
              handleRestoreAllData(res.data);
            }
          })
          .catch(() => {});
      }
    }, 15000);

    return () => window.clearInterval(mirrorInterval);
  }, [user?.email, settings.driveSyncEmail]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);
  const currentLangObj =
    SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  const triggerSaveBlink = () => {
    if (saveBlinkTimeoutRef.current) {
      window.clearTimeout(saveBlinkTimeoutRef.current);
    }
    setSaveStatus('saving');
    window.setTimeout(() => {
      setSaveStatus('saved');
      saveBlinkTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
      }, 2200);
    }, 350);
  };

  // Persistence Saving to Local Device Storage + Automatic Background Cloud & Drive Sync
  useEffect(() => {
    setIsSyncing(true);
    localStorage.setItem('cf_invoices', JSON.stringify(invoices));
    localStorage.setItem('cf_expenses', JSON.stringify(expenses));
    localStorage.setItem('cf_clients', JSON.stringify(clients));
    localStorage.setItem('cf_staff_list', JSON.stringify(staffList));
    localStorage.setItem('cf_staff_advances', JSON.stringify(staffAdvances));
    localStorage.setItem('cf_staff_attendance', JSON.stringify(staffAttendance));
    localStorage.setItem('cf_expense_categories', JSON.stringify(categories));
    localStorage.setItem('cf_settings', JSON.stringify(settings));
    saveStoredUsers(users);

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    } else {
      setSaveStatus('saving');
    }

    const timer = setTimeout(() => {
      setIsSyncing(false);
      setSaveStatus(prev => (prev === 'saving' ? 'saved' : prev));
      if (saveBlinkTimeoutRef.current) {
        window.clearTimeout(saveBlinkTimeoutRef.current);
      }
      saveBlinkTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
      }, 2200);

      const emailToSync = (
        user?.email ||
        settings.driveSyncEmail ||
        getLinkedDriveAccount() ||
        ''
      )
        .trim()
        .toLowerCase();

      if (emailToSync) {
        const payload: AppBackupPayload = {
          version: '2.0',
          exportedAt: new Date().toISOString(),
          userEmail: emailToSync,
          invoices,
          clients,
          expenses,
          staffList,
          staffAdvances,
          staffAttendance,
          categories,
          settings,
          users
        };
        syncToGoogleDriveCloud(emailToSync, payload).catch(() => {});
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [invoices, expenses, clients, staffList, staffAdvances, staffAttendance, categories, settings, users, user?.email]);

  const handleRestoreAllData = (payload: AppBackupPayload) => {
    if (payload.invoices) setInvoices(payload.invoices);
    if (payload.clients) setClients(payload.clients);
    if (payload.expenses) setExpenses(payload.expenses);
    if (payload.staffList) setStaffList(payload.staffList);
    if (payload.staffAdvances) setStaffAdvances(payload.staffAdvances);
    if (payload.staffAttendance) setStaffAttendance(payload.staffAttendance);
    if (payload.categories && payload.categories.length > 0) setCategories(payload.categories);
    if (payload.settings) {
      setSettings(prev => ({
        ...prev,
        ...payload.settings,
        currencySymbol:
          !payload.settings.currencySymbol || payload.settings.currencySymbol === 'د.إ'
            ? '\u20C3'
            : payload.settings.currencySymbol
      }));
    }
    if (payload.users && payload.users.length > 0) setUsers(payload.users);
  };

  const handleLogin = async (userAccount: UserAccount) => {
    setUser(userAccount);
    localStorage.setItem('af_current_user', JSON.stringify(userAccount));
    setActiveView('dashboard');

    const loginEmail = userAccount.email || settings.driveSyncEmail || getLinkedDriveAccount();
    if (loginEmail) {
      setSyncEmailInput(loginEmail);
      const res = await pullFromCloudAndDriveByEmail(loginEmail, 'merge');
      if (res.success && res.data) {
        handleRestoreAllData(res.data);
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('af_current_user');
  };

  const handleUpdateCurrentUser = (updatedUser: UserAccount) => {
    setUser(updatedUser);
    localStorage.setItem('af_current_user', JSON.stringify(updatedUser));
  };

  const handleAddClient = (newClient: Client) => {
    setClients(prev => [newClient, ...prev]);
  };

  const handleUpdateClient = (updatedClient: Client) => {
    setClients(prev => prev.map(c => (c.id === updatedClient.id ? updatedClient : c)));
  };

  const handleDeleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const handleReorderClients = (reorderedList: Client[]) => {
    setClients(reorderedList);
  };

  const handleUpdateInvoice = (updatedInv: Invoice) => {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === updatedInv.id);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = updatedInv;
        return u;
      }
      return [updatedInv, ...prev];
    });
  };

  // Working Single & Bulk Invoice Deletion
  const handleDeleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    if (selectedInvoiceId === id) {
      setSelectedInvoiceId(null);
      setAutoPrint(false);
    }
  };

  const handleBulkDeleteInvoices = (ids: string[]) => {
    const idSet = new Set(ids);
    setInvoices(prev => prev.filter(i => !idSet.has(i.id)));
    if (selectedInvoiceId && idSet.has(selectedInvoiceId)) {
      setSelectedInvoiceId(null);
      setAutoPrint(false);
    }
  };

  const handleManualEmailSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetEmail = (syncEmailInput || activeSyncEmail).trim().toLowerCase();
    if (!targetEmail) {
      setSyncStatusMsg('Please enter your Email ID to link PC & Mobile devices.');
      return;
    }

    setIsPullingCloud(true);
    setSyncStatusMsg('Syncing data across Google Drive & Multi-Device Email Vault...');
    try {
      setLinkedDriveAccount(targetEmail);
      setSettings(prev => ({ ...prev, driveSyncEmail: targetEmail, autoDriveSync: true }));
      if (user && !user.email) {
        handleUpdateCurrentUser({ ...user, email: targetEmail });
      }
      // First push current local data so nothing is lost, then pull merged dataset
      await syncToGoogleDriveCloud(targetEmail);
      const res = await pullFromCloudAndDriveByEmail(targetEmail, 'merge');
      if (res.success && res.data) {
        handleRestoreAllData(res.data);
      }
      setSyncStatusMsg(res.message || `All data linked and synced with ${targetEmail}!`);
    } catch (err: any) {
      setSyncStatusMsg(err?.message || 'Saved locally on device.');
    } finally {
      setIsPullingCloud(false);
    }
  };

  const handleConnectGoogleDriveQuick = async () => {
    setIsPullingCloud(true);
    setSyncStatusMsg('Opening Google Drive sign-in...');
    try {
      const res = await signInWithGoogleDrive();
      if (res?.user?.email) {
        const gEmail = res.user.email.toLowerCase().trim();
        markEmailVerified(gEmail);
        setDriveConnected(true);
        setSyncEmailInput(gEmail);
        setLinkedDriveAccount(gEmail);
        setSettings(prev => ({ ...prev, driveSyncEmail: gEmail, autoDriveSync: true }));
        if (user && !user.email) {
          handleUpdateCurrentUser({ ...user, email: gEmail });
        }

        const pulled = await pullFromCloudAndDriveByEmail(gEmail, 'merge');
        if (pulled.success && pulled.data) {
          handleRestoreAllData(pulled.data);
        }
        await backupDirectlyToGoogleDrive(gatherAppBackupPayload(gEmail));
        triggerSaveBlink();
        setSyncStatusMsg(`Connected Google Drive (${gEmail}) & synced all data across devices!`);
      }
    } catch (err: any) {
      const fallbackEmail = (syncEmailInput || activeSyncEmail || '').toLowerCase().trim();
      if (fallbackEmail && fallbackEmail.includes('@')) {
        linkGoogleDriveAccountByEmail(fallbackEmail, user?.name);
        setDriveConnected(true);
        setLinkedDriveAccount(fallbackEmail);
        setSettings(prev => ({ ...prev, driveSyncEmail: fallbackEmail, autoDriveSync: true }));
        const pulled = await pullFromCloudAndDriveByEmail(fallbackEmail, 'merge');
        if (pulled.success && pulled.data) {
          handleRestoreAllData(pulled.data);
        }
        await backupDirectlyToGoogleDrive(gatherAppBackupPayload(fallbackEmail));
        triggerSaveBlink();
        setSyncStatusMsg(`Linked Google Drive Mirror (${fallbackEmail}) & synced all data!`);
      } else {
        setSyncStatusMsg(err?.message || 'Could not connect Google Drive popup. Email sync remains active.');
      }
    } finally {
      setIsPullingCloud(false);
    }
  };

  const allNavItems: { view: View; icon: React.ReactNode; label: string }[] = [
    { view: 'dashboard', icon: <LayoutDashboard size={18} />, label: t('nav.dashboard', 'Dashboard') },
    { view: 'invoices', icon: <FileText size={18} />, label: t('nav.invoices', 'Invoices & Proforma') },
    { view: 'statements', icon: <ClipboardList size={18} />, label: t('nav.statements', 'Statements') },
    { view: 'expenses', icon: <Wallet size={18} />, label: t('nav.expenses', 'Expenses') },
    { view: 'clients', icon: <Users size={18} />, label: t('nav.clients', 'Clients') },
    { view: 'staff', icon: <UserCheck size={18} />, label: t('nav.staff', 'Staff Payroll') },
    { view: 'ai-helper', icon: <Sparkles size={18} />, label: t('nav.ai_advisor', 'AI Advisor') },
    { view: 'settings', icon: <SettingsIcon size={18} />, label: t('nav.settings', 'Settings') }
  ];

  const navItemsList = allNavItems.filter(
    item => item.view !== 'ai-helper' || settings.aiNavEnabled !== false
  );

  const NavItem: React.FC<{ view: View; icon: React.ReactNode; label: string; mobile?: boolean }> = ({
    view,
    icon,
    label,
    mobile = false
  }) => {
    return (
      <button
        onClick={() => {
          setActiveView(view);
          setSelectedInvoiceId(null);
          setAutoPrint(false);
          if (mobile) setIsMobileMenuOpen(false);
        }}
        title={!isSidebarOpen && !mobile ? label : ''}
        className={`w-full flex items-center rounded-xl transition-all ${
          isSidebarOpen || mobile ? 'px-4 py-3 space-x-3' : 'p-3 justify-center'
        } ${
          activeView === view
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-black'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-bold'
        }`}
      >
        <div className="flex-shrink-0">{icon}</div>
        {(isSidebarOpen || mobile) && (
          <span className="text-xs whitespace-nowrap overflow-hidden transition-all duration-300">
            {label}
          </span>
        )}
      </button>
    );
  };

  if (!user) {
    return <Login users={users} onLogin={handleLogin} onUpdateUsers={setUsers} />;
  }

  return (
    <div className="flex h-screen w-screen max-w-full bg-slate-50 dark:bg-darkbg text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      {/* Desktop Left Sidebar (Hidden on Mobile, Visible on lg+ screens) */}
      <aside
        className={`no-print hidden lg:flex ${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-white dark:bg-darkcard border-r border-slate-200 dark:border-darkborder transition-all duration-300 flex-col relative z-20 shrink-0`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 bg-white dark:bg-darkcard border border-slate-200 dark:border-darkborder rounded-full p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 shadow-sm z-50 transition-all"
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className={`p-5 flex items-center ${isSidebarOpen ? 'space-x-3' : 'justify-center'}`}>
          {settings.logoUrl ? (
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
              <img
                src={settings.logoUrl}
                alt={settings.name || 'Logo'}
                className="max-h-full max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0 shadow-sm">
              Af
            </div>
          )}
          {isSidebarOpen && (
            <div className="min-w-0">
              <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight block truncate">
                {settings.name || 'Af© Accounts'}
              </span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block truncate">
                {activeSyncEmail || 'Local + Cloud Ready'}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1.5 mt-1 scrollbar-hide overflow-y-auto">
          {navItemsList.map(item => (
            <NavItem key={item.view} view={item.view} icon={item.icon} label={item.label} />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-darkborder space-y-1.5">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all ${
              isSidebarOpen ? 'px-4 py-2.5 space-x-3' : 'p-2.5 justify-center'
            }`}
          >
            <LogOut size={18} />
            {isSidebarOpen && <span className="text-xs font-bold">{t('nav.logout', 'Logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {isMobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-darkcard h-full flex flex-col justify-between z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-darkborder flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs">
                  Af
                </div>
                <div>
                  <span className="text-sm font-black text-slate-900 dark:text-white block">
                    {settings.name || 'Af© Accounts'}
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block truncate max-w-[160px]">
                    {activeSyncEmail || 'Offline & Cloud Sync'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
              {navItemsList.map(item => (
                <NavItem
                  key={item.view}
                  view={item.view}
                  icon={item.icon}
                  label={item.label}
                  mobile
                />
              ))}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-darkborder space-y-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setShowSyncModal(true);
                }}
                className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-xs font-black"
              >
                <Cloud size={17} />
                <span>Link Email / Google Drive Sync</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold"
              >
                <LogOut size={17} />
                <span>{t('nav.logout', 'Logout')}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Responsive Top Header Bar */}
        <header className="no-print h-16 bg-white dark:bg-darkcard border-b border-slate-200 dark:border-darkborder flex items-center justify-between px-3 sm:px-6 md:px-8 z-10 shrink-0 gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title="Open Menu"
            >
              <Menu size={19} />
            </button>

            <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-full px-3.5 py-1.5 w-40 md:w-64 border border-slate-200 dark:border-slate-700">
              <Search size={14} className="text-slate-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder={t('header.search_placeholder', 'Search...')}
                className="bg-transparent border-none outline-none w-full text-xs text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400"
              />
            </div>

            {/* Multi-Device Email 4-Digit Verification & Google Drive Mirror Status Button */}
            <button
              onClick={() => setShowSyncModal(true)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black transition-all truncate max-w-[190px] sm:max-w-[260px] ${
                activeSyncEmail && isEmailVerified(activeSyncEmail)
                  ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
              }`}
              title="Click to verify Email ID with 4-digit code & mirror Google Drive"
            >
              {activeSyncEmail && isEmailVerified(activeSyncEmail) ? (
                <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
              ) : (
                <Cloud size={13} className={isSyncing ? 'animate-bounce shrink-0' : 'shrink-0'} />
              )}
              <span className="truncate">
                {activeSyncEmail
                  ? isEmailVerified(activeSyncEmail)
                    ? `${activeSyncEmail} (Verified)`
                    : `${activeSyncEmail} (Verify 4-Digit)`
                  : 'Verify Email (4-Digit) & Sync'}
              </span>
            </button>

            {/* Attractive Sync & Save Blink Symbol (Replaces "Online + Local" text) */}
            {settings.headerStatusMode !== 'hidden' && (
              <button
                type="button"
                onClick={triggerSaveBlink}
                title={
                  saveStatus === 'saving'
                    ? 'Saving changes...'
                    : saveStatus === 'saved'
                    ? 'Saved! All changes synced'
                    : isOnline
                    ? 'Synced & Saved (Click to verify save blink)'
                    : 'Offline Local Vault Active'
                }
                className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
                  saveStatus === 'saved'
                    ? 'px-2.5 h-8 bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 scale-105 ring-4 ring-emerald-400/30 animate-pulse'
                    : saveStatus === 'saving'
                    ? 'w-8 h-8 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700'
                    : isOnline
                    ? 'w-8 h-8 bg-emerald-50/90 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80'
                    : 'w-8 h-8 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {/* Blinking Ripple Ring on Save Done */}
                {saveStatus === 'saved' && (
                  <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping" />
                )}

                {saveStatus === 'saving' ? (
                  <RefreshCw size={13} className="animate-spin relative z-10" />
                ) : saveStatus === 'saved' ? (
                  <div className="relative z-10 flex items-center space-x-1">
                    <CheckCircle2 size={14} className="text-white" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Saved</span>
                  </div>
                ) : isOnline ? (
                  <div className="relative flex items-center justify-center">
                    <CheckCircle2 size={14} />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                ) : (
                  <WifiOff size={13} />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Quick Settings Shortcut Button (Always Visible on Mobile & Desktop) */}
            <button
              onClick={() => {
                setActiveView('settings');
                setSelectedInvoiceId(null);
              }}
              title="Open System Settings"
              className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                activeView === 'settings'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <SettingsIcon size={16} />
            </button>

            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center"
            >
              {theme === 'dark' ? (
                <Sun size={16} className="text-amber-400" />
              ) : (
                <Moon size={16} className="text-indigo-600" />
              )}
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                title="Select Language"
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
              >
                <span className="text-sm">{currentLangObj.flag}</span>
                <span className="hidden md:inline">{currentLangObj.nativeName}</span>
              </button>

              {showLanguageDropdown && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-darkcard rounded-2xl shadow-2xl border border-slate-200 dark:border-darkborder py-2 z-50 animate-in fade-in zoom-in-95"
                  onClick={() => setShowLanguageDropdown(false)}
                >
                  <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-darkborder">
                    {t('languages.select', 'Select Language')}
                  </div>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLanguageDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${
                        language === lang.code
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span>{lang.flag}</span>
                        <span>{lang.nativeName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {lang.code.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User Profile Badge */}
            <div className="flex items-center space-x-2 border-l border-slate-200 dark:border-darkborder pl-2 sm:pl-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate max-w-[110px]">
                  {user.username}
                </p>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                  {user.role}
                </span>
              </div>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=4f46e5&color=fff`}
                alt="Profile"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>
        </header>

        {/* Dynamic View Body Container — Responsive Padding & Full Access for All Users */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-8 pb-24 lg:pb-8 custom-scrollbar relative">
          {activeView === 'dashboard' && (
            <Dashboard
              invoices={invoices}
              expenses={expenses}
              categories={categories}
              clients={clients}
              settings={settings}
              role={UserRole.ADMIN}
              language={language}
              onLanguageChange={setLanguage}
              theme={theme}
              onToggleTheme={toggleTheme}
              onNavigateToView={view => {
                setActiveView(view);
                setSelectedInvoiceId(null);
                setAutoPrint(false);
              }}
              onNewInvoice={() => {
                setActiveView('invoices');
                setNewInvoiceDocType('INVOICE');
                setSelectedInvoiceId('new');
                setAutoPrint(false);
              }}
              onSelectInvoice={id => {
                setActiveView('invoices');
                setSelectedInvoiceId(id);
                setAutoPrint(false);
              }}
              onDownloadInvoice={id => {
                setActiveView('invoices');
                setSelectedInvoiceId(id);
                setAutoPrint(true);
              }}
              onUpdateInvoice={handleUpdateInvoice}
              onAddExpense={newExp => setExpenses(prev => [newExp, ...prev])}
            />
          )}

          {activeView === 'invoices' && !selectedInvoiceId && (
            <InvoiceList
              invoices={invoices}
              onNewInvoice={(docType = 'INVOICE') => {
                setNewInvoiceDocType(docType);
                setSelectedInvoiceId('new');
                setAutoPrint(false);
              }}
              onEditInvoice={id => {
                setSelectedInvoiceId(id);
                setAutoPrint(false);
              }}
              onDownloadInvoice={id => {
                setSelectedInvoiceId(id);
                setAutoPrint(true);
              }}
              onUpdateInvoice={handleUpdateInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onBulkDeleteInvoices={handleBulkDeleteInvoices}
              role={UserRole.ADMIN}
              clients={clients}
              settings={settings}
            />
          )}

          {activeView === 'invoices' && selectedInvoiceId && (
            <InvoiceBuilder
              invoiceId={selectedInvoiceId === 'new' ? null : selectedInvoiceId}
              initialDocumentType={newInvoiceDocType}
              autoPrint={autoPrint}
              clients={clients}
              invoices={invoices}
              onAddClient={handleAddClient}
              settings={settings}
              role={UserRole.ADMIN}
              onSave={newInv => {
                handleUpdateInvoice(newInv);
                setSelectedInvoiceId(null);
                setAutoPrint(false);
              }}
              onDelete={id => {
                handleDeleteInvoice(id);
                setSelectedInvoiceId(null);
                setAutoPrint(false);
              }}
              onCancel={() => {
                setSelectedInvoiceId(null);
                setAutoPrint(false);
              }}
            />
          )}

          {activeView === 'expenses' && (
            <ExpenseTracker
              expenses={expenses}
              setExpenses={setExpenses}
              categories={categories}
              setCategories={setCategories}
              clients={clients}
              settings={settings}
              role={UserRole.ADMIN}
            />
          )}

          {activeView === 'clients' && (
            <ClientList
              clients={clients}
              invoices={invoices}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              onReorderClients={handleReorderClients}
              role={UserRole.ADMIN}
              language={language}
              currency={settings.defaultCurrency || 'AED'}
            />
          )}

          {activeView === 'staff' && (
            <StaffPayroll
              staffList={staffList}
              advances={staffAdvances}
              attendanceRecords={staffAttendance}
              onUpdateStaffList={setStaffList}
              onUpdateAdvances={setStaffAdvances}
              onUpdateAttendance={setStaffAttendance}
              settings={settings}
              role={UserRole.ADMIN}
            />
          )}

          {activeView === 'statements' && (
            <Statements
              invoices={invoices}
              clients={clients}
              expenses={expenses}
              categories={categories}
              settings={settings}
              language={language}
              onSelectInvoice={id => {
                setActiveView('invoices');
                setSelectedInvoiceId(id);
                setAutoPrint(false);
              }}
              onUpdateInvoice={handleUpdateInvoice}
            />
          )}

          {activeView === 'ai-helper' && (
            <AIHelper
              invoices={invoices}
              clients={clients}
              expenses={expenses}
              settings={settings}
              onUpdateSettings={partial => setSettings(prev => ({ ...prev, ...partial }))}
              onTriggerTestBlink={triggerSaveBlink}
              language={language}
            />
          )}

          {activeView === 'settings' && (
            <Settings
              settings={settings}
              onUpdate={setSettings}
              currentUser={user}
              users={users}
              onUpdateUsers={setUsers}
              onUpdateCurrentUser={handleUpdateCurrentUser}
              onRestoreData={handleRestoreAllData}
              onTriggerTestBlink={triggerSaveBlink}
              onOpenEmailVerifyModal={() => setShowSyncModal(true)}
              language={language}
            />
          )}
        </div>

        {/* Mobile Bottom Navigation Bar (Visible on screens < lg for 1-Tap Access to All Sections) */}
        <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-darkcard border-t border-slate-200 dark:border-darkborder px-2 py-1.5 flex items-center justify-around z-30 shadow-lg overflow-x-auto">
          {navItemsList.map(item => {
            const active = activeView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => {
                  setActiveView(item.view);
                  setSelectedInvoiceId(null);
                  setAutoPrint(false);
                }}
                className={`flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl min-w-[56px] transition-all ${
                  active
                    ? 'text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50/80 dark:bg-indigo-950/60'
                    : 'text-slate-500 dark:text-slate-400 font-bold'
                }`}
              >
                {item.icon}
                <span className="text-[9px] mt-0.5 truncate max-w-[60px]">
                  {item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </nav>
      </main>

      {/* 4-DIGIT EMAIL VERIFICATION + AUTOMATIC GOOGLE DRIVE MIRROR MODAL */}
      <EmailVerificationModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        initialEmail={activeSyncEmail}
        driveConnected={driveConnected}
        onConnectGoogleDrive={handleConnectGoogleDriveQuick}
        isSyncingExternal={isPullingCloud}
        onVerifiedAndMirrored={(verifiedEmail, payload) => {
          markEmailVerified(verifiedEmail);
          setSyncEmailInput(verifiedEmail);
          setLinkedDriveAccount(verifiedEmail);
          setSettings(prev => ({
            ...prev,
            driveSyncEmail: verifiedEmail,
            autoDriveSync: true
          }));
          if (user && !user.email) {
            handleUpdateCurrentUser({ ...user, email: verifiedEmail });
          }
          if (payload) {
            handleRestoreAllData(payload);
          }
          triggerSaveBlink();
        }}
        onManualSyncNow={async () => {
          await handleManualEmailSync();
          triggerSaveBlink();
        }}
      />

      {/* Persistent Floating Gemini & Offline AI Chatbot Widget */}
      {activeView !== 'ai-helper' && (
        <FloatingAIChat
          invoices={invoices}
          expenses={expenses}
          clients={clients}
          settings={settings}
          onUpdateSettings={partial => setSettings(prev => ({ ...prev, ...partial }))}
          onTriggerTestBlink={triggerSaveBlink}
        />
      )}
    </div>
  );
};

export default App;

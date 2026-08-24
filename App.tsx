import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings as SettingsIcon, 
  Search, 
  Bell,
  Sparkles,
  ClipboardList,
  Wallet,
  LogOut,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Menu,
  CheckCircle2,
  UserCheck,
  Briefcase,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { View, Invoice, Client, CompanySettings, Expense, UserAccount, UserRole, StaffMember, StaffAdvance, StaffAttendanceRecord, AppBackupPayload } from './types';
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

const App: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>(() => loadStoredUsers());
  const [user, setUser] = useState<UserAccount | null>(() => {
    const savedUser = localStorage.getItem('af_current_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
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
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
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
  
  // Persistence Loading
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
          logoUrl: parsed.logoUrl || INITIAL_SETTINGS.logoUrl,
          name: parsed.name && !parsed.name.includes('CreativeFlow') ? parsed.name : INITIAL_SETTINGS.name,
        };
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_SETTINGS;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);

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

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);
  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  // Persistence Saving with Sync Indicator
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
    const timer = setTimeout(() => setIsSyncing(false), 800);
    return () => clearTimeout(timer);
  }, [invoices, expenses, clients, staffList, staffAdvances, staffAttendance, categories, settings, users]);

  const handleRestoreAllData = (payload: AppBackupPayload) => {
    if (payload.invoices) setInvoices(payload.invoices);
    if (payload.clients) setClients(payload.clients);
    if (payload.expenses) setExpenses(payload.expenses);
    if (payload.staffList) setStaffList(payload.staffList);
    if (payload.staffAdvances) setStaffAdvances(payload.staffAdvances);
    if (payload.staffAttendance) setStaffAttendance(payload.staffAttendance);
    if (payload.categories) setCategories(payload.categories);
    if (payload.settings) setSettings(payload.settings);
    if (payload.users) setUsers(payload.users);
  };

  const handleLogin = (userAccount: UserAccount) => {
    setUser(userAccount);
    localStorage.setItem('af_current_user', JSON.stringify(userAccount));
    setActiveView('dashboard');
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
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
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

  const NavItem: React.FC<{ view: View; icon: React.ReactNode; label: string; roles?: UserRole[] }> = ({ view, icon, label, roles }) => {
    if (roles && user && !roles.includes(user.role)) return null;
    
    return (
      <button
        onClick={() => {
          setActiveView(view);
          setSelectedInvoiceId(null);
          setAutoPrint(false);
        }}
        title={!isSidebarOpen ? label : ''}
        className={`w-full flex items-center rounded-xl transition-all ${
          isSidebarOpen ? 'px-4 py-3 space-x-3' : 'p-3 justify-center'
        } ${
          activeView === view 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none font-black' 
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-bold'
        }`}
      >
        <div className="flex-shrink-0">{icon}</div>
        {isSidebarOpen && <span className="text-xs whitespace-nowrap overflow-hidden transition-all duration-300">{label}</span>}
      </button>
    );
  };

  if (!user) {
    return <Login users={users} onLogin={handleLogin} onUpdateUsers={setUsers} />;
  }

  const isAdmin = user.role === UserRole.ADMIN;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-darkbg text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      {/* Left Sidebar */}
      <aside className={`no-print ${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-darkcard border-r border-slate-200 dark:border-darkborder transition-all duration-300 flex flex-col relative z-20`}>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 bg-white dark:bg-darkcard border border-slate-200 dark:border-darkborder rounded-full p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 shadow-sm z-50 transition-all"
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className={`p-6 flex items-center ${isSidebarOpen ? 'space-x-3' : 'justify-center'}`}>
          {settings.logoUrl ? (
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
              <img 
                src={settings.logoUrl} 
                alt={settings.name || 'Logo'} 
                className="max-h-full max-w-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0 shadow-sm">
              Af
            </div>
          )}
          {isSidebarOpen && (
            <div className="min-w-0">
              <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight block truncate">
                {settings.name || 'Af© Accounts'}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1.5 mt-2 scrollbar-hide overflow-y-auto">
          <NavItem view="dashboard" icon={<LayoutDashboard size={18} />} label={t('nav.dashboard', 'Dashboard')} />
          <NavItem view="invoices" icon={<FileText size={18} />} label={t('nav.invoices', 'Invoices')} />
          <NavItem view="statements" icon={<ClipboardList size={18} />} label={t('nav.statements', 'Statements')} roles={[UserRole.ADMIN]} />
          <NavItem view="expenses" icon={<Wallet size={18} />} label={t('nav.expenses', 'Expenses')} />
          <NavItem view="clients" icon={<Users size={18} />} label={t('nav.clients', 'Clients')} />
          <NavItem view="staff" icon={<UserCheck size={18} />} label={t('nav.staff', 'Staff')} />
          <NavItem view="ai-helper" icon={<Sparkles size={18} />} label={t('nav.ai_advisor', 'AI Advisor')} />
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-darkborder space-y-1.5">
          <NavItem view="settings" icon={<SettingsIcon size={18} />} label={t('nav.settings', 'Settings')} roles={[UserRole.ADMIN]} />
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

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="no-print h-16 bg-white dark:bg-darkcard border-b border-slate-200 dark:border-darkborder flex items-center justify-between px-6 md:px-8 z-10">
          <div className="flex items-center space-x-4">
             <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-full px-4 py-1.5 w-44 sm:w-60 md:w-72 border border-slate-200 dark:border-slate-700">
                <Search size={15} className="text-slate-400 mr-2 flex-shrink-0" />
                <input 
                  type="text" 
                  placeholder={t('header.search_placeholder', 'Search...')} 
                  className="bg-transparent border-none outline-none w-full text-xs text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400" 
                />
              </div>
              <div className={`save-indicator hidden sm:flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider transition-opacity duration-300 ${isSyncing ? 'text-indigo-600 dark:text-indigo-400 opacity-100' : 'text-slate-400 opacity-60'}`}>
                <CheckCircle2 size={12} />
                <span>{t('header.cloud_saved', 'Saved')}</span>
              </div>
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Top Light/Dark Mode Switcher */}
            <button
              onClick={toggleTheme}
              id="top-theme-toggle"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center"
            >
              {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-indigo-600" />}
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                id="top-language-toggle"
                title="Select Language"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
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
                      <span className="text-[10px] text-slate-400 font-normal">{lang.code.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User Profile Badge */}
            <div className="flex items-center space-x-3 border-l border-slate-200 dark:border-darkborder pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">{user.username}</p>
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${isAdmin ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {user.role}
                </span>
              </div>
              <img 
                src={`https://ui-avatars.com/api/?name=${user.username}&background=${theme === 'dark' ? '4f46e5' : '000'}&color=fff`} 
                alt="Profile" 
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700" 
              />
            </div>
          </div>
        </header>

        {/* Dynamic View Body Container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative">
          {activeView === 'dashboard' && (
            <Dashboard 
              invoices={invoices} 
              expenses={expenses} 
              categories={categories}
              clients={clients}
              settings={settings}
              role={user.role}
              language={language}
              onLanguageChange={setLanguage}
              theme={theme}
              onToggleTheme={toggleTheme}
              onNavigateToView={(view) => {
                setActiveView(view);
                setSelectedInvoiceId(null);
                setAutoPrint(false);
              }}
              onNewInvoice={() => {
                setActiveView('invoices');
                setSelectedInvoiceId('new');
                setAutoPrint(false);
              }}
              onSelectInvoice={(id) => {
                setActiveView('invoices');
                setSelectedInvoiceId(id);
                setAutoPrint(false);
              }}
              onDownloadInvoice={(id) => {
                setActiveView('invoices');
                setSelectedInvoiceId(id);
                setAutoPrint(true);
              }}
              onUpdateInvoice={handleUpdateInvoice}
              onAddExpense={(newExp) => setExpenses(prev => [newExp, ...prev])}
            />
          )}
          {activeView === 'invoices' && !selectedInvoiceId && (
            <InvoiceList 
              invoices={invoices} 
              onNewInvoice={() => { setSelectedInvoiceId('new'); setAutoPrint(false); }} 
              onEditInvoice={(id) => { setSelectedInvoiceId(id); setAutoPrint(false); }} 
              onDownloadInvoice={(id) => { setSelectedInvoiceId(id); setAutoPrint(true); }}
              onUpdateInvoice={handleUpdateInvoice}
              role={user.role}
              clients={clients}
              settings={settings}
            />
          )}
          {activeView === 'invoices' && selectedInvoiceId && (
            <InvoiceBuilder 
              invoiceId={selectedInvoiceId === 'new' ? null : selectedInvoiceId} 
              autoPrint={autoPrint}
              clients={clients} 
              invoices={invoices}
              onAddClient={handleAddClient}
              settings={settings}
              role={user.role}
              onSave={(newInv) => {
                handleUpdateInvoice(newInv);
                setSelectedInvoiceId(null);
                setAutoPrint(false);
              }}
              onCancel={() => { setSelectedInvoiceId(null); setAutoPrint(false); }}
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
              role={user.role} 
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
              role={user.role}
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
              role={user.role}
            />
          )}
          {activeView === 'statements' && isAdmin && (
            <Statements 
              invoices={invoices} 
              clients={clients} 
              settings={settings}
              onSelectInvoice={(id) => {
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
            />
          )}
          {activeView === 'settings' && isAdmin && (
            <Settings 
              settings={settings} 
              onUpdate={setSettings} 
              currentUser={user}
              users={users}
              onUpdateUsers={setUsers}
              onUpdateCurrentUser={handleUpdateCurrentUser}
              onRestoreData={handleRestoreAllData}
              language={language}
            />
          )}
        </div>
      </main>

      {/* Persistent Floating Gemini Chatbot Widget */}
      {activeView !== 'ai-helper' && (
        <FloatingAIChat 
          invoices={invoices}
          expenses={expenses}
          clients={clients}
          settings={settings}
        />
      )}
    </div>
  );
};

export default App;

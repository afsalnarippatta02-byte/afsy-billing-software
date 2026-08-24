import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  FileText, 
  Wallet, 
  ArrowDownCircle, 
  TrendingUp, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search, 
  ChevronRight, 
  X, 
  Eye, 
  Download, 
  Sparkles, 
  PieChart as PieIcon, 
  BarChart3, 
  Layers, 
  Building2,
  DollarSign,
  Filter,
  ArrowUpRight,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { 
  Invoice, 
  InvoiceStatus, 
  Expense, 
  ExpenseCategory, 
  UserRole, 
  Client, 
  CompanySettings, 
  View, 
  PaymentMethod 
} from '../types';
import { DEFAULT_EXPENSE_CATEGORIES } from '../constants';
import { isInvoiceOverdue, getDaysOverdue, formatMoney, formatMoneyCompact, getCurrencySymbol } from '../utils/currency';
import { LanguageCode, SUPPORTED_LANGUAGES, getTranslation } from '../utils/translations';

interface DashboardProps {
  invoices: Invoice[];
  expenses?: Expense[];
  categories?: string[];
  clients?: Client[];
  settings?: CompanySettings;
  role: UserRole;
  language?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onNavigateToView?: (view: View) => void;
  onNewInvoice?: () => void;
  onSelectInvoice?: (id: string) => void;
  onDownloadInvoice?: (id: string) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onAddExpense?: (expense: Expense) => void;
}

type TimeframeOption = 'all' | 'this_month' | 'last_30_days' | 'this_year' | 'q1_2026';
type ActiveModalType = 'revenue' | 'expenses' | 'profit' | 'invoices' | 'quick_expense' | null;

export const Dashboard: React.FC<DashboardProps> = ({ 
  invoices, 
  expenses = [], 
  categories = DEFAULT_EXPENSE_CATEGORIES,
  clients = [], 
  settings, 
  role,
  language = 'en',
  onLanguageChange,
  theme = 'light',
  onToggleTheme,
  onNavigateToView,
  onNewInvoice,
  onSelectInvoice,
  onDownloadInvoice,
  onUpdateInvoice,
  onAddExpense
}) => {
  const isAdmin = role === UserRole.ADMIN;
  const currencyCode = settings?.defaultCurrency || 'AED';
  const currSym = getCurrencySymbol(currencyCode);
  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);

  // States
  const [timeframe, setTimeframe] = useState<TimeframeOption>('all');
  const [activeChartTab, setActiveChartTab] = useState<'cashflow' | 'expenses_by_cat' | 'services'>('cashflow');
  const [recentFilter, setRecentFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  // Quick Add Expense State inside Dashboard
  const [quickExpDesc, setQuickExpDesc] = useState('');
  const [quickExpAmount, setQuickExpAmount] = useState<number | ''>('');
  const [quickExpCat, setQuickExpCat] = useState(categories[0] || 'General');
  const [quickExpDate, setQuickExpDate] = useState(new Date().toISOString().split('T')[0]);

  // Helper date filter
  const isDateInTimeframe = (dateStr: string) => {
    if (timeframe === 'all') return true;
    const itemDate = new Date(dateStr);
    const now = new Date();

    if (timeframe === 'this_month') {
      return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
    }
    if (timeframe === 'last_30_days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return itemDate >= thirtyDaysAgo && itemDate <= now;
    }
    if (timeframe === 'this_year') {
      return itemDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // Filtered dataset
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => isDateInTimeframe(inv.date));
  }, [invoices, timeframe]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => isDateInTimeframe(exp.date));
  }, [expenses, timeframe]);

  // Helper for invoice calculation
  const calculateInvoiceTotal = (inv: Invoice) => {
    const subtotal = inv.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const discountAmount = subtotal * (inv.discount / 100);
    const taxAmount = (subtotal - discountAmount) * (inv.taxRate / 100);
    return subtotal - discountAmount + taxAmount;
  };

  // 1. Gross Revenue (Paid Invoices Only)
  const grossRevenue = useMemo(() => {
    return filteredInvoices
      .filter(i => i.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
  }, [filteredInvoices]);

  // Total Invoiced Volume (Paid + Sent + Pending, excludes Quotations)
  const totalInvoicedVolume = useMemo(() => {
    return filteredInvoices
      .filter(i => i.status !== InvoiceStatus.QUOTATION)
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
  }, [filteredInvoices]);

  // 2. Total Operational Expenses
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  }, [filteredExpenses]);

  // 3. Net Operating Profit
  const netProfit = grossRevenue - totalExpenses;
  const profitMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;

  // 4. Pending Receivables & Overdue
  const pendingReceivables = useMemo(() => {
    return filteredInvoices
      .filter(i => (i.status === InvoiceStatus.SENT || isInvoiceOverdue(i)) && i.status !== InvoiceStatus.PAID && i.status !== InvoiceStatus.QUOTATION)
      .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
  }, [filteredInvoices]);

  const overdueInvoices = useMemo(() => {
    return filteredInvoices.filter(i => isInvoiceOverdue(i));
  }, [filteredInvoices]);

  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);
  const paidInvoicesCount = filteredInvoices.filter(i => i.status === InvoiceStatus.PAID).length;
  const pendingInvoicesCount = filteredInvoices.filter(i => (i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.OVERDUE) && i.status !== InvoiceStatus.PAID).length;
  const overdueInvoicesCount = overdueInvoices.length;

  // Monthly Chart Data Calculation
  const monthlyChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    return months.map((mName, mIdx) => {
      // Invoices paid in this month
      const monthRev = invoices
        .filter(i => {
          const d = new Date(i.paymentDate || i.date);
          return d.getFullYear() === currentYear && d.getMonth() === mIdx && i.status === InvoiceStatus.PAID;
        })
        .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);

      // Expenses in this month
      const monthExp = expenses
        .filter(e => {
          const d = new Date(e.date);
          return d.getFullYear() === currentYear && d.getMonth() === mIdx;
        })
        .reduce((sum, exp) => sum + Number(exp.amount), 0);

      return {
        name: mName,
        rev: monthRev,
        exp: monthExp,
        net: monthRev - monthExp
      };
    });
  }, [invoices, expenses]);

  // Expenses By Category Pie Data
  const expenseCatData = useMemo(() => {
    const catMap: { [cat: string]: number } = {};
    filteredExpenses.forEach(exp => {
      catMap[exp.category] = (catMap[exp.category] || 0) + Number(exp.amount);
    });

    const colors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
    return Object.keys(catMap).map((cat, idx) => ({
      name: cat,
      value: catMap[cat],
      color: colors[idx % colors.length]
    }));
  }, [filteredExpenses]);

  // Services Revenue Breakdown Bar Chart Data
  const serviceTypeData = useMemo(() => {
    const serviceMap: { [key: string]: number } = {
      'Production': 0,
      'Branding': 0,
      'Motion': 0,
      'Strategy': 0,
      'Post-Prod': 0
    };

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const desc = item.description.toLowerCase();
        const itemTot = item.quantity * item.rate;
        if (desc.includes('video') || desc.includes('shoot') || desc.includes('film') || desc.includes('commercial')) {
          serviceMap['Production'] += itemTot;
        } else if (desc.includes('brand') || desc.includes('identity') || desc.includes('logo') || desc.includes('design')) {
          serviceMap['Branding'] += itemTot;
        } else if (desc.includes('animation') || desc.includes('vfx') || desc.includes('3d') || desc.includes('motion')) {
          serviceMap['Motion'] += itemTot;
        } else if (desc.includes('edit') || desc.includes('color') || desc.includes('audio') || desc.includes('sound')) {
          serviceMap['Post-Prod'] += itemTot;
        } else {
          serviceMap['Strategy'] += itemTot;
        }
      });
    });

    return Object.keys(serviceMap).map(k => ({
      name: k,
      amount: serviceMap[k]
    }));
  }, [filteredInvoices]);

  // Recent Invoices Filter
  const displayedRecentInvoices = useMemo(() => {
    return [...filteredInvoices]
      .filter(inv => {
        if (recentFilter === 'all') return true;
        if (recentFilter === 'paid') return inv.status === InvoiceStatus.PAID;
        if (recentFilter === 'pending') return inv.status === InvoiceStatus.SENT || inv.status === InvoiceStatus.DRAFT;
        if (recentFilter === 'overdue') return isInvoiceOverdue(inv);
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7);
  }, [filteredInvoices, recentFilter]);

  const handleMarkAsPaid = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateInvoice) {
      onUpdateInvoice({
        ...inv,
        status: InvoiceStatus.PAID,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: PaymentMethod.BANK_TRANSFER
      });
    }
  };

  const handleQuickAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickExpDesc || !quickExpAmount) return;
    if (onAddExpense) {
      onAddExpense({
        id: `exp-${Date.now().toString(36)}`,
        description: quickExpDesc,
        amount: Number(quickExpAmount),
        category: quickExpCat as ExpenseCategory,
        date: quickExpDate,
        createdAt: new Date().toISOString()
      });
    }
    setQuickExpDesc('');
    setQuickExpAmount('');
    setActiveModal(null);
  };

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.company || 'Valued Client';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const currentLanguageObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Top Banner & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-darkcard p-5 rounded-2xl border border-slate-200 dark:border-darkborder shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('dashboard.title', 'Dashboard')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
            {t('dashboard.subtitle', 'Overview & Financial Summary')}
          </p>
        </div>

        {/* Timeframe & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            {[
              { id: 'all', label: t('dashboard.filter_all', 'All') },
              { id: 'this_month', label: t('dashboard.filter_month', 'Month') },
              { id: 'last_30_days', label: t('dashboard.filter_30_days', '30 Days') },
              { id: 'this_year', label: t('dashboard.filter_year', 'Year') }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTimeframe(tab.id as TimeframeOption)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  timeframe === tab.id
                    ? 'bg-white dark:bg-darkcard text-indigo-600 dark:text-indigo-400 shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* New Invoice Action */}
          {onNewInvoice && (
            <button
              onClick={onNewInvoice}
              className="bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all flex items-center space-x-1 shadow-xs active:scale-95"
            >
              <Plus size={15} />
              <span>{t('dashboard.new_invoice', 'New Invoice')}</span>
            </button>
          )}

          {/* Quick Add Expense Action */}
          <button
            onClick={() => setActiveModal('quick_expense')}
            className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-3 py-1.5 rounded-xl font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all flex items-center space-x-1"
          >
            <ArrowDownCircle size={14} />
            <span>{t('dashboard.log_expense', '+ Expense')}</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Card 1: Revenue */}
        <div
          onClick={() => setActiveModal('revenue')}
          role="button"
          tabIndex={0}
          className="bg-white dark:bg-darkcard p-5 rounded-2xl border border-slate-200 dark:border-darkborder shadow-xs hover:border-indigo-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('dashboard.gross_revenue', 'Revenue')}
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Wallet size={16} />
            </div>
          </div>
          <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatMoneyCompact(grossRevenue, currencyCode)}
          </h4>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{paidInvoicesCount} paid</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {totalInvoicedVolume > 0 ? `${Math.round((grossRevenue / totalInvoicedVolume) * 100)}% collected` : '100%'}
            </span>
          </div>
        </div>

        {/* Card 2: Expenses */}
        <div
          onClick={() => setActiveModal('expenses')}
          role="button"
          tabIndex={0}
          className="bg-white dark:bg-darkcard p-5 rounded-2xl border border-slate-200 dark:border-darkborder shadow-xs hover:border-rose-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('dashboard.total_expenses', 'Expenses')}
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <ArrowDownCircle size={16} />
            </div>
          </div>
          <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatMoneyCompact(totalExpenses, currencyCode)}
          </h4>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{filteredExpenses.length} entries</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">Total spend</span>
          </div>
        </div>

        {/* Card 3: Net Profit */}
        <div
          onClick={() => setActiveModal('profit')}
          role="button"
          tabIndex={0}
          className="bg-white dark:bg-darkcard p-5 rounded-2xl border border-slate-200 dark:border-darkborder shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('dashboard.net_profit', 'Net Profit')}
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <h4 className={`text-xl md:text-2xl font-black tracking-tight ${
            netProfit >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'
          }`}>
            {formatMoneyCompact(netProfit, currencyCode)}
          </h4>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Margin</span>
            <span className={`font-bold ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
              {profitMargin}%
            </span>
          </div>
        </div>

        {/* Card 4: Pending Invoices */}
        <div
          onClick={() => setActiveModal('invoices')}
          role="button"
          tabIndex={0}
          className="bg-white dark:bg-darkcard p-5 rounded-2xl border border-slate-200 dark:border-darkborder shadow-xs hover:border-amber-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('dashboard.pending_receivables', 'Pending')}
            </span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <FileText size={16} />
            </div>
          </div>
          <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatMoneyCompact(pendingReceivables, currencyCode)}
          </h4>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{pendingInvoicesCount} invoices</span>
            {overdueInvoicesCount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold">{overdueInvoicesCount} overdue</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-bold">On track</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-darkcard p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-darkborder shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {activeChartTab === 'cashflow' && 'Cash Flow'}
                {activeChartTab === 'expenses_by_cat' && 'Expenses by Category'}
                {activeChartTab === 'services' && 'Revenue by Service'}
              </h3>
            </div>

            {/* Chart switcher tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => setActiveChartTab('cashflow')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  activeChartTab === 'cashflow' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <TrendingUp size={13} /> <span>Flow</span>
              </button>
              <button
                onClick={() => setActiveChartTab('expenses_by_cat')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  activeChartTab === 'expenses_by_cat' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PieIcon size={13} /> <span>Categories</span>
              </button>
              <button
                onClick={() => setActiveChartTab('services')}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  activeChartTab === 'services' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 size={13} /> <span>Services</span>
              </button>
            </div>
          </div>

          {/* Chart Display Container */}
          <div className="h-80 w-full">
            {activeChartTab === 'cashflow' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip 
                    formatter={(value: any) => [formatMoney(Number(value), currencyCode), '']}
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a', borderRadius: '16px', color: '#fff', border: 'none', padding: '12px 16px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" name={`Revenue (${currencyCode})`} dataKey="rev" stroke="#4f46e5" strokeWidth={3.5} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" name={`Expenses (${currencyCode})`} dataKey="exp" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeChartTab === 'expenses_by_cat' && (
              <div className="h-full flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="h-full w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCatData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseCatData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [formatMoney(Number(v), currencyCode), 'Cost']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-2.5">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Category Totals</h4>
                  {expenseCatData.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-white">{formatMoney(cat.value, currencyCode)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeChartTab === 'services' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceTypeData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} interval={0} angle={-15} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(value: any) => [formatMoney(Number(value), currencyCode), 'Billed Volume']} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Action footer for charts */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Currency: <strong className="text-indigo-600 dark:text-indigo-400">{currencyCode}</strong> • Tax: <strong>{settings?.defaultTaxRate || 5}%</strong>
            </span>
            {onNavigateToView && (
              <button
                onClick={() => onNavigateToView('ai-helper')}
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
              >
                <Sparkles size={13} /> AI Forecast
              </button>
            )}
          </div>
        </div>

        {/* Right Col: Latest Invoices */}
        <div className="bg-white dark:bg-darkcard p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-darkborder shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {t('dashboard.recent_activity', 'Recent Invoices')}
              </h3>
              {onNavigateToView && (
                <button
                  onClick={() => onNavigateToView('invoices')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg transition-colors"
                >
                  View All
                </button>
              )}
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex items-center space-x-1 mb-4 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-[11px] font-bold">
              {(['all', 'paid', 'pending', 'overdue'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRecentFilter(tab)}
                  className={`flex-1 py-1 rounded-lg capitalize transition-all ${
                    recentFilter === tab ? 'bg-white dark:bg-darkcard text-indigo-600 dark:text-indigo-400 shadow-sm font-black' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Invoices List */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {displayedRecentInvoices.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs font-medium">
                  No invoices found matching criteria.
                </div>
              ) : (
                displayedRecentInvoices.map(inv => {
                  const total = calculateInvoiceTotal(inv);
                  const isPaid = inv.status === InvoiceStatus.PAID;
                  const isOverdue = isInvoiceOverdue(inv);
                  const daysOver = getDaysOverdue(inv);
                  const isQuotation = inv.status === InvoiceStatus.QUOTATION;

                  return (
                    <div
                      key={inv.id}
                      onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                      className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-500 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          isPaid ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : isOverdue ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                            <span>#{inv.id}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded-md uppercase font-black ${
                              isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : isOverdue ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}>
                              {isOverdue ? `Overdue (${daysOver}d)` : inv.status}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[130px]">
                            {getClientName(inv.clientId)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex items-center space-x-2 shrink-0">
                        <div>
                          <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                            {formatMoney(total, currencyCode)}
                          </p>
                          <span className="text-[9px] text-slate-400 font-bold block">
                            {formatDate(inv.date)}
                          </span>
                        </div>
                        {!isPaid && !isQuotation && (
                          <button
                            onClick={(e) => handleMarkAsPaid(inv, e)}
                            title="Quick Mark as Paid"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Quick Action Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onNavigateToView && onNavigateToView('statements')}
              className="w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 text-slate-700 dark:text-slate-300 hover:text-indigo-700 border border-slate-200 dark:border-slate-800 text-xs font-bold transition-all flex items-center justify-center space-x-1.5"
            >
              <span>Generate Client Statements of Account</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DRILL-DOWN MODALS */}
      {/* ========================================================================= */}

      {/* 1. GROSS REVENUE DRILL-DOWN MODAL */}
      {activeModal === 'revenue' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-darkcard rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-darkborder overflow-hidden">
            <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black">Gross Revenue Breakdown</h3>
                  <p className="text-xs text-slate-400 font-medium">All cleared & paid invoice collections in {currencyCode}</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-2xl">
                <div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Total Cleared</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{formatMoney(grossRevenue, currencyCode)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Paid Invoices</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{paidInvoicesCount} records</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Tax Portion ({settings?.defaultTaxRate || 5}%)</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{formatMoney(grossRevenue * ((settings?.defaultTaxRate || 5) / 100), currencyCode)}</span>
                </div>
              </div>

              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pt-2">Cleared Invoices</h4>
              <div className="space-y-2">
                {filteredInvoices.filter(i => i.status === InvoiceStatus.PAID).map(inv => (
                  <div key={inv.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">#{inv.id} • {getClientName(inv.clientId)}</p>
                      <p className="text-xs text-slate-500 font-medium">Paid Date: {formatDate(inv.paymentDate || inv.date)} • Method: {inv.paymentMethod || 'Bank Transfer'}</p>
                    </div>
                    <div className="text-right flex items-center space-x-3">
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatMoney(calculateInvoiceTotal(inv), currencyCode)}</span>
                      {onSelectInvoice && (
                        <button
                          onClick={() => { setActiveModal(null); onSelectInvoice(inv.id); }}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Filtered Timeframe: {timeframe.replace('_', ' ').toUpperCase()}</span>
              <button
                onClick={() => { setActiveModal(null); onNavigateToView && onNavigateToView('invoices'); }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors"
              >
                Go to Billing Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. TOTAL EXPENSES DRILL-DOWN MODAL */}
      {activeModal === 'expenses' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-darkcard rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-darkborder overflow-hidden">
            <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white">
                  <ArrowDownCircle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black">Expenses Breakdown</h3>
                  <p className="text-xs text-slate-400 font-medium">All logged agency operational costs ({currencyCode})</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4 p-4 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-2xl">
                <div>
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">Total Spent</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{formatMoney(totalExpenses, currencyCode)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">Transactions</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{filteredExpenses.length} receipts</span>
                </div>
              </div>

              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pt-2">Itemized Expenses</h4>
              <div className="space-y-2">
                {filteredExpenses.map(exp => (
                  <div key={exp.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{exp.description}</p>
                      <p className="text-xs text-slate-500 font-medium">{formatDate(exp.date)} • Category: <strong className="text-slate-700 dark:text-slate-300">{exp.category}</strong></p>
                    </div>
                    <span className="text-sm font-black text-rose-600">{formatMoney(exp.amount, currencyCode)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button
                onClick={() => { setActiveModal('quick_expense'); }}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50"
              >
                + Add Another Expense
              </button>
              <button
                onClick={() => { setActiveModal(null); onNavigateToView && onNavigateToView('expenses'); }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Open Full Expense Tracker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. NET PROFIT P&L SUMMARY MODAL */}
      {activeModal === 'profit' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-darkcard rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-darkborder overflow-hidden">
            <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black">Profit & Loss (P&L) Summary</h3>
                  <p className="text-xs text-slate-400 font-medium">Business net bottom line calculation in {currencyCode}</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-600 dark:text-slate-400">(+) Gross Revenue Collected</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400">{formatMoney(grossRevenue, currencyCode)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-600 dark:text-slate-400">(-) Total Operational Costs</span>
                  <span className="font-black text-rose-600 dark:text-rose-400">{formatMoney(totalExpenses, currencyCode)}</span>
                </div>
                <div className="pt-3 border-t-2 border-slate-200 dark:border-slate-700 flex justify-between items-center text-base">
                  <span className="font-black text-slate-900 dark:text-white">(=) Net Operating Profit</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{formatMoney(netProfit, currencyCode)}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-start space-x-3">
                <Sparkles size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-indigo-900 dark:text-indigo-300">Net Profit Margin: {profitMargin}%</p>
                  <p className="text-indigo-700 dark:text-indigo-400 mt-1">
                    Your operations are generating a positive margin. Real-time multi-currency tracking keeps exchange rates and accounts aligned.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ACTIVE INVOICES & RECEIVABLES MODAL */}
      {activeModal === 'invoices' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-darkcard rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-darkborder overflow-hidden">
            <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black">Pending & Overdue Receivables</h3>
                  <p className="text-xs text-slate-400 font-medium">Invoices awaiting payment collection in {currencyCode}</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-2xl">
                <div>
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block">Pending Volume</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{formatMoney(pendingReceivables, currencyCode)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest block">Awaiting Collection</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">{pendingInvoicesCount} invoices ({overdueInvoicesCount} overdue)</span>
                </div>
              </div>

              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pt-2">Outstanding Invoices</h4>
              <div className="space-y-2">
                {filteredInvoices.filter(i => (i.status === InvoiceStatus.SENT || isInvoiceOverdue(i)) && i.status !== InvoiceStatus.PAID && i.status !== InvoiceStatus.QUOTATION).map(inv => {
                  const overdue = isInvoiceOverdue(inv);
                  const daysOver = getDaysOverdue(inv);
                  return (
                    <div key={inv.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">#{inv.id}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                            overdue ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {overdue ? `OVERDUE (${daysOver}d)` : 'PENDING'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{getClientName(inv.clientId)} • Due: {formatDate(inv.dueDate)}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{formatMoney(calculateInvoiceTotal(inv), currencyCode)}</span>
                        <button
                          onClick={(e) => { handleMarkAsPaid(inv, e); }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          Mark Paid
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button
                onClick={() => { setActiveModal(null); onNewInvoice && onNewInvoice(); }}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-50"
              >
                + Create New Document
              </button>
              <button
                onClick={() => { setActiveModal(null); onNavigateToView && onNavigateToView('invoices'); }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Go to Invoices Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. QUICK ADD EXPENSE MODAL */}
      {activeModal === 'quick_expense' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-darkcard rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-darkborder overflow-hidden">
            <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white">
                  <ArrowDownCircle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black">Log Business Expense</h3>
                  <p className="text-xs text-slate-400 font-medium">Record new expense receipt ({currencyCode})</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuickAddExpense} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sony FX6 camera lens rental"
                  value={quickExpDesc}
                  onChange={e => setQuickExpDesc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">Amount ({currSym})</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="0"
                    value={quickExpAmount}
                    onChange={e => setQuickExpAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">Category</label>
                  <select
                    value={quickExpCat}
                    onChange={e => setQuickExpCat(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">Date</label>
                <input
                  type="date"
                  value={quickExpDate}
                  onChange={e => setQuickExpDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-md shadow-rose-200 dark:shadow-none"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

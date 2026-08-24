import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Tag, 
  Car,
  Utensils,
  MapPin,
  Camera,
  Layers,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Printer,
  FileSpreadsheet,
  Building2,
  CreditCard,
  Receipt,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  FolderPlus,
  Fuel,
  Loader2,
  Briefcase,
  AlertCircle,
  Edit2,
  Wallet
} from 'lucide-react';
import { Expense, CompanySettings, UserRole, Client } from '../types';
import { downloadElementAsPdf, printElementDirectly } from '../utils/pdfExport';
import { getCurrencySymbol, formatMoney } from '../utils/currency';

interface ExpenseTrackerProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  clients?: Client[];
  settings: CompanySettings;
  role: UserRole;
}

type SortField = 'date' | 'amount' | 'category' | 'vendor' | 'description';
type SortOrder = 'asc' | 'desc';
type DateRangeOption = 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'last_30_days' | 'this_year' | 'custom';

export const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({ 
  expenses, 
  setExpenses, 
  categories, 
  setCategories,
  clients = [],
  settings, 
  role 
}) => {
  const isAdmin = role === UserRole.ADMIN;
  const currencyCode = settings?.defaultCurrency || 'AED';
  const currencySymbol = getCurrencySymbol(currencyCode);

  // Utility to get today's date
  const getToday = () => new Date().toISOString().split('T')[0];

  // Filtering and Searching State
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('All');
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination & Page Size State (10, 20, 50, 100, or -1 for All)
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals & Panels
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportStatusMsg, setExportStatusMsg] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // New Category input states
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newCategoryError, setNewCategoryError] = useState('');
  const [inlineNewCategory, setInlineNewCategory] = useState('');
  const [showInlineCategoryInput, setShowInlineCategoryInput] = useState(false);

  // Add / Edit Form State
  const [formMode, setFormMode] = useState<'single' | 'itemized'>('single');
  const [formData, setFormData] = useState<{
    id?: string;
    date: string;
    category: string;
    description: string;
    vendor: string;
    amount: number | '';
    quantity: number;
    unitPrice: number | '';
    taxRatePercent: number; // 0, 5, etc.
    paymentMethod: string;
    receiptNumber: string;
    clientId: string;
    notes: string;
  }>({
    date: getToday(),
    category: categories[0] || 'Operations',
    description: '',
    vendor: '',
    amount: '',
    quantity: 1,
    unitPrice: '',
    taxRatePercent: 5,
    paymentMethod: 'Company Card',
    receiptNumber: '',
    clientId: '',
    notes: ''
  });

  // Category Icon Resolver
  const getCategoryIcon = (categoryName: string) => {
    const lower = (categoryName || '').toLowerCase();
    if (lower.includes('fuel') || lower.includes('petrol') || lower.includes('gas') || lower.includes('diesel')) {
      return <Fuel size={16} className="text-amber-500" />;
    }
    if (lower.includes('food') || lower.includes('meal') || lower.includes('catering') || lower.includes('dining')) {
      return <Utensils size={16} className="text-emerald-500" />;
    }
    if (lower.includes('taxi') || lower.includes('transport') || lower.includes('uber') || lower.includes('careem') || lower.includes('metro')) {
      return <Car size={16} className="text-blue-500" />;
    }
    if (lower.includes('equipment') || lower.includes('camera') || lower.includes('gear') || lower.includes('lens') || lower.includes('lighting')) {
      return <Camera size={16} className="text-purple-500" />;
    }
    if (lower.includes('travel') || lower.includes('flight') || lower.includes('hotel') || lower.includes('visa')) {
      return <MapPin size={16} className="text-rose-500" />;
    }
    if (lower.includes('marketing') || lower.includes('ads') || lower.includes('promotion')) {
      return <Layers size={16} className="text-indigo-500" />;
    }
    if (lower.includes('software') || lower.includes('subscription') || lower.includes('license') || lower.includes('app') || lower.includes('cloud')) {
      return <Briefcase size={16} className="text-cyan-500" />;
    }
    if (lower.includes('rent') || lower.includes('office') || lower.includes('studio') || lower.includes('utility')) {
      return <Building2 size={16} className="text-orange-500" />;
    }
    return <Tag size={16} className="text-slate-500" />;
  };

  // Category Color resolver
  const getCategoryBadgeClass = (categoryName: string) => {
    const lower = (categoryName || '').toLowerCase();
    if (lower.includes('fuel') || lower.includes('petrol')) return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    if (lower.includes('food') || lower.includes('meal')) return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    if (lower.includes('taxi') || lower.includes('transport')) return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    if (lower.includes('equipment') || lower.includes('camera')) return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    if (lower.includes('travel') || lower.includes('hotel')) return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    if (lower.includes('marketing') || lower.includes('ads')) return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    if (lower.includes('software') || lower.includes('license')) return 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
    if (lower.includes('rent') || lower.includes('office')) return 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  // Add Category Handler
  const handleAddNewCategory = (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) {
      setNewCategoryError('Category name cannot be empty');
      return false;
    }
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setNewCategoryError('This category already exists');
      return false;
    }

    const updated = [...categories, trimmed];
    setCategories(updated);
    setNewCategoryInput('');
    setInlineNewCategory('');
    setShowInlineCategoryInput(false);
    setNewCategoryError('');
    setFormData(prev => ({ ...prev, category: trimmed }));
    return true;
  };

  // Delete Category Handler
  const handleDeleteCategory = (catToDelete: string) => {
    if (!isAdmin) return;
    if (categories.length <= 1) {
      alert('You must keep at least one category.');
      return;
    }
    if (confirm(`Are you sure you want to remove the category "${catToDelete}"? Expenses assigned to it will remain preserved.`)) {
      setCategories(prev => prev.filter(c => c !== catToDelete));
      if (formData.category === catToDelete) {
        setFormData(prev => ({ ...prev, category: (categories || []).find(c => c !== catToDelete) || 'Other' }));
      }
    }
  };

  // Open Form to Add New Expense
  const handleOpenAddModal = (presetCategory?: string) => {
    setEditingExpenseId(null);
    setFormMode('single');
    setFormData({
      date: getToday(),
      category: presetCategory || (selectedCategory !== 'All' ? selectedCategory : (categories[0] || 'Operations')),
      description: '',
      vendor: '',
      amount: '',
      quantity: 1,
      unitPrice: '',
      taxRatePercent: 5,
      paymentMethod: 'Company Card',
      receiptNumber: '',
      clientId: '',
      notes: ''
    });
    setShowAddModal(true);
  };

  // Open Form to Edit Expense
  const handleOpenEditModal = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    const hasItemized = (exp.quantity && exp.quantity > 1) || exp.unitPrice;
    setFormMode(hasItemized ? 'itemized' : 'single');
    
    let taxPercent = 5;
    if (exp.taxAmount && exp.amount) {
      const net = exp.amount - exp.taxAmount;
      if (net > 0) {
        taxPercent = Math.round((exp.taxAmount / net) * 100);
      }
    }

    setFormData({
      id: exp.id,
      date: exp.date || getToday(),
      category: exp.category || 'Other',
      description: exp.description || '',
      vendor: exp.vendor || '',
      amount: exp.amount,
      quantity: exp.quantity || 1,
      unitPrice: exp.unitPrice || exp.amount,
      taxRatePercent: taxPercent,
      paymentMethod: (exp.paymentMethod as string) || 'Company Card',
      receiptNumber: exp.receiptNumber || '',
      clientId: exp.clientId || '',
      notes: exp.notes || ''
    });
    setShowAddModal(true);
  };

  // Save Expense
  const handleSaveExpense = () => {
    let finalAmount = 0;
    if (formMode === 'itemized') {
      const qty = Number(formData.quantity) || 1;
      const unit = Number(formData.unitPrice) || 0;
      finalAmount = qty * unit;
    } else {
      finalAmount = Number(formData.amount) || 0;
    }

    if (!formData.description.trim()) {
      alert('Please enter a description or purpose for the expense.');
      return;
    }
    if (finalAmount <= 0) {
      alert('Please enter a valid expense amount greater than 0.');
      return;
    }

    let calculatedTax = 0;
    if (formData.taxRatePercent > 0) {
      calculatedTax = parseFloat((finalAmount - (finalAmount / (1 + formData.taxRatePercent / 100))).toFixed(2));
    }

    if (editingExpenseId) {
      setExpenses(prev => prev.map(exp => {
        if (exp.id === editingExpenseId) {
          return {
            ...exp,
            date: formData.date || getToday(),
            category: formData.category,
            description: formData.description.trim(),
            vendor: formData.vendor.trim(),
            amount: finalAmount,
            quantity: formMode === 'itemized' ? formData.quantity : undefined,
            unitPrice: formMode === 'itemized' ? Number(formData.unitPrice) : undefined,
            taxAmount: calculatedTax,
            paymentMethod: formData.paymentMethod,
            receiptNumber: formData.receiptNumber.trim(),
            clientId: formData.clientId || undefined,
            notes: formData.notes.trim()
          };
        }
        return exp;
      }));
    } else {
      const newExp: Expense = {
        id: `exp-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
        date: formData.date || getToday(),
        category: formData.category,
        description: formData.description.trim(),
        vendor: formData.vendor.trim(),
        amount: finalAmount,
        currency: currencyCode,
        quantity: formMode === 'itemized' ? formData.quantity : undefined,
        unitPrice: formMode === 'itemized' ? Number(formData.unitPrice) : undefined,
        taxAmount: calculatedTax,
        paymentMethod: formData.paymentMethod,
        receiptNumber: formData.receiptNumber.trim(),
        clientId: formData.clientId || undefined,
        notes: formData.notes.trim()
      };
      setExpenses(prev => [newExp, ...prev]);
    }

    setShowAddModal(false);
  };

  // Delete Expense
  const handleDeleteExpense = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (confirm('Are you sure you want to delete this expense record?')) {
      setExpenses(prev => prev.filter(exp => exp.id !== id));
    }
  };

  // Duplicate Expense
  const handleDuplicateExpense = (exp: Expense, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup: Expense = {
      ...exp,
      id: `exp-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
      date: getToday(),
      description: `${exp.description} (Copy)`
    };
    setExpenses(prev => [dup, ...prev]);
  };

  // Date Range Checker
  const isDateInRange = (dateStr: string) => {
    if (dateRange === 'all') return true;
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === 'today') {
      return targetDate.toISOString().split('T')[0] === getToday();
    }
    if (dateRange === 'this_week') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return targetDate >= startOfWeek;
    }
    if (dateRange === 'this_month') {
      return targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() === today.getMonth();
    }
    if (dateRange === 'last_month') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return targetDate >= lastMonth && targetDate <= endLastMonth;
    }
    if (dateRange === 'last_30_days') {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return targetDate >= thirtyDaysAgo;
    }
    if (dateRange === 'this_year') {
      return targetDate.getFullYear() === today.getFullYear();
    }
    if (dateRange === 'custom') {
      if (customStartDate && targetDate < new Date(customStartDate)) return false;
      if (customEndDate && targetDate > new Date(customEndDate + 'T23:59:59')) return false;
      return true;
    }
    return true;
  };

  // Filtered & Sorted Expenses
  const filteredAndSortedExpenses = useMemo(() => {
    return expenses
      .filter(exp => {
        if (selectedCategory !== 'All' && exp.category !== selectedCategory) {
          return false;
        }
        if (!isDateInRange(exp.date)) {
          return false;
        }
        if (paymentMethodFilter !== 'All' && exp.paymentMethod !== paymentMethodFilter) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchDesc = (exp.description || '').toLowerCase().includes(q);
          const matchVendor = (exp.vendor || '').toLowerCase().includes(q);
          const matchCat = (exp.category || '').toLowerCase().includes(q);
          const matchRec = (exp.receiptNumber || '').toLowerCase().includes(q);
          const matchNotes = (exp.notes || '').toLowerCase().includes(q);
          if (!matchDesc && !matchVendor && !matchCat && !matchRec && !matchNotes) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'date') {
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (sortField === 'amount') {
          cmp = Number(a.amount) - Number(b.amount);
        } else if (sortField === 'category') {
          cmp = (a.category || '').localeCompare(b.category || '');
        } else if (sortField === 'vendor') {
          cmp = (a.vendor || '').localeCompare(b.vendor || '');
        } else if (sortField === 'description') {
          cmp = (a.description || '').localeCompare(b.description || '');
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [expenses, selectedCategory, dateRange, customStartDate, customEndDate, paymentMethodFilter, search, sortField, sortOrder]);

  // Overall and Category-Specific Aggregations
  const analytics = useMemo(() => {
    let totalSpend = 0;
    let totalVat = 0;
    const categoryTotals: Record<string, { total: number; count: number; vendors: Set<string> }> = {};

    categories.forEach(cat => {
      categoryTotals[cat] = { total: 0, count: 0, vendors: new Set() };
    });

    expenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      const vat = Number(exp.taxAmount) || 0;
      totalSpend += amt;
      totalVat += vat;

      const catName = exp.category || 'Other';
      if (!categoryTotals[catName]) {
        categoryTotals[catName] = { total: 0, count: 0, vendors: new Set() };
      }
      categoryTotals[catName].total += amt;
      categoryTotals[catName].count += 1;
      if (exp.vendor) {
        categoryTotals[catName].vendors.add(exp.vendor);
      }
    });

    const sortedCategoryBreakdown = Object.entries(categoryTotals)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        vendorCount: data.vendors.size,
        percentage: totalSpend > 0 ? ((data.total / totalSpend) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.total - a.total);

    let filteredTotal = 0;
    let filteredVat = 0;
    filteredAndSortedExpenses.forEach(exp => {
      filteredTotal += Number(exp.amount) || 0;
      filteredVat += Number(exp.taxAmount) || 0;
    });

    return {
      totalSpend,
      totalVat,
      sortedCategoryBreakdown,
      filteredTotal,
      filteredVat,
      filteredCount: filteredAndSortedExpenses.length
    };
  }, [expenses, categories, filteredAndSortedExpenses]);

  // Reset currentPage on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, dateRange, customStartDate, customEndDate, paymentMethodFilter, search, sortField, sortOrder, pageSize]);

  // Pagination Math
  const totalFilteredCount = filteredAndSortedExpenses.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const activePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = pageSize === -1 ? 0 : (activePage - 1) * pageSize;
  const endIndex = pageSize === -1 ? totalFilteredCount : Math.min(startIndex + pageSize, totalFilteredCount);

  const paginatedExpenses = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedExpenses;
    return filteredAndSortedExpenses.slice(startIndex, endIndex);
  }, [filteredAndSortedExpenses, startIndex, endIndex, pageSize]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (activePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (activePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', activePage - 1, activePage, activePage + 1, '...', totalPages];
  }, [totalPages, activePage]);

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Expense ID',
      'Category',
      'Description / Purpose',
      'Vendor / Merchant',
      `Amount (${currencyCode})`,
      `Tax Portion (${currencyCode})`,
      'Payment Method',
      'Receipt #',
      'Notes'
    ];

    const rows = filteredAndSortedExpenses.map(exp => [
      `"${exp.date}"`,
      `"${exp.id}"`,
      `"${exp.category}"`,
      `"${(exp.description || '').replace(/"/g, '""')}"`,
      `"${(exp.vendor || '').replace(/"/g, '""')}"`,
      exp.amount.toFixed(2),
      (exp.taxAmount || 0).toFixed(2),
      `"${exp.paymentMethod || 'N/A'}"`,
      `"${exp.receiptNumber || 'N/A'}"`,
      `"${(exp.notes || '').replace(/"/g, '""')}"`
    ]);

    rows.push([]);
    rows.push(['"TOTAL"', '""', '""', '""', '""', analytics.filteredTotal.toFixed(2), analytics.filteredVat.toFixed(2), '""', '""', '""']);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filenameCategory = selectedCategory !== 'All' ? selectedCategory.replace(/\s+/g, '-') : 'All-Expenses';
    link.setAttribute('download', `Expenses-${filenameCategory}-${getToday()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = async () => {
    if (!showPrintModal) {
      setShowPrintModal(true);
    }
    setIsExportingPdf(true);
    setExportStatusMsg('Preparing Expense Statement PDF...');

    setTimeout(async () => {
      const filenameCategory = selectedCategory !== 'All' ? selectedCategory.replace(/\s+/g, '-') : 'Business-Expenses';
      const filename = `Expenses-${filenameCategory}-${getToday()}`;
      await downloadElementAsPdf('expense-report-sheet', filename, (status, msg) => {
        if (msg) setExportStatusMsg(msg);
      });
      setTimeout(() => {
        setIsExportingPdf(false);
        setExportStatusMsg('');
      }, 1000);
    }, 400);
  };

  const handleDirectPrint = () => {
    if (!showPrintModal) {
      setShowPrintModal(true);
      setTimeout(() => {
        printElementDirectly('expense-report-sheet', `Expense Statement - ${selectedCategory !== 'All' ? selectedCategory : 'All Categories'}`);
      }, 300);
    } else {
      printElementDirectly('expense-report-sheet', `Expense Statement - ${selectedCategory !== 'All' ? selectedCategory : 'All Categories'}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Toast Notification */}
      {isExportingPdf && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl z-[100] flex items-center space-x-3 border border-slate-700 animate-in slide-in-from-bottom-3 no-print">
          <Loader2 size={18} className="animate-spin text-indigo-400" />
          <span className="text-xs font-bold">{exportStatusMsg || 'Generating Expense PDF...'}</span>
        </div>
      )}

      {/* Top Header & Main Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 dark:bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-100 dark:shadow-none">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Expense Ledger</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
              Track business expenses, fuel logs, operational spending, and receipts.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95"
            title="Manage categories"
          >
            <FolderPlus size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span>Categories</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95"
            title="Export CSV"
          >
            <FileSpreadsheet size={15} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isExportingPdf}
            className="flex items-center space-x-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Download PDF Statement"
          >
            {isExportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span className="hidden sm:inline">Download PDF</span>
          </button>

          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-100 dark:shadow-none active:scale-95"
          >
            <Plus size={16} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Category Spending Overview Cards */}
      <div className="no-print space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category Breakdown</h3>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">(Click to filter)</span>
          </div>
          {selectedCategory !== 'All' && (
            <button
              onClick={() => setSelectedCategory('All')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
            >
              <span>Show All</span>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* "All" Card */}
          <button
            onClick={() => setSelectedCategory('All')}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              selectedCategory === 'All'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 dark:shadow-none'
                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-xl ${selectedCategory === 'All' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                <Layers size={16} />
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${selectedCategory === 'All' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                {expenses.length} logs
              </span>
            </div>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${selectedCategory === 'All' ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>
                Total Spend
              </span>
              <span className={`text-base font-black tracking-tight ${selectedCategory === 'All' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                {formatMoney(analytics.totalSpend, currencyCode, 0)}
              </span>
            </div>
          </button>

          {/* Individual Category Cards */}
          {analytics.sortedCategoryBreakdown.map(cat => {
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group ${
                  isSelected
                    ? 'bg-slate-900 dark:bg-indigo-950 text-white border-slate-900 dark:border-indigo-800 shadow-md'
                    : 'bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/10 text-white' : 'bg-slate-50 dark:bg-slate-800'}`}>
                    {getCategoryIcon(cat.name)}
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {cat.percentage}%
                  </span>
                </div>

                <div>
                  <span className={`text-xs font-bold truncate block ${isSelected ? 'text-indigo-300' : 'text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                    {cat.name}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      {formatMoney(cat.total, currencyCode, 0)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      {cat.count} {cat.count === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Specific Active Banner */}
      {selectedCategory !== 'All' && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in no-print">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
              {getCategoryIcon(selectedCategory)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedCategory}
                </h4>
                <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {filteredAndSortedExpenses.length} Records
                </span>
              </div>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                Total: <strong className="font-black text-indigo-950 dark:text-white">{formatMoney(analytics.filteredTotal, currencyCode)}</strong>
                {analytics.filteredVat > 0 && <span className="ml-2">(Tax: {formatMoney(analytics.filteredVat, currencyCode)})</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleOpenAddModal(selectedCategory)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm"
            >
              <Plus size={14} />
              <span>Add {selectedCategory} Log</span>
            </button>
            <button
              onClick={() => setSelectedCategory('All')}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1"
            >
              <X size={14} />
              <span>Clear Filter</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter, Search, & Sort Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by description, vendor, receipt #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            {/* Date Range Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
              <Calendar size={13} className="text-slate-400" />
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value as DateRangeOption)}
                className="bg-transparent text-slate-800 dark:text-slate-200 outline-none cursor-pointer text-xs font-semibold"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Range */}
            {dateRange === 'custom' && (
              <div className="flex items-center space-x-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1.5 rounded-xl">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none"
                />
              </div>
            )}

            {/* Payment Method */}
            <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
              <CreditCard size={13} className="text-slate-400" />
              <select
                value={paymentMethodFilter}
                onChange={e => setPaymentMethodFilter(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 outline-none cursor-pointer text-xs font-semibold"
              >
                <option value="All">All Payment Methods</option>
                <option value="Company Card">Company Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online Payment">Online Payment</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
              <ArrowUpDown size={13} className="text-indigo-600 dark:text-indigo-400" />
              <select
                value={`${sortField}_${sortOrder}`}
                onChange={e => {
                  const [field, order] = e.target.value.split('_') as [SortField, SortOrder];
                  setSortField(field);
                  setSortOrder(order);
                }}
                className="bg-transparent text-slate-800 dark:text-slate-200 outline-none cursor-pointer text-xs font-semibold"
              >
                <option value="date_desc">Date: Newest First</option>
                <option value="date_asc">Date: Oldest First</option>
                <option value="amount_desc">Amount: High to Low</option>
                <option value="amount_asc">Amount: Low to High</option>
                <option value="category_asc">Category: A to Z</option>
                <option value="vendor_asc">Vendor: A to Z</option>
              </select>
            </div>

            {/* Page Size */}
            <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
              <SlidersHorizontal size={13} className="text-slate-400" />
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-800 dark:text-slate-200 outline-none cursor-pointer text-xs font-semibold"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={-1}>All records</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 select-none">
                <th 
                  onClick={() => handleSortClick('date')}
                  className="px-6 py-3.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Date</span>
                    {sortField === 'date' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSortClick('category')}
                  className="px-6 py-3.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Category</span>
                    {sortField === 'category' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSortClick('description')}
                  className="px-6 py-3.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Description & Details</span>
                    {sortField === 'description' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>

                <th 
                  onClick={() => handleSortClick('vendor')}
                  className="px-6 py-3.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Vendor / Payee</span>
                    {sortField === 'vendor' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>

                <th className="px-6 py-3.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Payment Method
                </th>

                <th 
                  onClick={() => handleSortClick('amount')}
                  className="px-6 py-3.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-end space-x-1.5">
                    <span>Amount</span>
                    {sortField === 'amount' ? (
                      sortOrder === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                </th>

                <th className="px-6 py-3.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedExpenses.length > 0 ? (
                paginatedExpenses.map(exp => {
                  return (
                    <tr 
                      key={exp.id} 
                      onClick={() => handleOpenEditModal(exp)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    >
                      {/* Date */}
                      <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{exp.date}</span>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="p-1 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            {getCategoryIcon(exp.category)}
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryBadgeClass(exp.category)}`}>
                            {exp.category}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-6 py-4 max-w-sm">
                        <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {exp.description}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                          {exp.quantity && exp.quantity > 1 && exp.unitPrice ? (
                            <span>{exp.quantity} units @ {formatMoney(exp.unitPrice, currencyCode)}</span>
                          ) : null}
                          {exp.taxAmount ? (
                            <span>Tax: {formatMoney(exp.taxAmount, currencyCode)}</span>
                          ) : null}
                          {exp.notes && (
                            <span className="truncate italic max-w-xs">• {exp.notes}</span>
                          )}
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {exp.vendor ? (
                          <div className="flex items-center space-x-1.5">
                            <Building2 size={13} className="text-slate-400" />
                            <span>{exp.vendor}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 font-normal">—</span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                          {exp.paymentMethod || 'Company Card'}
                        </span>
                        {exp.receiptNumber && (
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            #{exp.receiptNumber}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                          {formatMoney(exp.amount, currencyCode)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(exp)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDuplicateExpense(exp, e)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={(e) => handleDeleteExpense(exp.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <Search size={18} />
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No expense records found</p>
                      <p className="text-xs text-slate-400">Try changing your filters or record a new expense.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="bg-slate-50/90 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700/80 no-print">
          <div className="p-4 px-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
            <div>
              Showing <strong className="text-slate-900 dark:text-white">{totalFilteredCount === 0 ? 0 : startIndex + 1}–{endIndex}</strong> of <strong className="text-slate-900 dark:text-white">{totalFilteredCount}</strong> records
            </div>

            {/* Page Navigation */}
            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={activePage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={activePage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all flex items-center space-x-1"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                <div className="flex items-center space-x-1 px-1">
                  {paginationPages.map((p, idx) => {
                    if (p === '...') {
                      return <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">...</span>;
                    }
                    const pageNum = Number(p);
                    const isActive = pageNum === activePage;
                    return (
                      <button
                        key={`page-${pageNum}`}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={activePage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={activePage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Financial Totals Row */}
          <div className="p-4 px-6 bg-slate-50 dark:bg-slate-800/90 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
            <div>
              <span>Filtered Scope: <strong className="text-slate-800 dark:text-slate-200">{totalFilteredCount} transactions</strong></span>
            </div>

            <div className="flex items-center space-x-6">
              {analytics.filteredVat > 0 && (
                <span>Tax Portion: <strong className="text-slate-900 dark:text-white">{formatMoney(analytics.filteredVat, currencyCode)}</strong></span>
              )}
              <span className="text-sm">
                Total Spend: <strong className="text-rose-600 dark:text-rose-400 font-black">{formatMoney(analytics.filteredTotal, currencyCode)}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Record / Edit Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-md">
                  {editingExpenseId ? <Edit2 size={18} /> : <Plus size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingExpenseId ? 'Edit Expense Record' : 'Record Business Expense'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Log payments, fuel, rentals & operational costs</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Date & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Transaction Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowInlineCategoryInput(!showInlineCategoryInput)}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      + New
                    </button>
                  </div>

                  {showInlineCategoryInput ? (
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        placeholder="Category name"
                        value={inlineNewCategory}
                        onChange={e => setInlineNewCategory(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewCategory(inlineNewCategory);
                          }
                        }}
                        className="flex-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleAddNewCategory(inlineNewCategory)}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowInlineCategoryInput(false)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Item Description / Purpose <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Fuel refill, Equipment rental, Team Lunch, Office stationery..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Vendor & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Vendor / Merchant / Payee
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., ADNOC, Careem, Amazon, Sony"
                    value={formData.vendor}
                    onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="Company Card">Company Card / Debit</option>
                    <option value="Cash">Petty Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Online Payment">Online Payment</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Personal Reimbursement">Personal Reimbursement</option>
                  </select>
                </div>
              </div>

              {/* Amount Mode */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Amount & Pricing</span>
                  <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setFormMode('single')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        formMode === 'single' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-black' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Total Amount
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormMode('itemized');
                        if (!formData.unitPrice && formData.amount) {
                          setFormData(prev => ({ ...prev, unitPrice: prev.amount }));
                        }
                      }}
                      className={`px-3 py-1 rounded-md transition-all ${
                        formMode === 'itemized' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-black' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Qty × Rate
                    </button>
                  </div>
                </div>

                {formMode === 'single' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Total ({currencySymbol}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Tax / VAT Rate
                      </label>
                      <select
                        value={formData.taxRatePercent}
                        onChange={e => setFormData({ ...formData, taxRatePercent: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                      >
                        <option value={5}>5% Standard VAT</option>
                        <option value={0}>0% Exempt / Zero Rated</option>
                        <option value={18}>18% GST</option>
                        <option value={12}>12% GST</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Unit Rate ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.unitPrice}
                        onChange={e => setFormData({ ...formData, unitPrice: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Total
                      </label>
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center">
                        <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                          {formatMoney((Number(formData.quantity) || 1) * (Number(formData.unitPrice) || 0), currencyCode)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Receipt # & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Receipt / Invoice #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., REC-1029"
                    value={formData.receiptNumber}
                    onChange={e => setFormData({ ...formData, receiptNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Notes / Memo
                  </label>
                  <input
                    type="text"
                    placeholder="Optional remarks..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExpense}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-sm"
              >
                {editingExpenseId ? 'Save Changes' : 'Record Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <FolderPlus size={18} className="text-indigo-400" />
                <h3 className="text-base font-black">Manage Categories</h3>
              </div>
              <button 
                onClick={() => {
                  setShowCategoryManager(false);
                  setNewCategoryError('');
                }} 
                className="p-2 text-slate-400 hover:text-white rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Add New Category */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  New Category Name
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="e.g., Studio Utilities, Travel..."
                    value={newCategoryInput}
                    onChange={e => {
                      setNewCategoryInput(e.target.value);
                      setNewCategoryError('');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewCategory(newCategoryInput);
                      }
                    }}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => handleAddNewCategory(newCategoryInput)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                  >
                    Add
                  </button>
                </div>
                {newCategoryError && (
                  <p className="text-xs font-bold text-rose-600 flex items-center space-x-1">
                    <AlertCircle size={13} />
                    <span>{newCategoryError}</span>
                  </p>
                )}
              </div>

              {/* Active Categories List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Active Categories ({categories.length})
                </span>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-2 border border-slate-200 dark:border-slate-700">
                  {categories.map(cat => {
                    const count = expenses.filter(e => e.category === cat).length;
                    return (
                      <div key={cat} className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            {getCategoryIcon(cat)}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{cat}</span>
                            <span className="text-[10px] text-slate-400 block">{count} {count === 1 ? 'record' : 'records'}</span>
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowCategoryManager(false)}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print / PDF Export Preview Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black">
                  <Printer size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black">Expense Statement Preview</h3>
                  <p className="text-[11px] text-slate-400">Ready for PDF download or print</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownloadPDF}
                  disabled={isExportingPdf}
                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  <span>Save PDF</span>
                </button>
                <button
                  onClick={handleDirectPrint}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 hover:bg-indigo-700"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-100 dark:bg-slate-950 flex justify-center">
              <div id="expense-report-sheet" className="bg-white p-8 rounded-2xl shadow-md max-w-3xl w-full border border-slate-200 text-slate-800 space-y-6 print-container">
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900">{settings?.name || 'Company Accounts'}</h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{settings?.address || 'Business Location'}</p>
                    {settings?.vatNumber && <p className="text-xs text-slate-500 font-medium">TRN / Tax: {settings.vatNumber}</p>}
                  </div>
                  <div className="text-right">
                    <span className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg inline-block">
                      Expense Statement
                    </span>
                    <p className="text-xs font-bold text-slate-500 mt-1.5">Date: {new Date().toLocaleDateString()}</p>
                    <p className="text-xs font-bold text-indigo-600">Category: {selectedCategory !== 'All' ? selectedCategory : 'All Categories'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Spend</span>
                    <span className="text-sm font-black text-slate-900">{formatMoney(analytics.filteredTotal, currencyCode)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tax Portion</span>
                    <span className="text-sm font-black text-emerald-600">{formatMoney(analytics.filteredVat, currencyCode)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Logs</span>
                    <span className="text-sm font-black text-slate-900">{filteredAndSortedExpenses.length} Records</span>
                  </div>
                </div>

                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900 font-black uppercase text-[10px] text-slate-500">
                      <th className="py-2">Date</th>
                      <th className="py-2">Category</th>
                      <th className="py-2">Description</th>
                      <th className="py-2">Vendor</th>
                      <th className="py-2">Receipt #</th>
                      <th className="py-2 text-right">Amount ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {filteredAndSortedExpenses.map(exp => (
                      <tr key={exp.id}>
                        <td className="py-2 text-slate-600 font-bold">{exp.date}</td>
                        <td className="py-2 font-bold text-slate-800">{exp.category}</td>
                        <td className="py-2 text-slate-700">{exp.description}</td>
                        <td className="py-2 text-slate-600">{exp.vendor || '—'}</td>
                        <td className="py-2 font-mono text-[10px] text-slate-400">{exp.receiptNumber || '—'}</td>
                        <td className="py-2 text-right font-black text-slate-900">{formatMoney(exp.amount, currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-end text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Accounting Records</p>
                    <p className="text-slate-600 font-medium">Verified by Management</p>
                  </div>
                  <div className="text-right">
                    <div className="h-8 border-b border-slate-300 w-36"></div>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase block">Authorized Signature</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;

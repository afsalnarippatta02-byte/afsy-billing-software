import React, { useState, useMemo } from 'react';
import {
  Invoice,
  Client,
  InvoiceStatus,
  CompanySettings,
  PaymentMethod,
  Expense
} from '../types';
import {
  FileText,
  Download,
  Printer,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileSpreadsheet,
  ShieldCheck,
  Filter,
  X,
  CreditCard,
  Layers,
  Loader2,
  SlidersHorizontal,
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Wallet,
  Tag,
  Check,
  RotateCcw,
  CalendarRange,
  CalendarDays,
  ArrowUpDown
} from 'lucide-react';
import { downloadElementAsPdf, printElementDirectly, downloadDocumentAsHtml } from '../utils/pdfExport';
import { LanguageCode, getTranslation } from '../utils/translations';
import { isInvoiceOverdue, getCurrencySymbol } from '../utils/currency';

interface StatementsProps {
  invoices: Invoice[];
  clients: Client[];
  expenses?: Expense[];
  categories?: string[];
  settings?: CompanySettings;
  onSelectInvoice?: (id: string) => void;
  onUpdateInvoice?: (inv: Invoice) => void;
  language?: LanguageCode;
}

type DateFilterMode = 'all' | 'month_wise' | 'date_range' | 'today' | 'last_7_days' | 'last_30_days' | 'this_quarter' | 'this_year';
type StatusFilterMode = 'all' | 'paid' | 'unpaid' | 'overdue' | 'sent' | 'proforma' | 'draft';
type StatementTypeMode = 'invoices' | 'expenses' | 'combined';
type GroupingMode = 'chronological' | 'month_wise' | 'category_wise' | 'paid_unpaid_split';

const MONTH_NAMES = [
  { index: 0, short: 'Jan', full: 'January' },
  { index: 1, short: 'Feb', full: 'February' },
  { index: 2, short: 'Mar', full: 'March' },
  { index: 3, short: 'Apr', full: 'April' },
  { index: 4, short: 'May', full: 'May' },
  { index: 5, short: 'Jun', full: 'June' },
  { index: 6, short: 'Jul', full: 'July' },
  { index: 7, short: 'Aug', full: 'August' },
  { index: 8, short: 'Sep', full: 'September' },
  { index: 9, short: 'Oct', full: 'October' },
  { index: 10, short: 'Nov', full: 'November' },
  { index: 11, short: 'Dec', full: 'December' }
];

export const Statements: React.FC<StatementsProps> = ({
  invoices = [],
  clients = [],
  expenses = [],
  categories = [],
  settings,
  onSelectInvoice,
  onUpdateInvoice,
  language = 'en'
}) => {
  // 1. Scope & Statement Mode
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [statementType, setStatementType] = useState<StatementTypeMode>('invoices');
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('chronological');

  // 2. Date-Wise & Month-Wise Filter State
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('all');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]); // empty = all months in selected year
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // 3. Paid / Unpaid / Payment Method Filter State
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');

  // 4. Category-Based Filter State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 5. Statement Layout & Print/PDF Customization Options
  const [showCustomizerDrawer, setShowCustomizerDrawer] = useState<boolean>(false);
  const [customStatementTitle, setCustomStatementTitle] = useState<string>('STATEMENT OF ACCOUNT');
  const [showMonthSummaryInPdf, setShowMonthSummaryInPdf] = useState<boolean>(true);
  const [showCategorySummaryInPdf, setShowCategorySummaryInPdf] = useState<boolean>(true);
  const [showLineItemDetailsInPdf, setShowLineItemDetailsInPdf] = useState<boolean>(true);
  const [showRunningBalanceInPdf, setShowRunningBalanceInPdf] = useState<boolean>(true);
  const [showBankDetailsInPdf, setShowBankDetailsInPdf] = useState<boolean>(true);
  const [customFooterNote, setCustomFooterNote] = useState<string>(
    'Please remit any outstanding balance to the designated bank account and quote your Invoice ID as reference.'
  );

  // Modals & Export State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);
  const selectedClient = useMemo(
    () => (selectedClientId === 'ALL' ? null : clients.find(c => c.id === selectedClientId) || null),
    [clients, selectedClientId]
  );
  const currencySymbol = getCurrencySymbol(settings?.defaultCurrency || 'AED');

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Extract available years from invoices and expenses
  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    invoices.forEach(inv => {
      if (inv.date) {
        const y = parseInt(inv.date.split('-')[0], 10);
        if (!isNaN(y)) years.add(y);
      }
    });
    expenses.forEach(exp => {
      if (exp.date) {
        const y = parseInt(exp.date.split('-')[0], 10);
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices, expenses]);

  // Extract all available service categories (from invoices) and expense categories
  const availableServiceCategories = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        if (item.category && item.category.trim()) set.add(item.category.trim());
        if (item.service && item.service.trim()) set.add(item.service.trim());
      });
    });
    return Array.from(set).sort();
  }, [invoices]);

  const availableExpenseCategories = useMemo(() => {
    const set = new Set<string>(categories);
    expenses.forEach(exp => {
      if (exp.category && exp.category.trim()) set.add(exp.category.trim());
    });
    return Array.from(set).sort();
  }, [categories, expenses]);

  const allAvailableCategories = useMemo(() => {
    if (statementType === 'invoices') return availableServiceCategories;
    if (statementType === 'expenses') return availableExpenseCategories;
    return Array.from(new Set([...availableServiceCategories, ...availableExpenseCategories])).sort();
  }, [statementType, availableServiceCategories, availableExpenseCategories]);

  // Helper calculations for an invoice (with optional category filtering)
  const calculateInvoiceMetrics = (inv: Invoice, filterCats: string[]) => {
    const matchingItems =
      filterCats.length === 0
        ? inv.items || []
        : (inv.items || []).filter(
            it =>
              filterCats.includes(it.category || '') ||
              filterCats.includes(it.service || '')
          );

    const subtotal = matchingItems.reduce((s, i) => s + (i.quantity || 0) * (i.rate || 0), 0);
    const discount = subtotal * ((inv.discount || 0) / 100);
    const tax = (subtotal - discount) * ((inv.taxRate || 0) / 100);
    const total = subtotal - discount + tax;
    const itemCategories = Array.from(
      new Set(
        matchingItems
          .map(i => i.category || i.service || 'General Service')
          .filter(Boolean)
      )
    );

    return {
      subtotal,
      discount,
      tax,
      total,
      matchingItems,
      primaryCategory: itemCategories[0] || 'General Service',
      allCategories: itemCategories
    };
  };

  // Date matcher helper
  const matchesDateFilter = (dateStr: string): boolean => {
    if (!dateStr || dateFilterMode === 'all') return true;
    const docDate = new Date(dateStr + 'T00:00:00');
    if (isNaN(docDate.getTime())) return true;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilterMode === 'today') {
      return docDate.getTime() === todayStart.getTime();
    }
    if (dateFilterMode === 'last_7_days') {
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return docDate >= sevenDaysAgo && docDate <= todayStart;
    }
    if (dateFilterMode === 'last_30_days') {
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return docDate >= thirtyDaysAgo && docDate <= todayStart;
    }
    if (dateFilterMode === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      const qEnd = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59);
      return docDate >= qStart && docDate <= qEnd;
    }
    if (dateFilterMode === 'this_year') {
      return docDate.getFullYear() === now.getFullYear();
    }
    if (dateFilterMode === 'month_wise') {
      if (docDate.getFullYear() !== selectedYear) return false;
      if (selectedMonths.length === 0) return true;
      return selectedMonths.includes(docDate.getMonth());
    }
    if (dateFilterMode === 'date_range') {
      if (customStartDate) {
        const start = new Date(customStartDate + 'T00:00:00');
        if (docDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate + 'T23:59:59');
        if (docDate > end) return false;
      }
      return true;
    }
    return true;
  };

  // Status matcher for invoices
  const isEffectiveOverdue = (inv: Invoice) =>
    inv.status === InvoiceStatus.OVERDUE || isInvoiceOverdue(inv);

  const matchesInvoiceStatus = (inv: Invoice): boolean => {
    // Exclude Quotations unless user searches for them specifically
    if (inv.status === InvoiceStatus.QUOTATION) return false;

    // Exclude Proforma unless 'proforma' filter or 'all' is selected
    if (statusFilter === 'proforma') {
      return inv.status === InvoiceStatus.PROFORMA;
    }
    if (inv.status === InvoiceStatus.PROFORMA && statusFilter !== 'all') {
      return false;
    }

    if (statusFilter === 'paid') {
      return inv.status === InvoiceStatus.PAID;
    }
    if (statusFilter === 'unpaid') {
      return (
        inv.status !== InvoiceStatus.PAID &&
        inv.status !== InvoiceStatus.PROFORMA &&
        inv.status !== InvoiceStatus.QUOTATION
      );
    }
    if (statusFilter === 'overdue') {
      return isEffectiveOverdue(inv);
    }
    if (statusFilter === 'sent') {
      return inv.status === InvoiceStatus.SENT && !isEffectiveOverdue(inv);
    }
    if (statusFilter === 'draft') {
      return inv.status === InvoiceStatus.DRAFT;
    }
    return true;
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    if (statementType === 'expenses') return [];

    return invoices
      .filter(inv => {
        if (selectedClientId !== 'ALL' && inv.clientId !== selectedClientId) return false;
        if (!matchesInvoiceStatus(inv)) return false;
        if (!matchesDateFilter(inv.date)) return false;

        if (paymentMethodFilter !== 'ALL') {
          if ((inv.paymentMethod || '') !== paymentMethodFilter) return false;
        }

        // Category filter
        if (selectedCategories.length > 0) {
          const hasMatchingCategory = (inv.items || []).some(
            it =>
              selectedCategories.includes(it.category || '') ||
              selectedCategories.includes(it.service || '')
          );
          if (!hasMatchingCategory) return false;
        }

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const clientObj = clients.find(c => c.id === inv.clientId);
          const clientName = `${clientObj?.company || ''} ${clientObj?.name || ''}`.toLowerCase();
          const idMatch = inv.id.toLowerCase().includes(q);
          const itemMatch = (inv.items || []).some(
            i =>
              (i.description || '').toLowerCase().includes(q) ||
              (i.service || '').toLowerCase().includes(q) ||
              (i.category || '').toLowerCase().includes(q)
          );
          if (!idMatch && !itemMatch && !clientName.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return sortDirection === 'desc' ? diff : -diff;
      });
  }, [
    invoices,
    statementType,
    selectedClientId,
    statusFilter,
    dateFilterMode,
    selectedYear,
    selectedMonths,
    customStartDate,
    customEndDate,
    paymentMethodFilter,
    selectedCategories,
    searchQuery,
    sortDirection,
    clients
  ]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    if (statementType === 'invoices') return [];

    return expenses
      .filter(exp => {
        if (selectedClientId !== 'ALL' && exp.clientId && exp.clientId !== selectedClientId) {
          return false;
        }
        if (selectedClientId !== 'ALL' && !exp.clientId) {
          return false;
        }
        if (!matchesDateFilter(exp.date)) return false;

        if (paymentMethodFilter !== 'ALL') {
          if ((exp.paymentMethod || '') !== paymentMethodFilter) return false;
        }

        if (selectedCategories.length > 0) {
          if (!selectedCategories.includes(exp.category || '')) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            (exp.description || '').toLowerCase().includes(q) ||
            (exp.category || '').toLowerCase().includes(q) ||
            (exp.vendor || '').toLowerCase().includes(q) ||
            (exp.receiptNumber || '').toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return sortDirection === 'desc' ? diff : -diff;
      });
  }, [
    expenses,
    statementType,
    selectedClientId,
    dateFilterMode,
    selectedYear,
    selectedMonths,
    customStartDate,
    customEndDate,
    paymentMethodFilter,
    selectedCategories,
    searchQuery,
    sortDirection
  ]);

  // Aggregate KPI Statistics
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalOverdue = 0;
    let totalProforma = 0;
    let totalTax = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;
    let proformaCount = 0;

    filteredInvoices.forEach(inv => {
      const m = calculateInvoiceMetrics(inv, selectedCategories);
      if (inv.status === InvoiceStatus.PROFORMA) {
        totalProforma += m.total;
        proformaCount++;
        return;
      }

      totalInvoiced += m.total;
      totalTax += m.tax;

      if (inv.status === InvoiceStatus.PAID) {
        totalPaid += m.total;
        paidCount++;
      } else {
        totalUnpaid += m.total;
        unpaidCount++;
        if (isEffectiveOverdue(inv)) {
          totalOverdue += m.total;
          overdueCount++;
        }
      }
    });

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netCashflow = totalPaid - totalExpenses;

    return {
      totalInvoiced,
      totalPaid,
      totalUnpaid,
      totalOverdue,
      totalProforma,
      totalTax,
      paidCount,
      unpaidCount,
      overdueCount,
      proformaCount,
      totalExpenses,
      expenseCount: filteredExpenses.length,
      netCashflow,
      isFullySettled: filteredInvoices.length > 0 && totalUnpaid === 0
    };
  }, [filteredInvoices, filteredExpenses, selectedCategories]);

  // Month-Wise Summary Breakdown
  const monthWiseSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        label: string;
        sortKey: number;
        invoiceCount: number;
        invoiced: number;
        paid: number;
        unpaid: number;
        overdue: number;
        expenses: number;
        netCash: number;
        invoices: Invoice[];
      }
    >();

    filteredInvoices.forEach(inv => {
      if (inv.status === InvoiceStatus.PROFORMA) return;
      const d = new Date(inv.date + 'T00:00:00');
      if (isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[month]?.full || ''} ${year}`;
      const sortKey = year * 100 + month;

      if (!map.has(key)) {
        map.set(key, {
          monthKey: key,
          label,
          sortKey,
          invoiceCount: 0,
          invoiced: 0,
          paid: 0,
          unpaid: 0,
          overdue: 0,
          expenses: 0,
          netCash: 0,
          invoices: []
        });
      }

      const entry = map.get(key)!;
      const m = calculateInvoiceMetrics(inv, selectedCategories);
      entry.invoiceCount += 1;
      entry.invoiced += m.total;
      if (inv.status === InvoiceStatus.PAID) {
        entry.paid += m.total;
      } else {
        entry.unpaid += m.total;
        if (isEffectiveOverdue(inv)) {
          entry.overdue += m.total;
        }
      }
      entry.netCash = entry.paid - entry.expenses;
      entry.invoices.push(inv);
    });

    filteredExpenses.forEach(exp => {
      const d = new Date(exp.date + 'T00:00:00');
      if (isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[month]?.full || ''} ${year}`;
      const sortKey = year * 100 + month;

      if (!map.has(key)) {
        map.set(key, {
          monthKey: key,
          label,
          sortKey,
          invoiceCount: 0,
          invoiced: 0,
          paid: 0,
          unpaid: 0,
          overdue: 0,
          expenses: 0,
          netCash: 0,
          invoices: []
        });
      }

      const entry = map.get(key)!;
      entry.expenses += exp.amount || 0;
      entry.netCash = entry.paid - entry.expenses;
    });

    return Array.from(map.values()).sort((a, b) =>
      sortDirection === 'desc' ? b.sortKey - a.sortKey : a.sortKey - b.sortKey
    );
  }, [filteredInvoices, filteredExpenses, selectedCategories, sortDirection]);

  // Category-Wise Breakdown (Paid vs Unpaid per Category)
  const categoryWiseSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        type: 'Service / Revenue' | 'Operating Expense';
        count: number;
        totalAmount: number;
        paidAmount: number;
        unpaidAmount: number;
      }
    >();

    filteredInvoices.forEach(inv => {
      if (inv.status === InvoiceStatus.PROFORMA) return;
      const discountFactor = 1 - (inv.discount || 0) / 100;
      const taxFactor = 1 + (inv.taxRate || 0) / 100;

      (inv.items || []).forEach(item => {
        const cat = item.category || item.service || 'General Service';
        if (
          selectedCategories.length > 0 &&
          !selectedCategories.includes(item.category || '') &&
          !selectedCategories.includes(item.service || '')
        ) {
          return;
        }

        const itemGross = (item.quantity || 0) * (item.rate || 0) * discountFactor * taxFactor;
        const key = `REV:${cat}`;
        if (!map.has(key)) {
          map.set(key, {
            category: cat,
            type: 'Service / Revenue',
            count: 0,
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0
          });
        }
        const entry = map.get(key)!;
        entry.count += 1;
        entry.totalAmount += itemGross;
        if (inv.status === InvoiceStatus.PAID) {
          entry.paidAmount += itemGross;
        } else {
          entry.unpaidAmount += itemGross;
        }
      });
    });

    filteredExpenses.forEach(exp => {
      const cat = exp.category || 'Uncategorized Expense';
      const key = `EXP:${cat}`;
      if (!map.has(key)) {
        map.set(key, {
          category: cat,
          type: 'Operating Expense',
          count: 0,
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0
        });
      }
      const entry = map.get(key)!;
      entry.count += 1;
      entry.totalAmount += exp.amount || 0;
      entry.paidAmount += exp.amount || 0;
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredInvoices, filteredExpenses, selectedCategories]);

  // Human-readable active period description
  const activePeriodLabel = useMemo(() => {
    if (dateFilterMode === 'all') return 'All Time';
    if (dateFilterMode === 'today') return `Today (${formatDate(new Date().toISOString().split('T')[0])})`;
    if (dateFilterMode === 'last_7_days') return 'Last 7 Days';
    if (dateFilterMode === 'last_30_days') return 'Last 30 Days';
    if (dateFilterMode === 'this_quarter') return `Current Quarter (${new Date().getFullYear()})`;
    if (dateFilterMode === 'this_year') return `Full Year ${new Date().getFullYear()}`;
    if (dateFilterMode === 'month_wise') {
      if (selectedMonths.length === 0) return `All Months — ${selectedYear}`;
      const names = [...selectedMonths]
        .sort((a, b) => a - b)
        .map(m => MONTH_NAMES[m]?.short)
        .join(', ');
      return `${names} ${selectedYear}`;
    }
    if (dateFilterMode === 'date_range') {
      const from = customStartDate ? formatDate(customStartDate) : 'Start';
      const to = customEndDate ? formatDate(customEndDate) : 'Present';
      return `${from} to ${to}`;
    }
    return 'Custom Period';
  }, [dateFilterMode, selectedYear, selectedMonths, customStartDate, customEndDate]);

  const toggleMonthSelection = (monthIndex: number) => {
    setDateFilterMode('month_wise');
    setSelectedMonths(prev =>
      prev.includes(monthIndex) ? prev.filter(m => m !== monthIndex) : [...prev, monthIndex]
    );
  };

  const toggleCategorySelection = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleResetFilters = () => {
    setDateFilterMode('all');
    setSelectedMonths([]);
    setCustomStartDate('');
    setCustomEndDate('');
    setStatusFilter('all');
    setPaymentMethodFilter('ALL');
    setSelectedCategories([]);
    setSearchQuery('');
  };

  const handleQuickMarkPaid = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateInvoice) return;
    onUpdateInvoice({
      ...inv,
      status: InvoiceStatus.PAID,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: inv.paymentMethod || PaymentMethod.BANK_TRANSFER
    });
  };

  const handleExportCSV = () => {
    const scopeName = selectedClient
      ? (selectedClient.company || selectedClient.name).replace(/\s+/g, '_')
      : 'All_Clients';
    const headers = [
      'Record Type',
      'Document ID',
      'Date',
      'Due Date',
      'Client / Vendor',
      'Categories / Services',
      'Description',
      'Status',
      'Payment Method',
      `Subtotal (${currencySymbol})`,
      `Tax (${currencySymbol})`,
      `Total Amount (${currencySymbol})`,
      `Paid Amount (${currencySymbol})`,
      `Unpaid Balance (${currencySymbol})`
    ];

    const rows: any[][] = [];

    filteredInvoices.forEach(inv => {
      const m = calculateInvoiceMetrics(inv, selectedCategories);
      const c = clients.find(cl => cl.id === inv.clientId);
      const isPaid = inv.status === InvoiceStatus.PAID;
      rows.push([
        inv.status === InvoiceStatus.PROFORMA ? 'Proforma Invoice' : 'Tax Invoice',
        inv.id,
        formatDate(inv.date),
        formatDate(inv.dueDate),
        `"${(c?.company || c?.name || 'Client').replace(/"/g, '""')}"`,
        `"${m.allCategories.join('; ').replace(/"/g, '""')}"`,
        `"${m.matchingItems.map(i => i.description || i.service).join(' | ').replace(/"/g, '""')}"`,
        inv.status,
        inv.paymentMethod || 'N/A',
        m.subtotal.toFixed(2),
        m.tax.toFixed(2),
        m.total.toFixed(2),
        isPaid ? m.total.toFixed(2) : '0.00',
        !isPaid && inv.status !== InvoiceStatus.PROFORMA ? m.total.toFixed(2) : '0.00'
      ]);
    });

    filteredExpenses.forEach(exp => {
      rows.push([
        'Operating Expense',
        exp.receiptNumber || exp.id,
        formatDate(exp.date),
        '-',
        `"${(exp.vendor || 'Vendor').replace(/"/g, '""')}"`,
        `"${(exp.category || 'Expense').replace(/"/g, '""')}"`,
        `"${(exp.description || '').replace(/"/g, '""')}"`,
        'Paid Expense',
        exp.paymentMethod || 'Cash',
        exp.amount.toFixed(2),
        '0.00',
        exp.amount.toFixed(2),
        exp.amount.toFixed(2),
        '0.00'
      ]);
    });

    const csvContent = [
      `# ${customStatementTitle} - ${scopeName}`,
      `# Period: ${activePeriodLabel} | Status Filter: ${statusFilter.toUpperCase()} | Categories: ${selectedCategories.length ? selectedCategories.join(', ') : 'All'}`,
      headers.join(','),
      ...rows.map(r => r.join(',')),
      '',
      `SUMMARY TOTALS,,,,,,,,,Total Billed:,${stats.totalInvoiced.toFixed(2)},Paid:,${stats.totalPaid.toFixed(2)},Unpaid:,${stats.totalUnpaid.toFixed(2)}`
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Statement_${scopeName}_${activePeriodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
  };

  const handleDownloadStatementPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setExportMsg('Generating Customized Statement PDF...');

    const scopeName = selectedClient
      ? (selectedClient.company || selectedClient.name).replace(/\s+/g, '_')
      : 'Consolidated_Agency';

    setShowPrintModal(true);
    setTimeout(async () => {
      try {
        await downloadElementAsPdf(
          'printable-statement-area',
          `Statement_${scopeName}_${new Date().toISOString().split('T')[0]}.pdf`
        );
      } catch (err) {
        console.error('Statement PDF export error:', err);
      } finally {
        setIsExportingPdf(false);
        setExportMsg('');
      }
    }, 350);
  };

  const handleDownloadCertificatePdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setExportMsg('Generating Clearance Certificate PDF...');

    const scopeName = selectedClient
      ? (selectedClient.company || selectedClient.name).replace(/\s+/g, '_')
      : 'Consolidated_Agency';

    setShowCertificateModal(true);
    setTimeout(async () => {
      try {
        await downloadElementAsPdf(
          'printable-certificate-area',
          `Clearance_Certificate_${scopeName}.pdf`
        );
      } catch (err) {
        console.error('Certificate PDF export error:', err);
      } finally {
        setIsExportingPdf(false);
        setExportMsg('');
      }
    }, 350);
  };

  // Compute running balance for chronological ledger
  const ledgerWithRunningBalance = useMemo(() => {
    const asc = [...filteredInvoices].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let runningUnpaid = 0;
    const balanceMap = new Map<string, number>();
    asc.forEach(inv => {
      const m = calculateInvoiceMetrics(inv, selectedCategories);
      if (inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.PROFORMA) {
        runningUnpaid += m.total;
      }
      balanceMap.set(inv.id, runningUnpaid);
    });
    return balanceMap;
  }, [filteredInvoices, selectedCategories]);

  const activeFiltersCount =
    (dateFilterMode !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (paymentMethodFilter !== 'ALL' ? 1 : 0) +
    selectedCategories.length +
    (searchQuery.trim() ? 1 : 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Top Header & Statement Controls */}
      <div className="no-print flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-darkcard p-6 rounded-3xl border border-slate-200 dark:border-darkborder shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/50">
              Custom Statement Engine
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              • {activePeriodLabel}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            {t('statements.title', 'Statements & Custom Financial Ledgers')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            Customize statements date-wise, month-wise, paid/unpaid status, and service or expense category.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Client Scope Selector */}
          <div className="relative min-w-[230px]">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500" size={15} />
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">🌍 All Clients (Consolidated Statement)</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  🏢 {c.company || c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowCustomizerDrawer(!showCustomizerDrawer)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all border ${
              showCustomizerDrawer
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-none'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal size={15} />
            <span>Customize PDF Layout</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>CSV / Excel</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all shadow-sm"
          >
            <Printer size={15} />
            <span>Preview & Print</span>
          </button>

          <button
            onClick={handleDownloadStatementPdf}
            disabled={isExportingPdf}
            className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-60"
          >
            {isExportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span>{isExportingPdf && exportMsg ? exportMsg : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* PDF Layout Customizer Collapsible Drawer */}
      {showCustomizerDrawer && (
        <div className="no-print bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/50 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                Statement Document & PDF Customization Options
              </h3>
            </div>
            <button
              onClick={() => setShowCustomizerDrawer(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Statement Heading Title
              </label>
              <input
                type="text"
                value={customStatementTitle}
                onChange={e => setCustomStatementTitle(e.target.value)}
                placeholder="STATEMENT OF ACCOUNT"
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Custom Statement Footer / Payment Instructions
              </label>
              <input
                type="text"
                value={customFooterNote}
                onChange={e => setCustomFooterNote(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {[
              {
                label: 'Include Month-Wise Summary Table',
                checked: showMonthSummaryInPdf,
                onChange: setShowMonthSummaryInPdf
              },
              {
                label: 'Include Category Breakdown Table',
                checked: showCategorySummaryInPdf,
                onChange: setShowCategorySummaryInPdf
              },
              {
                label: 'Show Line-Item Descriptions & Categories',
                checked: showLineItemDetailsInPdf,
                onChange: setShowLineItemDetailsInPdf
              },
              {
                label: 'Show Running Balance Column',
                checked: showRunningBalanceInPdf,
                onChange: setShowRunningBalanceInPdf
              },
              {
                label: 'Show Bank Details & Stamp Block',
                checked: showBankDetailsInPdf,
                onChange: setShowBankDetailsInPdf
              }
            ].map((opt, idx) => (
              <label
                key={idx}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={opt.checked}
                  onChange={e => opt.onChange(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* MASTER CUSTOMIZATION & FILTER PANEL (Date-Wise, Month-Wise, Paid/Unpaid, Category-Based) */}
      <div className="no-print bg-white dark:bg-darkcard rounded-3xl border border-slate-200 dark:border-darkborder shadow-sm p-6 space-y-5">
        {/* Row 1: Statement Mode & Grouping View Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-darkborder">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
              Statement Mode:
            </span>
            {[
              { id: 'invoices', label: 'Client Invoices (Receivables)', icon: <FileText size={13} /> },
              { id: 'expenses', label: 'Operating Expenses', icon: <Wallet size={13} /> },
              { id: 'combined', label: 'Combined Cashflow & P&L', icon: <BarChart3 size={13} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatementType(tab.id as StatementTypeMode);
                  setSelectedCategories([]);
                }}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  statementType === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
              Group & View By:
            </span>
            {[
              { id: 'chronological', label: 'Date-Wise Ledger', icon: <Calendar size={13} /> },
              { id: 'month_wise', label: 'Month-Wise Summary', icon: <CalendarDays size={13} /> },
              { id: 'category_wise', label: 'Category Breakdown', icon: <PieChart size={13} /> },
              { id: 'paid_unpaid_split', label: 'Paid vs Unpaid Split', icon: <Layers size={13} /> }
            ].map(g => (
              <button
                key={g.id}
                onClick={() => setGroupingMode(g.id as GroupingMode)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  groupingMode === g.id
                    ? 'bg-slate-900 dark:bg-indigo-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {g.icon}
                <span>{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Date-Wise & Month-Wise Customization */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarRange size={15} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                1. Date-Wise & Month-Wise Period Filter
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'month_wise', label: 'Month-Wise Picker' },
                { id: 'date_range', label: 'Custom Date-Wise Range' },
                { id: 'today', label: 'Today' },
                { id: 'last_7_days', label: 'Last 7 Days' },
                { id: 'last_30_days', label: 'Last 30 Days' },
                { id: 'this_quarter', label: 'This Quarter' },
                { id: 'this_year', label: 'This Year' }
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setDateFilterMode(preset.id as DateFilterMode)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                    dateFilterMode === preset.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month-Wise Interactive Selector Bar */}
          {dateFilterMode === 'month_wise' && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-black uppercase text-slate-400">Year:</span>
                <div className="flex items-center space-x-1">
                  {availableYears.map(yr => (
                    <button
                      key={yr}
                      onClick={() => setSelectedYear(yr)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                        selectedYear === yr
                          ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                <button
                  onClick={() => setSelectedMonths([])}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                    selectedMonths.length === 0
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  All 12 Months
                </button>
                {MONTH_NAMES.map(m => {
                  const isSelected = selectedMonths.includes(m.index);
                  return (
                    <button
                      key={m.index}
                      onClick={() => toggleMonthSelection(m.index)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      {m.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Date-Wise Range Pickers */}
          {dateFilterMode === 'date_range' && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center gap-4 animate-in fade-in duration-200">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300">From Date:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300">To Date:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </div>

        {/* Row 3: Paid / Unpaid Status & Payment Method Filter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-100 dark:border-darkborder">
          <div className="lg:col-span-8 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                2. Paid / Unpaid Status Filter
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Statuses', badgeColor: 'bg-slate-900 text-white' },
                { id: 'paid', label: '✅ Paid Only (Settled)', badgeColor: 'bg-emerald-600 text-white' },
                { id: 'unpaid', label: '⏳ Unpaid (Pending + Overdue)', badgeColor: 'bg-rose-600 text-white' },
                { id: 'overdue', label: '🚨 Overdue Only', badgeColor: 'bg-red-600 text-white' },
                { id: 'sent', label: '📤 Sent / Awaiting Payment', badgeColor: 'bg-amber-500 text-white' },
                { id: 'proforma', label: '📄 Proforma Invoices', badgeColor: 'bg-purple-600 text-white' },
                { id: 'draft', label: '📝 Drafts', badgeColor: 'bg-slate-600 text-white' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id as StatusFilterMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    statusFilter === st.id
                      ? `${st.badgeColor} shadow-sm`
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-indigo-500" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Payment Method
              </span>
            </div>
            <select
              value={paymentMethodFilter}
              onChange={e => setPaymentMethodFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Payment Methods</option>
              {Object.values(PaymentMethod).map(pm => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 4: Category-Based Filter (Service Categories & Expense Categories) + Search */}
        <div className="pt-2 border-t border-slate-100 dark:border-darkborder space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag size={15} className="text-purple-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                3. Category-Based Filter ({statementType === 'expenses' ? 'Expense Categories' : 'Service & Billing Categories'})
              </span>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-[11px] font-bold text-indigo-600 hover:underline ml-2"
                >
                  Clear ({selectedCategories.length} selected)
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search ID, client, service, vendor..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                title="Toggle Date Sort Order"
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center space-x-1 hover:bg-slate-200"
              >
                <ArrowUpDown size={13} />
                <span>{sortDirection === 'desc' ? 'Newest' : 'Oldest'}</span>
              </button>

              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center space-x-1 hover:bg-rose-100"
                >
                  <RotateCcw size={13} />
                  <span>Reset ({activeFiltersCount})</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedCategories([])}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                selectedCategories.length === 0
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Categories
            </button>
            {allAvailableCategories.map(cat => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategorySelection(cat)}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {isSelected && <Check size={11} />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI SUMMARY CARDS (Dynamic based on Date, Month, Paid/Unpaid, Category filters) */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-darkcard p-5 rounded-3xl border border-slate-200 dark:border-darkborder shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Total Billed (Filtered)
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {currencySymbol} {stats.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            {filteredInvoices.filter(i => i.status !== InvoiceStatus.PROFORMA).length} finalized invoices • VAT: {currencySymbol} {stats.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-5 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
              Total Paid / Settled
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {currencySymbol} {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] font-bold text-emerald-600/80 dark:text-emerald-500 mt-1">
            {stats.paidCount} paid invoices ({stats.totalInvoiced > 0 ? Math.round((stats.totalPaid / stats.totalInvoiced) * 100) : 0}% collection rate)
          </p>
        </div>

        <div className="bg-rose-50/70 dark:bg-rose-950/20 p-5 rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest">
              Unpaid / Outstanding
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {currencySymbol} {stats.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] font-bold text-rose-600/80 dark:text-rose-400 mt-1">
            {stats.unpaidCount} unpaid ({stats.overdueCount} overdue: {currencySymbol} {stats.totalOverdue.toLocaleString(undefined, { maximumFractionDigits: 0 })})
          </p>
        </div>

        {statementType === 'invoices' ? (
          <div className="bg-purple-50/70 dark:bg-purple-950/20 p-5 rounded-3xl border border-purple-200 dark:border-purple-900/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">
                Proforma Pipeline
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-purple-700 dark:text-purple-300">
              {currencySymbol} {stats.totalProforma.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] font-bold text-purple-600/80 dark:text-purple-400 mt-1">
              {stats.proformaCount} active Proforma Invoices
            </p>
          </div>
        ) : (
          <div className="bg-amber-50/70 dark:bg-amber-950/20 p-5 rounded-3xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                Filtered Expenses & Net
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center">
                <Wallet size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {currencySymbol} {stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] font-bold text-amber-700/80 dark:text-amber-400 mt-1">
              {stats.expenseCount} expenses • Net Cash: {currencySymbol} {stats.netCashflow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        )}
      </div>

      {/* VIEW 1: MONTH-WISE SUMMARY TABLE (Always shown when groupingMode === 'month_wise') */}
      {groupingMode === 'month_wise' && (
        <div className="no-print bg-white dark:bg-darkcard rounded-3xl border border-slate-200 dark:border-darkborder shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-darkborder flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays size={18} className="text-indigo-600" />
                <span>Month-Wise Financial Statement Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly aggregation of billed amounts, paid collections, unpaid receivables, and expenses.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-xs font-black">
              {monthWiseSummary.length} Active Months
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="px-6 py-4">Month / Year</th>
                  <th className="px-6 py-4 text-center">Invoices</th>
                  <th className="px-6 py-4 text-right">Total Billed</th>
                  <th className="px-6 py-4 text-right text-emerald-600">Paid / Settled</th>
                  <th className="px-6 py-4 text-right text-rose-600">Unpaid Balance</th>
                  {statementType !== 'invoices' && (
                    <th className="px-6 py-4 text-right text-amber-600">Expenses</th>
                  )}
                  <th className="px-6 py-4 text-right">Collection %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-darkborder text-sm">
                {monthWiseSummary.map(row => {
                  const pct = row.invoiced > 0 ? Math.round((row.paid / row.invoiced) * 100) : 0;
                  return (
                    <tr key={row.monthKey} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                        {row.label}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">
                        {row.invoiceCount}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                        {currencySymbol} {row.invoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">
                        {currencySymbol} {row.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-rose-600">
                        {currencySymbol} {row.unpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {statementType !== 'invoices' && (
                        <td className="px-6 py-4 text-right font-black text-amber-600">
                          {currencySymbol} {row.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center space-x-2">
                          <div className="w-16 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {monthWiseSummary.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">
                      No monthly records match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: CATEGORY-WISE BREAKDOWN TABLE */}
      {groupingMode === 'category_wise' && (
        <div className="no-print bg-white dark:bg-darkcard rounded-3xl border border-slate-200 dark:border-darkborder shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-darkborder flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart size={18} className="text-purple-600" />
                <span>Category-Based Financial Breakdown (Paid vs. Unpaid)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Granular breakdown of billed services and expense categories with settled vs. pending totals.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 text-xs font-black">
              {categoryWiseSummary.length} Categories
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="px-6 py-4">Category Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-center">Entries</th>
                  <th className="px-6 py-4 text-right text-emerald-600">Paid / Settled</th>
                  <th className="px-6 py-4 text-right text-rose-600">Unpaid / Pending</th>
                  <th className="px-6 py-4 text-right">Total Category Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-darkborder text-sm">
                {categoryWiseSummary.map((row, idx) => (
                  <tr
                    key={`${row.category}_${idx}`}
                    onClick={() => toggleCategorySelection(row.category)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-black text-slate-900 dark:text-white flex items-center space-x-2">
                      <Tag size={14} className="text-purple-500" />
                      <span>{row.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                          row.type.includes('Revenue')
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">
                      {row.count}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600">
                      {currencySymbol} {row.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-rose-600">
                      {currencySymbol} {row.unpaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                      {currencySymbol} {row.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {categoryWiseSummary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">
                      No categories match the current filter selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: PAID VS UNPAID SPLIT VIEW */}
      {groupingMode === 'paid_unpaid_split' && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unpaid / Pending Column */}
          <div className="bg-white dark:bg-darkcard rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-sm overflow-hidden">
            <div className="p-5 bg-rose-50/60 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle size={18} className="text-rose-600" />
                <h3 className="text-sm font-black text-rose-950 dark:text-rose-200 uppercase tracking-wider">
                  Unpaid & Pending Invoices ({stats.unpaidCount})
                </h3>
              </div>
              <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                {currencySymbol} {stats.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-darkborder max-h-[500px] overflow-y-auto">
              {filteredInvoices
                .filter(i => i.status !== InvoiceStatus.PAID && i.status !== InvoiceStatus.PROFORMA)
                .map(inv => {
                  const m = calculateInvoiceMetrics(inv, selectedCategories);
                  const c = clients.find(cl => cl.id === inv.clientId);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-slate-900 dark:text-white text-sm">#{inv.id}</span>
                          <span className="text-xs font-bold text-slate-500">• {c?.company || c?.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Date: {formatDate(inv.date)} | Due: {formatDate(inv.dueDate)} | {m.allCategories.join(', ')}
                        </p>
                      </div>
                      <div className="text-right flex items-center space-x-3">
                        <div>
                          <p className="font-black text-rose-600 text-sm">
                            {currencySymbol} {m.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <span className="text-[10px] font-black uppercase text-rose-500">{inv.status}</span>
                        </div>
                        {onUpdateInvoice && (
                          <button
                            onClick={e => handleQuickMarkPaid(inv, e)}
                            title="Mark as Paid"
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-[10px] font-black transition-all"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              {stats.unpaidCount === 0 && (
                <div className="p-10 text-center text-slate-400 text-xs font-bold">
                  All filtered invoices are settled!
                </div>
              )}
            </div>
          </div>

          {/* Paid / Settled Column */}
          <div className="bg-white dark:bg-darkcard rounded-3xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm overflow-hidden">
            <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-200 uppercase tracking-wider">
                  Paid & Settled Invoices ({stats.paidCount})
                </h3>
              </div>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {currencySymbol} {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-darkborder max-h-[500px] overflow-y-auto">
              {filteredInvoices
                .filter(i => i.status === InvoiceStatus.PAID)
                .map(inv => {
                  const m = calculateInvoiceMetrics(inv, selectedCategories);
                  const c = clients.find(cl => cl.id === inv.clientId);
                  return (
                    <div
                      key={inv.id}
                      onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-slate-900 dark:text-white text-sm">#{inv.id}</span>
                          <span className="text-xs font-bold text-slate-500">• {c?.company || c?.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Date: {formatDate(inv.date)} | Paid via {inv.paymentMethod || 'Bank Transfer'} | {m.allCategories.join(', ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-600 text-sm">
                          {currencySymbol} {m.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[10px] font-black uppercase text-emerald-600">Settled</span>
                      </div>
                    </div>
                  );
                })}
              {stats.paidCount === 0 && (
                <div className="p-10 text-center text-slate-400 text-xs font-bold">
                  No paid invoices match the current filter criteria.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED TRANSACTION LEDGER TABLE */}
      <div className="no-print bg-white dark:bg-darkcard rounded-3xl border border-slate-200 dark:border-darkborder shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-darkborder flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Detailed Statement Ledger ({filteredInvoices.length + filteredExpenses.length} Records)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Showing {selectedClient ? selectedClient.company || selectedClient.name : 'All Clients'} • Period: {activePeriodLabel}
              </p>
            </div>
          </div>

          {stats.isFullySettled && selectedClient && (
            <button
              onClick={() => setShowCertificateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 transition-all shadow-sm"
            >
              <ShieldCheck size={15} />
              <span>Issue Clearance Certificate</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                <th className="px-6 py-4">Document / Ref</th>
                <th className="px-6 py-4">Client / Vendor</th>
                <th className="px-6 py-4">Issue Date</th>
                <th className="px-6 py-4">Categories & Line Items</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Billed / Expense</th>
                <th className="px-6 py-4 text-right text-emerald-600">Paid Amount</th>
                <th className="px-6 py-4 text-right text-rose-600">Unpaid Balance</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-darkborder text-sm">
              {filteredInvoices.map(inv => {
                const m = calculateInvoiceMetrics(inv, selectedCategories);
                const c = clients.find(cl => cl.id === inv.clientId);
                const isPaid = inv.status === InvoiceStatus.PAID;
                const isProforma = inv.status === InvoiceStatus.PROFORMA;
                const overdue = isEffectiveOverdue(inv);

                return (
                  <tr
                    key={inv.id}
                    onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                          #{inv.id}
                        </span>
                        <ExternalLink size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        Due: {formatDate(inv.dueDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        {c?.company || c?.name || 'Direct Client'}
                      </p>
                      {inv.paymentMethod && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {inv.paymentMethod}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">
                      {formatDate(inv.date)}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {m.allCategories.map(cat => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 text-[10px] font-black"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {m.matchingItems.map(i => i.description || i.service).join(', ')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : isProforma
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : overdue
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        <span>{overdue && !isPaid && !isProforma ? 'Overdue' : inv.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {currencySymbol} {m.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600 whitespace-nowrap">
                      {isPaid
                        ? `${currencySymbol} ${m.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-rose-600 whitespace-nowrap">
                      {!isPaid && !isProforma
                        ? `${currencySymbol} ${m.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {!isPaid && !isProforma && onUpdateInvoice ? (
                        <button
                          onClick={e => handleQuickMarkPaid(inv, e)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-[11px] font-black transition-all"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <button
                          onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          Open
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Expense Rows when statementType is expenses or combined */}
              {filteredExpenses.map(exp => (
                <tr key={exp.id} className="bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/40 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-black text-amber-800 dark:text-amber-300 text-xs">
                      EXP #{exp.receiptNumber || exp.id.slice(-6)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 text-xs">
                    {exp.vendor || 'Expense Vendor'}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-300 text-xs">
                    {formatDate(exp.date)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black mr-2">
                      {exp.category}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{exp.description}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                      Expense Paid
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-amber-700 dark:text-amber-400">
                    -{currencySymbol} {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-amber-700">
                    {currencySymbol} {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400">-</td>
                  <td className="px-6 py-4 text-right text-xs text-slate-400 font-bold">
                    {exp.paymentMethod || 'Cash'}
                  </td>
                </tr>
              ))}

              {filteredInvoices.length === 0 && filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <Filter size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-500 font-bold text-sm">
                      No statement records found for the selected Date, Status, or Category filters.
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black"
                    >
                      Reset All Statement Filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            {(filteredInvoices.length > 0 || filteredExpenses.length > 0) && (
              <tfoot className="bg-slate-900 text-white font-black text-sm">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-right uppercase tracking-wider text-xs text-slate-400">
                    Filtered Statement Totals ({activePeriodLabel}):
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {currencySymbol} {stats.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-400 whitespace-nowrap">
                    {currencySymbol} {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-rose-400 whitespace-nowrap">
                    {currencySymbol} {stats.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* PRINTABLE / PDF CUSTOMIZED STATEMENT MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
            <div className="no-print p-4 sm:p-6 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-3">
                <Printer className="text-indigo-400" size={20} />
                <div>
                  <span className="font-bold text-sm block">Customized A4 Statement Preview</span>
                  <span className="text-[11px] text-slate-400">
                    Period: {activePeriodLabel} • Status: {statusFilter.toUpperCase()} • Categories: {selectedCategories.length ? selectedCategories.join(', ') : 'All'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    downloadElementAsPdf(
                      'printable-statement-area',
                      `Statement_${selectedClient ? selectedClient.company : 'Consolidated'}_${new Date().toISOString().split('T')[0]}.pdf`
                    )
                  }
                  className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center space-x-2"
                >
                  <Download size={15} />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() =>
                    printElementDirectly(
                      'printable-statement-area',
                      `Statement_${selectedClient ? selectedClient.company : 'Consolidated'}`
                    )
                  }
                  className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-black text-xs hover:bg-emerald-700 transition-all flex items-center space-x-2"
                >
                  <Printer size={15} />
                  <span>Print Now</span>
                </button>
                <button
                  onClick={() =>
                    downloadDocumentAsHtml(
                      'printable-statement-area',
                      `Statement_${selectedClient ? selectedClient.company : 'Consolidated'}.html`,
                      customStatementTitle
                    )
                  }
                  className="bg-slate-700 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-slate-600 transition-all flex items-center space-x-1.5"
                >
                  <FileText size={14} />
                  <span>Save HTML</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
              <div
                id="printable-statement-area"
                className="bg-white text-slate-900 shadow-xl box-border flex flex-col justify-between"
                style={{ width: '210mm', minHeight: '297mm', padding: '14mm 16mm' }}
              >
                <div>
                  {/* Statement Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-5">
                    <div className="flex items-center space-x-4">
                      {settings?.logoUrl ? (
                        <img
                          src={settings.logoUrl}
                          alt={settings.name}
                          className="h-14 w-auto object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl">
                          Af
                        </div>
                      )}
                      <div>
                        <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                          {settings?.name || 'Af© ACCOUNTS'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-500 whitespace-pre-line">
                          {settings?.address || 'Dubai Media City, Dubai, UAE'}
                        </p>
                        <p className="text-[10px] font-black text-indigo-600 mt-0.5">
                          TRN: {settings?.vatNumber || '100234567890003'} | {settings?.email} | {settings?.phone}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                        {customStatementTitle || 'STATEMENT OF ACCOUNT'}
                      </h1>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">
                        Period: {activePeriodLabel}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                        Generated: {formatDate(new Date().toISOString().split('T')[0])}
                      </p>
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 text-[9px] font-black uppercase text-slate-700">
                        <span>Status: {statusFilter.toUpperCase()}</span>
                        {selectedCategories.length > 0 && (
                          <span>• Category: {selectedCategories.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Account To & Financial Summary Box */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                        Statement Prepared For
                      </p>
                      {selectedClient ? (
                        <>
                          <p className="text-sm font-black text-slate-900">{selectedClient.company}</p>
                          <p className="text-xs font-bold text-slate-600">{selectedClient.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{selectedClient.address}</p>
                          <p className="text-[10px] text-slate-600 font-bold mt-1">
                            {selectedClient.email} {selectedClient.phone ? `• ${selectedClient.phone}` : ''}
                          </p>
                          {selectedClient.trn && (
                            <p className="text-[10px] font-black text-indigo-600 mt-0.5">
                              Client TRN: {selectedClient.trn}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-black text-slate-900">
                            Consolidated Multi-Client Statement
                          </p>
                          <p className="text-xs font-bold text-slate-600 mt-0.5">
                            Includes {clients.length} Registered Client Accounts
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Filtered by: {activePeriodLabel} ({statusFilter.toUpperCase()})
                          </p>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                        <span className="text-[8px] font-black uppercase text-slate-400">Total Billed</span>
                        <span className="text-xs font-black text-slate-900">
                          {currencySymbol} {stats.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between">
                        <span className="text-[8px] font-black uppercase text-emerald-700">Paid / Settled</span>
                        <span className="text-xs font-black text-emerald-700">
                          {currencySymbol} {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-col justify-between">
                        <span className="text-[8px] font-black uppercase text-rose-700">Unpaid Balance</span>
                        <span className="text-xs font-black text-rose-700">
                          {currencySymbol} {stats.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Optional Month-Wise Summary in PDF */}
                  {showMonthSummaryInPdf && monthWiseSummary.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                        Month-Wise Statement Summary
                      </h4>
                      <table className="w-full text-left border-collapse border border-slate-200 text-[10px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-black uppercase">
                            <th className="py-1.5 px-3 border-b border-slate-200">Month</th>
                            <th className="py-1.5 px-3 border-b border-slate-200 text-center">Invoices</th>
                            <th className="py-1.5 px-3 border-b border-slate-200 text-right">Billed ({currencySymbol})</th>
                            <th className="py-1.5 px-3 border-b border-slate-200 text-right text-emerald-700">Paid ({currencySymbol})</th>
                            <th className="py-1.5 px-3 border-b border-slate-200 text-right text-rose-700">Unpaid ({currencySymbol})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {monthWiseSummary.map(m => (
                            <tr key={m.monthKey}>
                              <td className="py-1.5 px-3 font-bold">{m.label}</td>
                              <td className="py-1.5 px-3 text-center">{m.invoiceCount}</td>
                              <td className="py-1.5 px-3 text-right font-bold">{m.invoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-1.5 px-3 text-right font-bold text-emerald-700">{m.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-1.5 px-3 text-right font-bold text-rose-700">{m.unpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Optional Category-Wise Summary in PDF */}
                  {showCategorySummaryInPdf && categoryWiseSummary.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                        Category-Based Summary (Paid vs. Unpaid)
                      </h4>
                      <table className="w-full text-left border-collapse border border-slate-200 text-[10px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-black uppercase">
                            <th className="py-1.5 px-3 border-b border-slate-200">Category</th>
                            <th className="py-1.5 px-3 border-b border-slate-200 text-center">Items</th>
                            <th className="py-1.5 px-3 border-b border-slate-200 text-right text-emerald-700">Paid ({currencySymbol})</th>
                            <th className="py-1.5 px-3 border-b border-slate-200 text-right text-rose-700">Unpaid ({currencySymbol})</th>
                            <th className="py-1.5 px-3 border-b border-slate-200 text-right">Total ({currencySymbol})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {categoryWiseSummary.map((cat, i) => (
                            <tr key={i}>
                              <td className="py-1.5 px-3 font-bold">{cat.category}</td>
                              <td className="py-1.5 px-3 text-center">{cat.count}</td>
                              <td className="py-1.5 px-3 text-right font-bold text-emerald-700">{cat.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-1.5 px-3 text-right font-bold text-rose-700">{cat.unpaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-1.5 px-3 text-right font-black">{cat.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Detailed Chronological Statement Table */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      Itemized Statement Ledger
                    </h4>
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-slate-900 text-white font-black uppercase">
                          <th className="py-2 px-2.5">Date</th>
                          <th className="py-2 px-2.5">Invoice #</th>
                          {selectedClientId === 'ALL' && <th className="py-2 px-2.5">Client</th>}
                          {showLineItemDetailsInPdf && <th className="py-2 px-2.5">Category & Description</th>}
                          <th className="py-2 px-2.5 text-center">Status</th>
                          <th className="py-2 px-2.5 text-right">Billed</th>
                          <th className="py-2 px-2.5 text-right">Paid</th>
                          <th className="py-2 px-2.5 text-right">Unpaid</th>
                          {showRunningBalanceInPdf && <th className="py-2 px-2.5 text-right">Running Bal.</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredInvoices.map(inv => {
                          const m = calculateInvoiceMetrics(inv, selectedCategories);
                          const c = clients.find(cl => cl.id === inv.clientId);
                          const isPaid = inv.status === InvoiceStatus.PAID;
                          const runBal = ledgerWithRunningBalance.get(inv.id) || 0;

                          return (
                            <tr key={inv.id}>
                              <td className="py-2 px-2.5 whitespace-nowrap font-medium">{formatDate(inv.date)}</td>
                              <td className="py-2 px-2.5 font-black">#{inv.id}</td>
                              {selectedClientId === 'ALL' && (
                                <td className="py-2 px-2.5 font-bold">{c?.company || c?.name}</td>
                              )}
                              {showLineItemDetailsInPdf && (
                                <td className="py-2 px-2.5 max-w-[200px] truncate">
                                  <span className="font-bold text-indigo-700">[{m.allCategories.join(', ')}]</span>{' '}
                                  {m.matchingItems.map(i => i.description || i.service).join('; ')}
                                </td>
                              )}
                              <td className="py-2 px-2.5 text-center font-black uppercase">
                                <span className={isPaid ? 'text-emerald-700' : 'text-rose-600'}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold">
                                {m.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold text-emerald-700">
                                {isPaid ? m.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                              </td>
                              <td className="py-2 px-2.5 text-right font-bold text-rose-600">
                                {!isPaid && inv.status !== InvoiceStatus.PROFORMA
                                  ? m.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                  : '0.00'}
                              </td>
                              {showRunningBalanceInPdf && (
                                <td className="py-2 px-2.5 text-right font-black text-slate-900">
                                  {runBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Statement Footer & Bank Details */}
                <div className="pt-6 border-t-2 border-slate-900 mt-6">
                  {showBankDetailsInPdf && (
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <div className="text-[10px] space-y-0.5">
                        <p className="font-black uppercase text-slate-900 mb-1">Bank Remittance Details:</p>
                        <p><strong>Bank:</strong> {settings?.bankName || 'Emirates NBD'}</p>
                        <p><strong>Beneficiary:</strong> {settings?.beneficiaryName || settings?.name}</p>
                        <p><strong>IBAN:</strong> {settings?.iban || 'AE000000000000000000000'}</p>
                        <p><strong>Account #:</strong> {settings?.accountNumber || '-'}</p>
                      </div>
                      <div className="text-right flex flex-col justify-end items-end">
                        <div className="p-3 rounded-xl bg-slate-900 text-white inline-block min-w-[200px]">
                          <p className="text-[9px] font-bold uppercase text-slate-400">Net Balance Due</p>
                          <p className="text-base font-black">
                            {currencySymbol} {stats.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] font-bold text-slate-500 text-center">
                    {customFooterNote}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLEARANCE CERTIFICATE MODAL */}
      {showCertificateModal && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            <div className="no-print p-6 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <ShieldCheck size={22} />
                <span className="font-black text-sm">Financial Clearance Certificate</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDownloadCertificatePdf}
                  className="bg-white text-emerald-700 px-5 py-2 rounded-xl font-black text-xs hover:bg-emerald-50"
                >
                  Download PDF
                </button>
                <button onClick={() => setShowCertificateModal(false)} className="p-2 text-emerald-100 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div id="printable-certificate-area" className="p-12 text-center space-y-6 bg-white text-slate-900">
              <ShieldCheck size={48} className="mx-auto text-emerald-600" />
              <h1 className="text-2xl font-black uppercase tracking-tight">Certificate of Financial Clearance</h1>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                This certifies that <strong>{selectedClient.company}</strong> ({selectedClient.name}) has settled all finalized invoices for the period <strong>{activePeriodLabel}</strong> with zero outstanding balance due.
              </p>
              <div className="p-6 bg-emerald-50 rounded-2xl max-w-md mx-auto border border-emerald-200">
                <p className="text-xs font-black uppercase text-emerald-700">Total Cleared Volume</p>
                <p className="text-2xl font-black text-emerald-900 mt-1">
                  {currencySymbol} {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statements;

import React, { useState, useMemo, useEffect } from 'react';
import {
  Invoice,
  Client,
  InvoiceStatus,
  CompanySettings,
  PaymentMethod,
  Expense
} from '../types';
import {
  Download,
  Printer,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  RotateCcw,
  Loader2,
  ExternalLink,
  Check,
  ShieldCheck,
  X,
  PenTool,
  Stamp,
  FileText,
  LayoutTemplate
} from 'lucide-react';
import {
  downloadElementAsPdf,
  printElementDirectly,
  exportStatementToPdf,
  exportClearanceCertificateToPdf
} from '../utils/pdfExport';
import { STATEMENT_TEMPLATE_PRESETS } from '../constants';
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

type PeriodMode = 'all' | 'month' | 'date_range' | 'this_month' | 'this_year';
type StatusFilter = 'all' | 'paid' | 'unpaid' | 'overdue';
type StatementViewMode = 'date_wise' | 'month_wise' | 'category_wise';
type LedgerSourceMode = 'invoices' | 'expenses';

const MONTHS = [
  { value: 'ALL', label: 'All Months', short: '' },
  { value: '0', label: 'January', short: 'Jan' },
  { value: '1', label: 'February', short: 'Feb' },
  { value: '2', label: 'March', short: 'Mar' },
  { value: '3', label: 'April', short: 'Apr' },
  { value: '4', label: 'May', short: 'May' },
  { value: '5', label: 'June', short: 'Jun' },
  { value: '6', label: 'July', short: 'Jul' },
  { value: '7', label: 'August', short: 'Aug' },
  { value: '8', label: 'September', short: 'Sep' },
  { value: '9', label: 'October', short: 'Oct' },
  { value: '10', label: 'November', short: 'Nov' },
  { value: '11', label: 'December', short: 'Dec' }
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
  // Simple, clean filter states
  const [ledgerSource, setLedgerSource] = useState<LedgerSourceMode>('invoices');
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<StatementViewMode>(
    () => settings?.statementDefaultView || 'date_wise'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Statement Template & Format Customization State (synced with Settings + quick switcher)
  const [activeStmtTemplateId, setActiveStmtTemplateId] = useState<string>(
    () => settings?.statementTemplate || 'standard_audit'
  );

  useEffect(() => {
    if (settings?.statementTemplate) {
      setActiveStmtTemplateId(settings.statementTemplate);
    }
    if (settings?.statementDefaultView) {
      setViewMode(settings.statementDefaultView);
    }
    if (settings?.statementDefaultOrientation) {
      setPdfOrientation(settings.statementDefaultOrientation);
    }
  }, [
    settings?.statementTemplate,
    settings?.statementDefaultView,
    settings?.statementDefaultOrientation
  ]);

  const activeStmtPreset =
    STATEMENT_TEMPLATE_PRESETS.find(p => p.id === activeStmtTemplateId) ||
    STATEMENT_TEMPLATE_PRESETS[0];
  const isDefaultStmtSetting =
    activeStmtTemplateId === (settings?.statementTemplate || 'standard_audit');
  const stmtAccentColor = isDefaultStmtSetting
    ? settings?.statementAccentColor || activeStmtPreset.accentColor
    : activeStmtPreset.accentColor;
  const stmtHeaderLayout = isDefaultStmtSetting
    ? settings?.statementHeaderLayout || activeStmtPreset.headerLayout
    : activeStmtPreset.headerLayout;
  const stmtTableStyle = isDefaultStmtSetting
    ? settings?.statementTableStyle || activeStmtPreset.tableStyle
    : activeStmtPreset.tableStyle;
  const stmtCompact = isDefaultStmtSetting
    ? settings?.statementCompactMode ?? Boolean(activeStmtPreset.compactMode)
    : Boolean(activeStmtPreset.compactMode);
  const stmtShowSummaryBox = settings?.statementShowSummaryBox !== false;
  const stmtShowRemittance = settings?.statementShowRemittance !== false;
  const stmtCustomTitle = settings?.statementCustomTitle || 'STATEMENT OF ACCOUNT';

  // Separate Enable / Disable Auto-Apply States for Signature & Seal (synced with Settings)
  const [applySignature, setApplySignature] = useState<boolean>(
    () => settings?.autoApplySignature ?? Boolean(settings?.signatureUrl)
  );
  const [applySeal, setApplySeal] = useState<boolean>(
    () => settings?.autoApplySeal ?? Boolean(settings?.companySealUrl)
  );

  useEffect(() => {
    setApplySignature(settings?.autoApplySignature ?? Boolean(settings?.signatureUrl));
    setApplySeal(settings?.autoApplySeal ?? Boolean(settings?.companySealUrl));
  }, [
    settings?.autoApplySignature,
    settings?.autoApplySeal,
    settings?.signatureUrl,
    settings?.companySealUrl
  ]);

  // Export & Certificate Modal State
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfExportSuccess, setPdfExportSuccess] = useState<boolean>(false);
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isExportingCertificatePdf, setIsExportingCertificatePdf] = useState<boolean>(false);
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);
  const currencySymbol = getCurrencySymbol(settings?.defaultCurrency || 'AED');
  const currencyCode = settings?.defaultCurrency || 'AED';

  const selectedClient = useMemo(
    () => (selectedClientId === 'ALL' ? null : clients.find(c => c.id === selectedClientId) || null),
    [clients, selectedClientId]
  );

  // Format date clearly as Date Month Year (e.g., "08 Oct 2026")
  const formatDateMonthYear = (dateStr?: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parts[2].padStart(2, '0');
      const monthShort = MONTHS[monthIdx + 1]?.short || parts[1];
      return `${day} ${monthShort} ${year}`;
    }
    return dateStr;
  };

  const formatAmount = (amount: number) =>
    amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Available Years from data
  const availableYears = useMemo(() => {
    const years = new Set<string>([String(new Date().getFullYear())]);
    invoices.forEach(inv => {
      if (inv.date && inv.date.length >= 4) years.add(inv.date.substring(0, 4));
    });
    expenses.forEach(exp => {
      if (exp.date && exp.date.length >= 4) years.add(exp.date.substring(0, 4));
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [invoices, expenses]);

  // Available Categories based on whether user is viewing Invoices or Expenses
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    if (ledgerSource === 'invoices') {
      invoices.forEach(inv => {
        (inv.items || []).forEach(it => {
          if (it.category?.trim()) set.add(it.category.trim());
          else if (it.service?.trim()) set.add(it.service.trim());
        });
      });
    } else {
      categories.forEach(c => {
        if (c?.trim()) set.add(c.trim());
      });
      expenses.forEach(exp => {
        if (exp.category?.trim()) set.add(exp.category.trim());
      });
    }
    return Array.from(set).sort();
  }, [ledgerSource, invoices, expenses, categories]);

  // Calculate Invoice Amounts (respecting selected category filter if active)
  const calcInvoiceAmounts = (inv: Invoice, categoryFilter: string) => {
    const items =
      categoryFilter === 'ALL'
        ? inv.items || []
        : (inv.items || []).filter(
            it => it.category === categoryFilter || it.service === categoryFilter
          );

    const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.rate || 0), 0);
    const discount = subtotal * ((inv.discount || 0) / 100);
    const tax = (subtotal - discount) * ((inv.taxRate || 0) / 100);
    const total = subtotal - discount + tax;
    const isPaid = inv.status === InvoiceStatus.PAID;
    const isOverdue = inv.status === InvoiceStatus.OVERDUE || isInvoiceOverdue(inv);
    const paidAmount = isPaid ? total : 0;
    const balanceAmount = isPaid ? 0 : total;

    const categoryNames = Array.from(
      new Set(items.map(i => i.category || i.service || 'General Services').filter(Boolean))
    );
    const descriptionSummary = items
      .map(i => i.description || i.service || 'Service')
      .filter(Boolean)
      .join(', ');

    return {
      subtotal,
      discount,
      tax,
      total,
      paidAmount,
      balanceAmount,
      isPaid,
      isOverdue,
      primaryCategory: categoryNames[0] || 'General Services',
      categoryLabel: categoryNames.join(', ') || 'General Services',
      descriptionSummary: descriptionSummary || 'Commercial Invoice'
    };
  };

  // Check if a date matches the simple Period Filter
  const matchesPeriod = (dateStr?: string): boolean => {
    if (!dateStr || periodMode === 'all') return true;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return true;
    const now = new Date();

    if (periodMode === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (periodMode === 'this_year') {
      return d.getFullYear() === now.getFullYear();
    }
    if (periodMode === 'month') {
      if (String(d.getFullYear()) !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && String(d.getMonth()) !== selectedMonth) return false;
      return true;
    }
    if (periodMode === 'date_range') {
      if (startDate) {
        const s = new Date(startDate + 'T00:00:00');
        if (d < s) return false;
      }
      if (endDate) {
        const e = new Date(endDate + 'T23:59:59');
        if (d > e) return false;
      }
      return true;
    }
    return true;
  };

  // Filtered & Chronologically Sorted Invoices (Oldest to Newest for proper accounting ledger)
  const filteredInvoices = useMemo(() => {
    if (ledgerSource !== 'invoices') return [];

    return invoices
      .filter(inv => {
        if (
          inv.status === InvoiceStatus.QUOTATION ||
          inv.status === InvoiceStatus.PROFORMA ||
          inv.status === InvoiceStatus.DRAFT
        ) {
          return false;
        }

        if (selectedClientId !== 'ALL' && inv.clientId !== selectedClientId) return false;
        if (!matchesPeriod(inv.date)) return false;

        const isPaid = inv.status === InvoiceStatus.PAID;
        const isOverdue = inv.status === InvoiceStatus.OVERDUE || isInvoiceOverdue(inv);

        if (statusFilter === 'paid' && !isPaid) return false;
        if (statusFilter === 'unpaid' && isPaid) return false;
        if (statusFilter === 'overdue' && !isOverdue) return false;

        if (selectedCategory !== 'ALL') {
          const hasCat = (inv.items || []).some(
            it => it.category === selectedCategory || it.service === selectedCategory
          );
          if (!hasCat) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const cl = clients.find(c => c.id === inv.clientId);
          const clientText = `${cl?.company || ''} ${cl?.name || ''}`.toLowerCase();
          const idMatch = inv.id.toLowerCase().includes(q);
          const itemMatch = (inv.items || []).some(
            i =>
              (i.description || '').toLowerCase().includes(q) ||
              (i.service || '').toLowerCase().includes(q) ||
              (i.category || '').toLowerCase().includes(q)
          );
          if (!idMatch && !itemMatch && !clientText.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [
    ledgerSource,
    invoices,
    clients,
    selectedClientId,
    periodMode,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    statusFilter,
    selectedCategory,
    searchQuery
  ]);

  // Filtered Expenses (when Expense Statement mode is selected)
  const filteredExpenses = useMemo(() => {
    if (ledgerSource !== 'expenses') return [];

    return expenses
      .filter(exp => {
        if (selectedClientId !== 'ALL' && exp.clientId !== selectedClientId) return false;
        if (!matchesPeriod(exp.date)) return false;
        if (selectedCategory !== 'ALL' && exp.category !== selectedCategory) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            (exp.description || '').toLowerCase().includes(q) ||
            (exp.vendor || '').toLowerCase().includes(q) ||
            (exp.category || '').toLowerCase().includes(q) ||
            (exp.receiptNumber || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [
    ledgerSource,
    expenses,
    selectedClientId,
    periodMode,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    selectedCategory,
    searchQuery
  ]);

  // Standard Accounting Ledger Rows
  const ledgerRows = useMemo(() => {
    if (ledgerSource === 'expenses') {
      let runningTotal = 0;
      return filteredExpenses.map(exp => {
        const amt = Number(exp.amount) || 0;
        runningTotal += amt;
        return {
          id: exp.id,
          refNumber: exp.receiptNumber || exp.id.toUpperCase(),
          date: exp.date,
          dueDate: '',
          partyName: exp.vendor || 'Operating Vendor',
          category: exp.category || 'Operations',
          description: exp.description || 'Business Expense',
          statusLabel: 'Paid',
          isPaid: true,
          isOverdue: false,
          debitAmount: amt,
          creditAmount: amt,
          balanceAmount: 0,
          runningBalance: runningTotal,
          rawInvoice: undefined as Invoice | undefined
        };
      });
    }

    let runningBalance = 0;
    return filteredInvoices.map(inv => {
      const m = calcInvoiceAmounts(inv, selectedCategory);
      const cl = clients.find(c => c.id === inv.clientId);
      runningBalance += m.balanceAmount;

      return {
        id: inv.id,
        refNumber: inv.id,
        date: inv.date,
        dueDate: inv.dueDate,
        partyName: cl?.company || cl?.name || 'Client',
        category: m.categoryLabel,
        description: m.descriptionSummary,
        statusLabel: m.isPaid ? 'Paid' : m.isOverdue ? 'Overdue' : 'Unpaid',
        isPaid: m.isPaid,
        isOverdue: m.isOverdue,
        debitAmount: m.total,
        creditAmount: m.paidAmount,
        balanceAmount: m.balanceAmount,
        runningBalance,
        rawInvoice: inv
      };
    });
  }, [ledgerSource, filteredInvoices, filteredExpenses, clients, selectedCategory]);

  // Summary Totals
  const summary = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    ledgerRows.forEach(row => {
      totalInvoiced += row.debitAmount;
      totalPaid += row.creditAmount;
      totalBalance += row.balanceAmount;
    });

    return {
      count: ledgerRows.length,
      totalInvoiced,
      totalPaid,
      totalBalance
    };
  }, [ledgerRows]);

  // Month-Wise Grouped Sections (preserving individual rows with full Date-Month-Year under "Invoice Date")
  const monthWiseGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        monthLabel: string;
        rows: typeof ledgerRows;
        invoiced: number;
        paid: number;
        balance: number;
      }
    >();

    ledgerRows.forEach(row => {
      const d = new Date(row.date + 'T00:00:00');
      const y = isNaN(d.getTime()) ? 'Unknown' : String(d.getFullYear());
      const mIdx = isNaN(d.getTime()) ? 0 : d.getMonth();
      const key = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
      const label = isNaN(d.getTime())
        ? formatDateMonthYear(row.date)
        : `${MONTHS[mIdx + 1]?.label || ''} ${y}`;

      const curr = map.get(key) || {
        monthKey: key,
        monthLabel: label,
        rows: [],
        invoiced: 0,
        paid: 0,
        balance: 0
      };
      curr.rows.push(row);
      curr.invoiced += row.debitAmount;
      curr.paid += row.creditAmount;
      curr.balance += row.balanceAmount;
      map.set(key, curr);
    });

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [ledgerRows]);

  // Category-Wise Grouped Sections (also showing full Date-Month-Year under "Invoice Date")
  const categoryWiseRows = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        latestDate: string;
        count: number;
        invoiced: number;
        paid: number;
        balance: number;
      }
    >();

    ledgerRows.forEach(row => {
      const cat = row.category || 'General Services';
      const curr = map.get(cat) || {
        category: cat,
        latestDate: row.date,
        count: 0,
        invoiced: 0,
        paid: 0,
        balance: 0
      };
      curr.count += 1;
      curr.latestDate = row.date;
      curr.invoiced += row.debitAmount;
      curr.paid += row.creditAmount;
      curr.balance += row.balanceAmount;
      map.set(cat, curr);
    });

    return Array.from(map.values()).sort((a, b) => b.invoiced - a.invoiced);
  }, [ledgerRows]);

  // Human-Readable Statement Period Label
  const periodLabel = useMemo(() => {
    if (periodMode === 'all') {
      if (ledgerRows.length > 0) {
        return `${formatDateMonthYear(ledgerRows[0].date)} to ${formatDateMonthYear(
          ledgerRows[ledgerRows.length - 1].date
        )}`;
      }
      return 'All Dates';
    }
    if (periodMode === 'this_month') {
      const now = new Date();
      return `${MONTHS[now.getMonth() + 1]?.label} ${now.getFullYear()}`;
    }
    if (periodMode === 'this_year') {
      return `01 Jan ${new Date().getFullYear()} – 31 Dec ${new Date().getFullYear()}`;
    }
    if (periodMode === 'month') {
      const mName = MONTHS.find(m => m.value === selectedMonth)?.label || 'All Months';
      return `${mName} ${selectedYear}`;
    }
    if (periodMode === 'date_range') {
      const from = startDate ? formatDateMonthYear(startDate) : 'Beginning';
      const to = endDate ? formatDateMonthYear(endDate) : 'Today';
      return `${from} – ${to}`;
    }
    return 'All Dates';
  }, [periodMode, selectedYear, selectedMonth, startDate, endDate, ledgerRows]);

  const hasActiveFilters =
    selectedClientId !== 'ALL' ||
    periodMode !== 'all' ||
    statusFilter !== 'all' ||
    selectedCategory !== 'ALL' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedClientId('ALL');
    setPeriodMode('all');
    setSelectedMonth('ALL');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setSelectedCategory('ALL');
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

  const handleDownloadPdf = async (orientationOverride?: 'portrait' | 'landscape') => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfExportSuccess(false);
    const scopeName = selectedClient
      ? (selectedClient.company || selectedClient.name).replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'All_Clients';
    const filename = `Statement_of_Account_${scopeName}_${new Date().toISOString().split('T')[0]}.pdf`;
    try {
      const ok = await exportStatementToPdf({
        ledgerSource,
        viewMode,
        selectedClient,
        periodLabel,
        statusFilter,
        selectedCategory,
        searchQuery,
        currencyCode,
        currencySymbol,
        settings,
        applySignature,
        applySeal,
        summary,
        ledgerRows,
        monthWiseGroups,
        categoryWiseRows,
        orientation: orientationOverride || pdfOrientation,
        filename,
        accentColor: stmtAccentColor,
        customTitle: stmtCustomTitle
      });
      if (ok) {
        setPdfExportSuccess(true);
        setTimeout(() => setPdfExportSuccess(false), 2600);
      }
    } catch (e) {
      console.error('Statement jsPDF export error, falling back to DOM PDF capture:', e);
      await downloadElementAsPdf('standard-statement-sheet', filename);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadCertificatePdf = async () => {
    if (isExportingCertificatePdf) return;
    setIsExportingCertificatePdf(true);
    try {
      await exportClearanceCertificateToPdf({
        selectedClient,
        periodLabel,
        totalInvoiced: summary.totalInvoiced,
        currencyCode,
        currencySymbol,
        settings,
        applySignature,
        applySeal
      });
    } catch (e) {
      console.error('Clearance certificate PDF error:', e);
    } finally {
      setIsExportingCertificatePdf(false);
    }
  };

  const handlePrint = () => {
    const scopeName = selectedClient
      ? selectedClient.company || selectedClient.name
      : 'All Clients';
    printElementDirectly('standard-statement-sheet', `Statement of Account - ${scopeName}`);
  };

  const handleExportCsv = () => {
    const scopeName = selectedClient
      ? (selectedClient.company || selectedClient.name).replace(/\s+/g, '_')
      : 'All_Clients';

    const headers = [
      'Invoice Date',
      'Reference #',
      'Client / Party',
      'Category',
      'Description',
      'Status',
      `Invoiced / Debit (${currencySymbol})`,
      `Paid / Credit (${currencySymbol})`,
      `Balance (${currencySymbol})`
    ];

    const rows = ledgerRows.map(r => [
      `"${formatDateMonthYear(r.date)}"`,
      r.refNumber,
      `"${r.partyName.replace(/"/g, '""')}"`,
      `"${r.category.replace(/"/g, '""')}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.statusLabel,
      r.debitAmount.toFixed(2),
      r.creditAmount.toFixed(2),
      (ledgerSource === 'invoices' ? r.runningBalance : r.balanceAmount).toFixed(2)
    ]);

    const csv = [
      `STATEMENT OF ACCOUNT - ${selectedClient ? selectedClient.company || selectedClient.name : 'CONSOLIDATED'}`,
      `Period: ${periodLabel} | Status: ${statusFilter.toUpperCase()} | Category: ${selectedCategory}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
      '',
      `TOTAL,,,,,Total Invoiced,${summary.totalInvoiced.toFixed(2)},${summary.totalPaid.toFixed(2)},${summary.totalBalance.toFixed(2)}`
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Statement_${scopeName}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-16">
      {/* ===================================================================== */}
      {/* SIMPLE, CLEAN TOP ACTION BAR & STREAMLINED FILTER BAR (NO-PRINT)      */}
      {/* ===================================================================== */}
      <div className="no-print bg-white dark:bg-darkcard rounded-2xl border border-slate-200 dark:border-darkborder shadow-xs p-4 sm:p-5 space-y-4">
        {/* Top Row: Title + Ledger Type + Export Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-darkborder">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('statements.title', 'Statement of Account')}
            </h1>

            {/* Simple Toggle: Client Invoices vs Expenses */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setLedgerSource('invoices');
                  setSelectedCategory('ALL');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  ledgerSource === 'invoices'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Client Statement
              </button>
              <button
                type="button"
                onClick={() => {
                  setLedgerSource('expenses');
                  setSelectedCategory('ALL');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  ledgerSource === 'expenses'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Expense Statement
              </button>
            </div>
          </div>

          {/* Export / Print Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Statement Template Selector */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <LayoutTemplate size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <select
                value={activeStmtTemplateId}
                onChange={e => setActiveStmtTemplateId(e.target.value)}
                title="Select Statement Template Format"
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                {STATEMENT_TEMPLATE_PRESETS.map(tp => (
                  <option key={tp.id} value={tp.id} className="bg-white dark:bg-slate-900">
                    Template: {tp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Separate & Combined Signature + Seal Quick Toggles */}
            <button
              type="button"
              onClick={() => setApplySignature(!applySignature)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                applySignature
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
              title="Enable or Disable Authorized Signature on Statement"
            >
              <PenTool size={13} />
              <span>Signature: {applySignature ? 'On' : 'Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => setApplySeal(!applySeal)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                applySeal
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
              title="Enable or Disable Official Company Seal on Statement"
            >
              <Stamp size={13} />
              <span>Seal: {applySeal ? 'On' : 'Off'}</span>
            </button>

            {ledgerSource === 'invoices' && summary.totalBalance === 0 && summary.count > 0 && (
              <button
                type="button"
                onClick={() => setShowCertificateModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors"
              >
                <ShieldCheck size={14} />
                <span>Clearance Certificate</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Excel / CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            {/* PDF Page Orientation + Direct jsPDF Export Control */}
            <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              <select
                value={pdfOrientation}
                onChange={e => setPdfOrientation(e.target.value as 'portrait' | 'landscape')}
                title="PDF Page Orientation"
                className="bg-transparent px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="portrait" className="bg-white dark:bg-slate-900">
                  A4 Portrait
                </option>
                <option value="landscape" className="bg-white dark:bg-slate-900">
                  A4 Landscape
                </option>
              </select>
              <button
                type="button"
                onClick={() => handleDownloadPdf()}
                disabled={isExportingPdf}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-black shadow-xs transition-colors disabled:opacity-50 ${
                  pdfExportSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isExportingPdf ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : pdfExportSuccess ? (
                  <Check size={14} />
                ) : (
                  <Download size={14} />
                )}
                <span>
                  {isExportingPdf
                    ? 'Exporting PDF...'
                    : pdfExportSuccess
                    ? 'PDF Downloaded'
                    : 'Export PDF'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Simple 1-Row Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* 1. Client / Account Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              1. Client Account
            </label>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Clients (Consolidated)</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Date / Month Period Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              2. Statement Period
            </label>
            <select
              value={periodMode}
              onChange={e => setPeriodMode(e.target.value as PeriodMode)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Dates</option>
              <option value="this_month">This Month</option>
              <option value="month">Select Month &amp; Year</option>
              <option value="date_range">Custom Date Range</option>
              <option value="this_year">This Year ({new Date().getFullYear()})</option>
            </select>
          </div>

          {/* 3. Payment Status (All / Paid / Unpaid / Overdue) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              3. Payment Status
            </label>
            <div className="grid grid-cols-4 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              {[
                { id: 'all', label: 'All' },
                { id: 'paid', label: 'Paid' },
                { id: 'unpaid', label: 'Unpaid' },
                { id: 'overdue', label: 'Overdue' }
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  disabled={ledgerSource === 'expenses'}
                  onClick={() => setStatusFilter(st.id as StatusFilter)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    statusFilter === st.id
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  } disabled:opacity-40`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              4. Category
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Statement View Mode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              5. Statement View
            </label>
            <select
              value={viewMode}
              onChange={e => setViewMode(e.target.value as StatementViewMode)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="date_wise">Date-Wise Standard Ledger</option>
              <option value="month_wise">Month-Wise Grouped Ledger</option>
              <option value="category_wise">Category-Wise Summary</option>
            </select>
          </div>
        </div>

        {/* Conditional Inline Sub-Row ONLY when Month Picker or Date Range or Search is needed */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            {periodMode === 'month' && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-500">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-bold text-slate-500 ml-1">Year:</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'date_range' && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-500">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
                <span className="text-xs font-bold text-slate-500">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Quick search invoice #, description..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 transition-colors shrink-0"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* OFFICIAL ACCOUNTING-STANDARD STATEMENT OF ACCOUNT SHEET               */}
      {/* ===================================================================== */}
      <div
        id="standard-statement-sheet"
        className={`bg-white text-slate-900 rounded-2xl border shadow-sm ${
          stmtCompact ? 'p-5 sm:p-7 md:p-9 space-y-5' : 'p-6 sm:p-10 md:p-12 space-y-8'
        } print:shadow-none print:border-none print:p-0 ${
          activeStmtTemplateId === 'classic_boxed'
            ? 'border-2 border-slate-800'
            : 'border-slate-200/90'
        }`}
      >
        {/* 1. STANDARD CORPORATE HEADER */}
        <div
          style={
            stmtHeaderLayout === 'banner'
              ? { backgroundColor: stmtAccentColor }
              : { borderBottomColor: stmtAccentColor }
          }
          className={`flex flex-col gap-6 pb-6 border-b-2 ${
            stmtHeaderLayout === 'banner'
              ? 'p-6 sm:p-8 rounded-2xl text-white border-b-0 sm:flex-row justify-between items-start'
              : stmtHeaderLayout === 'centered'
              ? 'items-center text-center'
              : stmtHeaderLayout === 'reversed'
              ? 'sm:flex-row-reverse justify-between items-start'
              : 'sm:flex-row justify-between items-start'
          }`}
        >
          {/* Company Branding & Legal Details */}
          <div
            className={`flex items-start gap-4 ${
              stmtHeaderLayout === 'centered' ? 'flex-col items-center text-center' : ''
            }`}
          >
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.name || 'Company Logo'}
                className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1 bg-white shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                style={{
                  backgroundColor:
                    stmtHeaderLayout === 'banner' ? 'rgba(255,255,255,0.2)' : stmtAccentColor
                }}
                className="w-14 h-14 rounded-lg text-white flex items-center justify-center font-black text-lg shrink-0"
              >
                Af
              </div>
            )}
            <div className="space-y-0.5">
              <h2
                className={`text-lg sm:text-xl font-black tracking-tight uppercase ${
                  stmtHeaderLayout === 'banner' ? 'text-white' : 'text-slate-900'
                }`}
              >
                {settings?.name || 'AF© CREATIVE FLOW'}
              </h2>
              {settings?.address && (
                <p
                  className={`text-xs whitespace-pre-line leading-relaxed max-w-sm ${
                    stmtHeaderLayout === 'banner' ? 'text-white/85' : 'text-slate-600'
                  }`}
                >
                  {settings.address}
                </p>
              )}
              <div
                className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs pt-0.5 ${
                  stmtHeaderLayout === 'centered' ? 'justify-center' : ''
                } ${stmtHeaderLayout === 'banner' ? 'text-white/85' : 'text-slate-600'}`}
              >
                {settings?.phone && <span>Tel: {settings.phone}</span>}
                {settings?.email && <span>Email: {settings.email}</span>}
              </div>
              {(settings?.trnNumber || settings?.vatNumber) && (
                <p
                  className={`text-xs font-bold pt-0.5 ${
                    stmtHeaderLayout === 'banner' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  TRN: {settings.trnNumber || settings.vatNumber}
                </p>
              )}
            </div>
          </div>

          {/* Statement Document Title & Metadata */}
          <div
            className={`space-y-1 w-full sm:w-auto ${
              stmtHeaderLayout === 'centered'
                ? 'text-center'
                : stmtHeaderLayout === 'reversed'
                ? 'sm:text-left'
                : 'sm:text-right'
            }`}
          >
            <h1
              style={{
                color: stmtHeaderLayout === 'banner' ? '#ffffff' : stmtAccentColor
              }}
              className="text-xl sm:text-2xl font-black tracking-tight uppercase"
            >
              {ledgerSource === 'expenses' ? 'EXPENSE STATEMENT' : stmtCustomTitle}
            </h1>
            <div
              className={`text-xs space-y-0.5 pt-1 ${
                stmtHeaderLayout === 'banner' ? 'text-white/90' : 'text-slate-600'
              }`}
            >
              <p>
                <span
                  className={`font-semibold ${
                    stmtHeaderLayout === 'banner' ? 'text-white/75' : 'text-slate-500'
                  }`}
                >
                  Statement Date:
                </span>{' '}
                <span
                  className={`font-bold ${
                    stmtHeaderLayout === 'banner' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {formatDateMonthYear(new Date().toISOString().split('T')[0])}
                </span>
              </p>
              <p>
                <span
                  className={`font-semibold ${
                    stmtHeaderLayout === 'banner' ? 'text-white/75' : 'text-slate-500'
                  }`}
                >
                  Statement Period:
                </span>{' '}
                <span
                  className={`font-bold ${
                    stmtHeaderLayout === 'banner' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {periodLabel}
                </span>
              </p>
              <p>
                <span
                  className={`font-semibold ${
                    stmtHeaderLayout === 'banner' ? 'text-white/75' : 'text-slate-500'
                  }`}
                >
                  Currency:
                </span>{' '}
                <span
                  className={`font-bold ${
                    stmtHeaderLayout === 'banner' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {currencyCode} ({currencySymbol})
                </span>
              </p>
              {(statusFilter !== 'all' || selectedCategory !== 'ALL') && (
                <p>
                  <span
                    className={`font-semibold ${
                      stmtHeaderLayout === 'banner' ? 'text-white/75' : 'text-slate-500'
                    }`}
                  >
                    Filter Scope:
                  </span>{' '}
                  <span
                    className={`font-bold uppercase ${
                      stmtHeaderLayout === 'banner' ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {statusFilter !== 'all' ? `${statusFilter} Only` : 'All Statuses'}
                    {selectedCategory !== 'ALL' ? ` · ${selectedCategory}` : ''}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2. ACCOUNT HOLDER (BILL TO) & STANDARD ACCOUNT SUMMARY BOX */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Left: Account Holder / Client Details */}
          <div
            className={`${
              stmtShowSummaryBox ? 'md:col-span-6' : 'md:col-span-12'
            } p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between`}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Account Of (Client / Customer)
              </p>
              {selectedClient ? (
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-slate-900">
                    {selectedClient.company || selectedClient.name}
                  </p>
                  {selectedClient.name && selectedClient.company && (
                    <p className="text-xs font-medium text-slate-700">Attn: {selectedClient.name}</p>
                  )}
                  {selectedClient.address && (
                    <p className="text-xs text-slate-600">{selectedClient.address}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 text-xs text-slate-600 pt-1">
                    {selectedClient.phone && <span>Tel: {selectedClient.phone}</span>}
                    {selectedClient.email && <span>{selectedClient.email}</span>}
                  </div>
                  {selectedClient.trn && (
                    <p className="text-xs font-bold text-slate-900 pt-1">
                      Client TRN: {selectedClient.trn}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900">
                    All Clients — Consolidated Account Statement
                  </p>
                  <p className="text-xs text-slate-600">
                    Showing {summary.count} {summary.count === 1 ? 'record' : 'records'} across{' '}
                    {selectedCategory === 'ALL' ? 'all categories' : selectedCategory}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Standard Accounting Summary Box */}
          {stmtShowSummaryBox && (
            <div
              style={{ borderColor: stmtAccentColor }}
              className="md:col-span-6 rounded-xl border overflow-hidden"
            >
              <div
                style={{ backgroundColor: stmtAccentColor }}
                className="text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between"
              >
                <span>Account Summary</span>
                <span>Amount ({currencySymbol})</span>
              </div>
              <div className="divide-y divide-slate-200 text-xs">
                <div className="px-4 py-2.5 flex items-center justify-between bg-white">
                  <span className="font-semibold text-slate-600">
                    {ledgerSource === 'expenses'
                      ? 'Total Expenses Recorded'
                      : 'Total Invoiced (Billed)'}
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {currencySymbol} {formatAmount(summary.totalInvoiced)}
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between bg-white">
                  <span className="font-semibold text-slate-600">
                    {ledgerSource === 'expenses'
                      ? 'Total Paid Out'
                      : 'Less: Amount Received (Paid)'}
                  </span>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    {currencySymbol} {formatAmount(summary.totalPaid)}
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between bg-slate-50">
                  <span className="font-black text-slate-900 uppercase">
                    {ledgerSource === 'expenses'
                      ? 'Net Expense Total'
                      : 'Total Balance Due (Unpaid)'}
                  </span>
                  <span
                    style={{ color: stmtAccentColor }}
                    className="text-sm font-black tabular-nums"
                  >
                    {currencySymbol}{' '}
                    {formatAmount(
                      ledgerSource === 'expenses' ? summary.totalInvoiced : summary.totalBalance
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. STATEMENT TABLE — HEADING IS "INVOICE DATE" AND SHOWS FULL DATE MONTH YEAR */}
        {viewMode === 'date_wise' && (
          <div className="space-y-2">
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    style={
                      stmtTableStyle === 'minimal'
                        ? { borderBottomColor: stmtAccentColor }
                        : { backgroundColor: stmtAccentColor, color: '#ffffff' }
                    }
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      stmtTableStyle === 'minimal'
                        ? 'border-b-2 text-slate-900 bg-slate-50'
                        : 'text-white'
                    }`}
                  >
                    <th className="py-2.5 px-3 border-r border-slate-700 w-32">Invoice Date</th>
                    <th className="py-2.5 px-3 border-r border-slate-700 w-28">Invoice / Ref</th>
                    {selectedClientId === 'ALL' && (
                      <th className="py-2.5 px-3 border-r border-slate-700">Client / Party</th>
                    )}
                    <th className="py-2.5 px-3 border-r border-slate-700">
                      Particulars / Category
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-center w-24">
                      Status
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-right w-28">
                      Invoiced ({currencySymbol})
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-700 text-right w-28">
                      Paid ({currencySymbol})
                    </th>
                    <th className="py-2.5 px-3 text-right w-32">
                      Balance ({currencySymbol})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={selectedClientId === 'ALL' ? 8 : 7}
                        className="py-10 text-center text-slate-400 font-medium"
                      >
                        No transactions match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        onClick={() => row.rawInvoice && onSelectInvoice && onSelectInvoice(row.id)}
                        className={`${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                        } hover:bg-indigo-50/40 transition-colors ${
                          row.rawInvoice && onSelectInvoice ? 'cursor-pointer' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                          {formatDateMonthYear(row.date)}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-1">
                            <span>{row.refNumber}</span>
                            {row.rawInvoice && onSelectInvoice && (
                              <ExternalLink size={11} className="text-slate-400 no-print shrink-0" />
                            )}
                          </div>
                        </td>
                        {selectedClientId === 'ALL' && (
                          <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-800">
                            {row.partyName}
                          </td>
                        )}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700">
                          <span className="font-semibold text-slate-900">{row.category}</span>
                          {row.description && row.description !== row.category && (
                            <span className="text-slate-500"> — {row.description}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`font-bold text-[11px] uppercase ${
                                row.isPaid
                                  ? 'text-emerald-700'
                                  : row.isOverdue
                                  ? 'text-rose-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {row.statusLabel}
                            </span>
                            {!row.isPaid && row.rawInvoice && onUpdateInvoice && (
                              <button
                                type="button"
                                onClick={e => handleQuickMarkPaid(row.rawInvoice!, e)}
                                title="Mark as Paid"
                                className="no-print p-0.5 rounded bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition-colors"
                              >
                                <Check size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatAmount(row.debitAmount)}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                          {row.creditAmount > 0 ? formatAmount(row.creditAmount) : '0.00'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatAmount(
                            ledgerSource === 'expenses' ? row.runningBalance : row.balanceAmount
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {ledgerRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-900 text-xs font-black text-slate-900">
                      <td
                        colSpan={selectedClientId === 'ALL' ? 5 : 4}
                        className="py-3 px-3 border-r border-slate-300 text-right uppercase"
                      >
                        Statement Total ({ledgerRows.length}{' '}
                        {ledgerRows.length === 1 ? 'Transaction' : 'Transactions'})
                      </td>
                      <td className="py-3 px-3 border-r border-slate-300 text-right tabular-nums">
                        {currencySymbol} {formatAmount(summary.totalInvoiced)}
                      </td>
                      <td className="py-3 px-3 border-r border-slate-300 text-right text-emerald-700 tabular-nums">
                        {currencySymbol} {formatAmount(summary.totalPaid)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {currencySymbol}{' '}
                        {formatAmount(
                          ledgerSource === 'expenses' ? summary.totalInvoiced : summary.totalBalance
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* MONTH-WISE GROUPED TABLE — HEADING IS "INVOICE DATE" AND ROWS SHOW FULL DATE MONTH YEAR */}
        {viewMode === 'month_wise' && (
          <div className="overflow-x-auto border border-slate-300 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  style={
                    stmtTableStyle === 'minimal'
                      ? { borderBottomColor: stmtAccentColor }
                      : { backgroundColor: stmtAccentColor, color: '#ffffff' }
                  }
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    stmtTableStyle === 'minimal'
                      ? 'border-b-2 text-slate-900 bg-slate-50'
                      : 'text-white'
                  }`}
                >
                  <th className="py-2.5 px-4 border-r border-slate-700 w-32">Invoice Date</th>
                  <th className="py-2.5 px-4 border-r border-slate-700 w-28">Invoice / Ref</th>
                  {selectedClientId === 'ALL' && (
                    <th className="py-2.5 px-4 border-r border-slate-700">Client / Party</th>
                  )}
                  <th className="py-2.5 px-4 border-r border-slate-700">Particulars / Category</th>
                  <th className="py-2.5 px-4 border-r border-slate-700 text-center w-24">Status</th>
                  <th className="py-2.5 px-4 border-r border-slate-700 text-right w-28">
                    Invoiced ({currencySymbol})
                  </th>
                  <th className="py-2.5 px-4 border-r border-slate-700 text-right w-28">
                    Paid ({currencySymbol})
                  </th>
                  <th className="py-2.5 px-4 text-right w-32">
                    Balance ({currencySymbol})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {monthWiseGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedClientId === 'ALL' ? 8 : 7}
                      className="py-10 text-center text-slate-400 font-medium"
                    >
                      No monthly records found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  monthWiseGroups.map(group => (
                    <React.Fragment key={group.monthKey}>
                      {/* Month Group Subheader */}
                      <tr className="bg-slate-100/90 font-black text-slate-800">
                        <td
                          colSpan={selectedClientId === 'ALL' ? 5 : 4}
                          className="py-2 px-4 border-r border-slate-200 uppercase tracking-wider text-[11px]"
                        >
                          {group.monthLabel} ({group.rows.length}{' '}
                          {group.rows.length === 1 ? 'Invoice' : 'Invoices'})
                        </td>
                        <td className="py-2 px-4 border-r border-slate-200 text-right tabular-nums">
                          {formatAmount(group.invoiced)}
                        </td>
                        <td className="py-2 px-4 border-r border-slate-200 text-right text-emerald-700 tabular-nums">
                          {formatAmount(group.paid)}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {formatAmount(group.balance)}
                        </td>
                      </tr>
                      {/* Individual Invoices in that Month showing full Date Month Year */}
                      {group.rows.map(row => (
                        <tr
                          key={row.id}
                          onClick={() => row.rawInvoice && onSelectInvoice && onSelectInvoice(row.id)}
                          className="bg-white hover:bg-indigo-50/40 transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 px-4 border-r border-slate-200 font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                            {formatDateMonthYear(row.date)}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">
                            {row.refNumber}
                          </td>
                          {selectedClientId === 'ALL' && (
                            <td className="py-2.5 px-4 border-r border-slate-200 font-semibold text-slate-800">
                              {row.partyName}
                            </td>
                          )}
                          <td className="py-2.5 px-4 border-r border-slate-200 text-slate-700">
                            <span className="font-semibold text-slate-900">{row.category}</span>
                            {row.description && row.description !== row.category && (
                              <span className="text-slate-500"> — {row.description}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 text-center font-bold uppercase text-[11px]">
                            <span
                              className={
                                row.isPaid
                                  ? 'text-emerald-700'
                                  : row.isOverdue
                                  ? 'text-rose-700'
                                  : 'text-amber-700'
                              }
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 text-right font-semibold text-slate-900 tabular-nums">
                            {formatAmount(row.debitAmount)}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 text-right font-semibold text-emerald-700 tabular-nums">
                            {formatAmount(row.creditAmount)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                            {formatAmount(row.balanceAmount)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
              {monthWiseGroups.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-900 text-xs font-black text-slate-900">
                    <td
                      colSpan={selectedClientId === 'ALL' ? 5 : 4}
                      className="py-3 px-4 border-r border-slate-300 text-right uppercase"
                    >
                      Grand Total ({summary.count} Transactions)
                    </td>
                    <td className="py-3 px-4 border-r border-slate-300 text-right tabular-nums">
                      {currencySymbol} {formatAmount(summary.totalInvoiced)}
                    </td>
                    <td className="py-3 px-4 border-r border-slate-300 text-right text-emerald-700 tabular-nums">
                      {currencySymbol} {formatAmount(summary.totalPaid)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {currencySymbol} {formatAmount(summary.totalBalance)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* CATEGORY-WISE SUMMARY TABLE */}
        {viewMode === 'category_wise' && (
          <div className="overflow-x-auto border border-slate-300 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  style={
                    stmtTableStyle === 'minimal'
                      ? { borderBottomColor: stmtAccentColor }
                      : { backgroundColor: stmtAccentColor, color: '#ffffff' }
                  }
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    stmtTableStyle === 'minimal'
                      ? 'border-b-2 text-slate-900 bg-slate-50'
                      : 'text-white'
                  }`}
                >
                  <th className="py-2.5 px-4 border-r border-slate-700 w-32">Invoice Date</th>
                  <th className="py-2.5 px-4 border-r border-slate-700">
                    Service / Expense Category
                  </th>
                  <th className="py-2.5 px-4 border-r border-slate-700 text-center">
                    Transactions
                  </th>
                  <th className="py-2.5 px-4 border-r border-slate-700 text-right">
                    Total Amount ({currencySymbol})
                  </th>
                  <th className="py-2.5 px-4 border-r border-slate-700 text-right">
                    Paid ({currencySymbol})
                  </th>
                  <th className="py-2.5 px-4 text-right">
                    Unpaid Balance ({currencySymbol})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {categoryWiseRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 font-medium">
                      No category records found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  categoryWiseRows.map((c, idx) => (
                    <tr key={c.category} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="py-2.5 px-4 border-r border-slate-200 font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                        {formatDateMonthYear(c.latestDate)}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-900">
                        {c.category}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 text-center font-semibold text-slate-700 tabular-nums">
                        {c.count}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 text-right font-semibold text-slate-900 tabular-nums">
                        {formatAmount(c.invoiced)}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 text-right font-semibold text-emerald-700 tabular-nums">
                        {formatAmount(c.paid)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                        {formatAmount(c.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {categoryWiseRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-900 text-xs font-black text-slate-900">
                    <td colSpan={2} className="py-3 px-4 border-r border-slate-300 uppercase">
                      Total
                    </td>
                    <td className="py-3 px-4 border-r border-slate-300 text-center tabular-nums">
                      {summary.count}
                    </td>
                    <td className="py-3 px-4 border-r border-slate-300 text-right tabular-nums">
                      {currencySymbol} {formatAmount(summary.totalInvoiced)}
                    </td>
                    <td className="py-3 px-4 border-r border-slate-300 text-right text-emerald-700 tabular-nums">
                      {currencySymbol} {formatAmount(summary.totalPaid)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {currencySymbol} {formatAmount(summary.totalBalance)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* 4. STANDARD REMITTANCE INSTRUCTIONS & AUTO-APPLIED AUTHORIZED SIGNATURE + COMPANY SEAL FOOTER */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs items-end">
          <div className="space-y-1">
            {stmtShowRemittance && (
              <>
                <p className="font-bold uppercase text-slate-800">
                  Bank Remittance &amp; Payment Instructions
                </p>
                {settings?.bankName || settings?.bankAccount ? (
                  <div className="text-slate-600 space-y-0.5 leading-relaxed">
                    {settings?.bankName && (
                      <p>
                        <span className="font-semibold text-slate-700">Bank:</span>{' '}
                        {settings.bankName}
                      </p>
                    )}
                    {settings?.bankAccount && (
                      <p>
                        <span className="font-semibold text-slate-700">Account / IBAN:</span>{' '}
                        {settings.bankAccount}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500">
                    Please remit the balance due via Bank Transfer or Cheque payable to{' '}
                    <strong className="text-slate-800">{settings?.name || 'our company'}</strong>{' '}
                    and quote your Invoice Reference #.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col sm:items-end justify-between space-y-2">
            <div className="sm:text-right">
              <p className="font-bold uppercase text-slate-800">
                For {settings?.name || 'AF© CREATIVE FLOW'}
              </p>
              <p className="text-[11px] text-slate-500">
                Authorized Signatory &amp; Official Company Seal
              </p>
            </div>

            {/* Auto-Applied Transparent Signature & Company Seal Block */}
            <div className="min-h-[72px] flex items-center sm:justify-end gap-4 py-1">
              {applySeal && settings?.companySealUrl && (
                <img
                  src={settings.companySealUrl}
                  alt="Official Company Seal"
                  className="h-20 w-20 object-contain opacity-95"
                />
              )}
              {applySignature && settings?.signatureUrl && (
                <img
                  src={settings.signatureUrl}
                  alt="Authorized Signature"
                  className="h-14 max-w-[160px] object-contain"
                />
              )}
            </div>

            <div className="w-52 border-t border-slate-400 pt-1.5 sm:text-right">
              <p className="text-xs font-bold text-slate-900">
                {settings?.signatoryName || 'Authorized Signature'}
              </p>
              {settings?.signatoryTitle && (
                <p className="text-[10px] text-slate-500">{settings.signatoryTitle}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CLEARANCE CERTIFICATE MODAL (WITH AUTO-APPLIED SIGNATURE & SEAL)       */}
      {/* ===================================================================== */}
      {showCertificateModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="text-emerald-600" size={22} />
                <h3 className="text-base font-black text-slate-900">
                  Account Clearance Certificate
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCertificatePdf}
                  disabled={isExportingCertificatePdf}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isExportingCertificatePdf ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <FileText size={13} />
                  )}
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printElementDirectly('clearance-certificate-sheet', 'Clearance Certificate')
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              id="clearance-certificate-sheet"
              className="p-6 sm:p-8 border-2 border-slate-900 rounded-xl space-y-6 text-slate-900 bg-white"
            >
              <div className="text-center border-b border-slate-200 pb-4 space-y-1">
                <h2 className="text-lg font-black uppercase">{settings?.name || 'AF© ACCOUNTS'}</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                  Certificate of Financial Clearance &amp; Zero Balance
                </p>
              </div>

              <p className="text-xs leading-relaxed text-slate-700">
                This is to certify that the account of{' '}
                <strong className="text-slate-900">
                  {selectedClient
                    ? selectedClient.company || selectedClient.name
                    : 'Consolidated Clients'}
                </strong>{' '}
                for the period <strong>{periodLabel}</strong> has been settled in full, with a
                total billed amount of{' '}
                <strong>
                  {currencySymbol} {formatAmount(summary.totalInvoiced)}
                </strong>{' '}
                and a closing outstanding balance of{' '}
                <strong>{currencySymbol} 0.00</strong>.
              </p>

              <div className="flex justify-between items-end pt-6 text-xs">
                <div>
                  <p className="font-bold">Date of Issue:</p>
                  <p>{formatDateMonthYear(new Date().toISOString().split('T')[0])}</p>
                </div>
                <div className="text-right space-y-2">
                  <div className="min-h-[64px] flex items-center justify-end gap-3">
                    {applySeal && settings?.companySealUrl && (
                      <img
                        src={settings.companySealUrl}
                        alt="Company Seal"
                        className="h-16 w-16 object-contain"
                      />
                    )}
                    {applySignature && settings?.signatureUrl && (
                      <img
                        src={settings.signatureUrl}
                        alt="Authorized Signature"
                        className="h-12 max-w-[140px] object-contain"
                      />
                    )}
                  </div>
                  <div className="w-44 border-t border-slate-400 pt-1">
                    <p className="font-bold">
                      {settings?.signatoryName || 'Authorized Signatory'}
                    </p>
                    {settings?.signatoryTitle && (
                      <p className="text-[10px] text-slate-500">{settings.signatoryTitle}</p>
                    )}
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

export default Statements;

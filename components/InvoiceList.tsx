import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Download,
  Edit3,
  Trash2,
  FileCheck,
  Clock,
  AlertCircle,
  ArrowRight,
  FileQuestion,
  ChevronRight,
  Calendar,
  Building2,
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  CheckCircle2,
  CreditCard,
  Loader2,
  FileBadge,
  CheckSquare,
  Square
} from 'lucide-react';
import { Invoice, InvoiceStatus, UserRole, Client, CompanySettings, PaymentMethod } from '../types';
import { downloadElementAsPdf, printElementDirectly } from '../utils/pdfExport';
import { isInvoiceOverdue, getDaysOverdue, getCurrencySymbol } from '../utils/currency';

interface InvoiceListProps {
  invoices: Invoice[];
  onNewInvoice: (initialType?: 'INVOICE' | 'PROFORMA' | 'QUOTATION') => void;
  onEditInvoice: (id: string) => void;
  onDownloadInvoice: (id: string) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (id: string) => void;
  onBulkDeleteInvoices?: (ids: string[]) => void;
  role: UserRole;
  clients: Client[];
  settings?: CompanySettings;
}

type DatePeriodOption = 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onNewInvoice,
  onEditInvoice,
  onDownloadInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onBulkDeleteInvoices,
  role,
  clients,
  settings
}) => {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('ALL');
  const [datePeriod, setDatePeriod] = useState<DatePeriodOption>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Selection & Delete Confirmation State (In-App Modal — works reliably in all browsers/iframes)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);

  const currencySymbol = getCurrencySymbol(settings?.defaultCurrency || 'AED');

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const calculateTotal = (inv: Invoice) => {
    const subtotal = (inv.items || []).reduce((s, i) => s + (i.quantity || 0) * (i.rate || 0), 0);
    const discount = subtotal * ((inv.discount || 0) / 100);
    const tax = (subtotal - discount) * ((inv.taxRate || 0) / 100);
    return subtotal - discount + tax;
  };

  const calculateTax = (inv: Invoice) => {
    const subtotal = (inv.items || []).reduce((s, i) => s + (i.quantity || 0) * (i.rate || 0), 0);
    const discount = subtotal * ((inv.discount || 0) / 100);
    return (subtotal - discount) * ((inv.taxRate || 0) / 100);
  };

  const getEffectiveStatus = (inv: Invoice): InvoiceStatus => {
    if (isInvoiceOverdue(inv)) {
      return InvoiceStatus.OVERDUE;
    }
    return inv.status;
  };

  const handleConvertToInvoice = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateInvoice) return;
    const newId = inv.id
      .replace(/^QT-/i, 'INV-')
      .replace(/^PI-/i, 'INV-');
    const converted: Invoice = {
      ...inv,
      id: newId === inv.id ? `INV-${inv.id}` : newId,
      status: InvoiceStatus.SENT,
      documentType: 'INVOICE',
      date: new Date().toISOString().split('T')[0]
    };
    onUpdateInvoice(converted);
  };

  const handlePaymentMethodChange = (inv: Invoice, newMethod: PaymentMethod, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    if (!onUpdateInvoice) return;
    onUpdateInvoice({
      ...inv,
      paymentMethod: newMethod
    });
  };

  const handleStatusChange = (inv: Invoice, newStatus: InvoiceStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    if (!onUpdateInvoice) return;
    onUpdateInvoice({
      ...inv,
      status: newStatus,
      documentType:
        newStatus === InvoiceStatus.PROFORMA
          ? 'PROFORMA'
          : newStatus === InvoiceStatus.QUOTATION
          ? 'QUOTATION'
          : 'INVOICE',
      paymentDate:
        newStatus === InvoiceStatus.PAID
          ? inv.paymentDate || new Date().toISOString().split('T')[0]
          : inv.paymentDate,
      paymentMethod:
        newStatus === InvoiceStatus.PAID && !inv.paymentMethod
          ? PaymentMethod.BANK_TRANSFER
          : inv.paymentMethod
    });
  };

  const handleConfirmSingleDelete = () => {
    if (!invoiceToDelete) return;
    if (onDeleteInvoice) {
      onDeleteInvoice(invoiceToDelete.id);
    }
    setSelectedIds(prev => prev.filter(id => id !== invoiceToDelete.id));
    setInvoiceToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (onBulkDeleteInvoices) {
      onBulkDeleteInvoices(selectedIds);
    } else if (onDeleteInvoice) {
      selectedIds.forEach(id => onDeleteInvoice(id));
    }
    setSelectedIds([]);
    setShowBulkDeleteConfirm(false);
  };

  const toggleSelectInvoice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  const applyDatePeriod = (period: DatePeriodOption) => {
    setDatePeriod(period);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (period === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (period === 'this_month') {
      const first = new Date(y, m, 1).toISOString().split('T')[0];
      const last = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (period === 'last_month') {
      const first = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const last = new Date(y, m, 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (period === 'this_quarter') {
      const qStartMonth = Math.floor(m / 3) * 3;
      const first = new Date(y, qStartMonth, 1).toISOString().split('T')[0];
      const last = new Date(y, qStartMonth + 3, 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (period === 'this_year') {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const client = (clients || []).find(c => c.id === inv.clientId);
      const clientDisplayName = client ? `${client.company} ${client.name}` : '';
      const effectiveStatus = getEffectiveStatus(inv);

      const matchesFilter =
        filter === 'all' || effectiveStatus.toLowerCase() === filter.toLowerCase();
      const matchesClient =
        selectedClientFilter === 'ALL' || inv.clientId === selectedClientFilter;
      const matchesSearch =
        inv.id.toLowerCase().includes(search.toLowerCase()) ||
        clientDisplayName.toLowerCase().includes(search.toLowerCase()) ||
        (inv.items || []).some(it =>
          (it.description || '').toLowerCase().includes(search.toLowerCase()) ||
          (it.service || '').toLowerCase().includes(search.toLowerCase())
        );

      let matchesDate = true;
      if (startDate || endDate) {
        const invDate = new Date(inv.date);
        if (startDate && invDate < new Date(startDate)) matchesDate = false;
        if (endDate && invDate > new Date(endDate)) matchesDate = false;
      }

      return matchesFilter && matchesClient && matchesSearch && matchesDate;
    });
  }, [invoices, clients, filter, selectedClientFilter, search, startDate, endDate]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map(i => i.id));
    }
  };

  const summaryMetrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalProforma = 0;
    let totalQuotations = 0;
    let totalTax = 0;

    filteredInvoices.forEach(inv => {
      const amt = calculateTotal(inv);
      const tax = calculateTax(inv);

      if (inv.status === InvoiceStatus.QUOTATION) {
        totalQuotations += amt;
      } else if (inv.status === InvoiceStatus.PROFORMA) {
        totalProforma += amt;
      } else {
        totalInvoiced += amt;
        totalTax += tax;
        if (inv.status === InvoiceStatus.PAID) {
          totalPaid += amt;
        } else {
          totalPending += amt;
        }
      }
    });

    return { totalInvoiced, totalPaid, totalPending, totalProforma, totalQuotations, totalTax };
  }, [filteredInvoices]);

  const getStatusStyle = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case InvoiceStatus.SENT:
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
      case InvoiceStatus.OVERDUE:
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
      case InvoiceStatus.PROFORMA:
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
      case InvoiceStatus.QUOTATION:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Document ID',
      'Type',
      'Client Company',
      'Contact Person',
      'Issue Date',
      'Due Date',
      'Status',
      'Payment Method',
      `VAT (${currencySymbol})`,
      `Total Amount (${currencySymbol})`
    ];
    const rows = filteredInvoices.map(inv => {
      const client = (clients || []).find(c => c.id === inv.clientId);
      const effectiveStatus = getEffectiveStatus(inv);
      const docType =
        inv.status === InvoiceStatus.PROFORMA
          ? 'Proforma Invoice'
          : inv.status === InvoiceStatus.QUOTATION
          ? 'Quotation'
          : 'Tax Invoice';
      return [
        inv.id,
        docType,
        `"${(client?.company || 'Unknown').replace(/"/g, '""')}"`,
        `"${(client?.name || '').replace(/"/g, '""')}"`,
        formatDate(inv.date),
        formatDate(inv.dueDate),
        effectiveStatus,
        inv.paymentMethod || (inv.status === InvoiceStatus.PAID ? 'Bank Transfer' : 'N/A'),
        calculateTax(inv).toFixed(2),
        calculateTotal(inv).toFixed(2)
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Invoices_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleDownloadReportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setShowReportModal(true);

    setTimeout(async () => {
      try {
        await downloadElementAsPdf(
          'printable-invoice-report-area',
          `Invoices_Report_${new Date().toISOString().split('T')[0]}.pdf`
        );
      } catch (e) {
        console.error('Report PDF error:', e);
      } finally {
        setIsExportingPdf(false);
      }
    }, 350);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Top Header & Document Creation Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Invoices, Proformas & Quotations
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
            Create Tax Invoices, Proforma Invoices, and Quotations with full UAE {currencySymbol} billing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center space-x-1.5 bg-rose-600 text-white px-3.5 py-2.5 rounded-xl font-black text-xs hover:bg-rose-700 transition-all shadow-sm"
            >
              <Trash2 size={15} />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleDownloadReportPdf}
            disabled={isExportingPdf}
            className="flex items-center space-x-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60"
          >
            {isExportingPdf ? <Loader2 size={15} className="animate-spin text-indigo-600" /> : <Download size={15} className="text-indigo-600" />}
            <span>PDF Report</span>
          </button>

          <button
            onClick={() => onNewInvoice('QUOTATION')}
            className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm"
          >
            <Plus size={15} />
            <span>New Quotation</span>
          </button>

          <button
            onClick={() => onNewInvoice('PROFORMA')}
            className="flex items-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm"
          >
            <FileBadge size={15} />
            <span>New Proforma</span>
          </button>

          <button
            onClick={() => onNewInvoice('INVOICE')}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            <Plus size={16} />
            <span>New Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-darkcard p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tax Billed</p>
          <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            <span className="text-indigo-600 dark:text-indigo-400 mr-1">{currencySymbol}</span>
            {summaryMetrics.totalInvoiced.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">
            Finalized Invoices
          </p>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 sm:p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm">
          <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1">Settled / Paid</p>
          <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400">
            <span className="mr-1">{currencySymbol}</span>
            {summaryMetrics.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] font-bold text-emerald-600/80 mt-1">
            Collected Revenue
          </p>
        </div>

        <div className="bg-rose-50/60 dark:bg-rose-950/20 p-4 sm:p-5 rounded-2xl border border-rose-100 dark:border-rose-900/40 shadow-sm">
          <p className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest mb-1">Unpaid Balance</p>
          <p className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400">
            <span className="mr-1">{currencySymbol}</span>
            {summaryMetrics.totalPending.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] font-bold text-rose-500 mt-1">
            Pending + Overdue
          </p>
        </div>

        <div className="bg-purple-50/60 dark:bg-purple-950/20 p-4 sm:p-5 rounded-2xl border border-purple-100 dark:border-purple-900/40 shadow-sm">
          <p className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-1">Proforma Value</p>
          <p className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-300">
            <span className="mr-1">{currencySymbol}</span>
            {summaryMetrics.totalProforma.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] font-bold text-purple-500 mt-1">
            Active Proformas
          </p>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-5 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-sm">
          <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Quotations</p>
          <p className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300">
            <span className="mr-1">{currencySymbol}</span>
            {summaryMetrics.totalQuotations.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] font-bold text-amber-600 mt-1">
            Open Estimates
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-darkcard p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-hide">
            {['all', ...Object.values(InvoiceStatus)].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black capitalize whitespace-nowrap transition-all ${
                  filter.toLowerCase() === s.toLowerCase()
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? 'All Documents' : s}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Client Dropdown */}
            <div className="relative min-w-[190px]">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                value={selectedClientFilter}
                onChange={e => setSelectedClientFilter(e.target.value)}
                className="w-full pl-8 pr-6 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Clients</option>
                {(clients || []).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company || c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search ID, client, service..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date Period Filter Row */}
        <div className="pt-3 border-t border-slate-100 dark:border-darkborder flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 flex items-center gap-1">
              <Calendar size={12} /> Date Filter:
            </span>
            {[
              { id: 'all', label: 'All Dates' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_quarter', label: 'This Quarter' },
              { id: 'this_year', label: 'This Year' },
              { id: 'custom', label: 'Custom Range' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => applyDatePeriod(p.id as DatePeriodOption)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  datePeriod === p.id
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setDatePeriod('custom');
              }}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
            />
            <span className="text-xs text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setDatePeriod('custom');
              }}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
            />
            {(startDate || endDate || selectedClientFilter !== 'ALL' || filter !== 'all' || search) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setDatePeriod('all');
                  setSelectedClientFilter('ALL');
                  setFilter('all');
                  setSearch('');
                }}
                className="text-xs font-black text-rose-600 hover:underline ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoices Table (Responsive on Desktop & Mobile) */}
      <div className="bg-white dark:bg-darkcard rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 dark:border-darkborder">
                <th className="py-4 pl-5 pr-2 w-10">
                  <button
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-indigo-600 flex items-center"
                    title="Select All"
                  >
                    {selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0 ? (
                      <CheckSquare size={16} className="text-indigo-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-4">Document ID</th>
                <th className="px-4 py-4">Client / Company</th>
                <th className="px-4 py-4">Issue Date</th>
                <th className="px-4 py-4">Due / Valid</th>
                <th className="px-4 py-4">Amount ({currencySymbol})</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Payment Mode</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-darkborder text-sm">
              {filteredInvoices.map(inv => {
                const client = (clients || []).find(c => c.id === inv.clientId);
                const isQuotation = inv.status === InvoiceStatus.QUOTATION;
                const isProforma = inv.status === InvoiceStatus.PROFORMA;
                const effectiveStatus = getEffectiveStatus(inv);
                const daysLate = getDaysOverdue(inv);
                const isSelected = selectedIds.includes(inv.id);

                return (
                  <tr
                    key={inv.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer ${
                      isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                    }`}
                    onClick={() => onEditInvoice(inv.id)}
                  >
                    <td className="py-4 pl-5 pr-2" onClick={e => toggleSelectInvoice(inv.id, e)}>
                      <button className="text-slate-400 hover:text-indigo-600 flex items-center">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-indigo-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                          {inv.id}
                        </span>
                        {isProforma && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase">
                            Proforma
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div>
                        <p className="font-black text-slate-900 dark:text-white leading-tight text-xs sm:text-sm">
                          {client?.company || 'Unknown Company'}
                        </p>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                          {client?.name}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                        {formatDate(inv.date)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start">
                        <span
                          className={`font-bold text-xs whitespace-nowrap ${
                            effectiveStatus === InvoiceStatus.OVERDUE
                              ? 'text-rose-600 font-black'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {formatDate(inv.dueDate)}
                        </span>
                        {effectiveStatus === InvoiceStatus.OVERDUE && daysLate > 0 && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded mt-1">
                            {daysLate} {daysLate === 1 ? 'day' : 'days'} overdue
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 font-black text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="text-indigo-600 dark:text-indigo-400 mr-1">{currencySymbol}</span>
                      {calculateTotal(inv).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>

                    <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                      <select
                        value={effectiveStatus}
                        onChange={e => handleStatusChange(inv, e.target.value as InvoiceStatus, e)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer outline-none ${getStatusStyle(
                          effectiveStatus
                        )}`}
                      >
                        {Object.values(InvoiceStatus).map(st => (
                          <option key={st} value={st} className="bg-white text-slate-900 font-bold">
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                      {!isQuotation ? (
                        <div className="relative inline-flex items-center">
                          <CreditCard size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                          <select
                            value={inv.paymentMethod || PaymentMethod.BANK_TRANSFER}
                            onChange={e =>
                              handlePaymentMethodChange(inv, e.target.value as PaymentMethod, e)
                            }
                            className="pl-7 pr-5 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                          >
                            {Object.values(PaymentMethod).map(m => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                          Est. Only
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1.5">
                        {(isQuotation || isProforma) && onUpdateInvoice && (
                          <button
                            onClick={e => handleConvertToInvoice(inv, e)}
                            title="Convert to Final Tax Invoice"
                            className="flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all"
                          >
                            <span>To Invoice</span>
                            <ArrowRight size={11} />
                          </button>
                        )}
                        <button
                          onClick={() => onEditInvoice(inv.id)}
                          title="Edit Document"
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => onDownloadInvoice(inv.id)}
                          title="Download / Print PDF"
                          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setInvoiceToDelete(inv);
                          }}
                          title="Delete Document"
                          className="p-2 text-rose-500 hover:text-white hover:bg-rose-600 bg-rose-50/70 dark:bg-rose-950/40 rounded-lg transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">No invoices, proformas, or quotations found matching your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SINGLE INVOICE DELETE CONFIRMATION MODAL */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete Document #{invoiceToDelete.id}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action will permanently remove this record from your workspace.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 mb-5 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Document ID:</span>
                <span className="font-black text-slate-900 dark:text-white">#{invoiceToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Status:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{invoiceToDelete.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Amount:</span>
                <span className="font-black text-rose-600">
                  {currencySymbol} {calculateTotal(invoiceToDelete).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSingleDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-200 dark:shadow-none flex items-center space-x-1.5"
              >
                <Trash2 size={14} />
                <span>Yes, Delete Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete {selectedIds.length} Selected Documents?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to permanently delete the {selectedIds.length} selected documents?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-200 dark:shadow-none flex items-center space-x-1.5"
              >
                <Trash2 size={14} />
                <span>Delete All ({selectedIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            <div className="no-print p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Printer className="text-indigo-400" size={20} />
                <span className="font-bold text-sm">Invoice Register Report Preview</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() =>
                    downloadElementAsPdf(
                      'printable-invoice-report-area',
                      `Invoices_Report_${new Date().toISOString().split('T')[0]}.pdf`
                    )
                  }
                  className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center space-x-2"
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() =>
                    printElementDirectly('printable-invoice-report-area', 'Invoices_Report')
                  }
                  className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-black text-xs hover:bg-emerald-700 transition-all flex items-center space-x-2"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div id="printable-invoice-report-area" className="p-10 space-y-8 bg-white text-slate-900">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                <div>
                  <h2 className="text-xl font-black uppercase">{settings?.name || 'Af© ACCOUNTS'}</h2>
                  <p className="text-xs text-slate-500 mt-1">{settings?.address}</p>
                  <p className="text-xs font-bold text-indigo-600 mt-0.5">TRN: {settings?.vatNumber}</p>
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-black uppercase">INVOICE & PROFORMA REGISTER</h1>
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    Generated: {formatDate(new Date().toISOString().split('T')[0])}
                  </p>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-black uppercase">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Due</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Total ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInvoices.map(inv => {
                    const c = (clients || []).find(cl => cl.id === inv.clientId);
                    return (
                      <tr key={inv.id}>
                        <td className="py-2 px-3 font-black">{inv.id}</td>
                        <td className="py-2 px-3 font-bold">{c?.company || c?.name}</td>
                        <td className="py-2 px-3">{formatDate(inv.date)}</td>
                        <td className="py-2 px-3">{formatDate(inv.dueDate)}</td>
                        <td className="py-2 px-3 font-bold uppercase">{getEffectiveStatus(inv)}</td>
                        <td className="py-2 px-3 text-right font-black">
                          {currencySymbol} {calculateTotal(inv).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceList;

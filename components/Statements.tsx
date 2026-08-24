import React, { useState, useMemo } from 'react';
import { 
  Invoice, 
  Client, 
  InvoiceStatus, 
  CompanySettings,
  PaymentMethod 
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
  ArrowUpRight, 
  Filter, 
  X,
  CreditCard,
  Layers,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { downloadElementAsPdf, printElementDirectly, downloadDocumentAsHtml } from '../utils/pdfExport';
import { LanguageCode, getTranslation } from '../utils/translations';

interface StatementsProps {
  invoices: Invoice[];
  clients: Client[];
  settings?: CompanySettings;
  onSelectInvoice?: (id: string) => void;
  onUpdateInvoice?: (inv: Invoice) => void;
  language?: LanguageCode;
}

export const Statements: React.FC<StatementsProps> = ({ 
  invoices, 
  clients, 
  settings, 
  onSelectInvoice,
  onUpdateInvoice,
  language = 'en'
}) => {
  const [selectedClientId, setSelectedClientId] = useState(clients?.[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'unsettled'>('all');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);
  const client = (clients || []).find(c => c.id === selectedClientId) || clients?.[0];
  const currencySymbol = settings?.defaultCurrency || 'AED';
  const AED_SYMBOL = 'د.إ';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Only count finalized invoices (exclude Quotations) for financial statements
  const clientInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.clientId === selectedClientId && inv.status !== InvoiceStatus.QUOTATION)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, selectedClientId]);

  const calculateInvoiceTotal = (inv: Invoice) => {
    const subtotal = inv.items.reduce((s, i) => s + (i.quantity * i.rate), 0);
    const discount = subtotal * (inv.discount / 100);
    const tax = (subtotal - discount) * (inv.taxRate / 100);
    return subtotal - discount + tax;
  };

  const calculateInvoiceSubtotal = (inv: Invoice) => {
    return inv.items.reduce((s, i) => s + (i.quantity * i.rate), 0);
  };

  const calculateInvoiceTax = (inv: Invoice) => {
    const subtotal = calculateInvoiceSubtotal(inv);
    const discount = subtotal * (inv.discount / 100);
    return (subtotal - discount) * (inv.taxRate / 100);
  };

  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalVat = 0;
    let paidCount = 0;
    let pendingCount = 0;

    clientInvoices.forEach(inv => {
      const total = calculateInvoiceTotal(inv);
      const vat = calculateInvoiceTax(inv);
      totalInvoiced += total;
      totalVat += vat;

      if (inv.status === InvoiceStatus.PAID) {
        totalPaid += total;
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    const balance = totalInvoiced - totalPaid;
    const settlementRate = totalInvoiced > 0 ? ((totalPaid / totalInvoiced) * 100).toFixed(0) : '100';

    return { 
      totalInvoiced, 
      totalPaid, 
      totalVat, 
      balance, 
      settlementRate,
      paidCount,
      pendingCount,
      totalCount: clientInvoices.length
    };
  }, [clientInvoices]);

  // Filtered list for display
  const displayedInvoices = useMemo(() => {
    return clientInvoices
      .filter(inv => {
        if (statusFilter === 'settled') return inv.status === InvoiceStatus.PAID;
        if (statusFilter === 'unsettled') return inv.status !== InvoiceStatus.PAID;
        return true;
      })
      .filter(inv => {
        if (!searchInvoice) return true;
        const query = searchInvoice.toLowerCase();
        return inv.id.toLowerCase().includes(query) || 
          inv.items.some(it => it.description.toLowerCase().includes(query));
      });
  }, [clientInvoices, statusFilter, searchInvoice]);

  // Handle Download CSV Settlement
  const handleDownloadSettlementCSV = () => {
    if (!client) return;

    const headers = [
      'Statement Date',
      'Invoice Number',
      'Services / Description',
      'Subtotal (AED)',
      'VAT 5% (AED)',
      'Total Amount (AED)',
      'Settlement Status',
      'Payment Date',
      'Payment Method'
    ];

    const rows = clientInvoices.map(inv => {
      const subtotal = calculateInvoiceSubtotal(inv);
      const vat = calculateInvoiceTax(inv);
      const total = calculateInvoiceTotal(inv);
      const descriptions = inv.items.map(i => i.description).join('; ');

      return [
        `"${formatDate(inv.date)}"`,
        `"${inv.id}"`,
        `"${descriptions.replace(/"/g, '""')}"`,
        subtotal.toFixed(2),
        vat.toFixed(2),
        total.toFixed(2),
        `"${inv.status}"`,
        `"${inv.paymentDate ? formatDate(inv.paymentDate) : 'Pending'}"`,
        `"${inv.paymentMethod || 'N/A'}"`
      ];
    });

    // Summary row
    rows.push([]);
    rows.push(['"SUMMARY"', '""', '""', '""', '""', '""', '""', '""', '""']);
    rows.push(['"Client Company"', `"${client.company}"`, '""', '""', '""', '""', '""', '""', '""']);
    rows.push(['"Total Invoiced (AED)"', '""', '""', '""', '""', stats.totalInvoiced.toFixed(2), '""', '""', '""']);
    rows.push(['"Total Settled / Received (AED)"', '""', '""', '""', '""', stats.totalPaid.toFixed(2), '""', '""', '""']);
    rows.push(['"Outstanding Balance (AED)"', '""', '""', '""', '""', stats.balance.toFixed(2), '""', '""', '""']);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Settlement-Statement-${client.company.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Real PDF Settlement Download
  const handleDownloadSettlementPDF = async () => {
    if (!showPrintModal) {
      setShowPrintModal(true);
    }
    
    setIsExportingPdf(true);
    setExportMsg('Rendering Settlement PDF...');

    setTimeout(async () => {
      const filename = `Settlement-Statement-${client?.company?.replace(/\s+/g, '-') || 'Account'}-${new Date().toISOString().split('T')[0]}`;
      await downloadElementAsPdf('statement-sheet', filename, (status, msg) => {
        if (msg) setExportMsg(msg);
      });

      setTimeout(() => {
        setIsExportingPdf(false);
        setExportMsg('');
      }, 1000);
    }, 400);
  };

  // Real PDF Clearance Certificate Download
  const handleDownloadCertificatePDF = async () => {
    setIsExportingPdf(true);
    setExportMsg('Exporting Clearance Certificate...');
    const filename = `Settlement-Clearance-${client?.company?.replace(/\s+/g, '-') || 'Client'}`;
    
    await downloadElementAsPdf('certificate-sheet', filename, (status, msg) => {
      if (msg) setExportMsg(msg);
    });

    setTimeout(() => {
      setIsExportingPdf(false);
      setExportMsg('');
    }, 1000);
  };

  // Dedicated Print Statement
  const handlePrintStatement = () => {
    if (!showPrintModal) {
      setShowPrintModal(true);
      setTimeout(() => {
        printElementDirectly('statement-sheet', `Statement of Account - ${client?.company}`);
      }, 300);
    } else {
      printElementDirectly('statement-sheet', `Statement of Account - ${client?.company}`);
    }
  };

  const handlePrintCertificate = () => {
    printElementDirectly('certificate-sheet', `Settlement Clearance - ${client?.company}`);
  };

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      {/* Toast Notification when exporting PDF */}
      {isExportingPdf && (
        <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-2xl z-[100] flex items-center space-x-3 border border-slate-700 animate-in slide-in-from-bottom-3 no-print">
          <Loader2 size={18} className="animate-spin text-indigo-400" />
          <span className="text-xs font-bold">{exportMsg || 'Generating document PDF...'}</span>
        </div>
      )}

      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-200 dark:shadow-none">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {t('statements.title', 'Client Statements & Settlements')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                Account History • Settlement Reports • Clearance Export
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Client Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Client selector dropdown */}
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-2xl">
            <Building2 size={16} className="text-slate-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {t('statements.client_label', 'Client:')}
              </span>
              <select 
                value={selectedClientId} 
                onChange={e => setSelectedClientId(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-900 dark:text-white outline-none cursor-pointer pr-2 pt-0.5"
              >
                {clients.map(c => <option key={c.id} value={c.id} className="dark:bg-slate-900 text-slate-900 dark:text-white">{c.company}</option>)}
              </select>
            </div>
          </div>

          {/* Download Settlement CSV Button */}
          <button 
            onClick={handleDownloadSettlementCSV}
            title="Download Settlement CSV Spreadsheet"
            className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95"
          >
            <FileSpreadsheet size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Download / Print Official PDF Statement */}
          <button 
            onClick={handleDownloadSettlementPDF}
            disabled={isExportingPdf}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95 disabled:opacity-50"
          >
            {isExportingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>Download Settlement PDF</span>
          </button>

          {/* Quick Print Direct Button */}
          <button 
            onClick={handlePrintStatement}
            title="Quick Print Statement"
            className="p-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-2xl transition-all shadow-md active:scale-95 border border-slate-700"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* Client Overview & Settlement Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 no-print">
        {/* Card 1: Total Invoiced */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              {t('statements.total_invoiced', 'Total Invoiced')}
            </span>
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {stats.totalCount} {t('statements.invoices_suffix', 'Invoices')}
            </span>
          </div>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
            <span className="aed-2026">{AED_SYMBOL}</span> {stats.totalInvoiced.toLocaleString()}
          </h4>
          <p className="text-[11px] text-slate-400 font-bold mt-2">Inc. 5% VAT: AED {stats.totalVat.toLocaleString()}</p>
        </div>

        {/* Card 2: Total Settled / Received */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
              {t('statements.total_settled', 'Total Settled')}
            </span>
            <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={10} /> {stats.paidCount} Paid
            </span>
          </div>
          <h4 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight flex items-center">
            <span className="aed-2026">{AED_SYMBOL}</span> {stats.totalPaid.toLocaleString()}
          </h4>
          <div className="w-full bg-emerald-200/60 dark:bg-emerald-950 rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${stats.settlementRate}%` }}></div>
          </div>
        </div>

        {/* Card 3: Outstanding Balance */}
        <div className={`p-6 rounded-[28px] border shadow-sm ${
          stats.balance > 0 
            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-300' 
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-black uppercase tracking-widest ${stats.balance > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500'}`}>
              {t('statements.outstanding_balance', 'Outstanding Balance')}
            </span>
            {stats.balance > 0 ? (
              <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle size={10} /> {stats.pendingCount} Due
              </span>
            ) : (
              <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                Fully Settled
              </span>
            )}
          </div>
          <h4 className={`text-2xl font-black tracking-tight flex items-center ${stats.balance > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
            <span className="aed-2026">{AED_SYMBOL}</span> {stats.balance.toLocaleString()}
          </h4>
          <p className={`text-[11px] font-bold mt-2 ${stats.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
            {stats.balance > 0 ? 'Action required for settlement' : 'Account in good standing'}
          </p>
        </div>

        {/* Card 4: Client Info & Settlement Certificate */}
        <div className="bg-slate-900 dark:bg-slate-800/90 border border-slate-800 dark:border-slate-700 p-6 rounded-[28px] text-white shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-1">Client Profile</span>
            <h4 className="text-base font-black truncate">{client?.company || 'Company'}</h4>
            <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{client?.email || 'N/A'}</p>
            {client?.trn && (
              <p className="text-[10px] text-slate-400 font-mono mt-1">TRN: {client.trn}</p>
            )}
          </div>

          <button
            onClick={() => setShowCertificateModal(true)}
            className="mt-3 w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 border border-white/10"
          >
            <ShieldCheck size={14} />
            <span>Settlement Clearance</span>
          </button>
        </div>
      </div>

      {/* Account History / Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm no-print">
        {/* Table Header & Search Filter Bar */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg">Transaction Ledger & Invoices</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice or service..."
                value={searchInvoice}
                onChange={e => setSearchInvoice(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-56"
              />
            </div>

            {/* Status Filter Chips */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs border border-slate-200 dark:border-slate-700">
              {[
                { id: 'all', label: 'All' },
                { id: 'settled', label: 'Settled (Paid)' },
                { id: 'unsettled', label: 'Unsettled' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all text-xs ${
                    statusFilter === f.id
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Invoice # (Click for Details)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Service Scope</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Settlement Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Taxable Subtotal</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Total Amount (AED)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {displayedInvoices.length > 0 ? (
                displayedInvoices.map((inv) => {
                  const subtotal = calculateInvoiceSubtotal(inv);
                  const total = calculateInvoiceTotal(inv);
                  const isPaid = inv.status === InvoiceStatus.PAID;
                  const isOverdue = inv.status === InvoiceStatus.OVERDUE;

                  return (
                    <tr key={inv.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors group">
                      {/* Date */}
                      <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{formatDate(inv.date)}</span>
                        </div>
                      </td>

                      {/* Invoice ID - Interactive Clickable */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                          className="inline-flex items-center space-x-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-indigo-500 group-hover:bg-indigo-600 group-hover:text-white px-3 py-1.5 rounded-xl font-black text-xs text-slate-900 dark:text-white transition-all shadow-sm"
                          title="Click to open invoice details & edit"
                        >
                          <FileText size={13} className="text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
                          <span className="underline decoration-indigo-200 dark:decoration-indigo-800 underline-offset-2">{inv.id}</span>
                          <ArrowUpRight size={13} className="text-slate-400 group-hover:text-white transition-colors" />
                        </button>
                      </td>

                      {/* Service Scope */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {inv.items.map(i => i.description).join(', ') || 'Custom Media Production'}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {inv.items.length} item{inv.items.length !== 1 ? 's' : ''} • Due {formatDate(inv.dueDate)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          isPaid 
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' 
                            : isOverdue 
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 animate-pulse' 
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        }`}>
                          {isPaid ? <CheckCircle2 size={12} /> : isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
                          <span>{inv.status}</span>
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="px-6 py-4 text-right text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {AED_SYMBOL} {subtotal.toLocaleString()}
                      </td>

                      {/* Total */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                          {AED_SYMBOL} {total.toLocaleString()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 transition-all"
                            title="Open Invoice Details"
                          >
                            <ExternalLink size={14} />
                          </button>
                          {!isPaid && onUpdateInvoice && (
                            <button
                              onClick={(e) => handleMarkAsPaid(inv, e)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white font-black text-[10px] uppercase tracking-wider transition-all border border-emerald-200 dark:border-emerald-800"
                              title="Settle / Mark as Paid"
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <span>Showing {displayedInvoices.length} of {clientInvoices.length} transactions for</span>
            <strong className="text-slate-900 dark:text-white">{client?.company}</strong>
          </div>
          <div className="flex items-center space-x-4">
            <span>Total Invoiced: <strong className="text-slate-900 dark:text-white">{AED_SYMBOL} {stats.totalInvoiced.toLocaleString()}</strong></span>
            <span>Settled: <strong className="text-emerald-600 dark:text-emerald-400">{AED_SYMBOL} {stats.totalPaid.toLocaleString()}</strong></span>
            <span>Balance: <strong className="text-rose-600 dark:text-rose-400">{AED_SYMBOL} {stats.balance.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FULL PRINTABLE SETTLEMENT STATEMENT VIEW (Visible in Print or Modal) */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Top Bar */}
            <div className="p-5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black">
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black">Official Statement of Account & Settlement</h3>
                  <p className="text-xs text-slate-400 font-medium">Ready for PDF download or print</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownloadSettlementPDF}
                  disabled={isExportingPdf}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50"
                >
                  {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>Save PDF</span>
                </button>
                <button
                  onClick={handlePrintStatement}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 hover:bg-indigo-700 shadow-md"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Document Body Preview */}
            <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-100 dark:bg-slate-950 flex justify-center">
              <div id="statement-sheet" className="bg-white p-10 rounded-2xl shadow-md max-w-3xl w-full border border-slate-200 text-slate-800 space-y-8 print-container">
                {/* Statement Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                  <div className="flex items-start space-x-4">
                    {settings?.logoUrl ? (
                      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
                        <img 
                          src={settings.logoUrl} 
                          alt={settings.name || 'Company Logo'} 
                          className="max-h-full max-w-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-xl font-black shadow-md flex-shrink-0">
                        {settings?.name ? settings.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AC' : 'AC'}
                      </div>
                    )}
                    <div>
                      <h1 className="text-2xl font-black tracking-tight text-slate-900">{settings?.name || 'Accounts & Invoicing'}</h1>
                      <p className="text-xs text-slate-500 font-medium mt-1">{settings?.address || 'Company Address'}</p>
                      {settings?.email && <p className="text-xs text-slate-500 font-medium">Email: {settings.email}</p>}
                      {settings?.trnNumber && <p className="text-xs font-bold text-indigo-600 mt-1">TRN (Tax Reg): {settings.trnNumber}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-slate-900 text-white text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-lg inline-flex items-center justify-center text-center">
                      Statement of Account
                    </span>
                    <p className="text-xs font-bold text-slate-500 mt-2">Date: {new Date().toLocaleDateString('en-GB')}</p>
                    <p className="text-xs font-bold text-slate-500">Currency: {settings?.defaultCurrency || 'AED'}</p>
                  </div>
                </div>

                {/* Client Box & Period */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Statement Issued To:</span>
                    <h3 className="text-base font-black text-slate-900">{client?.company}</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{client?.name}</p>
                    <p className="text-xs text-slate-600">{client?.address}</p>
                    {client?.trn && <p className="text-xs font-bold text-indigo-600 mt-1">Client TRN: {client.trn}</p>}
                  </div>
                  <div className="space-y-1.5 text-xs text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Financial Summary:</span>
                    <div className="flex justify-between"><span className="text-slate-500 font-medium">Total Billed:</span> <span className="font-black text-slate-900">AED {stats.totalInvoiced.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 font-medium">Total Settled:</span> <span className="font-black text-emerald-600">AED {stats.totalPaid.toLocaleString()}</span></div>
                    <div className="flex justify-between pt-1 border-t border-slate-200"><span className="text-slate-700 font-bold">Outstanding Balance:</span> <span className="font-black text-rose-600 text-sm">AED {stats.balance.toLocaleString()}</span></div>
                  </div>
                </div>

                {/* Itemized Table */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900 font-black uppercase text-[10px] text-slate-500">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Invoice #</th>
                      <th className="py-2.5">Description</th>
                      <th className="py-2.5 text-center">Status</th>
                      <th className="py-2.5 text-right">Amount (AED)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {clientInvoices.map(inv => {
                      const total = calculateInvoiceTotal(inv);
                      return (
                        <tr key={inv.id}>
                          <td className="py-2.5 font-bold">{formatDate(inv.date)}</td>
                          <td className="py-2.5 font-black text-slate-900">{inv.id}</td>
                          <td className="py-2.5 text-slate-600 truncate max-w-xs">{inv.items.map(i => i.description).join(', ')}</td>
                          <td className="py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${inv.status === InvoiceStatus.PAID ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-black text-slate-900">AED {total.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Settlement & Banking Instructions */}
                <div className="border-t-2 border-slate-900 pt-6 grid grid-cols-2 gap-6 text-xs">
                  <div>
                    <h4 className="font-black text-slate-900 uppercase text-[10px] tracking-wider mb-1">Payment & Settlement Details</h4>
                    {settings?.bankName && <p className="text-slate-600">Bank: <strong className="text-slate-800">{settings.bankName}</strong></p>}
                    {settings?.bankAccount && <p className="text-slate-600">IBAN / Account: <strong className="font-mono text-slate-800">{settings.bankAccount}</strong></p>}
                  </div>
                  <div className="text-right flex flex-col justify-end">
                    <div className="h-12 border-b border-slate-300 w-44 self-end"></div>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Authorized Signature & Stamp</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SETTLEMENT CLEARANCE CERTIFICATE MODAL */}
      {/* ========================================================================= */}
      {showCertificateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck size={20} className="text-emerald-400" />
                <h3 className="text-base font-black">Settlement Clearance Certificate</h3>
              </div>
              <button onClick={() => setShowCertificateModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl">
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6 bg-slate-50 dark:bg-slate-950">
              <div id="certificate-sheet" className="bg-white p-8 rounded-2xl border-2 border-slate-200 text-center space-y-4 shadow-sm text-slate-900">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Clearance Memo</span>
                  <h2 className="text-2xl font-black text-slate-900 mt-1">Certificate of Account Settlement</h2>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                  This document certifies that <strong className="text-slate-900">{client?.company}</strong> has recorded a total settled turnover of <strong className="text-emerald-600">AED {stats.totalPaid.toLocaleString()}</strong> across {stats.paidCount} fulfilled media contracts.
                </p>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Settled Invoices</span>
                    <span className="font-black text-slate-900">{stats.paidCount} Invoices</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Remaining Due</span>
                    <span className={`font-black ${stats.balance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      AED {stats.balance.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-bold">
                  <span>Issuer: {settings?.name || 'Accounts & Invoicing'}</span>
                  <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleDownloadSettlementCSV}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-1.5"
                >
                  <FileSpreadsheet size={15} />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={handleDownloadCertificatePDF}
                  disabled={isExportingPdf}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 flex items-center space-x-1.5 shadow-md disabled:opacity-50"
                >
                  {isExportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={handlePrintCertificate}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 flex items-center space-x-1.5 shadow-md"
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statements;

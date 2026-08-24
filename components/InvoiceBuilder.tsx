import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, ChevronLeft, Save, Calendar, UserPlus, Printer, X, Download, 
  FileCheck, CheckCircle2, FileSignature, FileText, Loader2, Mail, Send, 
  Copy, ExternalLink, Hash, MapPin, Phone, Clock
} from 'lucide-react';
import { Invoice, Client, LineItem, ProjectType, InvoiceStatus, CompanySettings, UserRole, PaymentMethod } from '../types';
import { downloadElementAsPdf, printElementDirectly } from '../utils/pdfExport';
import { formatMoney, getCurrencySymbol } from '../utils/currency';

interface InvoiceBuilderProps {
  invoiceId: string | null;
  autoPrint?: boolean;
  clients: Client[];
  invoices: Invoice[];
  onAddClient: (c: Client) => void;
  settings: CompanySettings;
  role: UserRole;
  onSave: (invoice: Invoice) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({ 
  invoiceId, 
  autoPrint, 
  clients, 
  invoices, 
  onAddClient, 
  settings, 
  role, 
  onSave, 
  onCancel,
  onDelete
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportStatusMsg, setExportStatusMsg] = useState('');

  // Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Quick Client Registration State
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState<Partial<Client>>({
    company: '',
    name: '',
    email: '',
    phone: '',
    trn: '',
    address: 'Dubai, UAE',
    notes: ''
  });

  const currencyCode = settings?.defaultCurrency || 'AED';
  const currSym = getCurrencySymbol(currencyCode);
  const formatCurr = (amount: number) => formatMoney(amount, currencyCode);

  const getToday = () => new Date().toISOString().split('T')[0];
  const calculateDueDate = (fromDate: string, days: number) => {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const formatDateStrict = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const getNextInvoiceId = () => {
    const ids = invoices
      .map(inv => {
        const match = inv.id.match(/INV-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(id => !isNaN(id));
    
    const maxId = ids.length > 0 ? Math.max(...ids) : 1000;
    return `INV-${(maxId + 1).toString().padStart(3, '0')}`;
  };

  const [dueTermOption, setDueTermOption] = useState<string>('7');

  const [invoice, setInvoice] = useState<Invoice>(() => {
    return {
      id: getNextInvoiceId(),
      date: getToday(),
      dueDate: calculateDueDate(getToday(), 7),
      status: InvoiceStatus.DRAFT,
      taxRate: settings.defaultTaxRate ?? 5,
      currency: settings.defaultCurrency || 'AED',
      discount: 0,
      items: [
        {
          id: Math.random().toString(36).substr(2, 9),
          description: 'Product or Service',
          serviceType: ProjectType.VIDEO_PRODUCTION,
          quantity: 1,
          rate: 1000
        }
      ],
      clientId: clients[0]?.id || '',
      notes: `Payment Terms: Due within 7 days. Bank transfer to account on file. TRN: ${settings.vatNumber || ''}`
    };
  });

  const selectedClient = clients.find(c => c.id === invoice.clientId) || clients[0];

  const handlePrint = async () => {
    const title = `${invoice.status === InvoiceStatus.QUOTATION ? 'Quotation' : 'Invoice'} ${invoice.id}`;
    await printElementDirectly('invoice-print-sheet', title);
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    setExportStatusMsg('Preparing PDF export...');
    const filename = `${invoice.status === InvoiceStatus.QUOTATION ? 'Quotation' : 'Invoice'}-${invoice.id}`;
    
    await downloadElementAsPdf('invoice-print-sheet', filename, (status, msg) => {
      if (msg) setExportStatusMsg(msg);
    });

    setTimeout(() => {
      setIsExportingPdf(false);
      setExportStatusMsg('');
    }, 1200);
  };

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  useEffect(() => {
    if (invoiceId) {
      const savedInvoices = localStorage.getItem('cf_invoices');
      if (savedInvoices) {
        try {
          const list = JSON.parse(savedInvoices);
          if (Array.isArray(list)) {
            const existing = list.find((i: Invoice) => i.id === invoiceId);
            if (existing) setInvoice(existing);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [invoiceId]);

  const handleDateChange = (date: string) => {
    const days = dueTermOption === 'custom' ? 0 : parseInt(dueTermOption) || 7;
    setInvoice(prev => ({
      ...prev,
      date,
      dueDate: dueTermOption === 'custom' ? prev.dueDate : calculateDueDate(date, days)
    }));
  };

  const handleDueTermChange = (termDays: string) => {
    setDueTermOption(termDays);
    if (termDays === 'custom') return;
    const days = parseInt(termDays) || 0;
    const newDueDate = calculateDueDate(invoice.date, days);
    setInvoice(prev => ({
      ...prev,
      dueDate: newDueDate
    }));
  };

  const updateItem = (itemId: string, updates: Partial<LineItem>) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === itemId ? { ...item, ...updates } : item)
    }));
  };

  const addItem = () => {
    const newItem: LineItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: 'Product or Service Description',
      serviceType: ProjectType.VIDEO_PRODUCTION,
      quantity: 1,
      rate: 500
    };
    setInvoice(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const subtotal = invoice.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
  const discountAmount = subtotal * (invoice.discount / 100);
  const tax = (subtotal - discountAmount) * (invoice.taxRate / 100);
  const total = subtotal - discountAmount + tax;
  
  const isQuotation = invoice.status === InvoiceStatus.QUOTATION;
  const docTypeLabel = isQuotation ? 'Quotation' : 'Tax Invoice';

  // Open Email Modal with Pre-filled Details
  const handleOpenEmailModal = () => {
    const client = selectedClient;
    const recipient = client?.email || '';
    const subject = `${docTypeLabel} #${invoice.id} from ${settings.name || 'Af© ACCOUNTS'} - Total: ${formatCurr(total)}`;
    
    const itemsList = invoice.items.map(it => `• ${it.description}: ${it.quantity} x ${formatCurr(it.rate)} = ${formatCurr(it.quantity * it.rate)}`).join('\n');

    const body = `Dear ${client?.name || client?.company || 'Valued Client'},

Please find the details for ${docTypeLabel} #${invoice.id} issued by ${settings.name || 'Af© ACCOUNTS'}.

SUMMARY OF CHARGES:
${itemsList}

----------------------------------------
Subtotal: ${formatCurr(subtotal)}
Tax / VAT (${invoice.taxRate}%): ${formatCurr(tax)}
TOTAL PAYABLE: ${formatCurr(total)}
----------------------------------------

Issue Date: ${formatDateStrict(invoice.date)}
Due Date: ${formatDateStrict(invoice.dueDate)}

PAYMENT INSTRUCTIONS:
${invoice.notes || `Payment due by ${formatDateStrict(invoice.dueDate)} via Bank Transfer.`}

Company TRN: ${settings.vatNumber || ''}
Company Contact: ${settings.email || ''}

Thank you for your business!

Warm regards,
${settings.name || 'Af© ACCOUNTS'}`;

    setEmailTo(recipient);
    setEmailSubject(subject);
    setEmailBody(body);
    setEmailSuccessMsg('');
    setIsEmailModalOpen(true);
  };

  // Launch Default Mail Client (mailto)
  const handleSendViaMailClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoUrl;
  };

  // Automated In-App Email Sender simulation with log & status
  const handleAutomatedSend = () => {
    if (!emailTo) {
      alert('Please enter a recipient email address.');
      return;
    }
    setIsSendingEmail(true);
    setTimeout(() => {
      setIsSendingEmail(false);
      setEmailSuccessMsg(`✓ Bill successfully dispatched to ${emailTo} with PDF invoice summary!`);
      if (invoice.status === InvoiceStatus.DRAFT) {
        setInvoice(prev => ({ ...prev, status: InvoiceStatus.SENT }));
      }
    }, 1200);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`To: ${emailTo}\nSubject: ${emailSubject}\n\n${emailBody}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Quick Client Save
  const handleSaveQuickClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientForm.company?.trim() || !quickClientForm.name?.trim()) return;

    const newClient: Client = {
      id: `c-${Date.now().toString(36)}`,
      name: quickClientForm.name.trim(),
      company: quickClientForm.company.trim(),
      email: quickClientForm.email?.trim() || '',
      phone: quickClientForm.phone?.trim() || '',
      trn: quickClientForm.trn?.trim() || '',
      address: quickClientForm.address?.trim() || 'Dubai, UAE',
      notes: quickClientForm.notes?.trim() || ''
    };

    onAddClient(newClient);
    setInvoice(prev => ({ ...prev, clientId: newClient.id }));
    setIsAddingClient(false);
    setQuickClientForm({
      company: '',
      name: '',
      email: '',
      phone: '',
      trn: '',
      address: 'Dubai, UAE',
      notes: ''
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in zoom-in-95 duration-300">
      {/* Toast Notification when exporting PDF */}
      {isExportingPdf && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl z-50 flex items-center space-x-3 border border-slate-700 animate-in slide-in-from-bottom-3 no-print">
          <Loader2 size={18} className="animate-spin text-indigo-400" />
          <span className="text-xs font-bold">{exportStatusMsg || 'Generating PDF file...'}</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <button 
          onClick={onCancel} 
          className="flex items-center space-x-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold"
        >
          <ChevronLeft size={20} /> <span>Return to List</span>
        </button>
        
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
           <button 
              onClick={() => setInvoice(p => ({...p, status: InvoiceStatus.DRAFT}))}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${!isQuotation ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}
           >
             <FileText size={14} /> Official Invoice
           </button>
           <button 
              onClick={() => setInvoice(p => ({...p, status: InvoiceStatus.QUOTATION}))}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isQuotation ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}
           >
             <FileSignature size={14} /> Customer Quotation
           </button>
        </div>

        <div className="flex flex-wrap items-center space-x-2">
          {/* Send Email Button */}
          <button 
            onClick={handleOpenEmailModal}
            title="Send bill to client email"
            className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-sm"
          >
            <Mail size={16} /> <span>Send Email</span>
          </button>

          {/* Delete Document Button (if editing existing) */}
          {invoiceId && invoiceId !== 'new' && onDelete && (
            <button 
              onClick={() => {
                if (confirm(`Are you sure you want to permanently delete document #${invoice.id}?`)) {
                  onDelete(invoice.id);
                  onCancel();
                }
              }}
              title="Delete Document"
              className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-sm"
            >
              <Trash2 size={16} /> <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          {/* Quick Print Button */}
          <button 
            onClick={handlePrint}
            title="Print Document directly"
            className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-2xl font-black uppercase text-xs tracking-wider transition-all"
          >
            <Printer size={16} /> <span className="hidden sm:inline">Print</span>
          </button>

          {/* Download PDF Button */}
          <button 
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-5 py-2.5 rounded-2xl font-black uppercase text-xs tracking-wider shadow-md transition-all disabled:opacity-50"
          >
            {isExportingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>{isExportingPdf ? 'Exporting...' : 'Download PDF'}</span>
          </button>

          {/* Save Button */}
          <button 
            onClick={() => onSave(invoice)} 
            className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black uppercase text-xs tracking-wider hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
          >
            <Save size={16} /> <span>Save</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Sheet */}
      <div 
        id="invoice-print-sheet" 
        className="bg-white rounded-[32px] border border-slate-200 shadow-2xl p-8 md:p-14 relative overflow-hidden text-slate-900 print:shadow-none print:border-none print:p-4"
      >
        {/* Accent top stripe */}
        <div className={`absolute top-0 left-0 w-full h-3 ${isQuotation ? 'bg-slate-600' : 'bg-slate-900'}`}></div>
        
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-12 relative z-10 gap-8">
          {/* Company Brand Logo & Information (Left) */}
          <div className="flex items-start space-x-5 max-w-xl">
            {settings.logoUrl ? (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
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
              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md flex-shrink-0 ${isQuotation ? 'bg-slate-700' : 'bg-slate-900'}`}>
                {settings.name ? settings.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AC' : 'AC'}
              </div>
            )}
            
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {settings.name || 'Accounts & Invoicing'}
              </h1>
              {settings.address && (
                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md">
                  {settings.address}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1 font-medium">
                {settings.email && <span>{settings.email}</span>}
                {settings.vatNumber && (
                  <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md text-[11px] inline-flex items-center justify-center">
                    TRN: {settings.vatNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Document Reference, Number & Dates (Right) */}
          <div className="flex flex-col items-start md:items-end space-y-3 flex-shrink-0">
            <div className="text-left md:text-right">
              <div className={`inline-flex items-center justify-center text-center px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider mb-1 text-white ${isQuotation ? 'bg-slate-600' : 'bg-slate-900'}`}>
                {docTypeLabel}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                #{invoice.id}
              </h2>
            </div>

            {invoice.status === InvoiceStatus.PAID && (
              <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-xl flex items-center justify-center gap-2 shadow-sm text-center">
                <CheckCircle2 size={16} />
                <div className="flex flex-col text-center items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">Payment Settled</span>
                  <span className="text-xs font-bold uppercase">Via {invoice.paymentMethod || 'Bank Transfer'}</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-end gap-3">
              <div className="flex flex-col items-center md:items-end text-center md:text-right">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Date</span>
                <div className="date-badge-black text-xs md:text-sm mt-0.5 font-bold">
                  {formatDateStrict(invoice.date)}
                </div>
                <div className="no-print mt-1 flex justify-end">
                  <input 
                    type="date" 
                    value={invoice.date} 
                    onChange={e => handleDateChange(e.target.value)} 
                    className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 outline-none cursor-pointer hover:bg-slate-200 text-center" 
                  />
                </div>
              </div>

              {!isQuotation && invoice.status !== InvoiceStatus.PAID && (
                <div className="flex flex-col items-center md:items-end text-center md:text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</span>
                  <div className="date-badge-black text-xs md:text-sm mt-0.5 font-bold">
                    {formatDateStrict(invoice.dueDate)}
                  </div>
                  <div className="no-print mt-1 flex flex-col items-end gap-1">
                    <select
                      value={dueTermOption}
                      onChange={e => handleDueTermChange(e.target.value)}
                      className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 outline-none cursor-pointer hover:bg-slate-200"
                    >
                      <option value="0">Immediate / Receipt</option>
                      <option value="7">7 Days (Standard)</option>
                      <option value="14">14 Days</option>
                      <option value="30">30 Days (Net 30)</option>
                      <option value="60">60 Days (Net 60)</option>
                      <option value="custom">Custom Date</option>
                    </select>
                    {dueTermOption === 'custom' && (
                      <input 
                        type="date" 
                        value={invoice.dueDate} 
                        onChange={e => setInvoice(prev => ({ ...prev, dueDate: e.target.value }))} 
                        className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 outline-none cursor-pointer hover:bg-slate-200 text-center" 
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Client Details (Billed To) & Invoice Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 pb-8 border-b border-slate-200">
          {/* Billed To / Client Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between no-print">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Billed To (Client Details)</h3>
               <button 
                 onClick={() => setIsAddingClient(true)} 
                 className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center space-x-1"
               >
                 <UserPlus size={12} />
                 <span>+ Quick Add Client</span>
               </button>
            </div>

            {/* Static print & capture aligned block */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
               <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-2">
                 <div>
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer / Company</h3>
                   <p className="text-base md:text-lg font-black text-slate-900 leading-tight">
                     {selectedClient?.company || 'Select Client'}
                   </p>
                 </div>
                 {selectedClient?.trn && (
                   <span className="font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded text-[10px] flex-shrink-0">
                     TRN: {selectedClient.trn}
                   </span>
                 )}
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                 <div>
                   <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Contact Person:</span>
                   <span className="font-bold text-slate-800">{selectedClient?.name || '—'}</span>
                 </div>
                 <div>
                   <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Contact Phone:</span>
                   <span className="font-mono font-semibold text-slate-800">{selectedClient?.phone || '—'}</span>
                 </div>
                 <div className="sm:col-span-2">
                   <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Email Address:</span>
                   <span className="font-medium text-slate-800">{selectedClient?.email || '—'}</span>
                 </div>
                 <div className="sm:col-span-2">
                   <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Registered Billing Address:</span>
                   <span className="text-slate-600 leading-relaxed block">{selectedClient?.address || 'No registered billing address recorded'}</span>
                 </div>
               </div>
            </div>

            {/* Interactive Selector on Screen */}
            <div className="no-print pt-1 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Switch Client Account:</label>
              <select 
                value={invoice.clientId} 
                onChange={e => setInvoice(prev => ({...prev, clientId: e.target.value}))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company} — {c.name} {c.trn ? `(TRN: ${c.trn})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Invoice Summary Details */}
          <div className="text-left md:text-right space-y-3">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Billing Terms & Currency</h3>
             <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs text-slate-600">
               <div className="flex md:justify-end gap-3 justify-between">
                 <span className="text-slate-400 font-bold">Currency:</span>
                 <span className="font-black text-slate-900">{currencyCode} ({currSym})</span>
               </div>
               <div className="flex md:justify-end gap-3 justify-between">
                 <span className="text-slate-400 font-bold">Tax Application:</span>
                 <span className="font-black text-slate-900">{invoice.taxRate}% VAT / Tax</span>
               </div>
               <div className="flex md:justify-end gap-3 justify-between">
                 <span className="text-slate-400 font-bold">Issue Date:</span>
                 <span className="font-bold text-slate-800">{formatDateStrict(invoice.date)}</span>
               </div>
               <div className="flex md:justify-end gap-3 justify-between border-t border-slate-200/60 pt-1.5">
                 <span className="text-slate-400 font-bold">Payment Due Date:</span>
                 <span className="font-black text-indigo-700">{formatDateStrict(invoice.dueDate)}</span>
               </div>
             </div>
          </div>
        </div>

        {/* Table of Line Items (Aligned with pixel precision) */}
        <div className="mb-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b-2 ${isQuotation ? 'border-slate-400' : 'border-slate-900'}`}>
                <th className="pb-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">
                  Item / Service Description
                </th>
                <th className="pb-3 text-center text-xs font-black text-slate-500 uppercase w-20 tracking-wider">
                  Qty
                </th>
                <th className="pb-3 text-right text-xs font-black text-slate-500 uppercase w-32 tracking-wider">
                  Rate ({currSym})
                </th>
                <th className="pb-3 text-right text-xs font-black text-slate-500 uppercase w-36 tracking-wider">
                  Total ({currSym})
                </th>
                <th className="pb-3 text-right text-xs font-black text-slate-500 uppercase w-8 no-print"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item, idx) => (
                <tr key={item.id || idx} className="group hover:bg-slate-50/60">
                  {/* Description */}
                  <td className="py-3.5 pr-3 text-left">
                    <div className="no-print">
                      <input 
                        value={item.description} 
                        onChange={e => updateItem(item.id, {description: e.target.value})} 
                        className="w-full outline-none font-bold text-slate-900 bg-transparent text-xs sm:text-sm py-1 px-2 rounded-lg border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white transition-all" 
                        placeholder="Product or service details..."
                      />
                    </div>
                    <div className="item-description-print hidden print:block font-bold text-slate-900 text-xs sm:text-sm text-left">
                      {item.description || 'Product or Service'}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className="py-3.5 px-2 text-center align-middle">
                    <div className="no-print flex justify-center">
                      <input 
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, {quantity: Math.max(1, parseInt(e.target.value) || 0)})}
                        className="w-14 text-center font-bold text-slate-900 bg-slate-100 rounded-lg py-1 px-1 outline-none text-xs sm:text-sm focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div className="item-qty-print hidden print:block font-bold text-slate-900 text-xs sm:text-sm text-center">
                      {item.quantity}
                    </div>
                  </td>

                  {/* Rate */}
                  <td className="py-3.5 px-2 text-right align-middle">
                    <div className="no-print flex justify-end">
                      <input 
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={e => updateItem(item.id, {rate: parseFloat(e.target.value) || 0})}
                        className="w-24 text-right font-bold bg-slate-100 text-slate-900 rounded-lg py-1 px-2 outline-none text-xs sm:text-sm focus:ring-2 focus:ring-black"
                      />
                    </div>
                    <div className="item-rate-print hidden print:block font-bold text-slate-900 text-xs sm:text-sm text-right">
                      {item.rate.toLocaleString()}
                    </div>
                  </td>

                  {/* Total */}
                  <td className="py-3.5 pl-2 text-right font-black text-slate-900 align-middle">
                    <span className="text-xs sm:text-sm">{formatCurr(item.quantity * item.rate)}</span>
                  </td>

                  {/* Remove Button */}
                  <td className="no-print w-8 text-right py-3.5 align-middle">
                    <button 
                      onClick={() => setInvoice(p => ({...p, items: p.items.filter(i => i.id !== item.id)}))}
                      className="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button 
            onClick={addItem} 
            className="no-print mt-4 flex items-center space-x-2 text-white font-black text-xs uppercase tracking-wider bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-98"
          >
            <Plus size={14} /> <span>Add Line Item</span>
          </button>
        </div>

        {/* Footer Notes & Summary Totals (Aligned and crisp) */}
        <div className="flex flex-col md:flex-row justify-between pt-8 border-t-2 border-slate-100 gap-8">
          {/* Left: Notes & Bank Info */}
          <div className="flex-1 space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
               {isQuotation ? 'Quote Terms & Conditions' : 'Payment Instructions & Bank Details'}
             </label>
             <textarea 
                value={invoice.notes} 
                onChange={e => setInvoice(p => ({...p, notes: e.target.value}))} 
                className="w-full h-28 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-medium text-slate-700 outline-none no-print focus:ring-2 focus:ring-black leading-relaxed" 
                placeholder="Payment details, bank transfer instructions, or quote terms..."
             />
             <div className="notes-print hidden print:block text-xs text-slate-600 leading-relaxed whitespace-pre-line border-l-2 border-slate-300 pl-3">
               {invoice.notes}
             </div>
          </div>

          {/* Right: Summary Totals */}
          <div className="w-full md:w-80 space-y-3 text-right">
             <div className="flex justify-between items-center text-slate-500 font-bold text-xs uppercase tracking-wider">
                <span>Subtotal</span>
                <span className="text-slate-900 font-black text-sm">{formatCurr(subtotal)}</span>
             </div>
             <div className="flex justify-between items-center text-slate-500 font-bold text-xs uppercase tracking-wider">
                <span>VAT / Tax ({invoice.taxRate}%)</span>
                <span className="text-slate-900 font-black text-sm">{formatCurr(tax)}</span>
             </div>
             <div className={`flex justify-between items-end pt-4 border-t-2 ${isQuotation ? 'border-slate-400' : 'border-slate-900'}`}>
                <div>
                  <span className="font-black text-slate-900 text-sm md:text-base tracking-tight uppercase block text-left">
                    {isQuotation ? 'Total Quote' : 'Total Amount Due'}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`text-2xl md:text-3xl font-black tracking-tight leading-none ${isQuotation ? 'text-slate-800' : 'text-indigo-600'}`}>
                    {formatCurr(total)}
                  </span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: SEND EMAIL MODAL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  <Mail size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Send Invoice via Email</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pre-formatted billing statement sent to saved client email</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEmailModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {emailSuccessMsg && (
                <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 size={16} />
                  <span>{emailSuccessMsg}</span>
                </div>
              )}

              {/* Recipient */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Client Email Address *</label>
                <input
                  type="email"
                  required
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="billing@clientcompany.ae"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Subject Line</label>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Message Body */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email Content & Breakdown</label>
                <textarea
                  rows={8}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-wrap gap-2 justify-between items-center">
              <button
                onClick={handleCopyEmail}
                className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 px-3 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm"
              >
                <Copy size={14} />
                <span>{isCopied ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSendViaMailClient}
                  className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider"
                >
                  <ExternalLink size={14} />
                  <span>Open in Mail App</span>
                </button>

                <button
                  onClick={handleAutomatedSend}
                  disabled={isSendingEmail}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50"
                >
                  {isSendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{isSendingEmail ? 'Sending...' : 'Send Invoice'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FULL QUICK CLIENT REGISTRATION */}
      {isAddingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">Quick Add Client</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add company TRN, billing address, and contact details to select immediately.</p>
              </div>
              <button onClick={() => setIsAddingClient(false)} className="text-slate-400 hover:text-slate-600 p-1.5">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickClient} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Company Name *</label>
                  <input
                    required
                    placeholder="e.g. Dubai Media Hub LLC"
                    value={quickClientForm.company}
                    onChange={e => setQuickClientForm({ ...quickClientForm, company: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Contact Person *</label>
                  <input
                    required
                    placeholder="e.g. Tariq Mansoor"
                    value={quickClientForm.name}
                    onChange={e => setQuickClientForm({ ...quickClientForm, name: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">UAE TRN / Tax Reg Number</label>
                  <input
                    placeholder="e.g. 100293847500003"
                    value={quickClientForm.trn}
                    onChange={e => setQuickClientForm({ ...quickClientForm, trn: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Billing Email</label>
                  <input
                    type="email"
                    placeholder="billing@company.ae"
                    value={quickClientForm.email}
                    onChange={e => setQuickClientForm({ ...quickClientForm, email: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Phone / Mobile</label>
                  <input
                    placeholder="+971 50 123 4567"
                    value={quickClientForm.phone}
                    onChange={e => setQuickClientForm({ ...quickClientForm, phone: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Full Billing Address</label>
                  <textarea
                    rows={2}
                    placeholder="Suite 501, Bay Square Building 2, Business Bay, Dubai, UAE"
                    value={quickClientForm.address}
                    onChange={e => setQuickClientForm({ ...quickClientForm, address: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg"
                >
                  Save & Apply to Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingClient(false)}
                  className="px-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold text-xs uppercase"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceBuilder;

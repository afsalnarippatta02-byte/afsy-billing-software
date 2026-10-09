import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  Save,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Printer,
  Check,
  Building2,
  MapPin,
  FileText,
  Mail,
  Phone,
  Hash,
  Download,
  CreditCard,
  Send,
  Copy,
  ExternalLink,
  X,
  Loader2,
  CheckCircle2,
  FileBadge,
  AlertTriangle,
  PenTool,
  Stamp,
  LayoutTemplate
} from 'lucide-react';
import { Invoice, InvoiceStatus, LineItem, Client, CompanySettings, UserRole, PaymentMethod } from '../types';
import { SERVICE_PRESETS, INVOICE_TEMPLATE_PRESETS } from '../constants';
import { geminiService } from '../services/geminiService';
import { downloadElementAsPdf, printElementDirectly, downloadDocumentAsHtml } from '../utils/pdfExport';
import { getCurrencySymbol } from '../utils/currency';

interface InvoiceBuilderProps {
  invoiceId: string | null;
  initialDocumentType?: 'INVOICE' | 'PROFORMA' | 'QUOTATION';
  autoPrint?: boolean;
  clients: Client[];
  invoices?: Invoice[];
  onAddClient: (client: Client) => void;
  settings: CompanySettings;
  role: UserRole;
  onSave: (invoice: Invoice) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
}

const getNextSequentialNumber = (existingInvoices: Invoice[] = [], prefix: string = 'INV-') => {
  let maxNumber = 2026120;
  existingInvoices.forEach(inv => {
    const matches = inv.id.match(/\d+/g);
    if (matches && matches.length > 0) {
      const lastNumStr = matches[matches.length - 1];
      const num = parseInt(lastNumStr, 10);
      if (!isNaN(num) && num >= 2026000 && num > maxNumber) {
        maxNumber = num;
      }
    }
  });
  return `${prefix}${maxNumber + 1}`;
};

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({
  invoiceId,
  initialDocumentType = 'INVOICE',
  autoPrint,
  clients,
  invoices = [],
  onAddClient,
  settings,
  role,
  onSave,
  onDelete,
  onCancel
}) => {
  const getToday = () => new Date().toISOString().split('T')[0];
  const getNextMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const initialPrefix =
    initialDocumentType === 'PROFORMA'
      ? 'PI-'
      : initialDocumentType === 'QUOTATION'
      ? 'QT-'
      : settings.invoicePrefix || 'INV-';

  const initialStatus =
    initialDocumentType === 'PROFORMA'
      ? InvoiceStatus.PROFORMA
      : initialDocumentType === 'QUOTATION'
      ? InvoiceStatus.QUOTATION
      : InvoiceStatus.DRAFT;

  const [invoice, setInvoice] = useState<Invoice>(() => ({
    id: getNextSequentialNumber(invoices, initialPrefix),
    clientId: clients[0]?.id || '',
    date: getToday(),
    dueDate: getNextMonth(),
    status: initialStatus,
    documentType: initialDocumentType,
    items: [
      { id: '1', category: 'Ad Campaign', service: 'Shoot', description: 'Main Commercial Shoot Day', quantity: 1, rate: 5000 }
    ],
    taxRate: settings.defaultTaxRate ?? 5,
    currency: settings.defaultCurrency || 'AED',
    discount: 0,
    paymentMethod: PaymentMethod.BANK_TRANSFER,
    includeSignature: settings.autoApplySignature ?? Boolean(settings.signatureUrl),
    includeSeal: settings.autoApplySeal ?? Boolean(settings.companySealUrl),
    notes:
      initialDocumentType === 'PROFORMA'
        ? `Proforma Invoice valid for 15 days. 50% mobilization advance requested prior to production.\nBank: ${settings.bankName || 'Emirates NBD'} | IBAN: ${settings.iban || 'AE0000000000000'}`
        : `Please make all payments to ${settings.beneficiaryName || settings.name}. Bank: ${settings.bankName || 'Emirates NBD'} | IBAN: ${settings.iban || 'AE0000000000000'}`
  }));

  const [isPolishing, setIsPolishing] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportStatusMsg, setExportStatusMsg] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Active Invoice Template & Format Customization State (synced from Settings, with quick switcher support)
  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    () => settings.invoiceTemplate || 'executive_indigo'
  );

  useEffect(() => {
    if (settings.invoiceTemplate) {
      setActiveTemplateId(settings.invoiceTemplate);
    }
  }, [settings.invoiceTemplate]);

  const activePreset =
    INVOICE_TEMPLATE_PRESETS.find(p => p.id === activeTemplateId) || INVOICE_TEMPLATE_PRESETS[0];
  const isCustomMatchesSettings = activeTemplateId === (settings.invoiceTemplate || 'executive_indigo');
  const invAccentColor = isCustomMatchesSettings
    ? settings.invoiceAccentColor || activePreset.accentColor
    : activePreset.accentColor;
  const invHeaderLayout = isCustomMatchesSettings
    ? settings.invoiceHeaderLayout || activePreset.headerLayout
    : activePreset.headerLayout;
  const invTableStyle = isCustomMatchesSettings
    ? settings.invoiceTableStyle || activePreset.tableStyle
    : activePreset.tableStyle;
  const invFontStyle = isCustomMatchesSettings
    ? settings.invoiceFontStyle || activePreset.fontStyle || 'sans'
    : activePreset.fontStyle || 'sans';
  const invCompact = isCustomMatchesSettings
    ? settings.invoiceCompactMode ?? Boolean(activePreset.compactMode)
    : Boolean(activePreset.compactMode);
  const invShowCatCol = settings.invoiceShowCategoryCol !== false;
  const invShowBankBox = settings.invoiceShowBankDetails !== false;
  const invCustomHeading = settings.invoiceCustomTitle || 'TAX INVOICE';

  // Quick Client Creation Modal State
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({
    company: '',
    name: '',
    email: '',
    phone: '',
    trn: '',
    address: ''
  });

  // Email Sending Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (invoiceId && invoiceId !== 'new') {
      const found = invoices.find(i => i.id === invoiceId);
      if (found) {
        setInvoice({
          ...found,
          paymentMethod: found.paymentMethod || PaymentMethod.BANK_TRANSFER,
          includeSignature:
            found.includeSignature !== undefined
              ? found.includeSignature
              : settings.autoApplySignature ?? Boolean(settings.signatureUrl),
          includeSeal:
            found.includeSeal !== undefined
              ? found.includeSeal
              : settings.autoApplySeal ?? Boolean(settings.companySealUrl)
        });
      }
    }
  }, [invoiceId, invoices]);

  const handleDownloadPdf = useCallback(async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setExportStatusMsg('Preparing PDF...');

    const docPrefix =
      invoice.status === InvoiceStatus.QUOTATION
        ? 'Quotation'
        : invoice.status === InvoiceStatus.PROFORMA
        ? 'Proforma_Invoice'
        : 'Invoice';

    await downloadElementAsPdf(
      'invoice-printable-document',
      `${docPrefix}_${invoice.id}.pdf`,
      (_status, msg) => {
        if (msg) setExportStatusMsg(msg);
      }
    );

    setTimeout(() => {
      setIsExportingPdf(false);
      setExportStatusMsg('');
    }, 1200);
  }, [invoice.id, invoice.status, isExportingPdf]);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        handleDownloadPdf();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, handleDownloadPdf]);

  const addItem = () => {
    setInvoice(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Math.random().toString(36).substr(2, 9),
          category: 'Poster Design',
          service: ' Design',
          description: '',
          quantity: 1,
          rate: 500
        }
      ]
    }));
  };

  const removeItem = (itemId: string) => {
    setInvoice(prev => {
      if (prev.items.length <= 1) {
        return {
          ...prev,
          items: [{ ...prev.items[0], description: '', quantity: 1, rate: 0 }]
        };
      }
      return {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId)
      };
    });
  };

  const updateItem = (id: string, updates: Partial<LineItem>) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.map(item => (item.id === id ? { ...item, ...updates } : item))
    }));
  };

  const switchDocumentMode = (mode: 'INVOICE' | 'PROFORMA' | 'QUOTATION') => {
    setInvoice(prev => {
      const numericPart = prev.id.replace(/^(INV-|PI-|QT-)/i, '');
      const nextPrefix = mode === 'PROFORMA' ? 'PI-' : mode === 'QUOTATION' ? 'QT-' : settings.invoicePrefix || 'INV-';
      const nextStatus =
        mode === 'PROFORMA'
          ? InvoiceStatus.PROFORMA
          : mode === 'QUOTATION'
          ? InvoiceStatus.QUOTATION
          : prev.status === InvoiceStatus.PROFORMA || prev.status === InvoiceStatus.QUOTATION
          ? InvoiceStatus.SENT
          : prev.status;

      return {
        ...prev,
        id: `${nextPrefix}${numericPart}`,
        status: nextStatus,
        documentType: mode
      };
    });
  };

  const handleSaveQuickClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientForm.company.trim() || !quickClientForm.name.trim()) return;
    const newClient: Client = {
      id: `c-${Date.now().toString(36)}`,
      name: quickClientForm.name.trim(),
      company: quickClientForm.company.trim(),
      email: quickClientForm.email.trim(),
      phone: quickClientForm.phone.trim(),
      trn: quickClientForm.trn.trim(),
      address: quickClientForm.address.trim()
    };
    onAddClient(newClient);
    setInvoice(prev => ({ ...prev, clientId: newClient.id }));
    setQuickClientForm({ company: '', name: '', email: '', phone: '', trn: '', address: '' });
    setIsAddingClient(false);
  };

  const handlePolish = async (item: LineItem) => {
    setIsPolishing(item.id);
    const polished = await geminiService.polishInvoiceDescription(item.service, item.description);
    updateItem(item.id, { description: polished });
    setIsPolishing(null);
  };

  const subtotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.rate, 0);
  const discountAmount = subtotal * ((invoice.discount || 0) / 100);
  const tax = (subtotal - discountAmount) * ((invoice.taxRate || 0) / 100);
  const total = subtotal - discountAmount + tax;

  const isQuotation = invoice.status === InvoiceStatus.QUOTATION;
  const isProforma = invoice.status === InvoiceStatus.PROFORMA;
  const activeClient = clients.find(c => c.id === invoice.clientId);

  const currSym = getCurrencySymbol(invoice.currency || settings.defaultCurrency || 'AED');
  const formatCurr = (val: number) => `${currSym} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const openEmailModal = () => {
    const client = clients.find(c => c.id === invoice.clientId);
    const docType = isQuotation ? 'Quotation' : isProforma ? 'Proforma Invoice' : 'Tax Invoice';

    setEmailTo(client?.email || '');
    setEmailSubject(`${docType} #${invoice.id} from ${settings.name || 'Af© ACCOUNTS'}`);

    const itemsSummary = invoice.items
      .map(
        i =>
          `• ${i.service || i.category}: ${i.description || 'Service'} (${i.quantity} x ${currSym} ${i.rate.toLocaleString()}) = ${currSym} ${(i.quantity * i.rate).toLocaleString()}`
      )
      .join('\n');

    const bodyText = `Dear ${client?.name || client?.company || 'Valued Client'},

Greetings from ${settings.name || 'Af© ACCOUNTS'}.

Please find below the summary for ${docType} #${invoice.id}, issued on ${formatDate(invoice.date)}:

--------------------------------------------------
${docType.toUpperCase()} SUMMARY (#${invoice.id})
--------------------------------------------------
${itemsSummary}

Subtotal: ${currSym} ${subtotal.toLocaleString()}
VAT (${invoice.taxRate}%): ${currSym} ${tax.toLocaleString()}
Total Amount: ${currSym} ${total.toLocaleString()}
${isQuotation ? 'Valid Until' : 'Due Date'}: ${formatDate(invoice.dueDate)}
--------------------------------------------------

Payment / Remittance Details:
Beneficiary: ${settings.beneficiaryName || settings.name}
Bank: ${settings.bankName || 'Emirates NBD'}
IBAN: ${settings.iban || settings.bankAccount || 'N/A'}
Account Number: ${settings.accountNumber || settings.bankAccount || 'N/A'}

Thank you for your business. Please let us know if you have any questions.

Best regards,
${settings.name || 'Af© ACCOUNTS'}
${settings.phone || ''}
${settings.email || ''}`;

    setEmailBody(bodyText);
    setEmailSuccessMsg('');
    setIsEmailModalOpen(true);
  };

  const handleSendViaMailClient = () => {
    if (!emailTo.trim()) return;
    const mailtoLink = `mailto:${encodeURIComponent(emailTo.trim())}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
    if (invoice.status === InvoiceStatus.DRAFT) {
      setInvoice(prev => ({ ...prev, status: InvoiceStatus.SENT }));
    }
    setEmailSuccessMsg(`Opened mail client addressed to ${emailTo}!`);
  };

  const handleAutomatedSend = () => {
    if (!emailTo.trim()) return;
    setIsSendingEmail(true);
    setTimeout(() => {
      setIsSendingEmail(false);
      if (invoice.status === InvoiceStatus.DRAFT) {
        setInvoice(prev => ({ ...prev, status: InvoiceStatus.SENT }));
      }
      setEmailSuccessMsg(`Successfully dispatched ${isQuotation ? 'Quotation' : isProforma ? 'Proforma Invoice' : 'Invoice'} #${invoice.id} to ${emailTo}!`);
    }, 900);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`To: ${emailTo}\nSubject: ${emailSubject}\n\n${emailBody}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrint = () => {
    const prefix = isQuotation ? 'Quotation' : isProforma ? 'Proforma' : 'Invoice';
    printElementDirectly('invoice-printable-document', `${prefix}_${invoice.id}`);
  };

  const handleSaveAsHtml = () => {
    const prefix = isQuotation ? 'Quotation' : isProforma ? 'Proforma' : 'Invoice';
    downloadDocumentAsHtml(
      'invoice-printable-document',
      `${prefix}_${invoice.id}.html`,
      `${prefix} #${invoice.id}`
    );
  };

  const isExistingInvoice = Boolean(invoiceId && invoiceId !== 'new' && invoices.some(i => i.id === invoiceId));

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-300">
      {/* Top Action Header */}
      <div className="no-print flex flex-col gap-4 mb-6 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={onCancel}
              className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-xs px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            {/* 3-Way Document Type Switcher: Tax Invoice / Proforma Invoice / Quotation */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => switchDocumentMode('INVOICE')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all ${
                  !isProforma && !isQuotation
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Tax Invoice
              </button>
              <button
                type="button"
                onClick={() => switchDocumentMode('PROFORMA')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all ${
                  isProforma
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Proforma Invoice
              </button>
              <button
                type="button"
                onClick={() => switchDocumentMode('QUOTATION')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all ${
                  isQuotation
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Quotation
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Invoice Template Selector */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <LayoutTemplate size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <select
                value={activeTemplateId}
                onChange={e => setActiveTemplateId(e.target.value)}
                title="Select Invoice Template Format"
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                {INVOICE_TEMPLATE_PRESETS.map(tp => (
                  <option key={tp.id} value={tp.id} className="bg-white dark:bg-slate-900">
                    Template: {tp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Separate Enable / Disable Signature & Seal Toggles */}
            <button
              type="button"
              onClick={() =>
                setInvoice(prev => ({ ...prev, includeSignature: !prev.includeSignature }))
              }
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-bold text-xs border transition-all ${
                invoice.includeSignature
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
              title="Enable or Disable Authorized Signature on this document"
            >
              <PenTool size={13} />
              <span>Sig: {invoice.includeSignature ? 'On' : 'Off'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setInvoice(prev => ({ ...prev, includeSeal: !prev.includeSeal }))
              }
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-bold text-xs border transition-all ${
                invoice.includeSeal
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
              title="Enable or Disable Official Company Seal on this document"
            >
              <Stamp size={13} />
              <span>Seal: {invoice.includeSeal ? 'On' : 'Off'}</span>
            </button>

            {(isQuotation || isProforma) && (
              <button
                onClick={() => switchDocumentMode('INVOICE')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Check size={14} />
                <span>Convert to Tax Invoice</span>
              </button>
            )}

            <button
              onClick={openEmailModal}
              className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3.5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              <Mail size={14} />
              <span>Email</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm disabled:opacity-60"
            >
              {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{isExportingPdf ? exportStatusMsg || 'Generating...' : 'PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            {isExistingInvoice && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}

            <button
              onClick={() => onSave(invoice)}
              className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center space-x-1.5"
            >
              <Save size={14} />
              <span>Save {isProforma ? 'Proforma' : isQuotation ? 'Quote' : 'Invoice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main A4 Printable Document Sheet */}
      <div
        id="invoice-printable-document"
        style={{
          borderTopWidth: invHeaderLayout === 'banner' ? '1px' : '8px',
          borderTopColor: isQuotation
            ? '#f59e0b'
            : isProforma
            ? '#9333ea'
            : invAccentColor
        }}
        className={`bg-white rounded-3xl ${
          invCompact ? 'p-4 sm:p-6 md:p-8' : 'p-5 sm:p-8 md:p-12'
        } border shadow-xl print-container transition-all text-slate-900 ${
          invFontStyle === 'serif'
            ? 'font-serif'
            : invFontStyle === 'mono'
            ? 'font-mono'
            : 'font-sans'
        } ${
          activeTemplateId === 'classic_ledger'
            ? 'border-2 border-slate-800'
            : isQuotation
            ? 'border-amber-300'
            : isProforma
            ? 'border-purple-300'
            : 'border-slate-200'
        }`}
      >
        {/* Top Header Section */}
        <div
          style={
            invHeaderLayout === 'banner'
              ? {
                  backgroundColor: isQuotation
                    ? '#d97706'
                    : isProforma
                    ? '#7e22ce'
                    : invAccentColor
                }
              : { borderBottomColor: invTableStyle === 'bordered' ? invAccentColor : undefined }
          }
          className={`flex flex-col gap-6 pb-8 border-b-2 border-slate-100 ${
            invHeaderLayout === 'banner'
              ? 'p-6 sm:p-8 rounded-2xl text-white mb-2 border-b-0 md:flex-row justify-between items-start'
              : invHeaderLayout === 'centered'
              ? 'items-center text-center'
              : invHeaderLayout === 'reversed'
              ? 'md:flex-row-reverse justify-between items-start'
              : 'md:flex-row justify-between items-start'
          }`}
        >
          {/* Left: Company Branding & Details */}
          <div
            className={`space-y-3 max-w-sm ${
              invHeaderLayout === 'centered' ? 'flex flex-col items-center text-center' : ''
            }`}
          >
            <div
              className={`flex items-center gap-3.5 ${
                invHeaderLayout === 'centered' ? 'flex-col' : ''
              }`}
            >
              {settings.logoUrl ? (
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                  <img
                    src={settings.logoUrl}
                    alt={settings.name || 'Company Logo'}
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor:
                      invHeaderLayout === 'banner' ? 'rgba(255,255,255,0.2)' : invAccentColor
                  }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-md"
                >
                  Af
                </div>
              )}
              <div>
                <h2
                  className={`text-xl font-black tracking-tight uppercase leading-tight ${
                    invHeaderLayout === 'banner' ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {settings.name || 'Af© ACCOUNTS'}
                </h2>
                {(settings.vatNumber || settings.trnNumber) && (
                  <div
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wider mt-1 ${
                      invHeaderLayout === 'banner'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <span>TRN: {settings.vatNumber || settings.trnNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <div
              className={`text-xs space-y-1 font-medium leading-relaxed pt-1 ${
                invHeaderLayout === 'banner' ? 'text-white/85' : 'text-slate-500'
              }`}
            >
              {settings.address && (
                <p
                  className={`flex items-start space-x-1.5 ${
                    invHeaderLayout === 'centered' ? 'justify-center' : ''
                  }`}
                >
                  <MapPin
                    size={13}
                    className={`${
                      invHeaderLayout === 'banner' ? 'text-white/75' : 'text-slate-400'
                    } mt-0.5 flex-shrink-0`}
                  />
                  <span className="whitespace-pre-line">{settings.address}</span>
                </p>
              )}
              <div
                className={`flex flex-wrap gap-x-4 gap-y-1 pt-0.5 ${
                  invHeaderLayout === 'centered' ? 'justify-center' : ''
                }`}
              >
                {settings.email && (
                  <p className="flex items-center space-x-1">
                    <Mail
                      size={12}
                      className={invHeaderLayout === 'banner' ? 'text-white/75' : 'text-slate-400'}
                    />
                    <span>{settings.email}</span>
                  </p>
                )}
                {settings.phone && (
                  <p className="flex items-center space-x-1">
                    <Phone
                      size={12}
                      className={invHeaderLayout === 'banner' ? 'text-white/75' : 'text-slate-400'}
                    />
                    <span>{settings.phone}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Document Title, ID & Status */}
          <div
            className={`w-full md:w-auto flex flex-col justify-between space-y-4 ${
              invHeaderLayout === 'centered'
                ? 'items-center text-center'
                : invHeaderLayout === 'reversed'
                ? 'md:items-start md:text-left'
                : 'md:items-end'
            }`}
          >
            <div
              className={
                invHeaderLayout === 'centered'
                  ? 'text-center'
                  : invHeaderLayout === 'reversed'
                  ? 'md:text-left'
                  : 'md:text-right'
              }
            >
              <span
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-2 ${
                  invHeaderLayout === 'banner'
                    ? 'bg-white/20 text-white'
                    : isQuotation
                    ? 'bg-amber-100 text-amber-800'
                    : isProforma
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {isQuotation
                  ? 'Commercial Estimate'
                  : isProforma
                  ? 'Preliminary Proforma Billing'
                  : 'Official UAE Tax Document'}
              </span>
              <h1
                style={{
                  color:
                    invHeaderLayout === 'banner'
                      ? '#ffffff'
                      : isQuotation
                      ? '#d97706'
                      : isProforma
                      ? '#7e22ce'
                      : invAccentColor
                }}
                className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight leading-none"
              >
                {isQuotation
                  ? 'QUOTATION'
                  : isProforma
                  ? 'PROFORMA INVOICE'
                  : invCustomHeading}
              </h1>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 md:items-end w-full md:w-auto">
              {/* Document Number */}
              <div className="flex items-center md:justify-end space-x-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  {isQuotation ? 'Quote #' : isProforma ? 'Proforma #' : 'Invoice #'}
                </span>
                <input
                  value={invoice.id}
                  onChange={e => setInvoice(p => ({ ...p, id: e.target.value }))}
                  className="text-sm font-black text-slate-900 bg-transparent border-none outline-none w-32 md:text-right"
                />
              </div>

              {/* Status & Payment Mode Selector */}
              <div className="no-print flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status:</span>
                  <select
                    value={invoice.status}
                    onChange={e => {
                      const nextSt = e.target.value as InvoiceStatus;
                      setInvoice(p => ({
                        ...p,
                        status: nextSt,
                        documentType:
                          nextSt === InvoiceStatus.PROFORMA
                            ? 'PROFORMA'
                            : nextSt === InvoiceStatus.QUOTATION
                            ? 'QUOTATION'
                            : 'INVOICE'
                      }));
                    }}
                    className="bg-slate-900 text-white px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-wider outline-none cursor-pointer"
                  >
                    {Object.values(InvoiceStatus).map(s => (
                      <option key={s} value={s} className="bg-white text-slate-900 font-bold">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {!isQuotation && (
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mode:</span>
                    <select
                      value={invoice.paymentMethod || PaymentMethod.BANK_TRANSFER}
                      onChange={e => setInvoice(p => ({ ...p, paymentMethod: e.target.value as PaymentMethod }))}
                      className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-wider outline-none cursor-pointer"
                    >
                      {Object.values(PaymentMethod).map(m => (
                        <option key={m} value={m} className="bg-white text-slate-900 font-bold">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Client Info & Dates Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-6 border-b-2 border-slate-100 items-start">
          <div className="md:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {isQuotation ? 'Quotation Prepared For' : isProforma ? 'Proforma Billed To' : 'Invoice Billed To'}
              </label>
              <button
                type="button"
                onClick={() => setIsAddingClient(true)}
                className="no-print text-[11px] font-black text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Plus size={12} />
                <span>New Client</span>
              </button>
            </div>

            <div className="no-print">
              <select
                value={invoice.clientId}
                onChange={e => setInvoice(p => ({ ...p, clientId: e.target.value }))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company} — ({c.name})
                  </option>
                ))}
              </select>
            </div>

            {activeClient && (
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-base font-black text-slate-900">{activeClient.company}</p>
                  {activeClient.trn && (
                    <span className="text-[10px] font-black bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                      TRN: {activeClient.trn}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-600">Attn: {activeClient.name}</p>
                {activeClient.address && (
                  <p className="text-xs text-slate-500 leading-relaxed">{activeClient.address}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium pt-1">
                  {activeClient.email && <span>{activeClient.email}</span>}
                  {activeClient.phone && <span>{activeClient.phone}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-5 grid grid-cols-2 gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/70">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Issue Date
              </label>
              <div className="date-badge-black w-full">
                <input
                  type="date"
                  value={invoice.date}
                  onChange={e => setInvoice(p => ({ ...p, date: e.target.value }))}
                  className="bg-transparent text-white font-black text-xs outline-none cursor-pointer no-print w-full text-center"
                />
                <span className="hidden print:inline text-xs font-black">{formatDate(invoice.date)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                {isQuotation ? 'Valid Until' : isProforma ? 'Proforma Valid Until' : 'Due Date'}
              </label>
              <div className="date-badge-black w-full">
                <input
                  type="date"
                  value={invoice.dueDate}
                  onChange={e => setInvoice(p => ({ ...p, dueDate: e.target.value }))}
                  className="bg-transparent text-white font-black text-xs outline-none cursor-pointer no-print w-full text-center"
                />
                <span className="hidden print:inline text-xs font-black">{formatDate(invoice.dueDate)}</span>
              </div>
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">Currency & Tax Rate:</span>
              <span className="font-black text-slate-900">
                {currSym} ({invoice.currency || 'AED'}) • {invoice.taxRate}% VAT
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="py-6 overflow-x-auto">
          <div
            className={
              invTableStyle === 'bordered'
                ? 'border border-slate-300 rounded-xl overflow-hidden'
                : ''
            }
          >
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr
                  style={
                    invTableStyle === 'minimal'
                      ? { borderBottomColor: invAccentColor }
                      : { backgroundColor: invAccentColor, color: '#ffffff' }
                  }
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    invTableStyle === 'minimal'
                      ? 'border-b-2 text-slate-900'
                      : 'text-white'
                  }`}
                >
                  {invShowCatCol && <th className="py-3 px-3 w-48">Category &amp; Service</th>}
                  <th className="py-3 px-3">Deliverable Description</th>
                  <th className="py-3 px-2 w-20 text-center">Qty</th>
                  <th className="py-3 px-2 w-32 text-right">Rate ({currSym})</th>
                  <th className="py-3 px-3 w-36 text-right">Line Total ({currSym})</th>
                  <th className="no-print py-3 px-2 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {invoice.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`group ${
                      invTableStyle === 'striped' && idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'
                    }`}
                  >
                    {invShowCatCol && (
                      <td
                        className={`${
                          invCompact ? 'py-2 px-3' : 'py-3.5 px-3'
                        } align-top ${
                          invTableStyle === 'bordered' ? 'border-r border-slate-200' : ''
                        }`}
                      >
                        <div className="no-print space-y-1.5">
                          <select
                            value={item.category}
                            onChange={e => {
                              const cat = e.target.value;
                              const preset = SERVICE_PRESETS.find(p => p.category === cat);
                              updateItem(item.id, {
                                category: cat,
                                service: preset?.services[0] || 'Service'
                              });
                            }}
                            className="w-full bg-slate-100 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs font-black outline-none"
                          >
                            {SERVICE_PRESETS.map(p => (
                              <option key={p.category} value={p.category}>
                                {p.category}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={item.service}
                            onChange={e => updateItem(item.id, { service: e.target.value })}
                            placeholder="Sub-service..."
                            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold outline-none"
                          />
                        </div>
                        <div className="hidden print:block">
                          <p className="font-black text-slate-900 text-xs">{item.category}</p>
                          <p className="text-[11px] font-bold text-slate-500">{item.service}</p>
                        </div>
                      </td>
                    )}

                    <td
                      className={`${
                        invCompact ? 'py-2 px-3' : 'py-3.5 px-3'
                      } align-top ${
                        invTableStyle === 'bordered' ? 'border-r border-slate-200' : ''
                      }`}
                    >
                      <div className="no-print flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(item.id, { description: e.target.value })}
                          placeholder="Describe scope, deliverables, shoot days..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handlePolish(item)}
                          disabled={isPolishing === item.id}
                          title="Polish description with AI (Works Online & Offline)"
                          className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all flex-shrink-0"
                        >
                          {isPolishing === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                        </button>
                      </div>
                      <div className="item-description-print hidden print:block text-xs text-slate-800 font-medium">
                        {item.description || item.service}
                      </div>
                    </td>

                    <td
                      className={`${
                        invCompact ? 'py-2 px-2' : 'py-3.5 px-2'
                      } text-center align-top ${
                        invTableStyle === 'bordered' ? 'border-r border-slate-200' : ''
                      }`}
                    >
                      <div className="no-print flex justify-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e =>
                            updateItem(item.id, {
                              quantity: Math.max(1, parseInt(e.target.value) || 0)
                            })
                          }
                          className="w-16 text-center font-bold text-slate-900 bg-slate-100 rounded-lg py-1.5 px-1 outline-none text-xs"
                        />
                      </div>
                      <div className="item-qty-print hidden print:block font-bold text-slate-900 text-xs text-center">
                        {item.quantity}
                      </div>
                    </td>

                    <td
                      className={`${
                        invCompact ? 'py-2 px-2' : 'py-3.5 px-2'
                      } text-right align-top ${
                        invTableStyle === 'bordered' ? 'border-r border-slate-200' : ''
                      }`}
                    >
                      <div className="no-print flex justify-end">
                        <input
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={e =>
                            updateItem(item.id, { rate: parseFloat(e.target.value) || 0 })
                          }
                          className="w-28 text-right font-bold bg-slate-100 text-slate-900 rounded-lg py-1.5 px-2 outline-none text-xs"
                        />
                      </div>
                      <div className="item-rate-print hidden print:block font-bold text-slate-900 text-xs text-right">
                        {item.rate.toLocaleString()}
                      </div>
                    </td>

                    <td
                      className={`${
                        invCompact ? 'py-2 px-3' : 'py-3.5 px-3'
                      } text-right font-black text-slate-900 align-top whitespace-nowrap`}
                    >
                      <span className="text-xs sm:text-sm">
                        {formatCurr(item.quantity * item.rate)}
                      </span>
                    </td>

                    <td className="no-print w-10 text-right py-3.5 px-2 align-top">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 bg-rose-50 rounded-lg transition-all"
                        title="Delete line item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addItem}
            className="no-print mt-4 flex items-center space-x-2 text-white font-black text-xs uppercase tracking-wider bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Plus size={14} />
            <span>Add Line Item</span>
          </button>
        </div>

        {/* Footer Notes & Summary Totals */}
        <div className="flex flex-col md:flex-row justify-between pt-8 border-t-2 border-slate-100 gap-8">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              {isQuotation
                ? 'Quote Terms & Conditions'
                : isProforma
                ? 'Proforma Validity & Advance Payment Terms'
                : 'Payment Instructions & Bank Details'}
            </label>
            <textarea
              value={invoice.notes}
              onChange={e => setInvoice(p => ({ ...p, notes: e.target.value }))}
              className="w-full h-28 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-medium text-slate-700 outline-none no-print focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              placeholder="Payment details, bank transfer instructions, or proforma terms..."
            />
            <div className="notes-print hidden print:block text-xs text-slate-600 leading-relaxed whitespace-pre-line border-l-2 border-slate-300 pl-3">
              {invoice.notes}
            </div>
            {invShowBankBox && (settings.bankName || settings.bankAccount) && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 mt-2">
                <p className="font-black uppercase text-[10px] tracking-wider text-slate-500">
                  Official Bank Remittance Details
                </p>
                {settings.bankName && (
                  <p className="text-slate-700">
                    <span className="font-bold">Bank Name:</span> {settings.bankName}
                  </p>
                )}
                {settings.bankAccount && (
                  <p className="text-slate-700">
                    <span className="font-bold">Account / IBAN:</span> {settings.bankAccount}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="w-full md:w-80 space-y-3 text-right">
            <div className="flex justify-between items-center text-slate-500 font-bold text-xs uppercase tracking-wider">
              <span>Subtotal</span>
              <span className="text-slate-900 font-black text-sm">{formatCurr(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 font-bold text-xs uppercase tracking-wider">
              <span>VAT / Tax ({invoice.taxRate}%)</span>
              <span className="text-slate-900 font-black text-sm">{formatCurr(tax)}</span>
            </div>
            <div
              style={{
                borderTopColor: isQuotation
                  ? '#f59e0b'
                  : isProforma
                  ? '#9333ea'
                  : invAccentColor
              }}
              className="flex justify-between items-end pt-4 border-t-2"
            >
              <div>
                <span className="font-black text-slate-900 text-sm md:text-base tracking-tight uppercase block text-left">
                  {isQuotation
                    ? 'Total Quote'
                    : isProforma
                    ? 'Total Proforma'
                    : 'Total Amount Due'}
                </span>
              </div>
              <div className="text-right">
                <span
                  style={{
                    color: isQuotation
                      ? '#d97706'
                      : isProforma
                      ? '#9333ea'
                      : invAccentColor
                  }}
                  className="text-2xl md:text-3xl font-black tracking-tight leading-none"
                >
                  {formatCurr(total)}
                </span>
              </div>
            </div>

            {/* Auto-Applied Authorized Signature & Official Company Seal Block */}
            <div className="pt-6 flex flex-col items-end space-y-2 text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                For {settings.name || 'AF© ACCOUNTS'}
              </p>
              <div className="min-h-[68px] flex items-center justify-end gap-4 py-1">
                {invoice.includeSeal && settings.companySealUrl && (
                  <img
                    src={settings.companySealUrl}
                    alt="Official Company Seal"
                    className="h-20 w-20 object-contain opacity-95"
                  />
                )}
                {invoice.includeSignature && settings.signatureUrl && (
                  <img
                    src={settings.signatureUrl}
                    alt="Authorized Signature"
                    className="h-14 max-w-[160px] object-contain"
                  />
                )}
              </div>
              <div className="w-48 border-t border-slate-300 pt-1.5">
                <p className="text-xs font-bold text-slate-900">
                  {settings.signatoryName || 'Authorized Signatory'}
                </p>
                {settings.signatoryTitle && (
                  <p className="text-[10px] text-slate-500">{settings.signatoryTitle}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL INSIDE BUILDER */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete #{invoice.id}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This will permanently delete this document and return to the invoice list.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDelete) onDelete(invoice.id);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center space-x-1.5"
              >
                <Trash2 size={14} />
                <span>Yes, Delete Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND EMAIL MODAL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  <Mail size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Send Document via Email</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pre-formatted statement with {currSym} breakdown</p>
                </div>
              </div>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5">
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

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Subject Line</label>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

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
                  className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider"
                >
                  <ExternalLink size={14} />
                  <span>Open in Mail App</span>
                </button>

                <button
                  onClick={handleAutomatedSend}
                  disabled={isSendingEmail}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all disabled:opacity-50"
                >
                  {isSendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{isSendingEmail ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CLIENT REGISTRATION MODAL */}
      {isAddingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">Quick Add Client</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add company TRN, billing address, and contact details.</p>
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
                  Save & Apply
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

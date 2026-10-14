import React, { useState, useMemo } from 'react';
import {
  Bell,
  Clock,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
  Copy,
  ExternalLink,
  RotateCcw,
  Eye,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  UserCheck,
  Check
} from 'lucide-react';
import {
  CompanySettings,
  Invoice,
  Client,
  ReminderTemplate,
  ReminderFrequencyOption,
  InvoiceStatus,
  ReminderLogEntry
} from '../types';
import { DEFAULT_REMINDER_TEMPLATES } from '../constants';
import { getCurrencySymbol } from '../utils/currency';

interface RemindersSettingsSectionProps {
  formData: CompanySettings;
  onUpdateFields: (partial: Partial<CompanySettings>) => void;
  invoices?: Invoice[];
  clients?: Client[];
  onSaveToast?: (msg: string, type?: 'success' | 'error') => void;
  onSaveSettings?: () => void;
}

const FREQUENCY_OPTIONS: { id: ReminderFrequencyOption; label: string; desc: string }[] = [
  { id: 'daily', label: 'Daily', desc: 'Send daily follow-ups until settled' },
  { id: 'every_3_days', label: 'Every 3 Days', desc: 'Frequent reminder every 72 hours' },
  { id: 'weekly', label: 'Weekly (Every 7 Days)', desc: 'Standard business practice recommended for UAE' },
  { id: 'biweekly', label: 'Bi-Weekly (Every 14 Days)', desc: 'Spaced reminder every two weeks' },
  { id: 'tiered_intervals', label: 'Tiered Stage Intervals', desc: 'Auto-triggers at 3, 7, 14, and 30 days overdue' },
  { id: 'custom_days', label: 'Custom Day Interval', desc: 'Specify exact days between reminder notices' }
];

const AVAILABLE_PLACEHOLDERS = [
  { tag: '{{invoice_id}}', label: 'Invoice #' },
  { tag: '{{customer_name}}', label: 'Customer Name' },
  { tag: '{{due_date}}', label: 'Due Date' },
  { tag: '{{days_overdue}}', label: 'Days Overdue' },
  { tag: '{{total_amount}}', label: 'Total Amount' },
  { tag: '{{currency}}', label: 'Currency' },
  { tag: '{{company_name}}', label: 'Your Company' },
  { tag: '{{bank_details}}', label: 'Bank & IBAN' },
  { tag: '{{company_email}}', label: 'Your Email' },
  { tag: '{{company_phone}}', label: 'Your Phone' }
];

export const RemindersSettingsSection: React.FC<RemindersSettingsSectionProps> = ({
  formData,
  onUpdateFields,
  invoices = [],
  clients = [],
  onSaveToast,
  onSaveSettings
}) => {
  const isEnabled = formData.autoRemindersEnabled !== false;
  const currentFrequency = formData.reminderFrequency || 'weekly';
  const customDays = formData.reminderCustomIntervalDays || 7;
  const currencySym = getCurrencySymbol(formData.defaultCurrency || 'AED');

  const templates: ReminderTemplate[] = useMemo(() => {
    if (formData.reminderTemplates && formData.reminderTemplates.length > 0) {
      return formData.reminderTemplates;
    }
    return DEFAULT_REMINDER_TEMPLATES;
  }, [formData.reminderTemplates]);

  const [activeTemplateId, setActiveTemplateId] = useState<string>('first_overdue');
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<string>('sample');
  const [modalPreviewInvoice, setModalPreviewInvoice] = useState<Invoice | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === activeTemplateId) || templates[0];
  }, [templates, activeTemplateId]);

  // Compute live overdue invoices from data
  const overdueInvoices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return invoices.filter(inv => {
      // Must not be paid or cancelled
      if (inv.status === InvoiceStatus.PAID || inv.status === InvoiceStatus.CANCELLED) {
        return false;
      }
      if (inv.documentType === 'PROFORMA' || inv.documentType === 'QUOTATION') {
        return false;
      }
      if (!inv.dueDate) return false;

      const due = new Date(inv.dueDate);
      if (isNaN(due.getTime())) return false;
      due.setHours(0, 0, 0, 0);

      return due < today;
    }).map(inv => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(inv.dueDate);
      due.setHours(0, 0, 0, 0);
      const diffTime = Math.abs(today.getTime() - due.getTime());
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Compute total
      const subtotal = inv.items.reduce((s, it) => s + (it.quantity * it.rate), 0);
      const discount = (subtotal * (inv.discount || 0)) / 100;
      const tax = ((subtotal - discount) * (inv.taxRate || 5)) / 100;
      const total = subtotal - discount + tax;

      // Select recommended template
      let recTemplateId = 'first_overdue';
      if (daysOverdue <= 0) recTemplateId = 'gentle';
      else if (daysOverdue < 14) recTemplateId = 'first_overdue';
      else if (daysOverdue < 30) recTemplateId = 'urgent';
      else recTemplateId = 'final_demand';

      return {
        ...inv,
        daysOverdue,
        calculatedTotal: total,
        recommendedTemplateId: recTemplateId
      };
    });
  }, [invoices]);

  const totalOverdueAmount = useMemo(() => {
    return overdueInvoices.reduce((sum, inv) => sum + (inv.calculatedTotal || 0), 0);
  }, [overdueInvoices]);

  // Helper to interpolate placeholders into text
  const renderTemplateText = (
    text: string,
    sampleInv?: typeof overdueInvoices[0] | null
  ) => {
    const invId = sampleInv ? sampleInv.id : 'INV-2026120';
    const custName = sampleInv
      ? sampleInv.customerCompany || sampleInv.customerName || 'Al-Futtaim Trading LLC'
      : 'Al-Futtaim Trading LLC';
    const dueDate = sampleInv ? sampleInv.dueDate : '2026-10-01';
    const daysOverdue = sampleInv ? sampleInv.daysOverdue : 12;
    const totalAmount = sampleInv
      ? sampleInv.calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '14,750.00';
    const currency = sampleInv ? (sampleInv.currency || 'AED') : (formData.defaultCurrency || 'AED');
    const compName = formData.name || 'AFSY BILLING LLC';
    const compEmail = formData.email || 'accounts@afsybilling.ae';
    const compPhone = formData.phone || '+971 4 123 4567';

    const bankDetails = formData.bankName || formData.iban || formData.bankAccount
      ? `• Bank: ${formData.bankName || 'Emirates NBD'}\n• IBAN: ${formData.iban || 'AE29 0260 0000 1234 5678 901'}\n• Account: ${formData.bankAccount || '102938475'}\n• Beneficiary: ${formData.beneficiaryName || formData.name || 'AFSY BILLING'}`
      : `• Bank: Emirates NBD\n• IBAN: AE29 0260 0000 1234 5678 901\n• Beneficiary: ${compName}`;

    return text
      .replace(/\{\{invoice_id\}\}/g, invId)
      .replace(/\{\{customer_name\}\}/g, custName)
      .replace(/\{\{due_date\}\}/g, dueDate)
      .replace(/\{\{days_overdue\}\}/g, String(daysOverdue))
      .replace(/\{\{total_amount\}\}/g, totalAmount)
      .replace(/\{\{currency\}\}/g, currency)
      .replace(/\{\{company_name\}\}/g, compName)
      .replace(/\{\{company_email\}\}/g, compEmail)
      .replace(/\{\{company_phone\}\}/g, compPhone)
      .replace(/\{\{bank_details\}\}/g, bankDetails);
  };

  const handleUpdateTemplate = (id: string, partial: Partial<ReminderTemplate>) => {
    const updated = templates.map(t => (t.id === id ? { ...t, ...partial } : t));
    onUpdateFields({ reminderTemplates: updated });
  };

  const handleResetTemplateToDefault = (id: string) => {
    const original = DEFAULT_REMINDER_TEMPLATES.find(t => t.id === id);
    if (original) {
      handleUpdateTemplate(id, original);
      if (onSaveToast) onSaveToast(`Template "${original.name}" reset to standard default.`, 'success');
    }
  };

  const handleInsertPlaceholder = (tag: string) => {
    const currentBody = activeTemplate.body || '';
    handleUpdateTemplate(activeTemplate.id, { body: currentBody + ' ' + tag });
  };

  const handleTriggerSave = () => {
    if (onSaveSettings) onSaveSettings();
    setIsSavedRecently(true);
    if (onSaveToast) {
      onSaveToast('Automated Overdue Reminder Settings Saved Successfully!', 'success');
    }
    setTimeout(() => setIsSavedRecently(false), 3500);
  };

  const handleSendReminderForInvoice = (inv: typeof overdueInvoices[0]) => {
    const tpl = templates.find(t => t.id === inv.recommendedTemplateId) || templates[0];
    const subject = renderTemplateText(tpl.subject, inv);
    const body = renderTemplateText(tpl.body, inv);
    const recipient = inv.customerEmail || 'client@company.ae';

    // Log reminder
    const newLog: ReminderLogEntry = {
      id: `log-${Date.now()}`,
      invoiceId: inv.id,
      clientName: inv.customerCompany || inv.customerName || 'Client',
      clientEmail: recipient,
      sentDate: new Date().toISOString().split('T')[0],
      templateId: tpl.id,
      daysOverdue: inv.daysOverdue,
      amount: inv.calculatedTotal
    };

    const currentLogs = formData.reminderLogs || [];
    onUpdateFields({ reminderLogs: [newLog, ...currentLogs.slice(0, 49)] });

    // Open mailto
    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    if (onSaveToast) {
      onSaveToast(`Reminder ready for #${inv.id} (${inv.customerCompany || inv.customerName})! Mail client opened.`, 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Automation Status */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Automated Overdue Email Reminders</span>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    isEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isEnabled ? 'Automation Active' : 'Disabled'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure automated email sequences, intervals, and professional UAE debt collection templates for overdue invoices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onUpdateFields({ autoRemindersEnabled: !isEnabled })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              isEnabled
                ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            }`}
          >
            {isEnabled ? 'Turn Off Automation' : 'Turn On Automation'}
          </button>

          <button
            type="button"
            onClick={handleTriggerSave}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm ${
              isSavedRecently
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white'
            }`}
          >
            {isSavedRecently ? <CheckCircle2 size={14} /> : <Check size={14} />}
            <span>{isSavedRecently ? 'Settings Saved!' : 'Save Reminders'}</span>
          </button>
        </div>
      </div>

      {/* Live Overdue Invoices Alert & Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Overdue Invoices</span>
            <AlertTriangle size={15} className="text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {overdueInvoices.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Requiring payment collection</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Total Overdue Value</span>
            <span className="text-xs font-mono font-bold text-slate-400">{currencySym}</span>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
            {currencySym} {totalOverdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Pending receipt across all clients</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Reminders Sent</span>
            <Mail size={15} className="text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
            {formData.reminderLogs?.length || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Logged reminder notifications</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Active Sequence</span>
            <Clock size={15} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-base font-black text-slate-900 dark:text-white capitalize">
            {currentFrequency === 'custom_days' ? `Every ${customDays} Days` : currentFrequency.replace('_', ' ')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Interval sequence rhythm</p>
        </div>
      </div>

      {/* Main Grid: Left Controls (Schedule & Frequency), Right: Templates Customizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Automated Frequency & Triggers Setup */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Reminder Frequency & Schedule */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  1. Automation Frequency &amp; Timing
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Frequency</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Reminder Repetition Interval
              </label>
              <div className="grid grid-cols-1 gap-2">
                {FREQUENCY_OPTIONS.map(opt => {
                  const isSel = currentFrequency === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateFields({ reminderFrequency: opt.id })}
                      className={`text-left p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                        isSel
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {opt.desc}
                        </span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full mt-0.5 flex items-center justify-center shrink-0 border ${
                          isSel
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentFrequency === 'custom_days' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mt-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Send Reminder Every N Days
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={customDays}
                      onChange={e =>
                        onUpdateFields({
                          reminderCustomIntervalDays: Math.max(1, parseInt(e.target.value, 10) || 1)
                        })
                      }
                      className="w-24 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    />
                    <span className="text-xs text-slate-500 font-medium">Days after previous reminder</span>
                  </div>
                </div>
              )}
            </div>

            {/* Triggers: Before Due & On Due Date */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Pre-Due &amp; Due Date Early Triggers
              </label>

              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Send Notice Before Due Date
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Gentle reminder {formData.reminderBeforeDueDays || 3} days in advance
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.reminderSendBeforeDue !== false}
                    onChange={e => onUpdateFields({ reminderSendBeforeDue: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Send Notice on Due Date
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Notify client on the exact due date day
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.reminderSendOnDueDate !== false}
                    onChange={e => onUpdateFields({ reminderSendOnDueDate: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Safeguards: Max count & Min threshold */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Max Reminders / Invoice
                </label>
                <select
                  value={formData.reminderMaxCountPerInvoice ?? 4}
                  onChange={e =>
                    onUpdateFields({ reminderMaxCountPerInvoice: parseInt(e.target.value, 10) })
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  <option value={1}>Max 1 Notice</option>
                  <option value={2}>Max 2 Notices</option>
                  <option value={3}>Max 3 Notices</option>
                  <option value={4}>Max 4 Notices (Standard)</option>
                  <option value={6}>Max 6 Notices</option>
                  <option value={999}>Unlimited</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Min Balance Threshold ({currencySym})
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={formData.reminderMinBalanceThreshold ?? 5}
                  onChange={e =>
                    onUpdateFields({
                      reminderMinBalanceThreshold: Math.max(0, parseFloat(e.target.value) || 0)
                    })
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Sender Details & Email Routing */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  2. Email Sender &amp; CC Routing
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Mail Setup</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sender Display Name
                </label>
                <input
                  type="text"
                  value={formData.reminderSenderName || ''}
                  onChange={e => onUpdateFields({ reminderSenderName: e.target.value })}
                  placeholder={`${formData.name || 'AFSY BILLING'} Accounts`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Reply-To Email Address
                </label>
                <input
                  type="email"
                  value={formData.reminderReplyToEmail || ''}
                  onChange={e => onUpdateFields({ reminderReplyToEmail: e.target.value })}
                  placeholder={formData.email || 'billing@company.ae'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  CC Accounts Team (Audit Copy)
                </label>
                <input
                  type="email"
                  value={formData.reminderCcAccountsEmail || ''}
                  onChange={e => onUpdateFields({ reminderCcAccountsEmail: e.target.value })}
                  placeholder="accounts-audit@company.ae"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400">
                  Automatically copies your finance team on every reminder sent.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Template Customizer & Live Email Preview */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 3: Customizable Email Templates */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span>3. Customizable Email Reminder Templates</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a reminder stage to customize its subject line, wording, and placeholders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResetTemplateToDefault(activeTemplate.id)}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 self-start sm:self-auto"
                title="Reset this template to standard wording"
              >
                <RotateCcw size={12} />
                <span>Reset to Standard</span>
              </button>
            </div>

            {/* Stage Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {templates.map(tpl => {
                const isSelected = activeTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setActiveTemplateId(tpl.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider block ${
                        tpl.tone === 'gentle'
                          ? 'text-emerald-600'
                          : tpl.tone === 'polite'
                          ? 'text-blue-600'
                          : tpl.tone === 'urgent'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {tpl.tone}
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white block mt-0.5 leading-tight">
                      {tpl.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {tpl.stageLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Template Editor Form */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  Editing: {activeTemplate.name}
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={activeTemplate.enabled !== false}
                    onChange={e => handleUpdateTemplate(activeTemplate.id, { enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Enable this stage</span>
                </label>
              </div>

              {/* Subject Line */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={activeTemplate.subject}
                  onChange={e => handleUpdateTemplate(activeTemplate.id, { subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Tag Placeholders Quick Inserter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} className="text-indigo-500" />
                    <span>Click to Insert Smart Placeholders:</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_PLACEHOLDERS.map(ph => (
                    <button
                      key={ph.tag}
                      type="button"
                      onClick={() => handleInsertPlaceholder(ph.tag)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                      title={`Insert ${ph.label}`}
                    >
                      {ph.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Body Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email Message Body
                </label>
                <textarea
                  rows={8}
                  value={activeTemplate.body}
                  onChange={e => handleUpdateTemplate(activeTemplate.id, { body: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans"
                />
              </div>
            </div>

            {/* Live Rendered Email Client Preview */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Real-time Preview (As Received by Client)</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Formatted Outlook / Gmail View
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-2 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400 w-14">From:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formData.reminderSenderName || formData.name || 'AFSY BILLING Accounts'} &lt;
                      {formData.reminderReplyToEmail || formData.email || 'billing@company.ae'}&gt;
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400 w-14">Subject:</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                      {renderTemplateText(activeTemplate.subject)}
                    </span>
                  </div>
                  {formData.reminderCcAccountsEmail && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400 w-14">CC:</span>
                      <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                        {formData.reminderCcAccountsEmail}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {renderTemplateText(activeTemplate.body)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Invoices Detection Queue & Instant Trigger Action */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-500" />
              <span>Overdue Invoices Queue ({overdueInvoices.length} Pending Reminders)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live automated detection of past due invoices ready to receive reminder emails according to your frequency rules.
            </p>
          </div>
          {overdueInvoices.length > 0 && (
            <span className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-xl self-start sm:self-auto">
              Total Overdue: {currencySym}{' '}
              {totalOverdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {overdueInvoices.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Great News! No Invoices Are Currently Overdue
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              All your client accounts are paid or within agreed settlement terms. When an invoice surpasses its due date, it will automatically show here with its recommended reminder template.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Customer / Company</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-center">Days Overdue</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3">Recommended Stage</th>
                  <th className="py-2.5 px-3 text-right">Reminder Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {overdueInvoices.map(inv => {
                  const recTpl = templates.find(t => t.id === inv.recommendedTemplateId) || templates[0];
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        #{inv.id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {inv.customerCompany || inv.customerName || 'Unnamed Client'}
                        </span>
                        {inv.customerEmail && (
                          <span className="text-[11px] text-slate-400 block font-mono">
                            {inv.customerEmail}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {inv.dueDate}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                            inv.daysOverdue >= 30
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                              : inv.daysOverdue >= 14
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {inv.daysOverdue} Days Past Due
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white tabular-nums">
                        {currencySym}{' '}
                        {inv.calculatedTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {recTpl.name}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setModalPreviewInvoice(inv)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Preview Reminder Email"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendReminderForInvoice(inv)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all shadow-xs"
                          >
                            <Send size={11} />
                            <span>Send Reminder</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reminder Sending & Preview Modal */}
      {modalPreviewInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Mail size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Preview Reminder: #{modalPreviewInvoice.id}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {modalPreviewInvoice.customerCompany || modalPreviewInvoice.customerName} ·{' '}
                    {modalPreviewInvoice.daysOverdue} days past due
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPreviewInvoice(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">Recipient Email:</span>
                <input
                  type="email"
                  defaultValue={modalPreviewInvoice.customerEmail || 'billing@clientcompany.ae'}
                  id="preview-modal-recipient"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">Subject:</span>
                <input
                  type="text"
                  defaultValue={renderTemplateText(
                    (templates.find(t => t.id === modalPreviewInvoice.recommendedTemplateId) || templates[0]).subject,
                    modalPreviewInvoice
                  )}
                  id="preview-modal-subject"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">Body Content:</span>
                <textarea
                  rows={9}
                  defaultValue={renderTemplateText(
                    (templates.find(t => t.id === modalPreviewInvoice.recommendedTemplateId) || templates[0]).body,
                    modalPreviewInvoice
                  )}
                  id="preview-modal-body"
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white leading-relaxed font-sans"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  const b = (document.getElementById('preview-modal-body') as HTMLTextAreaElement)?.value || '';
                  navigator.clipboard.writeText(b);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
              >
                <Copy size={13} />
                <span>{isCopied ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalPreviewInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const recipient =
                      (document.getElementById('preview-modal-recipient') as HTMLInputElement)?.value || '';
                    const subject =
                      (document.getElementById('preview-modal-subject') as HTMLInputElement)?.value || '';
                    const body =
                      (document.getElementById('preview-modal-body') as HTMLTextAreaElement)?.value || '';

                    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
                      subject
                    )}&body=${encodeURIComponent(body)}`;
                    setModalPreviewInvoice(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                >
                  <Send size={13} />
                  <span>Launch Email App</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Check,
  Palette,
  Layout,
  Table,
  Type,
  Sliders,
  Eye,
  RotateCcw,
  Sparkles,
  Save,
  CheckCircle2,
  Building2,
  Calendar,
  CreditCard,
  PenTool,
  Stamp,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Info
} from 'lucide-react';
import { CompanySettings } from '../types';
import {
  INVOICE_TEMPLATE_PRESETS,
  STATEMENT_TEMPLATE_PRESETS,
  DocumentTemplatePreset
} from '../constants';
import { getCurrencySymbol } from '../utils/currency';

interface DocumentTemplatesSettingsSectionProps {
  formData: CompanySettings;
  onUpdateFields: (partial: Partial<CompanySettings>) => void;
  onSaveToast?: (msg: string, type?: 'success' | 'error') => void;
  onSaveSettings?: () => void;
}

const COLOR_SWATCHES = [
  { name: 'Classic Slate Black', hex: '#0f172a' },
  { name: 'Executive Indigo', hex: '#4f46e5' },
  { name: 'Royal Navy', hex: '#1e3a8a' },
  { name: 'Emirates Gold', hex: '#b45309' },
  { name: 'Financial Emerald', hex: '#047857' },
  { name: 'Corporate Teal', hex: '#0f766e' },
  { name: 'Studio Violet', hex: '#7c3aed' },
  { name: 'Crimson Rose', hex: '#be123c' }
];

export const DocumentTemplatesSettingsSection: React.FC<DocumentTemplatesSettingsSectionProps> = ({
  formData,
  onUpdateFields,
  onSaveToast,
  onSaveSettings
}) => {
  const [activeDocTab, setActiveDocTab] = useState<'invoice' | 'statement'>('invoice');
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  const currencySymbol = getCurrencySymbol(formData.defaultCurrency || 'AED');
  const activeInvoiceTemplate = formData.invoiceTemplate || 'personal_neat_custom';
  const activeStatementTemplate = formData.statementTemplate || 'standard_audit';

  const invAccent = formData.invoiceAccentColor || '#0f172a';
  const invHeaderLayout = formData.invoiceHeaderLayout || 'split';
  const invTableStyle = formData.invoiceTableStyle || 'bordered';
  const invFontStyle = formData.invoiceFontStyle || 'sans';
  const invTitle = formData.invoiceCustomTitle || 'TAX INVOICE';
  const invSubtitle = formData.invoiceSubtitle || 'Commercial Goods & Services Supply';
  const invShowCat = Boolean(formData.invoiceShowCategoryCol);
  const invShowBank = formData.invoiceShowBankDetails !== false;
  const invCompact = Boolean(formData.invoiceCompactMode);
  const invDefaultPaymentTerms = formData.invoiceDefaultPaymentTerms || 'none';
  const invShowSignatures = formData.invoiceShowSignatures !== false;
  const invShowRemarks = formData.invoiceShowRemarks !== false;
  const invShowAmountInWords = formData.invoiceShowAmountInWords !== false;
  const invShowFooterNote = formData.invoiceShowFooterNote !== false;
  const invShowDueDate = formData.invoiceShowDueDate !== false;

  const handleSelectInvoicePreset = (preset: DocumentTemplatePreset) => {
    onUpdateFields({
      invoiceTemplate: preset.id as CompanySettings['invoiceTemplate'],
      invoiceAccentColor: preset.accentColor,
      invoiceHeaderLayout: preset.headerLayout,
      invoiceTableStyle: preset.tableStyle,
      invoiceFontStyle: preset.fontStyle || 'sans',
      invoiceCompactMode: Boolean(preset.compactMode)
    });
  };

  const handleSelectStatementPreset = (preset: DocumentTemplatePreset) => {
    onUpdateFields({
      statementTemplate: preset.id as CompanySettings['statementTemplate'],
      statementAccentColor: preset.accentColor,
      statementHeaderLayout: preset.headerLayout,
      statementTableStyle: preset.tableStyle,
      statementCompactMode: Boolean(preset.compactMode)
    });
  };

  const handleTriggerSave = () => {
    if (onSaveSettings) {
      onSaveSettings();
    }
    setIsSavedRecently(true);
    if (onSaveToast) {
      onSaveToast(
        'Invoice Template Saved! Applied automatically to all previous & future invoices.',
        'success'
      );
    }
    setTimeout(() => setIsSavedRecently(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner: Invoice vs Statement Template */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Personal Invoice Template Customizer
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            Design your personal neat invoice template. Any customizations saved here will{' '}
            <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
              automatically reflect on all your previous and future invoices
            </strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveDocTab('invoice')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeDocTab === 'invoice'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <FileText size={14} />
              <span>Invoice Template</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDocTab('statement')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeDocTab === 'statement'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>Statement Template</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleTriggerSave}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm ${
              isSavedRecently
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white'
            }`}
          >
            {isSavedRecently ? <CheckCircle2 size={14} /> : <Save size={14} />}
            <span>{isSavedRecently ? 'Template Saved!' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. INVOICE TEMPLATE CUSTOMIZER                                        */}
      {/* ===================================================================== */}
      {activeDocTab === 'invoice' && (
        <div className="space-y-6">
          {/* Base Template Styles (Clean Cards) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>1. Choose Base Invoice Format</span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Neat &amp; Simple
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a starting layout, then easily customize all sections, colors, and headers below.
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-xl">
                Active:{' '}
                {INVOICE_TEMPLATE_PRESETS.find(p => p.id === activeInvoiceTemplate)?.name ||
                  'Personal Neat Custom'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {INVOICE_TEMPLATE_PRESETS.map(preset => {
                const isSelected = activeInvoiceTemplate === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectInvoicePreset(preset)}
                    className={`text-left rounded-2xl p-4 border-2 transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {preset.category}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-transparent'
                          }`}
                        >
                          <Check size={12} />
                        </div>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                        {preset.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] font-bold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                        <span className="capitalize">{preset.headerLayout}</span>
                      </span>
                      <span className="capitalize">{preset.tableStyle} Grid</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section Customization Controls & Live Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 Columns: Simple & Comprehensive Customizer */}
            <div className="lg:col-span-6 space-y-5">
              {/* Card A: Header & Branding Customization */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      2. Header &amp; Branding Customization
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">Section 1</span>
                </div>

                {/* Invoice Heading & Business Subtitle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Custom Invoice Heading Title
                    </label>
                    <input
                      type="text"
                      value={invTitle}
                      onChange={e => onUpdateFields({ invoiceCustomTitle: e.target.value })}
                      placeholder="TAX INVOICE"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[10px] text-slate-400">e.g. TAX INVOICE, INVOICE, فاتورة ضريبية</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Business Subtitle / Tagline
                    </label>
                    <input
                      type="text"
                      value={invSubtitle}
                      onChange={e => onUpdateFields({ invoiceSubtitle: e.target.value })}
                      placeholder="Commercial Goods & Services"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[10px] text-slate-400">Shows under company name</p>
                  </div>
                </div>

                {/* Header Layout Style */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layout size={13} className="text-indigo-500" />
                    <span>Header Layout Structure</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'split', label: 'Split Left/Right' },
                      { id: 'banner', label: 'Color Banner' },
                      { id: 'centered', label: 'Centered Minimal' },
                      { id: 'reversed', label: 'Reversed Right' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateFields({
                            invoiceHeaderLayout: opt.id as CompanySettings['invoiceHeaderLayout']
                          })
                        }
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                          invHeaderLayout === opt.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand Primary Accent Color */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Palette size={13} className="text-indigo-500" />
                      <span>Primary Accent Color</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">{invAccent}</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_SWATCHES.map(sw => (
                      <button
                        key={sw.hex}
                        type="button"
                        onClick={() => onUpdateFields({ invoiceAccentColor: sw.hex })}
                        title={sw.name}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-transform ${
                          invAccent.toLowerCase() === sw.hex.toLowerCase()
                            ? 'border-slate-900 dark:border-white scale-110 shadow-sm'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      >
                        {invAccent.toLowerCase() === sw.hex.toLowerCase() && (
                          <Check size={13} className="text-white" />
                        )}
                      </button>
                    ))}
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="color"
                        value={invAccent}
                        onChange={e => onUpdateFields({ invoiceAccentColor: e.target.value })}
                        className="w-4 h-4 border-0 bg-transparent cursor-pointer"
                      />
                      <span>Custom Color</span>
                    </label>
                  </div>
                </div>

                {/* Typography Style */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Type size={13} className="text-indigo-500" />
                    <span>Typography Font Family</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'sans', label: 'Modern Sans' },
                      { id: 'mono', label: 'Tabular Mono' },
                      { id: 'serif', label: 'Classic Serif' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateFields({
                            invoiceFontStyle: opt.id as CompanySettings['invoiceFontStyle']
                          })
                        }
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                          invFontStyle === opt.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card B: Line Items Table & Layout Density */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Table size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      3. Items Table &amp; Layout Spacing
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">Section 2</span>
                </div>

                {/* Table Style */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Table Grid Style
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'bordered', label: 'Bordered Full Grid' },
                      { id: 'striped', label: 'Zebra Striped' },
                      { id: 'minimal', label: 'Clean Minimal' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateFields({
                            invoiceTableStyle: opt.id as CompanySettings['invoiceTableStyle']
                          })
                        }
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                          invTableStyle === opt.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Column and Density Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onUpdateFields({ invoiceShowCategoryCol: !invShowCat })}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      invShowCat
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        Category Column
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          invShowCat ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {invShowCat ? 'Shown' : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Show separate Category / Item Code column in line items
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateFields({ invoiceCompactMode: !invCompact })}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      invCompact
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        Compact Density
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          invCompact ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {invCompact ? 'Compact Mode' : 'Spacious Mode'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Tighter padding to fit more rows per printed A4 page
                    </p>
                  </button>
                </div>
              </div>

              {/* Card C: Payment Terms, Bank Details & Footer Sections */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      4. Payment Terms &amp; Settlement Sections
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">Section 3</span>
                </div>

                {/* Default Payment Terms Setting */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Default Payment Terms for Invoices</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Add/Remove toggle is always available in invoice builder
                    </span>
                  </label>
                  <select
                    value={invDefaultPaymentTerms}
                    onChange={e => onUpdateFields({ invoiceDefaultPaymentTerms: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="none">Hidden by Default (Clean / None)</option>
                    <option value="30">Within 30 Days (1 Month) — Auto Due Date</option>
                    <option value="15">Within 15 Days</option>
                    <option value="7">Within 7 Days</option>
                    <option value="45">Within 45 Days</option>
                    <option value="60">Within 60 Days (2 Months)</option>
                    <option value="90">Within 90 Days (3 Months)</option>
                    <option value="0">Due upon Receipt (Immediate)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    When set to &quot;Hidden by Default&quot;, invoices omit payment terms automatically
                    unless you click &quot;+ Add Terms&quot;. When set to 1 Month, the due date is calculated automatically.
                  </p>
                </div>

                {/* Bank Box and Signatures Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onUpdateFields({ invoiceShowBankDetails: !invShowBank })}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      invShowBank
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        Bank Remittance Box
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          invShowBank ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {invShowBank ? 'Shown' : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Display Bank, Account number, and IBAN on bottom left
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateFields({
                        invoiceShowSignatures: !invShowSignatures,
                        autoApplySignature: !invShowSignatures,
                        autoApplySeal: !invShowSignatures
                      })
                    }
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      invShowSignatures
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        Signature &amp; Company Seal
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          invShowSignatures ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {invShowSignatures ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Auto-apply authorized signature and official seal block
                    </p>
                  </button>
                </div>

                {/* Additional Section Toggles: Remarks & Payment Instructions, Amount in Words, Due Date, Bottom Footer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Remarks & Payment Instructions Toggle */}
                  <button
                    type="button"
                    onClick={() => onUpdateFields({ invoiceShowRemarks: !invShowRemarks })}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      invShowRemarks
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        Remarks &amp; Notes
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          invShowRemarks ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {invShowRemarks ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Multi-line notes, payment instructions, delivery terms
                    </p>
                  </button>

                  {/* Total Amount in English Words Toggle */}
                  <button
                    type="button"
                    onClick={() => onUpdateFields({ invoiceShowAmountInWords: !invShowAmountInWords })}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      invShowAmountInWords
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        Amount in Words
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          invShowAmountInWords ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {invShowAmountInWords ? 'Shown' : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Grand Total in English words (UAE Dirhams Only)
                    </p>
                  </button>

                  {/* Due Date Display Toggle */}
                  <button
                    type="button"
                    onClick={() => onUpdateFields({ invoiceShowDueDate: !invShowDueDate })}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      invShowDueDate
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        Invoice Due Date
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          invShowDueDate ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {invShowDueDate ? 'Shown' : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Option to display or remove Due Date from invoice
                    </p>
                  </button>
                </div>

                {/* Bottom Footer Note (Thank you for your business.) */}
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Down Side Last Footer Note (Bottom of PDF)
                    </label>
                    <button
                      type="button"
                      onClick={() => onUpdateFields({ invoiceShowFooterNote: !invShowFooterNote })}
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        invShowFooterNote
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 border-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200'
                      }`}
                    >
                      {invShowFooterNote ? 'Footer Enabled' : 'Footer Disabled'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.invoiceFooterNote ?? 'Thank you for your business.'}
                    onChange={e => onUpdateFields({ invoiceFooterNote: e.target.value })}
                    placeholder="Thank you for your business."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Appears prominently centered at the very bottom of every invoice and downloaded PDF.
                  </p>
                </div>
              </div>
            </div>

            {/* Right 6 Columns: High-Fidelity Live Invoice Sheet Preview */}
            <div className="lg:col-span-6 bg-slate-100 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-3 lg:sticky lg:top-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Eye size={15} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Real-time Live Invoice Preview</span>
                </span>
                <span className="text-[11px] font-bold text-slate-500 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  {invHeaderLayout.toUpperCase()} · {invTableStyle.toUpperCase()}
                </span>
              </div>

              {/* Live Rendered A4 Invoice Sheet */}
              <div
                className={`bg-white text-slate-900 rounded-2xl shadow-lg border border-slate-200 overflow-hidden transition-all text-xs ${
                  invFontStyle === 'serif'
                    ? 'font-serif'
                    : invFontStyle === 'mono'
                    ? 'font-mono'
                    : 'font-sans'
                }`}
                style={{
                  borderTopWidth: invHeaderLayout === 'banner' ? '0px' : '6px',
                  borderTopColor: invAccent
                }}
              >
                {/* Header Layout Render */}
                {invHeaderLayout === 'banner' ? (
                  <div
                    className="p-4 sm:p-5 text-white flex items-start justify-between gap-4"
                    style={{ backgroundColor: invAccent }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center font-black text-sm shrink-0">
                        Af
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-tight">
                          {formData.name || 'Af© ACCOUNTS'}
                        </h4>
                        {invSubtitle && (
                          <p className="text-[10px] text-white/80 font-medium">{invSubtitle}</p>
                        )}
                        <p className="text-[10px] font-mono font-bold text-white/90 mt-0.5">
                          Supplier TRN: {formData.vatNumber || formData.trnNumber || '100293848100003'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black uppercase tracking-tight">
                        {invTitle}
                      </div>
                      <div className="text-[10px] font-bold text-white/90">
                        #{formData.invoicePrefix || 'INV-'}2026120
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`p-4 sm:p-5 border-b border-slate-200 flex gap-4 ${
                      invHeaderLayout === 'centered'
                        ? 'flex-col items-center text-center'
                        : invHeaderLayout === 'reversed'
                        ? 'flex-row-reverse justify-between items-start'
                        : 'justify-between items-start'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-3 ${
                        invHeaderLayout === 'centered' ? 'flex-col' : ''
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs"
                        style={{ backgroundColor: invAccent }}
                      >
                        Af
                      </div>
                      <div className={invHeaderLayout === 'centered' ? 'text-center' : ''}>
                        <h4 className="text-sm font-black uppercase text-slate-900 tracking-tight">
                          {formData.name || 'Af© ACCOUNTS'}
                        </h4>
                        {invSubtitle && (
                          <p className="text-[10px] text-slate-500 font-medium">{invSubtitle}</p>
                        )}
                        <div
                          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold mt-1"
                        >
                          Supplier TRN: {formData.vatNumber || formData.trnNumber || '100293848100003'}
                        </div>
                      </div>
                    </div>

                    <div className={invHeaderLayout === 'centered' ? 'text-center' : 'text-right'}>
                      <div
                        className="text-base font-black uppercase tracking-tight"
                        style={{ color: invAccent }}
                      >
                        {invTitle}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500">
                        #{formData.invoicePrefix || 'INV-'}2026120
                      </div>
                    </div>
                  </div>
                )}

                {/* Invoice Body Content */}
                <div className={invCompact ? 'p-3.5 space-y-3' : 'p-4 sm:p-5 space-y-4'}>
                  {/* Customer Card & Invoice Dates Box */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                        Billed To (Customer)
                      </span>
                      <p className="text-xs font-black text-slate-900 mt-0.5">
                        Al Noor Trading LLC
                      </p>
                      <p className="text-[10px] font-mono text-slate-600 font-bold">
                        Customer TRN: 100987654300003
                      </p>
                      <p className="text-[10px] text-slate-500">Dubai, United Arab Emirates</p>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 uppercase font-bold">Invoice Date:</span>
                        <span
                          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                          className="font-black px-2 py-0.5 rounded text-[10px]"
                        >
                          13 Oct 2026
                        </span>
                      </div>
                      {invShowDueDate && (
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-400 uppercase font-bold">Due Date:</span>
                          <span
                            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                            className="font-black px-2 py-0.5 rounded text-[10px]"
                          >
                            12 Nov 2026
                          </span>
                        </div>
                      )}
                      {invDefaultPaymentTerms !== 'none' && (
                        <div className="flex justify-between items-center text-[10px] pt-0.5 border-t border-slate-200">
                          <span className="text-slate-400 uppercase font-bold">Payment Terms:</span>
                          <span className="font-bold text-indigo-700">
                            {invDefaultPaymentTerms === '30'
                              ? 'Within 30 Days (1 Month)'
                              : `Within ${invDefaultPaymentTerms} Days`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div
                    className={`rounded-xl overflow-hidden ${
                      invTableStyle === 'bordered' ? 'border border-slate-300' : ''
                    }`}
                  >
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr
                          style={{
                            backgroundColor:
                              invTableStyle === 'minimal' ? '#f8fafc' : invAccent,
                            color: invTableStyle === 'minimal' ? '#0f172a' : '#ffffff'
                          }}
                          className={invTableStyle === 'minimal' ? 'border-b-2 border-slate-900' : ''}
                        >
                          <th className="py-2 px-2.5 font-bold">SL#</th>
                          {invShowCat && <th className="py-2 px-2.5 font-bold">Category</th>}
                          <th className="py-2 px-2.5 font-bold">Description of Goods / Services</th>
                          <th className="py-2 px-2 text-center font-bold">Qty</th>
                          <th className="py-2 px-2 text-right font-bold">Unit Price</th>
                          <th className="py-2 px-2 text-right font-bold">VAT 5%</th>
                          <th className="py-2 px-2.5 text-right font-bold">Total ({currencySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[
                          {
                            sl: '1',
                            cat: 'Trading',
                            desc: 'Commercial Product Supply & Delivery',
                            qty: 1,
                            rate: '1,000.00',
                            vat: '50.00',
                            total: '1,050.00'
                          },
                          {
                            sl: '2',
                            cat: 'Services',
                            desc: 'Technical Installation & Support Service',
                            qty: 1,
                            rate: '500.00',
                            vat: '25.00',
                            total: '525.00'
                          }
                        ].map((row, idx) => (
                          <tr
                            key={idx}
                            className={
                              invTableStyle === 'striped' && idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                            }
                          >
                            <td className="py-2 px-2.5 text-slate-400 font-mono font-bold text-center">
                              {row.sl}
                            </td>
                            {invShowCat && (
                              <td className="py-2 px-2.5 font-bold text-slate-800">{row.cat}</td>
                            )}
                            <td className="py-2 px-2.5 text-slate-700 font-medium">{row.desc}</td>
                            <td className="py-2 px-2 text-center font-bold text-slate-900">{row.qty}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-700">{row.rate}</td>
                            <td className="py-2 px-2 text-right font-mono text-slate-700">{row.vat}</td>
                            <td className="py-2 px-2.5 text-right font-black text-slate-900 tabular-nums">
                              {row.total}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Notes & Totals */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2 border-t border-slate-200">
                    <div className="space-y-2 max-w-xs text-[10px]">
                      {/* Lengthy Remarks & Payment Instructions Box */}
                      {invShowRemarks && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                          <span className="font-black text-slate-700 uppercase text-[9px] block border-b border-slate-200 pb-1">
                            Remarks &amp; Payment Instructions:
                          </span>
                          <p className="text-slate-600 leading-relaxed whitespace-pre-line text-[9px]">
                            1. Payment is due as per agreed terms.&#10;2. Make all remittances by Bank Transfer / Cheque.&#10;3. Goods received in good order.
                          </p>
                        </div>
                      )}

                      {invShowBank && (
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="font-black text-slate-400 uppercase text-[9px] block">
                            Bank Remittance Details:
                          </span>
                          <p className="text-slate-700 font-bold">
                            {formData.bankName || 'Emirates NBD'} · {formData.iban || 'AE00 0000 0000 0000'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-56 space-y-1.5 text-right text-xs">
                      <div className="flex justify-between text-slate-500 font-bold text-[11px]">
                        <span>Subtotal Excl. VAT:</span>
                        <span className="text-slate-900 font-mono">
                          {currencySymbol} 1,500.00
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 font-bold text-[11px]">
                        <span>VAT (5%):</span>
                        <span className="text-slate-900 font-mono">
                          {currencySymbol} 75.00
                        </span>
                      </div>
                      <div
                        className="flex justify-between items-baseline pt-2 border-t-2 font-black text-sm"
                        style={{ borderTopColor: invAccent }}
                      >
                        <span className="uppercase text-[11px]">Grand Total:</span>
                        <span className="text-base tabular-nums" style={{ color: invAccent }}>
                          {currencySymbol} 1,575.00
                        </span>
                      </div>

                      {invShowAmountInWords && (
                        <div className="pt-1 text-right">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Total in Words:</span>
                          <p className="text-[10px] font-black text-slate-800 italic leading-tight">
                            UAE Dirhams One Thousand Five Hundred Seventy-Five Only
                          </p>
                        </div>
                      )}

                      {invShowSignatures && (
                        <div className="pt-3 flex flex-col items-end">
                          <div className="w-28 border-b border-slate-300 pb-1 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">
                              Authorized Signature
                            </span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-600 mt-0.5">
                            {formData.signatoryName || 'Authorized Signatory'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Down Side Last of Preview Sheet: Dedicated Bottom Footer */}
                  {invShowFooterNote && (
                    <div className="w-full mt-4 pt-3 border-t border-slate-200 text-center flex flex-col items-center justify-center space-y-0.5">
                      <p className="text-[11px] font-black tracking-wider uppercase text-slate-900">
                        {formData.invoiceFooterNote || 'Thank you for your business.'}
                      </p>
                      <p className="text-[9px] text-slate-400 font-medium">
                        {[
                          formData.phone ? `Tel: ${formData.phone}` : null,
                          formData.email ? `Email: ${formData.email}` : null,
                          formData.address ? formData.address : 'United Arab Emirates'
                        ]
                          .filter(Boolean)
                          .join('  •  ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Save Reminder Card */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Ready to use this format? Click Save to apply to all existing and new invoices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerSave}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 shadow-sm transition-all"
                >
                  Save Format
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. STATEMENT OF ACCOUNT TEMPLATES                                      */}
      {/* ===================================================================== */}
      {activeDocTab === 'statement' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Statement of Account Format Presets
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose the template format for client customer statements and audit reports.
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              Active:{' '}
              {STATEMENT_TEMPLATE_PRESETS.find(p => p.id === activeStatementTemplate)?.name ||
                'Standard Audit'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {STATEMENT_TEMPLATE_PRESETS.map(preset => {
              const isSelected = activeStatementTemplate === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectStatementPreset(preset)}
                  className={`text-left rounded-2xl p-4 border-2 transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {preset.category}
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-transparent'
                        }`}
                      >
                        <Check size={12} />
                      </div>
                    </div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {preset.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {preset.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: preset.accentColor }}
                      />
                      <span className="capitalize">{preset.headerLayout}</span>
                    </span>
                    <span className="capitalize">{preset.tableStyle} Grid</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentTemplatesSettingsSection;

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
  Sparkles
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
}

const COLOR_SWATCHES = [
  { name: 'Executive Indigo', hex: '#4f46e5' },
  { name: 'Midnight Navy', hex: '#0f172a' },
  { name: 'Emirates Gold', hex: '#b45309' },
  { name: 'Financial Emerald', hex: '#047857' },
  { name: 'Corporate Teal', hex: '#0f766e' },
  { name: 'Royal Blue', hex: '#1e3a8a' },
  { name: 'Studio Violet', hex: '#7c3aed' },
  { name: 'Crimson Audit', hex: '#be123c' }
];

export const DocumentTemplatesSettingsSection: React.FC<DocumentTemplatesSettingsSectionProps> = ({
  formData,
  onUpdateFields,
  onSaveToast
}) => {
  const [activeDocTab, setActiveDocTab] = useState<'invoice' | 'statement'>('invoice');

  const currencySymbol = getCurrencySymbol(formData.defaultCurrency || 'AED');
  const activeInvoiceTemplate = formData.invoiceTemplate || 'executive_indigo';
  const activeStatementTemplate = formData.statementTemplate || 'standard_audit';

  const invAccent = formData.invoiceAccentColor || '#4f46e5';
  const invHeaderLayout = formData.invoiceHeaderLayout || 'split';
  const invTableStyle = formData.invoiceTableStyle || 'striped';
  const invFontStyle = formData.invoiceFontStyle || 'sans';
  const invTitle = formData.invoiceCustomTitle || 'TAX INVOICE';
  const invShowCat = formData.invoiceShowCategoryCol !== false;
  const invShowBank = formData.invoiceShowBankDetails !== false;
  const invCompact = Boolean(formData.invoiceCompactMode);

  const stmtAccent = formData.statementAccentColor || '#0f172a';
  const stmtHeaderLayout = formData.statementHeaderLayout || 'split';
  const stmtTableStyle = formData.statementTableStyle || 'striped';
  const stmtTitle = formData.statementCustomTitle || 'STATEMENT OF ACCOUNT';
  const stmtShowSummary = formData.statementShowSummaryBox !== false;
  const stmtShowRemit = formData.statementShowRemittance !== false;
  const stmtCompact = Boolean(formData.statementCompactMode);

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

  const renderMiniTemplateThumbnail = (
    preset: DocumentTemplatePreset,
    isStatement: boolean,
    isSelected: boolean
  ) => {
    const color = preset.accentColor;
    const isBanner = preset.headerLayout === 'banner';
    const isCentered = preset.headerLayout === 'centered';
    const isReversed = preset.headerLayout === 'reversed';
    const isBordered = preset.tableStyle === 'bordered';
    const isStriped = preset.tableStyle === 'striped';

    return (
      <div
        className={`w-full h-32 rounded-xl bg-white border p-2.5 flex flex-col justify-between overflow-hidden relative transition-all ${
          isSelected ? 'border-slate-900 shadow-xs' : 'border-slate-200'
        }`}
      >
        {/* Top Accent Strip when not banner */}
        {!isBanner && (
          <div
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: color }}
          />
        )}

        {/* Header Miniature */}
        {isBanner ? (
          <div
            className="rounded-md px-2 py-1.5 flex items-center justify-between text-white"
            style={{ backgroundColor: color }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-xs bg-white/25 flex items-center justify-center text-[7px] font-black">
                Af
              </div>
              <div className="space-y-0.5">
                <div className="w-12 h-1.5 bg-white/90 rounded-xs" />
                <div className="w-8 h-1 bg-white/60 rounded-xs" />
              </div>
            </div>
            <div className="text-[7px] font-black tracking-wider uppercase opacity-95">
              {isStatement ? 'STATEMENT' : 'INVOICE'}
            </div>
          </div>
        ) : isCentered ? (
          <div className="flex flex-col items-center pt-1 pb-1 border-b border-slate-200">
            <div
              className="w-4 h-4 rounded-xs text-white flex items-center justify-center text-[7px] font-black mb-0.5"
              style={{ backgroundColor: color }}
            >
              Af
            </div>
            <div className="text-[7px] font-black tracking-wider uppercase" style={{ color }}>
              {isStatement ? 'STATEMENT OF ACCOUNT' : 'TAX INVOICE'}
            </div>
          </div>
        ) : (
          <div
            className={`flex items-start justify-between pt-1 pb-1.5 border-b border-slate-200 ${
              isReversed ? 'flex-row-reverse' : ''
            }`}
          >
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-xs text-white flex items-center justify-center text-[7px] font-black"
                style={{ backgroundColor: color }}
              >
                Af
              </div>
              <div className="space-y-0.5">
                <div className="w-11 h-1.5 bg-slate-800 rounded-xs" />
                <div className="w-7 h-1 bg-slate-400 rounded-xs" />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[7px] font-black uppercase" style={{ color }}>
                {isStatement ? 'STATEMENT' : 'INVOICE'}
              </div>
              <div className="w-9 h-1 bg-slate-300 rounded-xs ml-auto mt-0.5" />
            </div>
          </div>
        )}

        {/* Middle Summary / Meta Strip */}
        <div className="grid grid-cols-2 gap-1.5 my-1">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xs p-1 space-y-0.5">
            <div className="w-8 h-1 bg-slate-400 rounded-xs" />
            <div className="w-12 h-1.5 bg-slate-700 rounded-xs" />
          </div>
          <div
            className="rounded-xs p-1 space-y-0.5 border"
            style={{
              backgroundColor: isStatement ? '#f8fafc' : '#ffffff',
              borderColor: isBordered ? color : '#e2e8f0'
            }}
          >
            <div className="w-9 h-1 bg-slate-400 rounded-xs ml-auto" />
            <div
              className="w-11 h-1.5 rounded-xs ml-auto"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>

        {/* Table Miniature */}
        <div
          className={`rounded-xs overflow-hidden ${
            isBordered ? 'border border-slate-300' : ''
          }`}
        >
          <div
            className="h-2.5 px-1.5 flex items-center justify-between"
            style={{
              backgroundColor: preset.tableStyle === 'minimal' ? '#f1f5f9' : color
            }}
          >
            <div
              className={`w-8 h-1 rounded-xs ${
                preset.tableStyle === 'minimal' ? 'bg-slate-700' : 'bg-white/90'
              }`}
            />
            <div
              className={`w-6 h-1 rounded-xs ${
                preset.tableStyle === 'minimal' ? 'bg-slate-700' : 'bg-white/90'
              }`}
            />
          </div>
          <div className="divide-y divide-slate-100">
            {[0, 1, 2].map(r => (
              <div
                key={r}
                className={`h-2 px-1.5 flex items-center justify-between ${
                  isStriped && r % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                }`}
              >
                <div className="w-12 h-0.5 bg-slate-400 rounded-xs" />
                <div className="w-5 h-0.5 bg-slate-600 rounded-xs" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Selector Banner: Invoice Format vs Statement Format */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Invoice &amp; Statement Format Studio
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose from 16 professional templates (8 Invoice + 8 Statement) and customize colors, headers, table grids, and layout structure.
          </p>
        </div>

        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
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
            <span>Invoice Templates (8)</span>
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
            <span>Statement Templates (8)</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 1. INVOICE TEMPLATES & FORMAT CUSTOMIZATION                           */}
      {/* ===================================================================== */}
      {activeDocTab === 'invoice' && (
        <div className="space-y-6">
          {/* 8 Invoice Template Cards Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  1. Select Invoice Template Style (8 Templates Available)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any template card below to apply its layout preset immediately to all Tax Invoices, Proforma Invoices, and Quotations.
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Active:{' '}
                {INVOICE_TEMPLATE_PRESETS.find(p => p.id === activeInvoiceTemplate)?.name ||
                  'Executive Corporate'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {INVOICE_TEMPLATE_PRESETS.map(preset => {
                const isSelected = activeInvoiceTemplate === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectInvoicePreset(preset)}
                    className={`group text-left rounded-2xl p-3.5 border-2 transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="space-y-2.5 w-full">
                      {renderMiniTemplateThumbnail(preset, false, isSelected)}

                      <div className="flex items-start justify-between gap-2 pt-1">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            {preset.category}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            {preset.name}
                          </h4>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-transparent group-hover:text-slate-400'
                          }`}
                        >
                          <Check size={12} />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/60 w-full text-[10px] font-bold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                        <span className="capitalize">{preset.headerLayout} Header</span>
                      </span>
                      <span className="capitalize">{preset.tableStyle} Grid</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Invoice Format Customization Controls + Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 Cols: Format Customization Controls */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    2. Customize Invoice Format &amp; Layout
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectInvoicePreset(INVOICE_TEMPLATE_PRESETS[0])}
                  className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  <RotateCcw size={12} />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Brand Accent Color */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Palette size={13} className="text-indigo-500" />
                  <span>Invoice Accent Color</span>
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
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    >
                      {invAccent.toLowerCase() === sw.hex.toLowerCase() && (
                        <Check size={13} className="text-white" />
                      )}
                    </button>
                  ))}
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="color"
                      value={invAccent}
                      onChange={e => onUpdateFields({ invoiceAccentColor: e.target.value })}
                      className="w-4 h-4 border-0 bg-transparent cursor-pointer"
                    />
                    <span>Custom</span>
                  </label>
                </div>
              </div>

              {/* Header Layout Style */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layout size={13} className="text-indigo-500" />
                  <span>Header Layout Style</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'split', label: 'Split Left/Right' },
                    { id: 'banner', label: 'Color Banner' },
                    { id: 'centered', label: 'Centered Top' },
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
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        invHeaderLayout === opt.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Grid Style & Font Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Table size={13} className="text-indigo-500" />
                    <span>Line Items Table Style</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'striped', label: 'Striped' },
                      { id: 'bordered', label: 'Bordered' },
                      { id: 'minimal', label: 'Minimal' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateFields({
                            invoiceTableStyle: opt.id as CompanySettings['invoiceTableStyle']
                          })
                        }
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
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

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Type size={13} className="text-indigo-500" />
                    <span>Typography Style</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'sans', label: 'Modern Sans' },
                      { id: 'serif', label: 'Classic Serif' },
                      { id: 'mono', label: 'Tabular Mono' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateFields({
                            invoiceFontStyle: opt.id as CompanySettings['invoiceFontStyle']
                          })
                        }
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
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

              {/* Document Title & Prefix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
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
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Number Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.invoicePrefix || 'INV-'}
                    onChange={e => onUpdateFields({ invoicePrefix: e.target.value })}
                    placeholder="INV-"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Visibility & Density Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateFields({ invoiceShowCategoryCol: !invShowCat })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    invShowCat
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
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
                  <p className="text-[10px] text-slate-500">Show separate Category &amp; Service</p>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateFields({ invoiceShowBankDetails: !invShowBank })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    invShowBank
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      Bank Details Box
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase ${
                        invShowBank ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    >
                      {invShowBank ? 'Shown' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Include bank &amp; IBAN footer</p>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateFields({ invoiceCompactMode: !invCompact })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    invCompact
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
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
                      {invCompact ? 'Compact' : 'Standard'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Fit more items per A4 page</p>
                </button>
              </div>
            </div>

            {/* Right 6 Cols: Live Interactive Invoice Preview */}
            <div className="lg:col-span-6 bg-slate-100 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} className="text-indigo-600" />
                  <span>Live Invoice Format Preview</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {
                    INVOICE_TEMPLATE_PRESETS.find(p => p.id === activeInvoiceTemplate)?.name
                  }{' '}
                  · {invHeaderLayout.toUpperCase()}
                </span>
              </div>

              {/* Miniature Live A4 Invoice Sheet */}
              <div
                className={`bg-white text-slate-900 rounded-2xl shadow-md border border-slate-200 overflow-hidden transition-all ${
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
                {/* Header */}
                {invHeaderLayout === 'banner' ? (
                  <div
                    className="p-5 text-white flex items-start justify-between gap-4"
                    style={{ backgroundColor: invAccent }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-black text-sm">
                        Af
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase">
                          {formData.name || 'AF© CREATIVE FLOW'}
                        </h4>
                        <p className="text-[10px] opacity-80">
                          TRN: {formData.vatNumber || formData.trnNumber || '100293848100003'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black uppercase tracking-tight">
                        {invTitle || 'TAX INVOICE'}
                      </div>
                      <div className="text-[10px] font-bold opacity-90">
                        #{formData.invoicePrefix || 'INV-'}2026125
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`p-5 border-b border-slate-200 flex gap-4 ${
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
                        className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-sm shrink-0"
                        style={{ backgroundColor: invAccent }}
                      >
                        Af
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase text-slate-900">
                          {formData.name || 'AF© CREATIVE FLOW'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-500">
                          TRN: {formData.vatNumber || formData.trnNumber || '100293848100003'}
                        </p>
                      </div>
                    </div>
                    <div className={invHeaderLayout === 'centered' ? 'text-center' : 'text-right'}>
                      <div
                        className="text-base font-black uppercase tracking-tight"
                        style={{ color: invAccent }}
                      >
                        {invTitle || 'TAX INVOICE'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-600">
                        #{formData.invoicePrefix || 'INV-'}2026125 · Date: 08 Oct 2026
                      </div>
                    </div>
                  </div>
                )}

                {/* Body */}
                <div className={invCompact ? 'p-4 space-y-3' : 'p-5 space-y-4'}>
                  <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">
                        Billed To
                      </span>
                      <span className="font-black text-slate-900">
                        Emirates Media Group LLC
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">
                        Due Date
                      </span>
                      <span className="font-bold text-slate-800">08 Nov 2026</span>
                    </div>
                  </div>

                  {/* Table */}
                  <div
                    className={`rounded-lg overflow-hidden ${
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
                          className={
                            invTableStyle === 'minimal' ? 'border-b-2 border-slate-900' : ''
                          }
                        >
                          {invShowCat && <th className="py-2 px-2.5 font-bold">Category</th>}
                          <th className="py-2 px-2.5 font-bold">Description</th>
                          <th className="py-2 px-2 text-center font-bold">Qty</th>
                          <th className="py-2 px-2.5 text-right font-bold">
                            Total ({currencySymbol})
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[
                          {
                            cat: 'Commercial Shoot',
                            desc: 'Full Day 4K Production & Crew',
                            qty: 1,
                            amt: '5,000.00'
                          },
                          {
                            cat: 'Post Production',
                            desc: 'Color Grading & Master Edit',
                            qty: 1,
                            amt: '2,500.00'
                          }
                        ].map((row, idx) => (
                          <tr
                            key={idx}
                            className={
                              invTableStyle === 'striped' && idx % 2 === 1
                                ? 'bg-slate-50'
                                : 'bg-white'
                            }
                          >
                            {invShowCat && (
                              <td
                                className={`py-2 px-2.5 font-bold text-slate-900 ${
                                  invTableStyle === 'bordered' ? 'border-r border-slate-200' : ''
                                }`}
                              >
                                {row.cat}
                              </td>
                            )}
                            <td
                              className={`py-2 px-2.5 text-slate-600 ${
                                invTableStyle === 'bordered' ? 'border-r border-slate-200' : ''
                              }`}
                            >
                              {row.desc}
                            </td>
                            <td
                              className={`py-2 px-2 text-center font-bold ${
                                invTableStyle === 'bordered' ? 'border-r border-slate-200' : ''
                              }`}
                            >
                              {row.qty}
                            </td>
                            <td className="py-2 px-2.5 text-right font-black text-slate-900 tabular-nums">
                              {currencySymbol} {row.amt}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals & Footer */}
                  <div className="flex items-end justify-between pt-2 border-t border-slate-200 text-xs">
                    <div className="text-[10px] text-slate-500 max-w-[55%]">
                      {invShowBank ? (
                        <div>
                          <span className="font-bold text-slate-700 block">
                            Bank Remittance:
                          </span>
                          <span>
                            {formData.bankName || 'Emirates NBD'} ·{' '}
                            {formData.bankAccount || 'AE00 0000 0000 0000'}
                          </span>
                        </div>
                      ) : (
                        <span>Thank you for your business.</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Total Amount Due (Incl. VAT)
                      </span>
                      <span
                        className="text-base font-black tabular-nums"
                        style={{ color: invAccent }}
                      >
                        {currencySymbol} 7,875.00
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. STATEMENT TEMPLATES & FORMAT CUSTOMIZATION                         */}
      {/* ===================================================================== */}
      {activeDocTab === 'statement' && (
        <div className="space-y-6">
          {/* 8 Statement Template Cards Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  1. Select Statement of Account Template (8 Templates Available)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose a professional layout for your Client Statements, Expense Statements, and jsPDF exports.
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Active:{' '}
                {STATEMENT_TEMPLATE_PRESETS.find(p => p.id === activeStatementTemplate)?.name ||
                  'Standard Accounting Audit'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STATEMENT_TEMPLATE_PRESETS.map(preset => {
                const isSelected = activeStatementTemplate === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectStatementPreset(preset)}
                    className={`group text-left rounded-2xl p-3.5 border-2 transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="space-y-2.5 w-full">
                      {renderMiniTemplateThumbnail(preset, true, isSelected)}

                      <div className="flex items-start justify-between gap-2 pt-1">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            {preset.category}
                          </span>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            {preset.name}
                          </h4>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-transparent group-hover:text-slate-400'
                          }`}
                        >
                          <Check size={12} />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/60 w-full text-[10px] font-bold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                        <span className="capitalize">{preset.headerLayout} Header</span>
                      </span>
                      <span className="capitalize">{preset.tableStyle} Grid</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Statement Format Customization Controls + Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 6 Cols: Statement Format Controls */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    2. Customize Statement Format &amp; PDF Defaults
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectStatementPreset(STATEMENT_TEMPLATE_PRESETS[0])}
                  className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  <RotateCcw size={12} />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Statement Brand Accent Color */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Palette size={13} className="text-indigo-500" />
                  <span>Statement Theme &amp; Table Header Color</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_SWATCHES.map(sw => (
                    <button
                      key={sw.hex}
                      type="button"
                      onClick={() => onUpdateFields({ statementAccentColor: sw.hex })}
                      title={sw.name}
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-transform ${
                        stmtAccent.toLowerCase() === sw.hex.toLowerCase()
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    >
                      {stmtAccent.toLowerCase() === sw.hex.toLowerCase() && (
                        <Check size={13} className="text-white" />
                      )}
                    </button>
                  ))}
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="color"
                      value={stmtAccent}
                      onChange={e => onUpdateFields({ statementAccentColor: e.target.value })}
                      className="w-4 h-4 border-0 bg-transparent cursor-pointer"
                    />
                    <span>Custom</span>
                  </label>
                </div>
              </div>

              {/* Statement Header Layout */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layout size={13} className="text-indigo-500" />
                  <span>Statement Header Layout</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'split', label: 'Split Left/Right' },
                    { id: 'banner', label: 'Color Banner' },
                    { id: 'centered', label: 'Centered Top' },
                    { id: 'reversed', label: 'Reversed Right' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onUpdateFields({
                          statementHeaderLayout: opt.id as CompanySettings['statementHeaderLayout']
                        })
                      }
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        stmtHeaderLayout === opt.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Statement Table Grid & Default View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Table size={13} className="text-indigo-500" />
                    <span>Statement Ledger Grid</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'striped', label: 'Striped' },
                      { id: 'bordered', label: 'Bordered' },
                      { id: 'minimal', label: 'Minimal' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateFields({
                            statementTableStyle: opt.id as CompanySettings['statementTableStyle']
                          })
                        }
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          stmtTableStyle === opt.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Default Statement Grouping
                  </label>
                  <select
                    value={formData.statementDefaultView || 'date_wise'}
                    onChange={e =>
                      onUpdateFields({
                        statementDefaultView: e.target
                          .value as CompanySettings['statementDefaultView']
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="date_wise">Date-Wise Standard Ledger</option>
                    <option value="month_wise">Month-Wise Grouped Ledger</option>
                    <option value="category_wise">Category-Wise Summary</option>
                  </select>
                </div>
              </div>

              {/* Statement Heading & Default PDF Orientation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Custom Statement Heading Title
                  </label>
                  <input
                    type="text"
                    value={stmtTitle}
                    onChange={e => onUpdateFields({ statementCustomTitle: e.target.value })}
                    placeholder="STATEMENT OF ACCOUNT"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Default PDF Page
                  </label>
                  <select
                    value={formData.statementDefaultOrientation || 'portrait'}
                    onChange={e =>
                      onUpdateFields({
                        statementDefaultOrientation: e.target.value as 'portrait' | 'landscape'
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="portrait">A4 Portrait</option>
                    <option value="landscape">A4 Landscape</option>
                  </select>
                </div>
              </div>

              {/* Statement Visibility & Density Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateFields({ statementShowSummaryBox: !stmtShowSummary })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    stmtShowSummary
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      Summary Box
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase ${
                        stmtShowSummary ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    >
                      {stmtShowSummary ? 'Shown' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Top Account Summary Card</p>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateFields({ statementShowRemittance: !stmtShowRemit })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    stmtShowRemit
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      Bank Remittance
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase ${
                        stmtShowRemit ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    >
                      {stmtShowRemit ? 'Shown' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Footer payment instructions</p>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateFields({ statementCompactMode: !stmtCompact })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    stmtCompact
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      Compact Rows
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase ${
                        stmtCompact ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    >
                      {stmtCompact ? 'Compact' : 'Standard'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">High-density ledger rows</p>
                </button>
              </div>
            </div>

            {/* Right 6 Cols: Live Interactive Statement Preview */}
            <div className="lg:col-span-6 bg-slate-100 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} className="text-indigo-600" />
                  <span>Live Statement Format Preview</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {
                    STATEMENT_TEMPLATE_PRESETS.find(p => p.id === activeStatementTemplate)?.name
                  }{' '}
                  · {stmtHeaderLayout.toUpperCase()}
                </span>
              </div>

              {/* Miniature Live A4 Statement Sheet */}
              <div className="bg-white text-slate-900 rounded-2xl shadow-md border border-slate-200 overflow-hidden transition-all">
                {/* Statement Header */}
                {stmtHeaderLayout === 'banner' ? (
                  <div
                    className="p-5 text-white flex items-start justify-between gap-4"
                    style={{ backgroundColor: stmtAccent }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-black text-sm">
                        Af
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase">
                          {formData.name || 'AF© CREATIVE FLOW'}
                        </h4>
                        <p className="text-[10px] opacity-80">
                          TRN: {formData.trnNumber || formData.vatNumber || '100293848100003'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black uppercase tracking-tight">
                        {stmtTitle || 'STATEMENT OF ACCOUNT'}
                      </div>
                      <div className="text-[10px] opacity-90">Period: 01 Jan 2026 – 08 Oct 2026</div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`p-5 border-b-2 flex gap-4 ${
                      stmtHeaderLayout === 'centered'
                        ? 'flex-col items-center text-center'
                        : stmtHeaderLayout === 'reversed'
                        ? 'flex-row-reverse justify-between items-start'
                        : 'justify-between items-start'
                    }`}
                    style={{ borderBottomColor: stmtAccent }}
                  >
                    <div
                      className={`flex items-center gap-3 ${
                        stmtHeaderLayout === 'centered' ? 'flex-col' : ''
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-sm shrink-0"
                        style={{ backgroundColor: stmtAccent }}
                      >
                        Af
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase text-slate-900">
                          {formData.name || 'AF© CREATIVE FLOW'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-500">
                          TRN: {formData.trnNumber || formData.vatNumber || '100293848100003'}
                        </p>
                      </div>
                    </div>
                    <div
                      className={stmtHeaderLayout === 'centered' ? 'text-center' : 'text-right'}
                    >
                      <div
                        className="text-base font-black uppercase tracking-tight"
                        style={{ color: stmtAccent }}
                      >
                        {stmtTitle || 'STATEMENT OF ACCOUNT'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500">
                        Statement Date: 08 Oct 2026
                      </div>
                    </div>
                  </div>
                )}

                <div className={stmtCompact ? 'p-4 space-y-3' : 'p-5 space-y-4'}>
                  {/* Summary Cards */}
                  {stmtShowSummary && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[9px] font-bold uppercase text-slate-400 block">
                          Account Of (Client)
                        </span>
                        <span className="font-black text-slate-900 text-xs">
                          Consolidated Client Ledger
                        </span>
                      </div>
                      <div
                        className="rounded-lg border overflow-hidden"
                        style={{ borderColor: stmtAccent }}
                      >
                        <div
                          className="px-2.5 py-1 text-[9px] font-bold uppercase text-white flex justify-between"
                          style={{ backgroundColor: stmtAccent }}
                        >
                          <span>Account Summary</span>
                          <span>Amount ({currencySymbol})</span>
                        </div>
                        <div className="p-2 flex justify-between items-center bg-slate-50">
                          <span className="text-[10px] font-bold text-slate-600">Balance Due:</span>
                          <span className="font-black text-xs text-slate-900 tabular-nums">
                            {currencySymbol} 4,500.00
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Statement Table Preview */}
                  <div
                    className={`rounded-lg overflow-hidden ${
                      stmtTableStyle === 'bordered' ? 'border border-slate-300' : ''
                    }`}
                  >
                    <table className="w-full text-left border-collapse text-[10.5px]">
                      <thead>
                        <tr
                          style={{
                            backgroundColor:
                              stmtTableStyle === 'minimal' ? '#f8fafc' : stmtAccent,
                            color: stmtTableStyle === 'minimal' ? '#0f172a' : '#ffffff'
                          }}
                          className={
                            stmtTableStyle === 'minimal' ? 'border-b-2 border-slate-900' : ''
                          }
                        >
                          <th className="py-2 px-2.5 font-bold">Invoice Date</th>
                          <th className="py-2 px-2 font-bold">Invoice / Ref</th>
                          <th className="py-2 px-2 text-center font-bold">Status</th>
                          <th className="py-2 px-2.5 text-right font-bold">
                            Balance ({currencySymbol})
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[
                          {
                            date: '02 Oct 2026',
                            ref: 'INV-2026121',
                            st: 'Paid',
                            paid: true,
                            bal: '0.00'
                          },
                          {
                            date: '08 Oct 2026',
                            ref: 'INV-2026122',
                            st: 'Unpaid',
                            paid: false,
                            bal: '4,500.00'
                          }
                        ].map((r, i) => (
                          <tr
                            key={r.ref}
                            className={
                              stmtTableStyle === 'striped' && i % 2 === 1
                                ? 'bg-slate-50'
                                : 'bg-white'
                            }
                          >
                            <td className="py-1.5 px-2.5 font-semibold text-slate-800 tabular-nums">
                              {r.date}
                            </td>
                            <td className="py-1.5 px-2 font-bold text-slate-900">{r.ref}</td>
                            <td className="py-1.5 px-2 text-center font-bold uppercase text-[9.5px]">
                              <span className={r.paid ? 'text-emerald-700' : 'text-amber-700'}>
                                {r.st}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-slate-900 tabular-nums">
                              {r.bal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default DocumentTemplatesSettingsSection;

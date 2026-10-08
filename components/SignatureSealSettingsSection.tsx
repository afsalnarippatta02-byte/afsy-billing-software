import React, { useRef, useState } from 'react';
import {
  PenTool,
  Stamp,
  Upload,
  Sparkles,
  Trash2,
  CheckCircle2,
  Wand2,
  Eraser,
  Check
} from 'lucide-react';
import { CompanySettings } from '../types';
import {
  removeImageBackground,
  generateDigitalSignatureSvg,
  generateOfficialSealSvg
} from '../utils/signatureSealUtils';

interface SignatureSealSettingsSectionProps {
  formData: CompanySettings;
  onFieldChange: (field: keyof CompanySettings, value: any) => void;
  onSaveToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const SignatureSealSettingsSection: React.FC<SignatureSealSettingsSectionProps> = ({
  formData,
  onFieldChange,
  onSaveToast
}) => {
  const sigInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  const [autoRemoveBgOnUpload, setAutoRemoveBgOnUpload] = useState<boolean>(true);
  const [bgThreshold, setBgThreshold] = useState<number>(225);
  const [isProcessingSig, setIsProcessingSig] = useState<boolean>(false);
  const [isProcessingSeal, setIsProcessingSeal] = useState<boolean>(false);
  const [showDrawPad, setShowDrawPad] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [inkColor, setInkColor] = useState<string>('#1e3a8a');

  const autoApplySig = formData.autoApplySignature ?? false;
  const autoApplySeal = formData.autoApplySeal ?? false;

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (onSaveToast) onSaveToast(msg, type);
  };

  // Handle Signature Upload (with automatic background removal option)
  const handleSignatureFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingSig(true);
    try {
      if (autoRemoveBgOnUpload) {
        const transparentDataUrl = await removeImageBackground(file, bgThreshold);
        onFieldChange('signatureUrl', transparentDataUrl);
        if (formData.autoApplySignature === undefined) {
          onFieldChange('autoApplySignature', true);
        }
        notify('Authorized Signature uploaded with background automatically removed!');
      } else {
        const reader = new FileReader();
        reader.onload = ev => {
          if (ev.target?.result) {
            onFieldChange('signatureUrl', ev.target.result as string);
            if (formData.autoApplySignature === undefined) {
              onFieldChange('autoApplySignature', true);
            }
            notify('Authorized Signature uploaded! Click "Save Changes" to apply.');
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      notify('Could not process signature image.', 'error');
    } finally {
      setIsProcessingSig(false);
      e.target.value = '';
    }
  };

  // Handle Seal Upload (with automatic background removal option)
  const handleSealFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingSeal(true);
    try {
      if (autoRemoveBgOnUpload) {
        const transparentDataUrl = await removeImageBackground(file, bgThreshold);
        onFieldChange('companySealUrl', transparentDataUrl);
        if (formData.autoApplySeal === undefined) {
          onFieldChange('autoApplySeal', true);
        }
        notify('Company Seal uploaded with background automatically removed!');
      } else {
        const reader = new FileReader();
        reader.onload = ev => {
          if (ev.target?.result) {
            onFieldChange('companySealUrl', ev.target.result as string);
            if (formData.autoApplySeal === undefined) {
              onFieldChange('autoApplySeal', true);
            }
            notify('Company Seal uploaded! Click "Save Changes" to apply.');
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      notify('Could not process seal image.', 'error');
    } finally {
      setIsProcessingSeal(false);
      e.target.value = '';
    }
  };

  // Remove background from already-uploaded signature
  const handleRemoveExistingSigBg = async () => {
    if (!formData.signatureUrl) return;
    setIsProcessingSig(true);
    try {
      const cleaned = await removeImageBackground(formData.signatureUrl, bgThreshold);
      onFieldChange('signatureUrl', cleaned);
      notify('Signature background removed (transparent PNG)!');
    } catch {
      notify('Failed to remove background.', 'error');
    } finally {
      setIsProcessingSig(false);
    }
  };

  // Remove background from already-uploaded seal
  const handleRemoveExistingSealBg = async () => {
    if (!formData.companySealUrl) return;
    setIsProcessingSeal(true);
    try {
      const cleaned = await removeImageBackground(formData.companySealUrl, bgThreshold);
      onFieldChange('companySealUrl', cleaned);
      notify('Company Seal background removed (transparent PNG)!');
    } catch {
      notify('Failed to remove background.', 'error');
    } finally {
      setIsProcessingSeal(false);
    }
  };

  // Drawing Pad Handlers for Hand-Drawn Transparent Signature
  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const drawMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearDrawPad = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const applyDrawnSignature = async () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const cropped = await removeImageBackground(dataUrl, 250);
    onFieldChange('signatureUrl', cropped);
    onFieldChange('autoApplySignature', true);
    setShowDrawPad(false);
    notify('Drawn transparent signature applied!');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <PenTool className="text-indigo-600 dark:text-indigo-400" size={22} />
            Authorized Signature &amp; Official Company Seal
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Upload or generate background-removed transparent Signature &amp; Company Stamp, and enable or disable automatic application across all Invoices, Proformas, and Statements.
          </p>
        </div>

        {/* Background Removal Global Toggle */}
        <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={autoRemoveBgOnUpload}
            onChange={e => setAutoRemoveBgOnUpload(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <Wand2 size={14} />
          <span>Auto-Remove Picture Background</span>
        </label>
      </div>

      {/* ===================================================================== */}
      {/* 1. ENABLE / DISABLE AUTO-APPLY CONTROLS (SEPARATE & COMBINED)         */}
      {/* ===================================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Auto-Apply Mode on Invoices, Proformas &amp; Statements
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Choose whether to auto-apply Signature only, Company Seal only, Both together, or Disable auto-apply.
            </p>
          </div>

          {/* 4-Way Quick Mode Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onFieldChange('autoApplySignature', true);
                onFieldChange('autoApplySeal', true);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                autoApplySig && autoApplySeal
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Auto-Apply Both
            </button>
            <button
              type="button"
              onClick={() => {
                onFieldChange('autoApplySignature', true);
                onFieldChange('autoApplySeal', false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                autoApplySig && !autoApplySeal
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Signature Only
            </button>
            <button
              type="button"
              onClick={() => {
                onFieldChange('autoApplySignature', false);
                onFieldChange('autoApplySeal', true);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                !autoApplySig && autoApplySeal
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Seal Only
            </button>
            <button
              type="button"
              onClick={() => {
                onFieldChange('autoApplySignature', false);
                onFieldChange('autoApplySeal', false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                !autoApplySig && !autoApplySeal
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Disable All
            </button>
          </div>
        </div>

        {/* Separate Individual Enable / Disable Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-700">
          {/* Separate Switch 1: Authorized Signature */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PenTool size={16} className={autoApplySig ? 'text-emerald-600' : 'text-slate-400'} />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  Auto-Apply Authorized Signature
                </p>
                <p className="text-[10px] text-slate-500">
                  {autoApplySig ? 'Enabled — Automatically placed on documents' : 'Disabled — Not applied automatically'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onFieldChange('autoApplySignature', !autoApplySig)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-colors ${
                autoApplySig
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {autoApplySig ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Separate Switch 2: Official Company Seal */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Stamp size={16} className={autoApplySeal ? 'text-emerald-600' : 'text-slate-400'} />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  Auto-Apply Official Company Seal
                </p>
                <p className="text-[10px] text-slate-500">
                  {autoApplySeal ? 'Enabled — Automatically stamped on documents' : 'Disabled — Not stamped automatically'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onFieldChange('autoApplySeal', !autoApplySeal)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-colors ${
                autoApplySeal
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {autoApplySeal ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. SEPARATE CARDS FOR AUTHORIZED SIGNATURE & OFFICIAL COMPANY SEAL    */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT CARD: AUTHORIZED SIGNATURE */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  1. Authorized Signature (Transparent)
                </h4>
              </div>
              {formData.signatureUrl && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={11} /> Ready
                </span>
              )}
            </div>

            {/* Transparent Preview Canvas for Signature */}
            <div
              className="h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center p-3 relative overflow-hidden"
              style={{
                backgroundImage:
                  'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '12px 12px'
              }}
            >
              {formData.signatureUrl ? (
                <img
                  src={formData.signatureUrl}
                  alt="Authorized Signature"
                  className="max-h-24 max-w-full object-contain"
                />
              ) : (
                <p className="text-xs text-slate-400 font-medium text-center">
                  No signature uploaded yet. Upload a picture (background auto-removed) or draw/generate below.
                </p>
              )}
            </div>

            {/* Draw Pad Modal / Inline Box */}
            {showDrawPad && (
              <div className="p-3 rounded-xl bg-white border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Sign inside the box below:</span>
                  <div className="flex items-center gap-1.5">
                    {['#1e3a8a', '#0f172a', '#be123c'].map(col => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setInkColor(col)}
                        className={`w-5 h-5 rounded-full border-2 ${
                          inkColor === col ? 'border-indigo-500 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>
                <canvas
                  ref={drawCanvasRef}
                  width={340}
                  height={110}
                  onMouseDown={startDrawing}
                  onMouseMove={drawMove}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={drawMove}
                  onTouchEnd={stopDrawing}
                  className="w-full h-28 border border-dashed border-slate-300 rounded-lg bg-slate-50/50 cursor-crosshair touch-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={clearDrawPad}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1"
                  >
                    <Eraser size={12} /> Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDrawPad(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyDrawnSignature}
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Check size={12} /> Use Signature
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons for Signature */}
            <input
              ref={sigInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleSignatureFileUpload}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isProcessingSig}
                onClick={() => sigInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Upload size={13} />
                <span>{isProcessingSig ? 'Removing BG...' : 'Upload Signature Picture'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDrawPad(!showDrawPad)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5"
              >
                <PenTool size={13} />
                <span>Draw Signature</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const svg = generateDigitalSignatureSvg(
                    formData.signatoryName || formData.name || 'Authorized',
                    inkColor
                  );
                  onFieldChange('signatureUrl', svg);
                  onFieldChange('autoApplySignature', true);
                  notify('Generated clean transparent digital signature!');
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5"
              >
                <Sparkles size={13} className="text-indigo-600" />
                <span>Auto-Generate</span>
              </button>

              {formData.signatureUrl && (
                <>
                  <button
                    type="button"
                    onClick={handleRemoveExistingSigBg}
                    className="px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 hover:bg-indigo-100"
                    title="Remove white paper background from current signature"
                  >
                    <Wand2 size={13} />
                    <span>Remove BG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onFieldChange('signatureUrl', '')}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Clear Signature"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Signatory Name & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-700">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Signatory Name
              </label>
              <input
                type="text"
                value={formData.signatoryName || ''}
                onChange={e => onFieldChange('signatoryName', e.target.value)}
                placeholder="e.g. Authorized Signatory"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Signatory Title / Designation
              </label>
              <input
                type="text"
                value={formData.signatoryTitle || ''}
                onChange={e => onFieldChange('signatoryTitle', e.target.value)}
                placeholder="e.g. Finance Director"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* RIGHT CARD: OFFICIAL COMPANY SEAL / STAMP */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stamp size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  2. Official Company Seal / Stamp (Transparent)
                </h4>
              </div>
              {formData.companySealUrl && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={11} /> Ready
                </span>
              )}
            </div>

            {/* Transparent Preview Canvas for Company Seal */}
            <div
              className="h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center p-3 relative overflow-hidden"
              style={{
                backgroundImage:
                  'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '12px 12px'
              }}
            >
              {formData.companySealUrl ? (
                <img
                  src={formData.companySealUrl}
                  alt="Official Company Seal"
                  className="max-h-28 max-w-full object-contain"
                />
              ) : (
                <p className="text-xs text-slate-400 font-medium text-center">
                  No company seal uploaded yet. Upload a stamp picture (background auto-removed) or generate an official circular seal below.
                </p>
              )}
            </div>

            {/* Action Buttons for Company Seal */}
            <input
              ref={sealInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleSealFileUpload}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isProcessingSeal}
                onClick={() => sealInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Upload size={13} />
                <span>{isProcessingSeal ? 'Removing BG...' : 'Upload Seal Picture'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const sealSvg = generateOfficialSealSvg(
                    formData.name || 'AF© ACCOUNTS',
                    formData.trnNumber,
                    inkColor
                  );
                  onFieldChange('companySealUrl', sealSvg);
                  onFieldChange('autoApplySeal', true);
                  notify('Generated official transparent circular company seal!');
                }}
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5"
              >
                <Stamp size={13} className="text-indigo-600" />
                <span>Generate Official Stamp</span>
              </button>

              {formData.companySealUrl && (
                <>
                  <button
                    type="button"
                    onClick={handleRemoveExistingSealBg}
                    className="px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 hover:bg-indigo-100"
                    title="Remove white paper background from current company seal"
                  >
                    <Wand2 size={13} />
                    <span>Remove BG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onFieldChange('companySealUrl', '')}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Clear Company Seal"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stamp Ink Color & Background Removal Sensitivity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-700 items-center">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Generated Stamp Ink Color
              </label>
              <div className="flex items-center gap-2">
                {[
                  { color: '#1e40af', label: 'Royal Blue' },
                  { color: '#b91c1c', label: 'Stamp Red' },
                  { color: '#0f172a', label: 'Black' },
                  { color: '#047857', label: 'Emerald' }
                ].map(c => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setInkColor(c.color)}
                    title={c.label}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      inkColor === c.color ? 'border-indigo-500 scale-110' : 'border-white shadow-2xs'
                    }`}
                    style={{ backgroundColor: c.color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                BG Removal Sensitivity ({bgThreshold})
              </label>
              <input
                type="range"
                min={160}
                max={248}
                value={bgThreshold}
                onChange={e => setBgThreshold(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. LIVE COMBINED DOCUMENT AUTHORIZATION PREVIEW                       */}
      {/* ===================================================================== */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white text-slate-900 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
            Live Document Authorization Preview
          </span>
          <p className="text-xs font-bold text-slate-800">
            How your Signature &amp; Seal appear on Invoices, Proformas &amp; Statements:
          </p>
          <p className="text-[11px] text-slate-500">
            Status:{' '}
            <strong>
              {autoApplySig && autoApplySeal
                ? 'Both Signature & Seal Auto-Applied'
                : autoApplySig
                ? 'Signature Only Auto-Applied'
                : autoApplySeal
                ? 'Company Seal Only Auto-Applied'
                : 'Auto-Apply Disabled'}
            </strong>
          </p>
        </div>

        <div className="min-w-[240px] text-center sm:text-right border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/40">
          <p className="text-[10px] font-bold uppercase text-slate-700 mb-2">
            For {formData.name || 'Your Company'}
          </p>
          <div className="min-h-[76px] flex items-center justify-center sm:justify-end gap-3 relative">
            {autoApplySeal && formData.companySealUrl && (
              <img
                src={formData.companySealUrl}
                alt="Company Seal"
                className="h-20 w-20 object-contain opacity-90"
              />
            )}
            {autoApplySig && formData.signatureUrl && (
              <img
                src={formData.signatureUrl}
                alt="Authorized Signature"
                className="h-14 max-w-[150px] object-contain"
              />
            )}
            {(!autoApplySig || !formData.signatureUrl) &&
              (!autoApplySeal || !formData.companySealUrl) && (
                <span className="text-[11px] text-slate-400 italic py-4">
                  (Blank Signatory Line)
                </span>
              )}
          </div>
          <div className="border-t border-slate-400 pt-1.5 mt-1">
            <p className="text-xs font-bold text-slate-900">
              {formData.signatoryName || 'Authorized Signatory'}
            </p>
            {formData.signatoryTitle && (
              <p className="text-[10px] text-slate-500">{formData.signatoryTitle}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureSealSettingsSection;

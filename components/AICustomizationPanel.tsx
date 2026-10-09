import React from 'react';
import {
  Sparkles,
  Move,
  Sliders,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  Cpu,
  Palette,
  Layout,
  CornerDownRight,
  CornerDownLeft,
  CornerUpRight,
  CornerUpLeft,
  Zap
} from 'lucide-react';
import { CompanySettings } from '../types';

interface AICustomizationPanelProps {
  settings: CompanySettings;
  onUpdateSettings: (partial: Partial<CompanySettings>) => void;
  onTriggerTestBlink?: () => void;
  compact?: boolean;
}

export const AICustomizationPanel: React.FC<AICustomizationPanelProps> = ({
  settings,
  onUpdateSettings,
  onTriggerTestBlink,
  compact = false
}) => {
  const aiFloatingEnabled = settings.aiFloatingEnabled !== false;
  const aiNavEnabled = settings.aiNavEnabled !== false;
  const aiDraggable = settings.aiDraggable !== false;
  const aiButtonStyle = settings.aiButtonStyle || 'compact';
  const aiPositionPreset = settings.aiPositionPreset || 'bottom-right';
  const aiThemeColor = settings.aiThemeColor || 'indigo';
  const aiDefaultMode = settings.aiDefaultMode || 'hybrid';
  const headerStatusMode = settings.headerStatusMode || 'symbol';

  const setPresetPosition = (preset: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left') => {
    onUpdateSettings({
      aiPositionPreset: preset,
      aiCustomPosition: null
    });
  };

  return (
    <div className={compact ? 'space-y-4 text-xs' : 'space-y-6'}>
      {/* 1. Manual Move & Screen Position Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Move size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Manual Move &amp; Screen Position
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Drag the AI button or chat header anywhere on screen, or snap to a corner.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onUpdateSettings({ aiDraggable: !aiDraggable })}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center space-x-1.5 border ${
              aiDraggable
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Move size={12} />
            <span>{aiDraggable ? 'Manual Drag: ON' : 'Position Locked'}</span>
          </button>
        </div>

        {/* Corner Snap Presets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'bottom-right', label: 'Bottom Right', icon: <CornerDownRight size={13} /> },
            { id: 'bottom-left', label: 'Bottom Left', icon: <CornerDownLeft size={13} /> },
            { id: 'top-right', label: 'Top Right', icon: <CornerUpRight size={13} /> },
            { id: 'top-left', label: 'Top Left', icon: <CornerUpLeft size={13} /> }
          ].map(pos => {
            const active =
              aiPositionPreset === pos.id && !settings.aiCustomPosition;
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() =>
                  setPresetPosition(
                    pos.id as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
                  )
                }
                className={`flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-[11px] font-bold border transition-all ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                {pos.icon}
                <span>{pos.label}</span>
              </button>
            );
          })}
        </div>

        {settings.aiCustomPosition && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60">
            <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
              Custom Manual Position Active (X: {Math.round(settings.aiCustomPosition.x)}px, Y:{' '}
              {Math.round(settings.aiCustomPosition.y)}px)
            </span>
            <button
              type="button"
              onClick={() => setPresetPosition('bottom-right')}
              className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. AI Button Style, Theme & Visibility */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Palette size={18} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              AI Button Style, Theme &amp; Visibility
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Customize how the AI assistant appears across the workspace.
            </p>
          </div>
        </div>

        {/* Visibility Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">
                Floating AI Button
              </p>
              <p className="text-[10px] text-slate-500">Show draggable AI button on screen</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ aiFloatingEnabled: !aiFloatingEnabled })}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                aiFloatingEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {aiFloatingEnabled ? 'Enabled' : 'Hidden'}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">
                AI Advisor in Sidebar Menu
              </p>
              <p className="text-[10px] text-slate-500">Show AI tab in navigation bar</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ aiNavEnabled: !aiNavEnabled })}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                aiNavEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {aiNavEnabled ? 'Enabled' : 'Hidden'}
            </button>
          </div>
        </div>

        {/* Button Size / Shape Style */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Floating AI Button Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'icon', label: 'Icon Orb Only' },
              { id: 'compact', label: 'Compact Pill' },
              { id: 'full', label: 'Full Badge' }
            ].map(style => (
              <button
                key={style.id}
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    aiButtonStyle: style.id as 'icon' | 'compact' | 'full'
                  })
                }
                className={`py-2 px-3 rounded-xl text-[11px] font-bold border transition-all ${
                  aiButtonStyle === style.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            AI Button Theme Color
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'indigo', label: 'Indigo', dot: 'bg-indigo-600' },
              { id: 'emerald', label: 'Emerald', dot: 'bg-emerald-600' },
              { id: 'violet', label: 'Violet', dot: 'bg-purple-600' },
              { id: 'slate', label: 'Midnight', dot: 'bg-slate-900' },
              { id: 'amber', label: 'Amber Gold', dot: 'bg-amber-600' }
            ].map(color => (
              <button
                key={color.id}
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    aiThemeColor: color.id as
                      | 'indigo'
                      | 'emerald'
                      | 'violet'
                      | 'slate'
                      | 'amber'
                  })
                }
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                  aiThemeColor === color.id
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${color.dot}`} />
                <span>{color.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Engine Mode */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            AI Processing Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              {
                id: 'hybrid',
                label: 'Auto (Online + Offline)',
                desc: 'Cloud AI with instant offline fallback'
              },
              {
                id: 'offline',
                label: 'Offline Local Only',
                desc: '100% local on-device accounting AI'
              },
              {
                id: 'cloud',
                label: 'Cloud Gemini Priority',
                desc: 'Deep reasoning cloud model first'
              }
            ].map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    aiDefaultMode: mode.id as 'hybrid' | 'offline' | 'cloud'
                  })
                }
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  aiDefaultMode === mode.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-black">{mode.label}</div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    aiDefaultMode === mode.id ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {mode.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Top Header Status Symbol & Save Blink Animation */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Zap size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Top Header Sync Symbol &amp; Save Blink Animation
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Replaces the old &ldquo;Online + Local&rdquo; text with an animated save-blink symbol or hides it.
              </p>
            </div>
          </div>
          {onTriggerTestBlink && (
            <button
              type="button"
              onClick={onTriggerTestBlink}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition-all shrink-0 shadow-xs"
            >
              Test Save Blink
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onUpdateSettings({ headerStatusMode: 'symbol' })}
            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
              headerStatusMode === 'symbol'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div>
              <p className="text-xs font-black">Attractive Symbol + Save Blink</p>
              <p className="text-[10px] opacity-75">
                Minimal icon that blinks green whenever changes are saved
              </p>
            </div>
            <CheckCircle2
              size={16}
              className={headerStatusMode === 'symbol' ? 'text-emerald-600' : 'opacity-20'}
            />
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ headerStatusMode: 'hidden' })}
            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
              headerStatusMode === 'hidden'
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div>
              <p className="text-xs font-black">Hide from Top Bar</p>
              <p className="text-[10px] opacity-75">
                Completely hides the online/local status indicator
              </p>
            </div>
            <EyeOff
              size={16}
              className={headerStatusMode === 'hidden' ? 'text-indigo-600' : 'opacity-20'}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICustomizationPanel;

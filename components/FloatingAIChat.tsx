import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  Move,
  Sliders,
  RotateCcw
} from 'lucide-react';
import { Invoice, Expense, Client, CompanySettings } from '../types';
import AIChatBot from './AIChatBot';
import AICustomizationPanel from './AICustomizationPanel';

interface FloatingAIChatProps {
  invoices: Invoice[];
  expenses?: Expense[];
  clients: Client[];
  settings?: CompanySettings;
  onUpdateSettings?: (partial: Partial<CompanySettings>) => void;
  onTriggerTestBlink?: () => void;
}

const THEME_GRADIENTS: Record<string, string> = {
  indigo: 'from-indigo-600 via-indigo-700 to-purple-700 shadow-indigo-500/30',
  emerald: 'from-emerald-600 via-teal-600 to-emerald-800 shadow-emerald-500/30',
  violet: 'from-purple-600 via-fuchsia-600 to-indigo-800 shadow-purple-500/30',
  slate: 'from-slate-800 via-slate-900 to-black shadow-slate-900/40',
  amber: 'from-amber-500 via-orange-600 to-amber-700 shadow-amber-500/30'
};

const FloatingAIChat: React.FC<FloatingAIChatProps> = ({
  invoices,
  expenses = [],
  clients,
  settings,
  onUpdateSettings,
  onTriggerTestBlink
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(
    settings?.aiCustomPosition || null
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    moved: false
  });

  // Sync external settings changes
  useEffect(() => {
    setDragPos(settings?.aiCustomPosition || null);
  }, [settings?.aiCustomPosition?.x, settings?.aiCustomPosition?.y, settings?.aiPositionPreset]);

  const aiFloatingEnabled = settings?.aiFloatingEnabled !== false;
  const aiDraggable = settings?.aiDraggable !== false;
  const aiButtonStyle = settings?.aiButtonStyle || 'compact';
  const aiPositionPreset = settings?.aiPositionPreset || 'bottom-right';
  const aiThemeColor = settings?.aiThemeColor || 'indigo';

  if (!aiFloatingEnabled) {
    return null;
  }

  const updateSettingsPartial = (partial: Partial<CompanySettings>) => {
    if (onUpdateSettings) {
      onUpdateSettings(partial);
    }
  };

  // Start manual drag (mouse or touch)
  const startDrag = (clientX: number, clientY: number) => {
    if (!aiDraggable || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragStateRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      moved: false
    };
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!dragStateRef.current.active) return;
      const dx = clientX - dragStateRef.current.startX;
      const dy = clientY - dragStateRef.current.startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragStateRef.current.moved = true;
        setIsDragging(true);
      }

      if (dragStateRef.current.moved) {
        const elWidth = containerRef.current?.offsetWidth || 140;
        const elHeight = containerRef.current?.offsetHeight || 56;
        const maxX = Math.max(8, window.innerWidth - elWidth - 8);
        const maxY = Math.max(8, window.innerHeight - elHeight - 8);

        const nextX = Math.min(maxX, Math.max(8, dragStateRef.current.initialLeft + dx));
        const nextY = Math.min(maxY, Math.max(8, dragStateRef.current.initialTop + dy));
        setDragPos({ x: nextX, y: nextY });
      }
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStateRef.current.active || !e.touches[0]) return;
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleEnd = () => {
      if (!dragStateRef.current.active) return;
      const wasMoved = dragStateRef.current.moved;
      dragStateRef.current.active = false;
      setIsDragging(false);

      if (wasMoved && dragPos) {
        updateSettingsPartial({
          aiPositionPreset: 'custom',
          aiCustomPosition: dragPos
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [dragPos, aiDraggable]);

  // Compute preset classes when not using custom coordinates
  const getPresetPositionClasses = () => {
    switch (aiPositionPreset) {
      case 'bottom-left':
        return 'bottom-20 lg:bottom-6 left-4 sm:left-6';
      case 'top-right':
        return 'top-20 right-4 sm:right-6';
      case 'top-left':
        return 'top-20 left-4 sm:left-6';
      case 'bottom-right':
      default:
        return 'bottom-20 lg:bottom-6 right-4 sm:right-6';
    }
  };

  // Clamp open window position if custom dragged near right/bottom edge
  const getContainerStyle = (): React.CSSProperties | undefined => {
    if (!dragPos) return undefined;
    if (!isOpen) {
      return {
        left: `${ Math.min(Math.max(8, dragPos.x), Math.max(8, window.innerWidth - 70)) }px`,
        top: `${ Math.min(Math.max(8, dragPos.y), Math.max(8, window.innerHeight - 64)) }px`,
        right: 'auto',
        bottom: 'auto'
      };
    }
    const winW = isExpanded ? Math.min(750, window.innerWidth * 0.92) : Math.min(450, window.innerWidth * 0.92);
    const winH = isExpanded ? Math.min(820, window.innerHeight * 0.85) : 560;
    const clampedX = Math.min(Math.max(8, dragPos.x), Math.max(8, window.innerWidth - winW - 12));
    const clampedY = Math.min(Math.max(8, dragPos.y), Math.max(8, window.innerHeight - winH - 12));
    return {
      left: `${clampedX}px`,
      top: `${clampedY}px`,
      right: 'auto',
      bottom: 'auto'
    };
  };

  const gradientClass = THEME_GRADIENTS[aiThemeColor] || THEME_GRADIENTS.indigo;

  return (
    <div
      ref={containerRef}
      style={getContainerStyle()}
      className={`fixed z-50 no-print select-none ${
        dragPos ? '' : getPresetPositionClasses()
      } ${isDragging ? 'cursor-grabbing scale-[1.03]' : ''}`}
    >
      {!isOpen ? (
        <div className="relative group flex items-center">
          {/* Main Floating Draggable AI Button */}
          <button
            type="button"
            onMouseDown={e => startDrag(e.clientX, e.clientY)}
            onTouchStart={e => {
              if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onClick={() => {
              if (dragStateRef.current.moved) {
                dragStateRef.current.moved = false;
                return;
              }
              setIsOpen(true);
            }}
            title={
              aiDraggable
                ? 'Click to open AI Advisor • Drag anywhere to move'
                : 'Click to open AI Advisor'
            }
            className={`flex items-center bg-gradient-to-tr ${gradientClass} text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200 border-2 border-white/25 ${
              aiDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            } ${
              aiButtonStyle === 'icon'
                ? 'w-12 h-12 justify-center p-0'
                : aiButtonStyle === 'compact'
                ? 'px-3.5 py-2.5 space-x-2'
                : 'px-4.5 py-3 space-x-3'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-amber-300" />
            </div>

            {aiButtonStyle === 'compact' && (
              <span className="font-black text-xs tracking-wide pr-0.5">AI</span>
            )}

            {aiButtonStyle === 'full' && (
              <div className="flex flex-col text-left pr-1">
                <span className="font-black text-xs uppercase tracking-wider leading-tight">
                  Gemini AI
                </span>
                <span className="text-[10px] text-white/80 font-medium leading-none">
                  Ask Advisor
                </span>
              </div>
            )}

            {aiDraggable && aiButtonStyle !== 'icon' && (
              <Move
                size={12}
                className="text-white/60 group-hover:text-white transition-colors ml-0.5"
              />
            )}
          </button>

          {/* Quick Customize Trigger on Hover */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setIsOpen(true);
              setShowCustomize(true);
            }}
            title="Customize or Move AI Tool"
            className="opacity-0 group-hover:opacity-100 ml-1.5 w-7 h-7 rounded-full bg-slate-900/90 text-white border border-white/20 shadow-lg flex items-center justify-center transition-all hover:scale-110"
          >
            <Sliders size={12} />
          </button>
        </div>
      ) : (
        <div
          className={`flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'w-[92vw] md:w-[750px] h-[85vh] max-h-[840px]'
              : 'w-[92vw] sm:w-[450px] h-[560px]'
          }`}
        >
          {/* Draggable Header Controls */}
          <div
            onMouseDown={e => {
              if ((e.target as HTMLElement).closest('button')) return;
              startDrag(e.clientX, e.clientY);
            }}
            onTouchStart={e => {
              if ((e.target as HTMLElement).closest('button')) return;
              if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
            }}
            className={`bg-slate-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 ${
              aiDraggable ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            title={aiDraggable ? 'Drag header to move AI window anywhere on screen' : ''}
          >
            <div className="flex items-center space-x-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-200 truncate">
                Af© AI Advisor
              </span>
              {aiDraggable && (
                <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                  <Move size={10} />
                  <span>Drag to Move</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              {dragPos && (
                <button
                  type="button"
                  onClick={() => {
                    setDragPos(null);
                    updateSettingsPartial({
                      aiPositionPreset: 'bottom-right',
                      aiCustomPosition: null
                    });
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Reset AI Position to Corner"
                >
                  <RotateCcw size={13} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCustomize(!showCustomize)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition-colors ${
                  showCustomize
                    ? 'bg-indigo-600 text-white'
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Customize AI Tool & Position"
              >
                <Sliders size={12} />
                <span>{showCustomize ? 'Back to Chat' : 'Customize'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowCustomize(false);
                }}
                className="p-1.5 rounded-lg hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 transition-colors"
                title="Close chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body: Either Customization Drawer or Interactive AI Chat */}
          {showCustomize && settings ? (
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950">
              <AICustomizationPanel
                settings={settings}
                onUpdateSettings={updateSettingsPartial}
                onTriggerTestBlink={onTriggerTestBlink}
                compact
              />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <AIChatBot
                invoices={invoices}
                expenses={expenses}
                clients={clients}
                settings={settings}
                compact={!isExpanded}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FloatingAIChat;

import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  Maximize2, 
  Minimize2, 
  MessageSquare,
  Bot
} from 'lucide-react';
import { Invoice, Expense, Client, CompanySettings } from '../types';
import AIChatBot from './AIChatBot';

interface FloatingAIChatProps {
  invoices: Invoice[];
  expenses?: Expense[];
  clients: Client[];
  settings?: CompanySettings;
}

const FloatingAIChat: React.FC<FloatingAIChatProps> = ({
  invoices,
  expenses = [],
  clients,
  settings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 no-print">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center space-x-3 bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-700 text-white px-5 py-3.5 rounded-full shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/20"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles size={16} className="animate-pulse text-amber-300" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-black text-xs uppercase tracking-wider">Gemini AI</span>
            <span className="text-[10px] text-indigo-200 font-medium leading-none">Ask Advisor</span>
          </div>
        </button>
      ) : (
        <div 
          className={`flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 ${
            isExpanded 
              ? 'w-[90vw] md:w-[750px] h-[85vh] max-h-[850px]' 
              : 'w-[92vw] sm:w-[460px] h-[580px]'
          }`}
        >
          {/* Header Controls */}
          <div className="bg-slate-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">Af© Gemini Advisor</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 transition-colors"
                title="Close chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="flex-1 overflow-hidden">
            <AIChatBot
              invoices={invoices}
              expenses={expenses}
              clients={clients}
              settings={settings}
              compact={!isExpanded}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingAIChat;

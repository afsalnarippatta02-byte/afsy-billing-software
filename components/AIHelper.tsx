import React, { useState } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  Zap, 
  Target, 
  MessageSquare, 
  BrainCircuit, 
  Loader2, 
  RefreshCw,
  Bot,
  Mail,
  PieChart,
  ShieldAlert
} from 'lucide-react';
import { Invoice, Client, Expense, CompanySettings } from '../types';
import { geminiService } from '../services/geminiService';
import AIChatBot from './AIChatBot';
import { LanguageCode, getTranslation } from '../utils/translations';

interface AIHelperProps {
  invoices: Invoice[];
  clients: Client[];
  expenses?: Expense[];
  settings?: CompanySettings;
  language?: LanguageCode;
}

export const AIHelper: React.FC<AIHelperProps> = ({ 
  invoices, 
  clients, 
  expenses = [], 
  settings,
  language = 'en'
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'strategy' | 'emails'>('chat');
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [draftEmail, setDraftEmail] = useState('');
  const [selectedClient, setSelectedClient] = useState(clients[0]?.id || '');
  const [emailAmount, setEmailAmount] = useState(2500);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);

  const generateInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const result = await geminiService.getFinancialAdvice(invoices);
      const splitInsights = result.split('\n').filter(line => line.trim().length > 0);
      setInsights(splitInsights);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleDraftEmail = async () => {
    setIsLoadingEmail(true);
    try {
      const client = clients.find(c => c.id === selectedClient);
      const email = await geminiService.draftFollowUpEmail(client?.company || 'Valued Client', emailAmount, '2026-03-01');
      setDraftEmail(email);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingEmail(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none">
            <Sparkles size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('ai_helper.title', 'Gemini AI Financial Intelligence')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Multi-turn strategic reasoning, UAE billing compliance, and financial intelligence.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm self-start md:self-auto">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Bot size={16} />
            <span>Interactive Chatbot</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('strategy');
              if (insights.length === 0) generateInsights();
            }}
            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 ${
              activeTab === 'strategy'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <TrendingUp size={16} />
            <span>1-Click Insights</span>
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 ${
              activeTab === 'emails'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Mail size={16} />
            <span>Email Drafter</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <AIChatBot 
              invoices={invoices} 
              expenses={expenses} 
              clients={clients} 
              settings={settings} 
            />
          </div>

          {/* Quick Context Sidebar */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden border border-slate-800">
              <BrainCircuit className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 rotate-12 text-indigo-400" />
              <h3 className="text-base font-black uppercase tracking-wider mb-2 relative z-10 text-indigo-300">Model Routing</h3>
              <div className="space-y-3 relative z-10 text-xs">
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="font-bold text-indigo-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-300" /> gemini-3.5-flash
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1">General tasks, VAT calculation, billing queries, and fast reasoning.</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="font-bold text-purple-200 flex items-center gap-1.5">
                    <BrainCircuit size={14} className="text-purple-300" /> gemini-3.1-pro-preview
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1">Deep complex financial audits, risk stress-testing, and forecasting.</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="font-bold text-amber-200 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-300" /> gemini-3.1-flash-lite
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1">Rapid line-item pricing and instantaneous email generation.</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Business Snapshot</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total Invoices</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{invoices.length}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Registered Clients</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{clients.length}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Operating Expenses</span>
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400">AED {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">UAE VAT Rate</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">{settings?.taxRate ?? 5}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'strategy' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Instant AI Financial Insights</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">One-click audit of your billing records and revenue collection.</p>
            </div>
            <button 
              onClick={generateInsights}
              disabled={isLoadingInsights}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
            >
              <RefreshCw size={18} className={isLoadingInsights ? 'animate-spin' : ''} />
              <span>{isLoadingInsights ? 'Analyzing...' : 'Re-run Analysis'}</span>
            </button>
          </div>

          {isLoadingInsights ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 size={40} className="text-indigo-600 dark:text-indigo-400 animate-spin" />
              <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse">Running Gemini analysis on your media billing data...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(insights.length > 0 ? insights : [
                "Track invoices with net-7 day payment terms to prevent cash-flow dry spells.",
                "Incentivize upfront 50% deposits on high-budget video production projects in Dubai.",
                "Regularize monthly recurring retainers for social media and content marketing clients.",
                "Ensure UAE TRN number is clearly visible on all tax invoices to avoid FTA reconciliation delays."
              ]).map((insight, idx) => (
                <div key={idx} className="flex items-start space-x-4 p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm flex-shrink-0">
                    <Target size={22} />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-semibold">{insight.replace(/^[*\s-]+/, '')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">AI Client Communication Assistant</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Quickly generate tailored payment reminders and follow-up notes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Target Client</label>
              <select 
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {clients.map(c => <option key={c.id} value={c.id} className="dark:bg-slate-900">{c.company}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Pending Amount (AED)</label>
              <input 
                type="number"
                value={emailAmount}
                onChange={e => setEmailAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-end">
              <button 
                onClick={handleDraftEmail}
                disabled={isLoadingEmail}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
              >
                {isLoadingEmail ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
                <span>Generate Email</span>
              </button>
            </div>
          </div>

          {draftEmail && (
            <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 relative group animate-in fade-in">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans leading-relaxed">
                {draftEmail}
              </pre>
              <button 
                onClick={() => navigator.clipboard.writeText(draftEmail)}
                className="absolute top-4 right-4 text-xs font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-sm hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all"
              >
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIHelper;

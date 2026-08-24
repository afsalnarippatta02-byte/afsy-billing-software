import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Trash2, 
  Download, 
  Bot, 
  User, 
  Copy, 
  Check, 
  RotateCcw, 
  BrainCircuit, 
  Zap, 
  Layers, 
  FileText, 
  ShieldCheck, 
  Database, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  PlusCircle, 
  MessageSquare,
  AlertCircle,
  TrendingUp,
  Info
} from 'lucide-react';
import { 
  ChatMessage, 
  ChatRolePreset, 
  GeminiModelType, 
  Invoice, 
  Expense, 
  Client, 
  CompanySettings 
} from '../types';
import { geminiService, CHAT_ROLE_PRESETS } from '../services/geminiService';

interface AIChatBotProps {
  invoices: Invoice[];
  expenses?: Expense[];
  clients: Client[];
  settings?: CompanySettings;
  compact?: boolean; // For floating drawer mode
  initialPrompt?: string;
}

const AIChatBot: React.FC<AIChatBotProps> = ({ 
  invoices, 
  expenses = [], 
  clients, 
  settings, 
  compact = false,
  initialPrompt
}) => {
  const [selectedRole, setSelectedRole] = useState<ChatRolePreset>(CHAT_ROLE_PRESETS[0]);
  const [selectedModel, setSelectedModel] = useState<GeminiModelType>(selectedRole.defaultModel);
  const [customSystemInstruction, setCustomSystemInstruction] = useState<string>(selectedRole.systemInstruction);
  const [isCustomizingRole, setIsCustomizingRole] = useState<boolean>(false);
  const [includeBusinessContext, setIncludeBusinessContext] = useState<boolean>(true);

  // Chat message history
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const storageKey = `cf_chat_history_${selectedRole.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'welcome-msg',
        role: 'model',
        text: `Hello! I'm your **${selectedRole.name}** powered by Gemini.\n\nI can analyze your agency's invoices, model profit margins in AED, verify UAE 5% VAT compliance, estimate line items, or draft client communications.\n\nHow can I assist your media business today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedRole.defaultModel,
        rolePreset: selectedRole.name,
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on message update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Persist chat per role
  useEffect(() => {
    const storageKey = `cf_chat_history_${selectedRole.id}`;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, selectedRole.id]);

  // Handle initial prompt if provided
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim().length > 0) {
      setInputMessage(initialPrompt);
    }
  }, [initialPrompt]);

  // Handle switching role
  const handleSelectRole = (role: ChatRolePreset) => {
    setSelectedRole(role);
    setSelectedModel(role.defaultModel);
    setCustomSystemInstruction(role.systemInstruction);

    // Load or initialize messages for this role
    const storageKey = `cf_chat_history_${role.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
        return;
      } catch (e) {
        console.error(e);
      }
    }

    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: `Hello! I'm active as your **${role.name}**.\n\n${role.description}\n\nAsk me anything or select one of the suggested prompts below to get started!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: role.defaultModel,
        rolePreset: role.name,
      }
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    setErrorMessage(null);
    setInputMessage('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await geminiService.sendChatMessage({
        messages: newMessages,
        model: selectedModel,
        systemInstruction: customSystemInstruction,
        contextPayload: includeBusinessContext ? {
          invoices,
          expenses,
          clients,
          settings,
        } : undefined,
      });

      const modelMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: response.modelUsed,
        rolePreset: selectedRole.name,
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      console.error(err);
      const errorText = err?.message || 'Unable to connect to Gemini. Please try again.';
      setErrorMessage(errorText);

      const errorModelMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'model',
        text: `⚠️ **Error generating response:** ${errorText}\n\nYou can click **Retry** below or try selecting another Gemini model.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
        isError: true,
      };

      setMessages(prev => [...prev, errorModelMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear conversation history for this persona?')) {
      const initial: ChatMessage = {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: `Conversation reset. I am your **${selectedRole.name}**. How can I help?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
        rolePreset: selectedRole.name,
      };
      setMessages([initial]);
    }
  };

  const handleExportChat = () => {
    const text = messages.map(m => `[${m.timestamp}] ${m.role === 'user' ? 'YOU' : `GEMINI (${m.modelUsed || 'model'})`}:\n${m.text}\n\n`).join('---\n');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creativeflow-chat-${selectedRole.id}-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to format markdown text simply for readability
  const renderFormattedMessage = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-2 leading-relaxed text-sm">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return <h4 key={idx} className="font-black text-slate-900 text-base mt-3 mb-1">{line.replace('### ', '')}</h4>;
          }
          if (line.startsWith('## ')) {
            return <h3 key={idx} className="font-black text-slate-900 text-lg mt-4 mb-2">{line.replace('## ', '')}</h3>;
          }
          if (line.startsWith('# ')) {
            return <h2 key={idx} className="font-black text-slate-900 text-xl mt-4 mb-2">{line.replace('# ', '')}</h2>;
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.substring(2);
            return (
              <div key={idx} className="flex items-start space-x-2 pl-2">
                <span className="text-indigo-600 font-black mt-1 text-xs">•</span>
                <span className="flex-1 font-medium">{formatInlineText(content)}</span>
              </div>
            );
          }
          if (/^\d+\.\s/.test(line)) {
            const numMatch = line.match(/^(\d+\.)\s(.*)/);
            if (numMatch) {
              return (
                <div key={idx} className="flex items-start space-x-2 pl-2">
                  <span className="text-indigo-600 font-bold text-xs mt-0.5">{numMatch[1]}</span>
                  <span className="flex-1 font-medium">{formatInlineText(numMatch[2])}</span>
                </div>
              );
            }
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-1.5" />;
          }
          return <p key={idx} className="font-medium">{formatInlineText(line)}</p>;
        })}
      </div>
    );
  };

  const formatInlineText = (text: string) => {
    // Basic bold **text** parsing
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-slate-200/80 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-mono font-bold">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className={`flex flex-col bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden ${compact ? 'h-[620px]' : 'h-[780px]'}`}>
      {/* Top Header Bar */}
      <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-black text-base tracking-tight text-white">Gemini Multi-Turn Advisor</h2>
              <span className="bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                Live Chat
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium truncate max-w-sm">
              Role: <strong className="text-slate-200">{selectedRole.name}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end md:self-auto">
          {/* Business context toggle */}
          <button
            onClick={() => setIncludeBusinessContext(!includeBusinessContext)}
            title={includeBusinessContext ? "Live invoice & financial data is provided to Gemini" : "Business context disabled"}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              includeBusinessContext 
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Database size={13} />
            <span className="hidden sm:inline">Live Data Context:</span>
            <span className="uppercase text-[10px] font-black">{includeBusinessContext ? 'On' : 'Off'}</span>
          </button>

          {/* Export Chat */}
          <button
            onClick={handleExportChat}
            title="Export conversation history"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <Download size={15} />
          </button>

          {/* Clear history */}
          <button
            onClick={handleClearHistory}
            title="Clear current chat"
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 transition-colors border border-slate-700"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Control Bar: Role Selection & Model Switcher */}
      <div className="bg-slate-50 border-b border-slate-200 p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Role Selector Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-hide max-w-full">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center">
            <Sliders size={12} className="mr-1" /> Persona:
          </span>
          {CHAT_ROLE_PRESETS.map(role => {
            const isSelected = selectedRole.id === role.id;
            return (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                  isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                {role.name.split('&')[0].trim()}
              </button>
            );
          })}
        </div>

        {/* Model Selection Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Model:</span>
          <div className="relative inline-flex bg-white rounded-xl border border-slate-200 p-0.5 shadow-sm">
            <button
              onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
              title="Fastest response model (gemini-3.1-flash-lite)"
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                selectedModel === 'gemini-3.1-flash-lite'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap size={12} />
              <span>Flash-Lite</span>
            </button>
            <button
              onClick={() => setSelectedModel('gemini-3.5-flash')}
              title="General tasks model (gemini-3.5-flash)"
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                selectedModel === 'gemini-3.5-flash'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={12} />
              <span>3.5 Flash</span>
            </button>
            <button
              onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
              title="Deep reasoning & complex tasks model (gemini-3.1-pro-preview)"
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                selectedModel === 'gemini-3.1-pro-preview'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BrainCircuit size={12} />
              <span>3.1 Pro</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Custom System Prompt Editor */}
      <div className="bg-slate-50/70 border-b border-slate-200 px-5 py-2">
        <button
          onClick={() => setIsCustomizingRole(!isCustomizingRole)}
          className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <span>System Instruction & Persona Rules</span>
          {isCustomizingRole ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isCustomizingRole && (
          <div className="mt-2 pb-2 space-y-2 animate-in fade-in slide-in-from-top-1">
            <p className="text-[11px] text-slate-500 font-medium">
              Customize the instructions passed to Gemini for this role session:
            </p>
            <textarea
              value={customSystemInstruction}
              onChange={e => setCustomSystemInstruction(e.target.value)}
              className="w-full h-24 p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter custom system instructions..."
            />
            <div className="flex justify-end">
              <button
                onClick={() => setCustomSystemInstruction(selectedRole.systemInstruction)}
                className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
              >
                Reset to Role Default
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Message Thread */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-50/40">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={`flex items-start gap-3.5 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                isUser ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold shadow-md ${
                  isUser
                    ? 'bg-slate-900'
                    : message.isError
                    ? 'bg-rose-600'
                    : 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                }`}
              >
                {isUser ? <User size={18} /> : message.isError ? <AlertCircle size={18} /> : <Bot size={18} />}
              </div>

              {/* Message Bubble */}
              <div className={`flex flex-col max-w-[84%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Meta details header */}
                <div className="flex items-center space-x-2 mb-1 text-[11px] font-bold text-slate-400 px-1">
                  <span>{isUser ? 'You' : message.rolePreset || 'Gemini AI'}</span>
                  <span>•</span>
                  <span>{message.timestamp}</span>
                  {message.modelUsed && !isUser && (
                    <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-black uppercase px-1.5 py-0.2 rounded">
                      {message.modelUsed}
                    </span>
                  )}
                </div>

                <div
                  className={`p-4 md:p-5 rounded-3xl shadow-sm relative text-slate-800 ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-sm font-medium'
                      : message.isError
                      ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-sm'
                      : 'bg-white border border-slate-200/90 rounded-tl-sm'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-sm font-medium">{message.text}</p>
                  ) : (
                    renderFormattedMessage(message.text)
                  )}

                  {/* Actions on hover */}
                  {!isUser && !message.isError && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span className="text-[10px] font-bold text-slate-400">Af© AI</span>
                      <button
                        onClick={() => handleCopy(message.id, message.text)}
                        className="flex items-center space-x-1 text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-lg hover:bg-slate-50"
                        title="Copy message"
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check size={13} className="text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span className="text-[10px] font-bold">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {message.isError && (
                    <div className="mt-3">
                      <button
                        onClick={() => handleSendMessage(messages[messages.length - 2]?.text)}
                        className="flex items-center space-x-1.5 bg-rose-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs hover:bg-rose-700 transition-all shadow"
                      >
                        <RotateCcw size={13} />
                        <span>Retry Generation</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex items-start gap-3.5 animate-in fade-in duration-300">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Bot size={18} className="animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-3xl rounded-tl-sm shadow-sm flex items-center space-x-3">
              <div className="flex space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"></span>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {selectedModel === 'gemini-3.1-pro-preview' 
                  ? 'Gemini 3.1 Pro is performing deep financial reasoning...' 
                  : selectedModel === 'gemini-3.1-flash-lite'
                  ? 'Gemini Flash-Lite is generating fast response...'
                  : 'Gemini 3.5 Flash is thinking...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Pills */}
      <div className="bg-white border-t border-slate-100 px-5 pt-3 pb-2 overflow-x-auto scrollbar-hide flex items-center space-x-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Suggested:</span>
        {selectedRole.suggestedPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200/80 hover:border-indigo-200 text-xs font-bold whitespace-nowrap transition-all flex-shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end space-x-3 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all"
        >
          <textarea
            ref={inputRef}
            rows={compact ? 2 : 3}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${selectedRole.name} anything... (Enter to send, Shift+Enter for newline)`}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-slate-800 font-medium placeholder-slate-400 p-2 custom-scrollbar"
          />

          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className={`p-3.5 rounded-xl font-bold transition-all flex items-center justify-center flex-shrink-0 ${
              inputMessage.trim() && !isLoading
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send size={18} />
          </button>
        </form>
        
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400 font-medium">
          <span>Active model: <strong className="text-slate-600">{selectedModel}</strong></span>
          <span>Shift + Enter for new line • Enter to send</span>
        </div>
      </div>
    </div>
  );
};

export default AIChatBot;

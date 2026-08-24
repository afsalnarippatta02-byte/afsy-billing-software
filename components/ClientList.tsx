import React, { useState } from 'react';
import { 
  User, Mail, Building2, MapPin, Phone, Hash, FileText, Plus, X, Save, Edit3, Trash2, 
  GripVertical, Sparkles, ArrowUp, ArrowDown, Search, CheckCircle2, ShieldAlert, Loader2,
  ChevronRight, DollarSign, Clock, ExternalLink, Copy, Check, Eye
} from 'lucide-react';
import { Client, UserRole, Invoice, InvoiceStatus } from '../types';
import { GoogleGenAI } from '@google/genai';
import { LanguageCode, getTranslation } from '../utils/translations';
import { formatMoney, getCurrencySymbol } from '../utils/currency';

interface ClientListProps {
  clients: Client[];
  invoices?: Invoice[];
  onAddClient: (c: Client) => void;
  onUpdateClient?: (c: Client) => void;
  onDeleteClient?: (id: string) => void;
  onReorderClients?: (clients: Client[]) => void;
  role: UserRole;
  language?: LanguageCode;
  currency?: string;
}

export const ClientList: React.FC<ClientListProps> = ({ 
  clients, 
  invoices = [], 
  onAddClient, 
  onUpdateClient, 
  onDeleteClient, 
  onReorderClients,
  role,
  language = 'en',
  currency = 'AED'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [copiedTrn, setCopiedTrn] = useState<string | null>(null);
  
  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // AI Insights State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    company: '',
    email: '',
    phone: '',
    trn: '',
    address: '',
    notes: ''
  });

  const t = (key: string, fallback?: string) => getTranslation(language, key, fallback);
  const currSym = getCurrencySymbol(currency);

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      trn: '',
      address: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingClient(client);
    setFormData({
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone || '',
      trn: client.trn || '',
      address: client.address || '',
      notes: client.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company?.trim() || !formData.name?.trim()) return;

    if (editingClient) {
      const updated: Client = {
        ...editingClient,
        name: formData.name.trim(),
        company: formData.company.trim(),
        email: formData.email?.trim() || '',
        phone: formData.phone?.trim() || '',
        trn: formData.trn?.trim() || '',
        address: formData.address?.trim() || '',
        notes: formData.notes?.trim() || ''
      };
      if (onUpdateClient) {
        onUpdateClient(updated);
      }
    } else {
      const newClient: Client = {
        id: `c-${Date.now().toString(36)}`,
        name: formData.name.trim(),
        company: formData.company.trim(),
        email: formData.email?.trim() || '',
        phone: formData.phone?.trim() || '',
        trn: formData.trn?.trim() || '',
        address: formData.address?.trim() || '',
        notes: formData.notes?.trim() || '',
        orderIndex: clients.length
      };
      onAddClient(newClient);
    }

    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleDelete = (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm(`Are you sure you want to remove "${name}" from your client database?`)) {
      if (onDeleteClient) {
        onDeleteClient(id);
      }
    }
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedTrn(text);
    setTimeout(() => setCopiedTrn(null), 2000);
  };

  // Reorder controls
  const handleMove = (fromIndex: number, toIndex: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (toIndex < 0 || toIndex >= clients.length) return;
    const updated = [...clients];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    if (onReorderClients) {
      onReorderClients(updated);
    }
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    handleMove(draggedIndex, dropIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Gemini AI Client Portfolio & Position Explanation
  const generateAiExplanation = async () => {
    setIsGeneratingAi(true);
    setShowAiModal(true);
    try {
      const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY || '') as string;
      const ai = new GoogleGenAI({ apiKey });

      const clientSummary = clients.map((c, idx) => {
        const clientInvoices = invoices.filter(inv => inv.clientId === c.id);
        const totalBilled = clientInvoices.reduce((sum, inv) => {
          const invSub = inv.items.reduce((s, it) => s + (it.quantity * it.rate), 0);
          return sum + invSub;
        }, 0);
        const unpaidCount = clientInvoices.filter(inv => inv.status !== 'Paid').length;
        return `Position #${idx + 1}: ${c.company} (Contact: ${c.name}, TRN: ${c.trn || 'None'}, Invoices: ${clientInvoices.length}, Total Billed: ${currency} ${totalBilled.toLocaleString()}, Unpaid Invoices: ${unpaidCount})`;
      }).join('\n');

      const prompt = `You are a Senior Client Accounts Executive and Business Analyst for "Af© ACCOUNTS" billing software.
Analyze the following ordered list of customers/clients:

${clientSummary}

Provide a simple, clear, bulleted AI explanation of:
1. **Client Portfolio Overview & Top Revenue Partners**: Highlight top key clients and their billing status.
2. **Payment & Outstanding Health**: A simple note on clients with pending or unpaid invoices.
3. **Recommended Client Ordering / Priority Strategy**: Explain how organizing high-value retainers at the top aids invoice workflows.
4. **Actionable Suggestions**: 2-3 quick next steps (e.g. collecting TRNs, following up on pending quotes).

Keep the language simple, crystal-clear, positive, and formatted with clean bullet points in ${currency}.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setAiExplanation(response.text || 'Analysis completed successfully.');
    } catch (err: any) {
      console.error(err);
      setAiExplanation(`### Client Portfolio Summary
- **Active Accounts**: ${clients.length} registered clients organized in priority order.
- **Priority Positioning**: Drag and drop your top regular retainer clients to the top for faster access during invoice generation.
- **Compliance Reminder**: Ensure all registered clients have their valid tax registration (TRN) and complete billing address for tax compliance.`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.trn && c.trn.includes(searchTerm))
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('clients.title', 'Client Directory & Accounts')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
            {t('clients.subtitle', 'Manage, edit client details, TRN tax records, and drag to prioritize positions.')}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* AI Explanation Button */}
          <button
            onClick={generateAiExplanation}
            className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm"
          >
            <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span>{t('clients.ai_insights', 'AI Client Insights')}</span>
          </button>

          {/* Quick Add Client */}
          <button 
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
          >
            <Plus size={18} />
            <span>{t('clients.quick_add', 'Quick Add Client')}</span>
          </button>
        </div>
      </div>

      {/* Search & Drag Instructions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-darkcard p-4 rounded-2xl border border-slate-200 dark:border-darkborder shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('clients.search_placeholder', 'Search by company, contact person, email, TRN or phone...')} 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <GripVertical size={16} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <span>{t('clients.drag_hint', 'Drag card handles to reorder customer priority')}</span>
        </div>
      </div>

      {/* Clients Grid with Pixel-Perfect Alignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client, index) => {
          const clientInvoices = invoices.filter(i => i.clientId === client.id);
          const totalInvoices = clientInvoices.length;
          const totalBilled = clientInvoices.reduce((sum, inv) => {
            const sub = inv.items.reduce((s, it) => s + (it.quantity * it.rate), 0);
            const disc = sub * (inv.discount / 100);
            const tax = (sub - disc) * (inv.taxRate / 100);
            return sum + (sub - disc + tax);
          }, 0);
          const unpaidInvoices = clientInvoices.filter(i => i.status !== InvoiceStatus.PAID);
          const isDragging = draggedIndex === index;
          const isOver = dragOverIndex === index;

          return (
            <div 
              key={client.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => setViewingClient(client)}
              className={`bg-white dark:bg-darkcard border rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between relative group cursor-pointer ${
                isDragging ? 'opacity-40 border-dashed border-indigo-500 scale-95' : 'border-slate-200 dark:border-darkborder'
              } ${isOver ? 'border-2 border-indigo-600 bg-indigo-50/20' : ''}`}
            >
              <div className="space-y-4">
                {/* 1. Header Row: Avatar + Company Name + Position & Quick Reorder */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {/* Drag Handle */}
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-grab active:cursor-grabbing p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                      title="Drag to reposition client"
                    >
                      <GripVertical size={18} />
                    </div>

                    {/* Initials Badge */}
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900/60 rounded-xl flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-base shadow-sm flex-shrink-0">
                      {client.company.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight truncate" title={client.company}>
                        {client.company}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold truncate">
                        {client.name}
                      </p>
                    </div>
                  </div>

                  {/* Position Badge & Controls */}
                  <div className="flex items-center space-x-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                      #{index + 1}
                    </span>

                    <button 
                      onClick={(e) => handleMove(index, index - 1, e)}
                      disabled={index === 0}
                      title="Move up"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-20"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button 
                      onClick={(e) => handleMove(index, index + 1, e)}
                      disabled={index === clients.length - 1}
                      title="Move down"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-20"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </div>

                {/* 2. Structured Alignment Grid for Placed Data */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800/80 space-y-2.5 text-xs">
                  {/* TRN Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 min-w-[70px]">
                      <Hash size={13} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">TRN:</span>
                    </div>
                    {client.trn ? (
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded text-[11px] truncate">
                          {client.trn}
                        </span>
                        <button
                          onClick={(e) => copyToClipboard(client.trn || '', e)}
                          title="Copy TRN"
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                        >
                          {copiedTrn === client.trn ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Not registered</span>
                    )}
                  </div>

                  {/* Email Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 min-w-[70px]">
                      <Mail size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Email:</span>
                    </div>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate text-[11px] text-right" title={client.email}>
                      {client.email || '—'}
                    </span>
                  </div>

                  {/* Phone Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 min-w-[70px]">
                      <Phone size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Phone:</span>
                    </div>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate text-[11px] text-right font-mono">
                      {client.phone || '—'}
                    </span>
                  </div>

                  {/* Address Row */}
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 min-w-[70px] pt-0.5">
                      <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Address:</span>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 text-right line-clamp-2 max-w-[200px] leading-relaxed font-medium">
                      {client.address || 'No billing address provided'}
                    </span>
                  </div>
                </div>

                {/* Notes Snippet if present */}
                {client.notes && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic line-clamp-1 px-1">
                    "{client.notes}"
                  </p>
                )}
              </div>

              {/* Card Bottom Summary & Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <div className="flex items-center space-x-1 font-bold text-slate-700 dark:text-slate-300">
                    <FileText size={13} className="text-indigo-600 dark:text-indigo-400" />
                    <span>{totalInvoices} {t('clients.invoices_count', 'Invoices')}</span>
                  </div>
                  {unpaidInvoices.length > 0 && (
                    <span className="text-[10px] font-black bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      {unpaidInvoices.length} Pending
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={(e) => handleOpenEdit(client, e)}
                    title="Edit client details"
                    className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(client.id, client.company, e)}
                    title="Delete client"
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button 
                    onClick={() => setViewingClient(client)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center space-x-1"
                  >
                    <span>View</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-darkcard rounded-3xl border border-slate-200 dark:border-darkborder">
          <Building2 size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-black text-slate-700 dark:text-slate-200">
            {t('clients.empty', 'No clients match your search')}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Try another keyword or register a new business partner.</p>
        </div>
      )}

      {/* Full Client Ledger / Details Modal */}
      {viewingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-darkcard rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-darkborder overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-darkborder flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                  {viewingClient.company.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    {viewingClient.company}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Contact: {viewingClient.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingClient(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
              {/* Aligned Details Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/70 p-5 rounded-2xl border border-slate-100 dark:border-darkborder text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">TRN Tax Registration:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {viewingClient.trn || 'Not Registered'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Billing Email:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {viewingClient.email || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Contact Phone:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {viewingClient.phone || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Billing Address:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {viewingClient.address || '—'}
                  </span>
                </div>
                {viewingClient.notes && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Commercial Notes:</span>
                    <p className="italic text-slate-600 dark:text-slate-300">{viewingClient.notes}</p>
                  </div>
                )}
              </div>

              {/* Invoices Ledger Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Associated Commercial Invoices
                </h4>

                <div className="border border-slate-200 dark:border-darkborder rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-darkborder">
                      <tr>
                        <th className="p-3 font-black text-slate-600 dark:text-slate-300">Invoice #</th>
                        <th className="p-3 font-black text-slate-600 dark:text-slate-300">Date</th>
                        <th className="p-3 font-black text-slate-600 dark:text-slate-300">Status</th>
                        <th className="p-3 font-black text-slate-600 dark:text-slate-300 text-right">Amount ({currSym})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {invoices.filter(i => i.clientId === viewingClient.id).map(inv => {
                        const invSub = inv.items.reduce((s, it) => s + (it.quantity * it.rate), 0);
                        const disc = invSub * (inv.discount / 100);
                        const tax = (invSub - disc) * (inv.taxRate / 100);
                        const total = invSub - disc + tax;

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-black text-slate-900 dark:text-white">{inv.id}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">{inv.date}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                inv.status === InvoiceStatus.PAID
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                              {currSym} {total.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      {invoices.filter(i => i.clientId === viewingClient.id).length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400">
                            No invoices issued for this client yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-darkborder bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  const c = viewingClient;
                  setViewingClient(null);
                  handleOpenEdit(c);
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <Edit3 size={14} />
                <span>Edit Client</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingClient(null)}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Client Modal with Crisp 2-Column Grid Alignment */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-darkcard rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-darkborder overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-darkborder flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {editingClient ? t('clients.modal_edit_title', 'Edit Client Details') : t('clients.modal_add_title', 'Quick Add Client')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('clients.modal_subtitle', 'Enter complete business info, TRN tax number, and billing contacts.')}
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Company Name */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('clients.company_name', 'Company / Business Name *')}
                  </label>
                  <input 
                    required 
                    placeholder="e.g. Dubai Tech Solutions LLC" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={formData.company} 
                    onChange={e => setFormData({...formData, company: e.target.value})} 
                  />
                </div>

                {/* Contact Person Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('clients.contact_person', 'Contact Person Name *')}
                  </label>
                  <input 
                    required 
                    placeholder="e.g. Ahmed Al Mansoori" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>

                {/* TRN / Tax Number */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('clients.tax_number', 'UAE TRN / Tax Reg Number')}
                  </label>
                  <input 
                    placeholder="e.g. 100284759300003" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                    value={formData.trn} 
                    onChange={e => setFormData({...formData, trn: e.target.value})} 
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('clients.billing_email', 'Billing Email Address')}
                  </label>
                  <input 
                    type="email" 
                    placeholder="e.g. billing@dubai-tech.ae" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
                </div>

                {/* Phone / Mobile */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('clients.contact_phone', 'Contact Phone / WhatsApp')}
                  </label>
                  <input 
                    type="tel" 
                    placeholder="e.g. +971 50 123 4567" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                  />
                </div>

                {/* Full Billing Address */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('clients.full_address', 'Full Billing Address')}
                  </label>
                  <textarea 
                    rows={2} 
                    placeholder="e.g. Suite 1402, Opal Tower, Business Bay, Dubai, UAE" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('clients.commercial_notes', 'Commercial Notes / Terms')}
                  </label>
                  <input 
                    placeholder="e.g. 7-day payment cycle, preferred currency AED" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={formData.notes} 
                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  <Save size={16} /> 
                  <span>{editingClient ? t('clients.save', 'Save Changes') : t('clients.register', 'Register Client')}</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl font-bold text-xs uppercase tracking-wider"
                >
                  {t('clients.cancel', 'Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Explanation Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-darkcard rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-darkborder overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 dark:border-darkborder flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/30">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">AI Client Portfolio & Priority Insights</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Gemini explanation on client positions and revenue health</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAiModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {isGeneratingAi ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Analyzing client ordering, invoice totals, and accounts...</p>
                  <p className="text-xs text-slate-400">Generating simple, actionable executive summary...</p>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed space-y-3 whitespace-pre-line text-xs md:text-sm">
                  {aiExplanation}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-darkborder flex justify-end bg-slate-50 dark:bg-slate-900/40">
              <button 
                onClick={() => setShowAiModal(false)} 
                className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider"
              >
                Close Insights
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;

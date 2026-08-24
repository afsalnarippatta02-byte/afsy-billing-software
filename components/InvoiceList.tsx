
import React, { useState } from 'react';
import { 
  Search, Plus, FileText, Save, Calendar, Download, ChevronRight, Info, Banknote, 
  Building2, CheckCircle2, X, RefreshCw, FileSignature, AlertCircle, Clock, Trash2,
  CheckSquare, Square
} from 'lucide-react';
import { Invoice, InvoiceStatus, UserRole, Client, PaymentMethod, CompanySettings } from '../types';
import { isInvoiceOverdue, getDaysOverdue, formatMoney, getCurrencySymbol } from '../utils/currency';

interface InvoiceListProps {
  invoices: Invoice[];
  clients: Client[];
  settings?: CompanySettings;
  onNewInvoice: () => void;
  onEditInvoice: (id: string) => void;
  onDownloadInvoice: (id: string) => void;
  role: UserRole;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (id: string) => void;
  onDeleteMultipleInvoices?: (ids: string[]) => void;
}

const InvoiceList: React.FC<InvoiceListProps> = ({ 
  invoices, 
  clients, 
  settings, 
  onNewInvoice, 
  onEditInvoice, 
  onDownloadInvoice, 
  role, 
  onUpdateInvoice,
  onDeleteInvoice,
  onDeleteMultipleInvoices
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'invoices' | 'quotations' | 'overdue'>('all');
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const currencyCode = settings?.defaultCurrency || 'AED';
  const currSym = getCurrencySymbol(currencyCode);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  const handleRecordPayment = () => {
    if (paymentModalInvoice && onUpdateInvoice) {
      const updated: Invoice = {
        ...paymentModalInvoice,
        status: InvoiceStatus.PAID,
        paymentMethod: selectedMethod,
        paymentDate: paymentDate
      };
      onUpdateInvoice(updated);
      setPaymentModalInvoice(null);
    }
  };

  const handleConvertToInvoice = (inv: Invoice) => {
    if (onUpdateInvoice) {
      onUpdateInvoice({
        ...inv,
        status: InvoiceStatus.SENT // Change status from Quotation to Sent (Active Invoice)
      });
    }
  };

  const handleDeleteSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete invoice #${id}? This action cannot be undone.`)) {
      if (onDeleteInvoice) {
        onDeleteInvoice(id);
      }
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(i => i.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedIds.length} selected document(s)?`)) {
      if (onDeleteMultipleInvoices) {
        onDeleteMultipleInvoices(selectedIds);
      } else if (onDeleteInvoice) {
        selectedIds.forEach(id => onDeleteInvoice(id));
      }
      setSelectedIds([]);
    }
  };

  const filtered = invoices.filter(inv => {
    const matchesSearch = inv.id.toLowerCase().includes(search.toLowerCase()) || 
      clients.find(c => c.id === inv.clientId)?.company.toLowerCase().includes(search.toLowerCase()) ||
      clients.find(c => c.id === inv.clientId)?.name.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeTab === 'invoices') return inv.status !== InvoiceStatus.QUOTATION;
    if (activeTab === 'quotations') return inv.status === InvoiceStatus.QUOTATION;
    if (activeTab === 'overdue') return isInvoiceOverdue(inv);
    return true;
  });

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Billing & Invoices</h1>
          <div className="flex items-center space-x-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
             <Save size={10} />
             <span>Active Local Storage & Manual Data Management</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg transition-all flex items-center justify-center space-x-1.5 active:scale-95"
            >
              <Trash2 size={16} />
              <span>Delete ({selectedIds.length})</span>
            </button>
          )}
          <button 
            onClick={onNewInvoice}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 md:px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:shadow-2xl transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            <Plus size={18} />
            <span>New Document</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-wrap bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl gap-1">
             <button 
                onClick={() => setActiveTab('all')}
                className={`px-4 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}`}
             >
               All ({invoices.length})
             </button>
             <button 
                onClick={() => setActiveTab('invoices')}
                className={`px-4 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'invoices' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}`}
             >
               Invoices
             </button>
             <button 
                onClick={() => setActiveTab('quotations')}
                className={`px-4 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'quotations' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'}`}
             >
               Quotes
             </button>
             <button 
                onClick={() => setActiveTab('overdue')}
                className={`px-4 md:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overdue' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50'}`}
             >
               Overdue ({invoices.filter(i => isInvoiceOverdue(i)).length})
             </button>
          </div>
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 flex-1 md:max-w-md">
            <Search size={18} className="text-slate-400 mr-3 shrink-0" />
            <input 
              type="text" 
              placeholder="Search ID, Client or Company..." 
              className="bg-transparent outline-none text-xs md:text-sm font-bold w-full text-slate-900 dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <th className="px-4 py-4 w-10 text-center">
                  <button
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-indigo-600"
                    title={selectedIds.length === filtered.length ? 'Deselect All' : 'Select All'}
                  >
                    {filtered.length > 0 && selectedIds.length === filtered.length ? (
                      <CheckSquare size={16} className="text-indigo-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-6 md:px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document #</th>
                <th className="px-6 md:px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 md:px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</th>
                <th className="px-6 md:px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount ({currSym})</th>
                <th className="px-6 md:px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 md:px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtered.length > 0 ? filtered.map(inv => {
                const client = clients.find(c => c.id === inv.clientId);
                const subtotal = inv.items.reduce((s, i) => s + (i.quantity * i.rate), 0);
                const discountAmt = subtotal * (inv.discount / 100);
                const taxableAmt = subtotal - discountAmt;
                const taxAmt = taxableAmt * (inv.taxRate / 100);
                const finalGrossTotal = taxableAmt + taxAmt;
                const isQuote = inv.status === InvoiceStatus.QUOTATION;
                const overdue = isInvoiceOverdue(inv);
                const daysOver = getDaysOverdue(inv);
                const isSelected = selectedIds.includes(inv.id);

                return (
                  <tr key={inv.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}`}>
                    <td className="px-4 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleToggleSelect(inv.id, e)}
                        className="text-slate-400 hover:text-indigo-600"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-indigo-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 md:px-8 py-5">
                      <div className="flex items-center gap-2">
                        {isQuote ? <FileSignature size={14} className="text-slate-400" /> : <FileText size={14} className="text-indigo-600" />}
                        <p className="text-sm font-black text-slate-900 dark:text-white">#{inv.id}</p>
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-5 text-center">
                      <div className="date-badge-black text-[10px] mx-auto">
                        {formatDate(inv.date)}
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-5">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">{client?.company || 'N/A'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{client?.name}</p>
                    </td>
                    <td className="px-6 md:px-8 py-5 font-black text-right">
                      <span className="text-slate-900 dark:text-white text-sm md:text-base">
                        {formatMoney(finalGrossTotal, currencyCode)}
                      </span>
                    </td>
                    <td className="px-6 md:px-8 py-5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {inv.status === InvoiceStatus.PAID ? (
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            PAID
                          </span>
                        ) : isQuote ? (
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            QUOTATION
                          </span>
                        ) : overdue ? (
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1">
                            <AlertCircle size={10} />
                            <span>OVERDUE ({daysOver}d)</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                            <Clock size={10} />
                            <span>PENDING</span>
                          </span>
                        )}

                        {inv.status === InvoiceStatus.PAID && inv.paymentMethod && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            via {inv.paymentMethod}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-5 text-right">
                       <div className="flex items-center justify-end space-x-2">
                          {isQuote ? (
                            <button 
                              onClick={() => handleConvertToInvoice(inv)}
                              title="Convert to Final Invoice"
                              className="bg-slate-900 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                            >
                              <RefreshCw size={12} /> Convert
                            </button>
                          ) : (
                            inv.status !== InvoiceStatus.PAID && (
                              <button 
                                onClick={() => setPaymentModalInvoice(inv)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-sm"
                              >
                                <Banknote size={12} /> Paid
                              </button>
                            )
                          )}
                          <button 
                            onClick={() => onDownloadInvoice(inv.id)} 
                            title="Download Official PDF"
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg transition-colors"
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            onClick={() => onEditInvoice(inv.id)} 
                            className="bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all flex items-center gap-1"
                          >
                            Manage <ChevronRight size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSingle(inv.id, e)}
                            title="Delete Invoice"
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <FileText size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-4" />
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No matching documents found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paymentModalInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
            <div className="bg-slate-900 dark:bg-slate-800 p-6 flex justify-between items-center text-white">
               <div>
                 <h2 className="text-xl font-black tracking-tight">Settlement Record</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice #{paymentModalInvoice.id}</p>
               </div>
               <button onClick={() => setPaymentModalInvoice(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                 <X size={20} />
               </button>
            </div>
            
            <div className="p-6 space-y-6">
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.values(PaymentMethod).map((method) => (
                      <button
                        key={method}
                        onClick={() => setSelectedMethod(method)}
                        className={`p-3.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2 ${
                          selectedMethod === method 
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-md' 
                            : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        {method === PaymentMethod.CASH && <Banknote size={14} />}
                        {method === PaymentMethod.BANK_TRANSFER && <Building2 size={14} />}
                        <span>{method}</span>
                      </button>
                    ))}
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement Date</label>
                  <input 
                    type="date" 
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  />
               </div>

               <button 
                onClick={handleRecordPayment}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
               >
                 <CheckCircle2 size={18} />
                 <span>Confirm & Mark as Paid</span>
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceList;

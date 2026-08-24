import React, { useState, useMemo } from 'react';
import { 
  Users, UserCheck, Plus, Trash2, Edit3, Banknote, Calendar, Calculator, 
  FileText, Download, Printer, Search, CheckCircle2, AlertCircle, 
  ChevronRight, Save, X, ArrowUpDown, UserPlus, CreditCard, ShieldCheck, Wallet, Coins
} from 'lucide-react';
import { StaffMember, StaffAdvance, StaffAttendanceRecord, CompanySettings, UserRole, PaymentMethod } from '../types';
import { printElementDirectly, downloadElementAsPdf } from '../utils/pdfExport';
import { formatMoney, getCurrencySymbol } from '../utils/currency';

interface StaffPayrollProps {
  staffList: StaffMember[];
  advances: StaffAdvance[];
  attendanceRecords: StaffAttendanceRecord[];
  onUpdateStaffList: (list: StaffMember[]) => void;
  onUpdateAdvances: (advances: StaffAdvance[]) => void;
  onUpdateAttendance: (records: StaffAttendanceRecord[]) => void;
  settings: CompanySettings;
  role: UserRole;
}

export const StaffPayroll: React.FC<StaffPayrollProps> = ({
  staffList,
  advances,
  attendanceRecords,
  onUpdateStaffList,
  onUpdateAdvances,
  onUpdateAttendance,
  settings,
  role
}) => {
  const currentMonthStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr());
  const [activeTab, setActiveTab] = useState<'payroll' | 'staff' | 'advances'>('payroll');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [selectedStaffForAdvance, setSelectedStaffForAdvance] = useState<string>(staffList[0]?.id || '');

  const [selectedPayslipStaff, setSelectedPayslipStaff] = useState<StaffMember | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Staff Form
  const [staffForm, setStaffForm] = useState<Partial<StaffMember>>({
    name: '',
    role: '',
    phone: '',
    email: '',
    basicSalary: 5000,
    standardDays: 30,
    allowances: 0,
    status: 'active'
  });

  // Advance State & Form
  const [editingAdvance, setEditingAdvance] = useState<StaffAdvance | null>(null);
  const [breakdownStaff, setBreakdownStaff] = useState<StaffMember | null>(null);
  const [advanceForm, setAdvanceForm] = useState<{
    staffId: string;
    amount: number;
    reason: string;
    date: string;
    paymentMethod: PaymentMethod | string;
  }>({
    staffId: staffList[0]?.id || '',
    amount: 500,
    reason: 'Monthly advance request',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: PaymentMethod.CASH
  });

  // Calculate days in selected month (e.g. 30, 31, 28)
  const getDaysInMonth = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };

  const monthTotalDays = getDaysInMonth(selectedMonth);

  // Get or initialize attendance record for a staff member for selected month
  const getStaffRecord = (staffId: string): StaffAttendanceRecord => {
    const found = attendanceRecords.find(r => r.staffId === staffId && r.month === selectedMonth);
    if (found) return found;

    // Default: full attendance
    return {
      id: `att-${staffId}-${selectedMonth}`,
      staffId,
      month: selectedMonth,
      totalMonthDays: monthTotalDays,
      daysWorked: monthTotalDays,
      absentDays: 0,
      overtimeBonus: 0,
      advanceDeducted: 0,
      otherDeductions: 0,
      paymentStatus: 'Unpaid'
    };
  };

  // Compute Total Advances taken by staff in selected month
  const getStaffMonthAdvances = (staffId: string) => {
    return advances
      .filter(a => a.staffId === staffId && (a.month === selectedMonth || a.date.startsWith(selectedMonth)))
      .reduce((sum, a) => sum + a.amount, 0);
  };

  // Update attendance / days worked for a staff
  const handleUpdateDaysWorked = (staffId: string, daysWorked: number) => {
    const validWorked = Math.max(0, Math.min(monthTotalDays, daysWorked));
    const absentDays = monthTotalDays - validWorked;
    const existing = getStaffRecord(staffId);

    const updatedRecord: StaffAttendanceRecord = {
      ...existing,
      totalMonthDays: monthTotalDays,
      daysWorked: validWorked,
      absentDays
    };

    const next = attendanceRecords.filter(r => !(r.staffId === staffId && r.month === selectedMonth));
    onUpdateAttendance([...next, updatedRecord]);
  };

  const handleUpdateAbsentDays = (staffId: string, absentDays: number) => {
    const validAbsent = Math.max(0, Math.min(monthTotalDays, absentDays));
    const daysWorked = monthTotalDays - validAbsent;
    const existing = getStaffRecord(staffId);

    const updatedRecord: StaffAttendanceRecord = {
      ...existing,
      totalMonthDays: monthTotalDays,
      daysWorked,
      absentDays: validAbsent
    };

    const next = attendanceRecords.filter(r => !(r.staffId === staffId && r.month === selectedMonth));
    onUpdateAttendance([...next, updatedRecord]);
  };

  const handleUpdateBonusDeductions = (
    staffId: string, 
    field: 'overtimeBonus' | 'otherDeductions' | 'notes', 
    val: any
  ) => {
    const existing = getStaffRecord(staffId);
    const updatedRecord: StaffAttendanceRecord = {
      ...existing,
      [field]: val
    };
    const next = attendanceRecords.filter(r => !(r.staffId === staffId && r.month === selectedMonth));
    onUpdateAttendance([...next, updatedRecord]);
  };

  const handleTogglePaymentStatus = (staffId: string) => {
    const existing = getStaffRecord(staffId);
    const newStatus = existing.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    const updatedRecord: StaffAttendanceRecord = {
      ...existing,
      paymentStatus: newStatus,
      paymentDate: newStatus === 'Paid' ? new Date().toISOString().split('T')[0] : undefined
    };
    const next = attendanceRecords.filter(r => !(r.staffId === staffId && r.month === selectedMonth));
    onUpdateAttendance([...next, updatedRecord]);
  };

  // Staff CRUD
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({
      name: '',
      role: '',
      phone: '',
      email: '',
      basicSalary: 5000,
      standardDays: 30,
      allowances: 0,
      status: 'active'
    });
    setIsStaffModalOpen(true);
  };

  const handleOpenEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    setStaffForm({
      name: staff.name,
      role: staff.role,
      phone: staff.phone,
      email: staff.email || '',
      basicSalary: staff.basicSalary,
      standardDays: staff.standardDays || 30,
      allowances: staff.allowances || 0,
      status: staff.status
    });
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name?.trim() || !staffForm.role?.trim()) return;

    if (editingStaff) {
      const updated = staffList.map(s => s.id === editingStaff.id ? {
        ...s,
        name: staffForm.name!.trim(),
        role: staffForm.role!.trim(),
        phone: staffForm.phone?.trim() || '',
        email: staffForm.email?.trim() || '',
        basicSalary: Number(staffForm.basicSalary) || 0,
        standardDays: Number(staffForm.standardDays) || 30,
        allowances: Number(staffForm.allowances) || 0,
        status: staffForm.status || 'active'
      } : s);
      onUpdateStaffList(updated);
    } else {
      const newStaff: StaffMember = {
        id: `st-${Date.now().toString(36)}`,
        name: staffForm.name!.trim(),
        role: staffForm.role!.trim(),
        phone: staffForm.phone?.trim() || '',
        email: staffForm.email?.trim() || '',
        basicSalary: Number(staffForm.basicSalary) || 0,
        standardDays: Number(staffForm.standardDays) || 30,
        allowances: Number(staffForm.allowances) || 0,
        joinDate: new Date().toISOString().split('T')[0],
        status: staffForm.status || 'active'
      };
      onUpdateStaffList([...staffList, newStaff]);
    }

    setIsStaffModalOpen(false);
    setEditingStaff(null);
  };

  const handleDeleteStaff = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove staff member "${name}"?`)) {
      onUpdateStaffList(staffList.filter(s => s.id !== id));
      onUpdateAdvances(advances.filter(a => a.staffId !== id));
      onUpdateAttendance(attendanceRecords.filter(r => r.staffId !== id));
    }
  };

  const handleOpenAddAdvance = (staffId?: string) => {
    setEditingAdvance(null);
    setAdvanceForm({
      staffId: staffId || staffList[0]?.id || '',
      amount: 500,
      reason: 'Monthly advance request',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: PaymentMethod.CASH
    });
    setIsAdvanceModalOpen(true);
  };

  const handleOpenEditAdvance = (adv: StaffAdvance) => {
    setEditingAdvance(adv);
    setAdvanceForm({
      staffId: adv.staffId,
      amount: adv.amount,
      reason: adv.reason,
      date: adv.date,
      paymentMethod: adv.paymentMethod || PaymentMethod.CASH
    });
    setIsAdvanceModalOpen(true);
  };

  // Advance submission (Create / Edit)
  const handleSaveAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceForm.staffId || advanceForm.amount <= 0) return;

    if (editingAdvance) {
      const updated = advances.map(a => a.id === editingAdvance.id ? {
        ...a,
        staffId: advanceForm.staffId,
        date: advanceForm.date,
        amount: Number(advanceForm.amount),
        reason: advanceForm.reason.trim() || 'Salary advance',
        paymentMethod: advanceForm.paymentMethod
      } : a);
      onUpdateAdvances(updated);
    } else {
      const newAdvance: StaffAdvance = {
        id: `adv-${Date.now().toString(36)}`,
        staffId: advanceForm.staffId,
        date: advanceForm.date,
        amount: Number(advanceForm.amount),
        reason: advanceForm.reason.trim() || 'Salary advance',
        paymentMethod: advanceForm.paymentMethod,
        month: selectedMonth
      };
      onUpdateAdvances([newAdvance, ...advances]);
    }

    setIsAdvanceModalOpen(false);
    setEditingAdvance(null);
  };

  const handleDeleteAdvance = (advId: string) => {
    if (confirm('Are you sure you want to delete this advance payment record? The deducted amount will be refunded to net salary.')) {
      const remaining = advances.filter(a => a.id !== advId);
      onUpdateAdvances(remaining);
      if (breakdownStaff) {
        const staffAdvancesLeft = remaining.filter(a => a.staffId === breakdownStaff.id && (a.month === selectedMonth || a.date.startsWith(selectedMonth)));
        if (staffAdvancesLeft.length === 0) {
          setBreakdownStaff(null);
        }
      }
    }
  };

  // Calculate full payroll line for a staff
  const calculateStaffPayroll = (staff: StaffMember) => {
    const record = getStaffRecord(staff.id);
    const totalDays = record.totalMonthDays || monthTotalDays;
    const daysWorked = record.daysWorked !== undefined ? record.daysWorked : totalDays;
    const absentDays = record.absentDays !== undefined ? record.absentDays : (totalDays - daysWorked);
    
    // Formula: Basic Salary divided by number of days in month multiplied by days worked
    const dailyRate = staff.basicSalary / (totalDays || 30);
    const earnedBasicSalary = dailyRate * daysWorked;

    const staffAdvancesTotal = getStaffMonthAdvances(staff.id);
    const allowances = staff.allowances || 0;
    const overtime = record.overtimeBonus || 0;
    const otherDeductions = record.otherDeductions || 0;

    const finalNetPayable = Math.max(0, earnedBasicSalary + allowances + overtime - staffAdvancesTotal - otherDeductions);

    return {
      staff,
      record,
      totalDays,
      daysWorked,
      absentDays,
      dailyRate,
      earnedBasicSalary,
      staffAdvancesTotal,
      allowances,
      overtime,
      otherDeductions,
      finalNetPayable,
      paymentStatus: record.paymentStatus || 'Unpaid',
      paymentDate: record.paymentDate
    };
  };

  // Summaries across all staff
  const payrollRows = useMemo(() => {
    return staffList
      .filter(s => s.status === 'active')
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.role.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(calculateStaffPayroll);
  }, [staffList, attendanceRecords, advances, selectedMonth, searchTerm, monthTotalDays]);

  const totalBasicSalaries = payrollRows.reduce((acc, row) => acc + row.staff.basicSalary, 0);
  const totalEarnedSalaries = payrollRows.reduce((acc, row) => acc + row.earnedBasicSalary, 0);
  const totalAdvancesSum = payrollRows.reduce((acc, row) => acc + row.staffAdvancesTotal, 0);
  const totalNetPayout = payrollRows.reduce((acc, row) => acc + row.finalNetPayable, 0);
  const totalDaysWorkedSum = payrollRows.reduce((acc, row) => acc + row.daysWorked, 0);

  const currencyCode = settings?.defaultCurrency || 'AED';
  const formatCurr = (num: number) => {
    return formatMoney(num, currencyCode, 0);
  };
  const currSym = getCurrencySymbol(currencyCode);

  const handlePrintPayslip = () => {
    printElementDirectly('payslip-print-view', `Payslip-${selectedPayslipStaff?.name}-${selectedMonth}`);
  };

  const handleDownloadPayslipPdf = async () => {
    if (!selectedPayslipStaff) return;
    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf(
        'payslip-print-view',
        `Payslip-${selectedPayslipStaff.name.replace(/\s+/g, '_')}-${selectedMonth}.pdf`
      );
    } catch (e) {
      console.error('Payslip PDF export failed:', e);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Staff & Payroll Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Record employee salaries, attendance days, advance deductions, and final net payouts ({currencyCode}).</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl shadow-sm">
            <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Payroll Month:</span>
            <input 
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-900 dark:text-white outline-none cursor-pointer"
            />
          </div>

          {/* Record Advance Button */}
          <button 
            onClick={() => {
              if (staffList.length > 0) {
                setAdvanceForm(p => ({ ...p, staffId: staffList[0].id }));
                setIsAdvanceModalOpen(true);
              } else {
                alert('Please register at least one staff member first.');
              }
            }}
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95"
          >
            <CreditCard size={16} />
            <span>Add Advance</span>
          </button>

          {/* Add Staff Button */}
          <button 
            onClick={handleOpenAddStaff}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
          >
            <UserPlus size={16} />
            <span>New Staff Member</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Active Staffs</span>
            <Users size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{staffList.filter(s => s.status === 'active').length} Members</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Standard Month Days: <strong>{monthTotalDays} Days</strong></p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Basic Payroll Budget</span>
            <Coins size={18} className="text-slate-600 dark:text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurr(totalBasicSalaries)}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Base Contract Salaries</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Advances Deducted</span>
            <CreditCard size={18} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatCurr(totalAdvancesSum)}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{advances.filter(a => a.month === selectedMonth || a.date.startsWith(selectedMonth)).length} Advances recorded this month</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-5 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none space-y-2">
          <div className="flex items-center justify-between text-indigo-200">
            <span className="text-[10px] font-black uppercase tracking-wider">Final Net Payout</span>
            <Calculator size={18} className="text-indigo-200" />
          </div>
          <p className="text-2xl font-black">{formatCurr(totalNetPayout)}</p>
          <p className="text-[11px] text-indigo-100 font-medium">Calculated by actual days worked</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'payroll' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Monthly Payroll Calculation
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'staff' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Staff Directory ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('advances')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            activeTab === 'advances' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Salary Advances Log ({advances.length})
        </button>
      </div>

      {/* TAB 1: MONTHLY PAYROLL CALCULATION TABLE */}
      {activeTab === 'payroll' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Payroll Calculation Sheet for {selectedMonth}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Formula: (Basic Salary ÷ {monthTotalDays} Days) × Days Worked + Fixed Allowances + Bonus - Advances = Final Payable Salary.
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter staff by name or role..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Staff Member</th>
                  <th className="pb-3 px-3 text-right">Basic ({currencyCode})</th>
                  <th className="pb-3 px-3 text-center">Days Worked</th>
                  <th className="pb-3 px-3 text-center">Absent Days</th>
                  <th className="pb-3 px-3 text-right">Daily Rate</th>
                  <th className="pb-3 px-3 text-right">Earned Base</th>
                  <th className="pb-3 px-3 text-right text-emerald-600 dark:text-emerald-400">Fixed Allowances</th>
                  <th className="pb-3 px-3 text-right text-amber-500">Advance</th>
                  <th className="pb-3 px-3 text-right font-black text-indigo-600 dark:text-indigo-400">Net Salary</th>
                  <th className="pb-3 px-3 text-center">Status</th>
                  <th className="pb-3 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {payrollRows.map(row => (
                  <tr key={row.staff.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                    {/* Staff Name & Role */}
                    <td className="py-4 pr-4">
                      <div className="font-black text-slate-900 dark:text-white">{row.staff.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{row.staff.role}</div>
                    </td>

                    {/* Basic Monthly Salary */}
                    <td className="py-4 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                      {formatCurr(row.staff.basicSalary)}
                    </td>

                    {/* Days Worked Editable Input */}
                    <td className="py-4 px-3 text-center">
                      <input 
                        type="number"
                        min="0"
                        max={monthTotalDays}
                        value={row.daysWorked}
                        onChange={e => handleUpdateDaysWorked(row.staff.id, parseInt(e.target.value) || 0)}
                        className="w-16 text-center font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg py-1.5 px-2 border border-indigo-200 dark:border-indigo-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Absent Days Editable Input */}
                    <td className="py-4 px-3 text-center">
                      <input 
                        type="number"
                        min="0"
                        max={monthTotalDays}
                        value={row.absentDays}
                        onChange={e => handleUpdateAbsentDays(row.staff.id, parseInt(e.target.value) || 0)}
                        className="w-16 text-center font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg py-1.5 px-2 border border-rose-200 dark:border-rose-800 outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </td>

                    {/* Calculated Daily Rate */}
                    <td className="py-4 px-3 text-right font-medium text-slate-500 dark:text-slate-400">
                      {formatCurr(row.dailyRate)}/day
                    </td>

                    {/* Earned Basic Salary based on Days Worked */}
                    <td className="py-4 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                      {formatCurr(row.earnedBasicSalary)}
                    </td>

                    {/* Fixed Allowances */}
                    <td className="py-4 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {row.allowances > 0 ? `+ ${formatCurr(row.allowances)}` : `${currSym} 0`}
                    </td>

                    {/* Advances Deducted */}
                    <td className="py-4 px-3 text-right">
                      {row.staffAdvancesTotal > 0 ? (
                        <button
                          type="button"
                          onClick={() => setBreakdownStaff(row.staff)}
                          className="inline-flex items-center space-x-1.5 font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 transition-all text-xs cursor-pointer shadow-xs"
                          title="Click to view, edit, or delete advance payments for this employee"
                        >
                          <span>- {formatCurr(row.staffAdvancesTotal)}</span>
                          <Edit3 size={11} className="opacity-70" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenAddAdvance(row.staff.id)}
                          className="text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 text-xs font-medium hover:underline cursor-pointer"
                          title="Give salary advance"
                        >
                          + Advance
                        </button>
                      )}
                    </td>

                    {/* Final Net Payable Salary */}
                    <td className="py-4 px-3 text-right font-black text-sm text-indigo-600 dark:text-indigo-400">
                      {formatCurr(row.finalNetPayable)}
                    </td>

                    {/* Payment Status Toggle */}
                    <td className="py-4 px-3 text-center">
                      <button
                        onClick={() => handleTogglePaymentStatus(row.staff.id)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 mx-auto ${
                          row.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-700'
                        }`}
                      >
                        {row.paymentStatus === 'Paid' ? (
                          <>
                            <CheckCircle2 size={12} />
                            <span>Paid</span>
                          </>
                        ) : (
                          <span>Mark Paid</span>
                        )}
                      </button>
                    </td>

                    {/* Actions: View / Print Payslip */}
                    <td className="py-4 pl-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedPayslipStaff(row.staff);
                          setIsPayslipModalOpen(true);
                        }}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-xl transition-all"
                        title="View / Print Staff Payslip"
                      >
                        <FileText size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {payrollRows.length === 0 && (
            <div className="text-center py-12">
              <Users size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No staff members registered.</p>
              <button 
                onClick={handleOpenAddStaff}
                className="mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 underline cursor-pointer"
              >
                Add your first employee to calculate payroll
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STAFF DIRECTORY */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffList.map(staff => (
            <div 
              key={staff.id} 
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-base flex items-center justify-center">
                    {staff.name.charAt(0)}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => handleOpenEditStaff(staff)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer"
                      title="Edit Staff Info"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteStaff(staff.id, staff.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                      title="Delete Staff"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">{staff.name}</h3>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-4">{staff.role}</p>

                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400">Monthly Basic:</span>
                    <span className="font-black text-slate-900 dark:text-white">{formatCurr(staff.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400">Fixed Allowances:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurr(staff.allowances || 0)}</span>
                  </div>
                  {staff.phone && (
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-medium">{staff.phone}</span>
                    </div>
                  )}
                  {staff.email && (
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/60">
                      <span className="text-slate-400">Email:</span>
                      <span className="font-medium truncate max-w-[160px]">{staff.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <button
                  onClick={() => handleOpenAddAdvance(staff.id)}
                  className="text-xs font-black text-amber-600 dark:text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <CreditCard size={14} />
                  <span>Give Advance</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPayslipStaff(staff);
                    setIsPayslipModalOpen(true);
                  }}
                  className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <FileText size={14} />
                  <span>View / Print Payslip</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: SALARY ADVANCES LOG */}
      {activeTab === 'advances' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Staff Advance Payment Ledger</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Advances issued to staff are automatically deducted from the monthly payroll. You can edit or delete them anytime.</p>
            </div>

            <button
              onClick={() => handleOpenAddAdvance()}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2 cursor-pointer shadow-md transition-all self-start sm:self-auto"
            >
              <Plus size={16} />
              <span>Record New Advance</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 px-3">Staff Member</th>
                  <th className="pb-3 px-3">Reason / Purpose</th>
                  <th className="pb-3 px-3">Method</th>
                  <th className="pb-3 px-3 text-right">Advance Amount</th>
                  <th className="pb-3 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                {advances.map(adv => {
                  const staff = staffList.find(s => s.id === adv.staffId);
                  return (
                    <tr key={adv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-3 pr-4 font-bold text-slate-700 dark:text-slate-300">{adv.date}</td>
                      <td className="py-3 px-3 font-black text-slate-900 dark:text-white">{staff?.name || 'Unknown Staff'}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{adv.reason}</td>
                      <td className="py-3 px-3 text-slate-500 font-medium">{adv.paymentMethod || 'Cash'}</td>
                      <td className="py-3 px-3 text-right font-black text-amber-600 dark:text-amber-400">
                        {formatCurr(adv.amount)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEditAdvance(adv)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Advance"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteAdvance(adv.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete Advance"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {advances.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">No staff advances recorded yet.</div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD / EDIT STAFF MEMBER */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {editingStaff ? 'Edit Staff Profile' : 'Register New Staff Member'}
              </h2>
              <button onClick={() => setIsStaffModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Employee Full Name *</label>
                <input
                  required
                  placeholder="e.g. Rashid Khan"
                  value={staffForm.name}
                  onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Job Title / Designation *</label>
                <input
                  required
                  placeholder="e.g. Senior Video Editor & Colorist"
                  value={staffForm.role}
                  onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Monthly Basic Salary ({currencyCode}) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="6500"
                    value={staffForm.basicSalary}
                    onChange={e => setStaffForm({ ...staffForm, basicSalary: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Fixed Allowances ({currencyCode})</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="500"
                    value={staffForm.allowances}
                    onChange={e => setStaffForm({ ...staffForm, allowances: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Phone / WhatsApp</label>
                  <input
                    placeholder="+971 50 123 4567"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Email Address</label>
                  <input
                    type="email"
                    placeholder="staff@company.ae"
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none cursor-pointer"
                >
                  <Save size={16} />
                  <span>{editingStaff ? 'Save Changes' : 'Register Staff'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD / EDIT SALARY ADVANCE */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center space-x-2">
                <CreditCard size={20} className="text-amber-600" />
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  {editingAdvance ? 'Edit Salary Advance' : 'Record Salary Advance'}
                </h2>
              </div>
              <button onClick={() => { setIsAdvanceModalOpen(false); setEditingAdvance(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Select Staff Member *</label>
                <select
                  value={advanceForm.staffId}
                  onChange={e => setAdvanceForm({ ...advanceForm, staffId: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role}) - Base: {formatCurr(s.basicSalary)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Advance Amount ({currencyCode}) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="500"
                    value={advanceForm.amount}
                    onChange={e => setAdvanceForm({ ...advanceForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Issue Date</label>
                  <input
                    type="date"
                    value={advanceForm.date}
                    onChange={e => setAdvanceForm({ ...advanceForm, date: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Payment Method</label>
                <select
                  value={advanceForm.paymentMethod}
                  onChange={e => setAdvanceForm({ ...advanceForm, paymentMethod: e.target.value as PaymentMethod })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value={PaymentMethod.CASH}>Cash Payment</option>
                  <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                  <option value={PaymentMethod.CHEQUE}>Cheque</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">Reason / Note</label>
                <input
                  placeholder="e.g. Emergency expense, travel allowance"
                  value={advanceForm.reason}
                  onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                >
                  <Save size={16} />
                  <span>{editingAdvance ? 'Update Advance' : 'Save Advance'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAdvanceModalOpen(false); setEditingAdvance(null); }}
                  className="px-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: STAFF ADVANCES BREAKDOWN & EDIT/DELETE */}
      {breakdownStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center space-x-2">
                <CreditCard size={20} className="text-amber-600" />
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">{breakdownStaff.name} - Advances</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Month: {selectedMonth}</p>
                </div>
              </div>
              <button onClick={() => setBreakdownStaff(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                {advances
                  .filter(a => a.staffId === breakdownStaff.id && (a.month === selectedMonth || a.date.startsWith(selectedMonth)))
                  .map(adv => (
                    <div key={adv.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div>
                        <div className="font-black text-amber-600 dark:text-amber-400 text-sm">
                          {formatCurr(adv.amount)}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">{adv.reason || 'Salary advance'}</div>
                        <div className="text-[10px] text-slate-400">{adv.date} • {adv.paymentMethod || 'Cash'}</div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setBreakdownStaff(null);
                            handleOpenEditAdvance(adv);
                          }}
                          className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-xl cursor-pointer"
                          title="Edit this advance"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteAdvance(adv.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                          title="Delete this advance"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => {
                    const sid = breakdownStaff.id;
                    setBreakdownStaff(null);
                    handleOpenAddAdvance(sid);
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Give Another Advance</span>
                </button>
                <button
                  onClick={() => setBreakdownStaff(null)}
                  className="px-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-bold text-xs uppercase cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: OFFICIAL PAYSLIP VIEW & PRINT */}
      {isPayslipModalOpen && selectedPayslipStaff && (() => {
        const p = calculateStaffPayroll(selectedPayslipStaff);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              {/* Header Action Bar */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 no-print">
                <div className="flex items-center space-x-2">
                  <FileText size={18} className="text-indigo-600" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Employee Salary Payslip</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={handlePrintPayslip}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <Printer size={14} />
                    <span>Print Payslip</span>
                  </button>
                  <button 
                    onClick={handleDownloadPayslipPdf}
                    disabled={isDownloadingPdf}
                    className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Download size={14} />
                    <span>{isDownloadingPdf ? 'Exporting...' : 'Download PDF'}</span>
                  </button>
                  <button onClick={() => setIsPayslipModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Printable Payslip Content */}
              <div id="payslip-print-view" className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{settings.name || 'Af© ACCOUNTS'}</h2>
                    <p className="text-xs text-slate-500 font-medium">{settings.address}</p>
                    {settings.vatNumber && <p className="text-xs font-bold text-indigo-700">TRN: {settings.vatNumber}</p>}
                  </div>
                  <div className="text-right">
                    <div className="bg-black text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider inline-block">
                      Payslip
                    </div>
                    <p className="text-xs font-bold text-slate-600 mt-1">Period: {selectedMonth}</p>
                  </div>
                </div>

                {/* Staff Information */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Employee Name</span>
                    <span className="text-sm font-black text-slate-900">{selectedPayslipStaff.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Designation / Role</span>
                    <span className="text-sm font-bold text-indigo-700">{selectedPayslipStaff.role}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Attendance Summary</span>
                    <span className="font-bold text-slate-700">{p.daysWorked} Days Worked / {p.absentDays} Days Absent (of {p.totalDays} days)</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Payment Status</span>
                    <span className={`font-black uppercase ${p.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {p.paymentStatus} {p.paymentDate ? `(${p.paymentDate})` : ''}
                    </span>
                  </div>
                </div>

                {/* Earnings & Deductions Breakdown */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Salary Breakdown</h3>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-2 text-left">Description</th>
                        <th className="py-2 text-right">Calculation</th>
                        <th className="py-2 text-right">Amount ({currencyCode})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2.5 font-bold">Basic Monthly Contract Salary</td>
                        <td className="py-2.5 text-right text-slate-500">Base</td>
                        <td className="py-2.5 text-right font-bold">{formatCurr(selectedPayslipStaff.basicSalary)}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-indigo-700">Earned Basic Salary (Days Worked)</td>
                        <td className="py-2.5 text-right text-slate-500">({selectedPayslipStaff.basicSalary} ÷ {p.totalDays}) × {p.daysWorked} days</td>
                        <td className="py-2.5 text-right font-black text-indigo-700">{formatCurr(p.earnedBasicSalary)}</td>
                      </tr>
                      {p.allowances > 0 && (
                        <tr>
                          <td className="py-2.5 font-bold">Fixed Allowances</td>
                          <td className="py-2.5 text-right text-slate-500">Housing / Transport / Phone</td>
                          <td className="py-2.5 text-right font-bold text-emerald-600">+{formatCurr(p.allowances)}</td>
                        </tr>
                      )}
                      {p.overtime > 0 && (
                        <tr>
                          <td className="py-2.5 font-bold text-emerald-600">Overtime / Shoot Bonus</td>
                          <td className="py-2.5 text-right text-slate-500">Bonus</td>
                          <td className="py-2.5 text-right font-bold text-emerald-600">+{formatCurr(p.overtime)}</td>
                        </tr>
                      )}
                      {p.staffAdvancesTotal > 0 && (
                        <tr className="bg-amber-50/50">
                          <td className="py-2.5 font-bold text-amber-700">Advance Salary Deductions</td>
                          <td className="py-2.5 text-right text-amber-600">Advance taken</td>
                          <td className="py-2.5 text-right font-black text-amber-700">-{formatCurr(p.staffAdvancesTotal)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Final Net Total */}
                <div className="flex justify-between items-center p-4 bg-slate-900 text-white rounded-2xl">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Final Net Salary Payable</span>
                    <span className="text-xs text-slate-300 font-medium">To be disbursed via WPS / Bank / Cash</span>
                  </div>
                  <span className="text-2xl font-black text-indigo-400">
                    {formatCurr(p.finalNetPayable)}
                  </span>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-center text-xs">
                  <div className="space-y-6">
                    <div className="h-10"></div>
                    <div className="border-t border-slate-300 pt-1 font-bold text-slate-600">Employee Signature</div>
                  </div>
                  <div className="space-y-6">
                    <div className="h-10"></div>
                    <div className="border-t border-slate-300 pt-1 font-bold text-slate-600">Authorized Management Stamp</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default StaffPayroll;

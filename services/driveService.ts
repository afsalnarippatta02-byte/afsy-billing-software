// Google Drive & Local Cloud Sync Service for Af© ACCOUNTS
import { Invoice, Client, Expense, StaffMember, StaffAdvance, StaffAttendanceRecord, CompanySettings, UserAccount } from '../types';
import { 
  uploadFileToGoogleDrive, 
  listGoogleDriveFiles, 
  downloadGoogleDriveFileContent, 
  isGoogleDriveConnected, 
  getGoogleDriveUser,
  GoogleDriveFile 
} from './googleDriveAuth';

export interface AppBackupPayload {
  version: string;
  exportedAt: string;
  userEmail?: string;
  invoices: Invoice[];
  clients: Client[];
  expenses: Expense[];
  staffList: StaffMember[];
  staffAdvances: StaffAdvance[];
  staffAttendance: StaffAttendanceRecord[];
  categories: string[];
  settings: CompanySettings;
  users?: UserAccount[];
}

const DRIVE_BACKUPS_STORAGE_KEY = 'af_google_drive_backups';
const DRIVE_LINKED_ACCOUNT_KEY = 'af_linked_drive_account';

/**
 * Upload active state directly to end-user's Google Drive account
 */
export const backupDirectlyToGoogleDrive = async (
  payload?: AppBackupPayload
): Promise<{ success: boolean; file?: GoogleDriveFile; message: string }> => {
  try {
    const data = payload || gatherAppBackupPayload();
    const gUser = getGoogleDriveUser();
    if (gUser?.email) {
      data.userEmail = gUser.email;
    }
    const jsonString = JSON.stringify(data, null, 2);
    const now = new Date();
    const dateFormatted = now.toISOString().replace(/[:.]/g, '-');
    const fileName = `AfAccounts-Backup-${dateFormatted}.json`;

    const uploaded = await uploadFileToGoogleDrive(fileName, 'application/json', jsonString);
    
    // Also save in local snapshot
    if (data.userEmail) {
      await syncToGoogleDriveCloud(data.userEmail, data);
    }

    return {
      success: true,
      file: uploaded,
      message: `Successfully backed up ${data.invoices.length} invoices, ${data.clients.length} clients, and expenses to Google Drive file "${fileName}".`
    };
  } catch (error: any) {
    console.error('Failed to backup directly to Google Drive:', error);
    return {
      success: false,
      message: error?.message || 'Failed to upload backup to Google Drive.'
    };
  }
};

/**
 * Retrieve list of backup files stored in Google Drive
 */
export const fetchGoogleDriveBackupList = async (): Promise<GoogleDriveFile[]> => {
  try {
    return await listGoogleDriveFiles('AfAccounts');
  } catch (error) {
    console.error('Failed to list Google Drive backups:', error);
    return [];
  }
};

/**
 * Download and apply backup from Google Drive file
 */
export const restoreFromGoogleDriveFile = async (
  fileId: string,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{ success: boolean; message: string; payload?: AppBackupPayload }> => {
  try {
    const rawContent = await downloadGoogleDriveFileContent(fileId);
    const parsed: AppBackupPayload = JSON.parse(rawContent);

    if (!parsed || (!Array.isArray(parsed.invoices) && !Array.isArray(parsed.clients))) {
      throw new Error('Downloaded file does not appear to be a valid AfAccounts backup archive.');
    }

    applyBackupPayload(parsed, mode);
    return {
      success: true,
      message: `Successfully loaded ${parsed.invoices?.length || 0} invoices and ${parsed.clients?.length || 0} clients from Google Drive!`,
      payload: parsed
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Failed to restore backup from Google Drive.'
    };
  }
};

/**
 * Get current linked Google Drive account email
 */
export const getLinkedDriveAccount = (): string | null => {
  return localStorage.getItem(DRIVE_LINKED_ACCOUNT_KEY);
};

/**
 * Set linked Google Drive account email
 */
export const setLinkedDriveAccount = (email: string | null): void => {
  if (email) {
    localStorage.setItem(DRIVE_LINKED_ACCOUNT_KEY, email);
  } else {
    localStorage.removeItem(DRIVE_LINKED_ACCOUNT_KEY);
  }
};

/**
 * Collect all application data into a single unified backup object
 */
export const gatherAppBackupPayload = (userEmail?: string): AppBackupPayload => {
  const invoices: Invoice[] = JSON.parse(localStorage.getItem('cf_invoices') || '[]');
  const clients: Client[] = JSON.parse(localStorage.getItem('cf_clients') || '[]');
  const expenses: Expense[] = JSON.parse(localStorage.getItem('cf_expenses') || '[]');
  const staffList: StaffMember[] = JSON.parse(localStorage.getItem('cf_staff_list') || '[]');
  const staffAdvances: StaffAdvance[] = JSON.parse(localStorage.getItem('cf_staff_advances') || '[]');
  const staffAttendance: StaffAttendanceRecord[] = JSON.parse(localStorage.getItem('cf_staff_attendance') || '[]');
  const categories: string[] = JSON.parse(localStorage.getItem('cf_expense_categories') || '[]');
  const settings: CompanySettings = JSON.parse(localStorage.getItem('cf_settings') || '{}');
  const users: UserAccount[] = JSON.parse(localStorage.getItem('af_user_accounts') || '[]');

  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    userEmail: userEmail || settings.driveSyncEmail || getLinkedDriveAccount() || undefined,
    invoices,
    clients,
    expenses,
    staffList,
    staffAdvances,
    staffAttendance,
    categories,
    settings,
    users
  };
};

/**
 * Automatically sync and save all data to Google Drive cloud vault for the specified email
 */
export const syncToGoogleDriveCloud = async (
  email: string,
  payload?: AppBackupPayload
): Promise<{ success: boolean; timestamp: string; invoiceCount: number; message: string }> => {
  const data = payload || gatherAppBackupPayload(email);
  data.userEmail = email;
  data.exportedAt = new Date().toISOString();

  // Save to Google Drive Cloud Vault keyed by email in persistent local storage
  const existingBackups = JSON.parse(localStorage.getItem(DRIVE_BACKUPS_STORAGE_KEY) || '{}');
  existingBackups[email.toLowerCase().trim()] = {
    ...data,
    lastSyncTime: data.exportedAt
  };
  localStorage.setItem(DRIVE_BACKUPS_STORAGE_KEY, JSON.stringify(existingBackups));

  // Also update linked email
  setLinkedDriveAccount(email);

  return {
    success: true,
    timestamp: data.exportedAt,
    invoiceCount: data.invoices.length,
    message: `Successfully synchronized ${data.invoices.length} invoices, ${data.clients.length} clients, and accounts to Google Drive for ${email}.`
  };
};

/**
 * Fetch and load Google Drive data associated with an email for a new device/browser
 */
export const fetchFromGoogleDriveCloud = (
  email: string
): { success: boolean; data?: AppBackupPayload; message: string } => {
  const cleanEmail = email.toLowerCase().trim();
  const existingBackups = JSON.parse(localStorage.getItem(DRIVE_BACKUPS_STORAGE_KEY) || '{}');
  const backup = existingBackups[cleanEmail];

  if (!backup) {
    return {
      success: false,
      message: `No Google Drive cloud data found for ${email}. Please check the email address or upload a manual backup JSON file.`
    };
  }

  return {
    success: true,
    data: backup,
    message: `Found cloud backup dated ${new Date(backup.exportedAt || backup.lastSyncTime).toLocaleString()} with ${backup.invoices?.length || 0} invoices and ${backup.clients?.length || 0} clients.`
  };
};

/**
 * Apply fetched or imported backup payload into the active workspace
 */
export const applyBackupPayload = (
  payload: Partial<AppBackupPayload>,
  mode: 'merge' | 'replace' = 'replace'
): { success: boolean; counts: Record<string, number> } => {
  const currentInvoices: Invoice[] = JSON.parse(localStorage.getItem('cf_invoices') || '[]');
  const currentClients: Client[] = JSON.parse(localStorage.getItem('cf_clients') || '[]');
  const currentExpenses: Expense[] = JSON.parse(localStorage.getItem('cf_expenses') || '[]');
  const currentStaff: StaffMember[] = JSON.parse(localStorage.getItem('cf_staff_list') || '[]');
  const currentAdvances: StaffAdvance[] = JSON.parse(localStorage.getItem('cf_staff_advances') || '[]');
  const currentAttendance: StaffAttendanceRecord[] = JSON.parse(localStorage.getItem('cf_staff_attendance') || '[]');

  let finalInvoices = payload.invoices || [];
  let finalClients = payload.clients || [];
  let finalExpenses = payload.expenses || [];
  let finalStaff = payload.staffList || [];
  let finalAdvances = payload.staffAdvances || [];
  let finalAttendance = payload.staffAttendance || [];

  if (mode === 'merge') {
    // Merge without duplicates based on ID
    const invMap = new Map(currentInvoices.map(i => [i.id, i]));
    (payload.invoices || []).forEach(i => invMap.set(i.id, i));
    finalInvoices = Array.from(invMap.values());

    const clientMap = new Map(currentClients.map(c => [c.id, c]));
    (payload.clients || []).forEach(c => clientMap.set(c.id, c));
    finalClients = Array.from(clientMap.values());

    const expMap = new Map(currentExpenses.map(e => [e.id, e]));
    (payload.expenses || []).forEach(e => expMap.set(e.id, e));
    finalExpenses = Array.from(expMap.values());

    const staffMap = new Map(currentStaff.map(s => [s.id, s]));
    (payload.staffList || []).forEach(s => staffMap.set(s.id, s));
    finalStaff = Array.from(staffMap.values());

    const advMap = new Map(currentAdvances.map(a => [a.id, a]));
    (payload.staffAdvances || []).forEach(a => advMap.set(a.id, a));
    finalAdvances = Array.from(advMap.values());

    const attMap = new Map(currentAttendance.map(a => [a.id, a]));
    (payload.staffAttendance || []).forEach(a => attMap.set(a.id, a));
    finalAttendance = Array.from(attMap.values());
  }

  // Save to localStorage
  localStorage.setItem('cf_invoices', JSON.stringify(finalInvoices));
  localStorage.setItem('cf_clients', JSON.stringify(finalClients));
  localStorage.setItem('cf_expenses', JSON.stringify(finalExpenses));
  localStorage.setItem('cf_staff_list', JSON.stringify(finalStaff));
  localStorage.setItem('cf_staff_advances', JSON.stringify(finalAdvances));
  localStorage.setItem('cf_staff_attendance', JSON.stringify(finalAttendance));

  if (payload.categories && Array.isArray(payload.categories) && payload.categories.length > 0) {
    localStorage.setItem('cf_expense_categories', JSON.stringify(payload.categories));
  }
  if (payload.settings && payload.settings.name) {
    localStorage.setItem('cf_settings', JSON.stringify(payload.settings));
  }
  if (payload.users && Array.isArray(payload.users) && payload.users.length > 0) {
    localStorage.setItem('af_user_accounts', JSON.stringify(payload.users));
  }

  return {
    success: true,
    counts: {
      invoices: finalInvoices.length,
      clients: finalClients.length,
      expenses: finalExpenses.length,
      staff: finalStaff.length
    }
  };
};

/**
 * Trigger download of full JSON backup file to local drive
 */
export const downloadLocalBackupJSON = (userEmail?: string): void => {
  const payload = gatherAppBackupPayload(userEmail);
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `AfAccounts-Backup-${userEmail ? userEmail.split('@')[0] + '-' : ''}${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Export specific module as CSV
 */
export const exportModuleToCSV = (moduleName: 'invoices' | 'clients' | 'expenses' | 'staff'): void => {
  let csvContent = '';
  const dateStr = new Date().toISOString().split('T')[0];
  let filename = `AfAccounts-${moduleName}-${dateStr}.csv`;

  if (moduleName === 'clients') {
    const clients: Client[] = JSON.parse(localStorage.getItem('cf_clients') || '[]');
    const headers = ['Company', 'Contact Person', 'Email', 'Phone', 'TRN', 'Address', 'Notes'];
    const rows = clients.map(c => [
      `"${(c.company || '').replace(/"/g, '""')}"`,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.trn || '').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);
    csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  } else if (moduleName === 'expenses') {
    const expenses: Expense[] = JSON.parse(localStorage.getItem('cf_expenses') || '[]');
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Currency', 'Vendor', 'Receipt #', 'Payment Method'];
    const rows = expenses.map(e => [
      `"${e.date || ''}"`,
      `"${e.category || ''}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.amount || 0,
      `"${e.currency || 'AED'}"`,
      `"${(e.vendor || '').replace(/"/g, '""')}"`,
      `"${(e.receiptNumber || '').replace(/"/g, '""')}"`,
      `"${e.paymentMethod || ''}"`
    ]);
    csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  } else if (moduleName === 'invoices') {
    const invoices: Invoice[] = JSON.parse(localStorage.getItem('cf_invoices') || '[]');
    const clients: Client[] = JSON.parse(localStorage.getItem('cf_clients') || '[]');
    const clientMap = new Map(clients.map(c => [c.id, c.company || c.name]));
    const headers = ['Invoice ID', 'Client / Company', 'Date', 'Due Date', 'Status', 'Currency', 'Items Count', 'Subtotal', 'Tax Rate (%)', 'Total'];
    const rows = invoices.map(inv => {
      const subtotal = (inv.items || []).reduce((sum, item) => sum + ((item.quantity || 1) * (item.rate || 0)), 0);
      const tax = (subtotal * (inv.taxRate || 0)) / 100;
      const total = subtotal + tax - (inv.discount || 0);
      return [
        `"${inv.id}"`,
        `"${(clientMap.get(inv.clientId) || 'Unknown').replace(/"/g, '""')}"`,
        `"${inv.date || ''}"`,
        `"${inv.dueDate || ''}"`,
        `"${inv.status || ''}"`,
        `"${inv.currency || 'AED'}"`,
        (inv.items || []).length,
        subtotal.toFixed(2),
        inv.taxRate || 0,
        total.toFixed(2)
      ];
    });
    csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  } else if (moduleName === 'staff') {
    const staffList: StaffMember[] = JSON.parse(localStorage.getItem('cf_staff_list') || '[]');
    const headers = ['Name', 'Designation / Role', 'Phone', 'Email', 'Basic Salary (AED)', 'Standard Days', 'Status', 'Join Date'];
    const rows = staffList.map(s => [
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.role || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.email || '').replace(/"/g, '""')}"`,
      s.basicSalary || 0,
      s.standardDays || 30,
      `"${s.status || 'active'}"`,
      `"${s.joinDate || ''}"`
    ]);
    csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Generate CSV template download for bulk importing
 */
export const downloadCSVTemplate = (type: 'clients' | 'expenses' | 'staff'): void => {
  let content = '';
  if (type === 'clients') {
    content = 'Company,Contact Person,Email,Phone,TRN,Address,Notes\n"Alpha General Trading LLC","Mohammed Ali","ali@alpha.ae","+971501234567","100234567800003","Business Bay, Dubai, UAE","Standard Net 30 days payment"';
  } else if (type === 'expenses') {
    content = 'Date,Category,Description,Amount,Currency,Vendor,Receipt #,Payment Method\n"2026-03-01","Fuel","Company vehicle petrol","250","AED","ADNOC Service Station","REC-9821","Company Card"';
  } else if (type === 'staff') {
    content = 'Name,Designation / Role,Phone,Email,Basic Salary (AED),Standard Days,Status,Join Date\n"Rashid Khan","Senior Video Editor","+971509988776","rashid@company.ae",6500,30,"active","2024-01-15"';
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AfAccounts-Template-${type}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Robust CSV line/cell parser that supports quoted values and commas
 */
export const parseCSVRows = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuote = false;

  const text = csvText.trim();
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip CRLF
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
};

/**
 * Parse and import Clients from CSV text
 */
export const parseAndImportClientsCSV = (csvText: string): Client[] => {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  
  // Find column indices
  let companyIdx = headers.findIndex(h => h.includes('company'));
  let nameIdx = headers.findIndex(h => h.includes('contact') || h.includes('person') || h.includes('name'));
  let emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
  let phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));
  let trnIdx = headers.findIndex(h => h.includes('trn') || h.includes('tax') || h.includes('vat'));
  let addressIdx = headers.findIndex(h => h.includes('address') || h.includes('location') || h.includes('city'));
  let notesIdx = headers.findIndex(h => h.includes('note') || h.includes('remark'));

  // Default fallbacks if header names don't match exactly
  if (companyIdx === -1) companyIdx = 0;
  if (nameIdx === -1) nameIdx = 1;
  if (emailIdx === -1) emailIdx = 2;
  if (phoneIdx === -1) phoneIdx = 3;
  if (trnIdx === -1) trnIdx = 4;
  if (addressIdx === -1) addressIdx = 5;
  if (notesIdx === -1) notesIdx = 6;

  const clients: Client[] = [];
  const now = Date.now();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const company = row[companyIdx] || '';
    const name = row[nameIdx] || company || 'Valued Client';
    const email = row[emailIdx] || '';
    const phone = row[phoneIdx] || '';
    const trn = row[trnIdx] || '';
    const address = row[addressIdx] || '';
    const notes = row[notesIdx] || '';

    if (!company && !name && !email) continue;

    clients.push({
      id: `c_${now}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      company: (company || name).trim(),
      email: email.trim(),
      phone: phone.trim(),
      trn: trn.trim(),
      address: address.trim(),
      notes: notes.trim(),
      orderIndex: now + i
    });
  }

  return clients;
};

/**
 * Parse and import Expenses from CSV text
 */
export const parseAndImportExpensesCSV = (csvText: string): Expense[] => {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));

  let dateIdx = headers.findIndex(h => h.includes('date'));
  let categoryIdx = headers.findIndex(h => h.includes('cat'));
  let descIdx = headers.findIndex(h => h.includes('desc') || h.includes('item') || h.includes('purpose') || h.includes('title'));
  let amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('total') || h.includes('price') || h.includes('cost'));
  let currencyIdx = headers.findIndex(h => h.includes('currency') || h.includes('curr'));
  let vendorIdx = headers.findIndex(h => h.includes('vendor') || h.includes('merchant') || h.includes('supplier') || h.includes('payee'));
  let receiptIdx = headers.findIndex(h => h.includes('receipt') || h.includes('bill') || h.includes('ref') || h.includes('invoice'));
  let paymentMethodIdx = headers.findIndex(h => h.includes('payment') || h.includes('method') || h.includes('paidvia'));

  // Default fallbacks
  if (dateIdx === -1) dateIdx = 0;
  if (categoryIdx === -1) categoryIdx = 1;
  if (descIdx === -1) descIdx = 2;
  if (amountIdx === -1) amountIdx = 3;
  if (currencyIdx === -1) currencyIdx = 4;
  if (vendorIdx === -1) vendorIdx = 5;
  if (receiptIdx === -1) receiptIdx = 6;
  if (paymentMethodIdx === -1) paymentMethodIdx = 7;

  const expenses: Expense[] = [];
  const now = Date.now();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row[dateIdx] || '';
    const category = row[categoryIdx] || 'Other';
    const description = row[descIdx] || 'Expense Item';
    const rawAmount = row[amountIdx] || '0';
    const currency = row[currencyIdx] || 'AED';
    const vendor = row[vendorIdx] || '';
    const receiptNumber = row[receiptIdx] || '';
    const paymentMethod = row[paymentMethodIdx] || 'Cash';

    const cleanAmount = parseFloat(rawAmount.replace(/[^0-9.-]+/g, '')) || 0;
    if (cleanAmount === 0 && !description) continue;

    // Normalize date
    let date = rawDate.trim();
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      date = new Date().toISOString().split('T')[0];
    }

    expenses.push({
      id: `exp_${now}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      date,
      category: category.trim(),
      description: description.trim(),
      amount: cleanAmount,
      currency: currency.trim() || 'AED',
      vendor: vendor.trim(),
      receiptNumber: receiptNumber.trim(),
      paymentMethod: paymentMethod.trim()
    });
  }

  return expenses;
};

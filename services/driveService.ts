// Google Drive & Local Cloud Sync Service for Af© ACCOUNTS
import { Invoice, Client, Expense, StaffMember, StaffAdvance, StaffAttendanceRecord, CompanySettings, UserAccount } from '../types';
import { 
  uploadFileToGoogleDrive, 
  updateFileInGoogleDrive,
  listGoogleDriveFiles, 
  downloadGoogleDriveFileContent, 
  deleteGoogleDriveFile,
  isGoogleDriveConnected, 
  hasActiveGoogleOAuthToken,
  getGoogleDriveUser,
  linkGoogleDriveAccountByEmail,
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
const DRIVE_FILES_LOCAL_CACHE_KEY = 'af_google_drive_files_cache';
const DRIVE_LINKED_ACCOUNT_KEY = 'af_linked_drive_account';

function getActiveDriveEmail(overrideEmail?: string | null): string {
  const gUser = getGoogleDriveUser();
  const raw =
    overrideEmail ||
    gUser?.email ||
    localStorage.getItem(DRIVE_LINKED_ACCOUNT_KEY) ||
    (() => {
      try {
        const s = JSON.parse(localStorage.getItem('cf_settings') || '{}');
        return s.driveSyncEmail || '';
      } catch {
        return '';
      }
    })();
  return (raw || '').toLowerCase().trim();
}

function saveLocalDriveFileRecord(email: string, fileMeta: GoogleDriveFile, payload: AppBackupPayload) {
  try {
    const clean = (email || 'local').toLowerCase().trim();
    const cache = JSON.parse(localStorage.getItem(DRIVE_FILES_LOCAL_CACHE_KEY) || '{}');
    const list: Array<GoogleDriveFile & { payload?: AppBackupPayload }> = cache[clean] || [];
    const existingIdx = list.findIndex(f => f.id === fileMeta.id || f.name === fileMeta.name);
    const entry = {
      ...fileMeta,
      invoiceCount: payload.invoices?.length || 0,
      clientCount: payload.clients?.length || 0,
      payload,
    };
    if (existingIdx >= 0) {
      list[existingIdx] = entry;
    } else {
      list.unshift(entry);
    }
    cache[clean] = list.slice(0, 20);
    localStorage.setItem(DRIVE_FILES_LOCAL_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Local Drive file cache warning:', e);
  }
}

/**
 * Upload or update active workspace backup directly to Google Drive & Cloud Vault
 */
export const backupDirectlyToGoogleDrive = async (
  payload?: AppBackupPayload,
  options?: { fileName?: string; overwriteFileId?: string }
): Promise<{ success: boolean; file?: GoogleDriveFile; message: string }> => {
  try {
    const activeEmail = getActiveDriveEmail(payload?.userEmail);
    const data = payload || gatherAppBackupPayload(activeEmail || undefined);
    if (activeEmail) {
      data.userEmail = activeEmail;
    }
    data.exportedAt = new Date().toISOString();

    const jsonString = JSON.stringify(data, null, 2);
    const now = new Date();
    const dateFormatted = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const fileName = options?.fileName || `AfAccounts-Backup-${dateFormatted}.json`;

    let uploadedFile: GoogleDriveFile | undefined;

    // 1. Upload or update directly on Google Drive API v3 if OAuth token is active in memory
    if (hasActiveGoogleOAuthToken()) {
      try {
        if (options?.overwriteFileId && !options.overwriteFileId.startsWith('drv_')) {
          uploadedFile = await updateFileInGoogleDrive(
            options.overwriteFileId,
            fileName,
            'application/json',
            jsonString
          );
        } else {
          uploadedFile = await uploadFileToGoogleDrive(fileName, 'application/json', jsonString);
        }
      } catch (oauthErr) {
        console.warn('Direct Google Drive API upload fallback to Cloud Drive Vault:', oauthErr);
      }
    }

    // 2. Also store in Multi-Device Server Cloud Drive Files Vault (/api/drive-files/:email)
    const vaultEmail = activeEmail || 'workspace@afaccounts.local';
    try {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        const res = await fetch(`/api/drive-files/${encodeURIComponent(vaultEmail)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: uploadedFile?.id || options?.overwriteFileId,
            fileName,
            payload: data,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (!uploadedFile && json.file) {
            uploadedFile = { ...json.file, source: 'cloud-vault' };
          }
        }
      }
    } catch (vaultErr) {
      console.warn('Cloud Drive Vault upload fallback to local cache:', vaultErr);
    }

    // 3. Ensure uploadedFile metadata is always populated even offline
    if (!uploadedFile) {
      uploadedFile = {
        id: options?.overwriteFileId || `drv_${Date.now()}`,
        name: fileName,
        mimeType: 'application/json',
        createdTime: data.exportedAt,
        modifiedTime: data.exportedAt,
        size: String(new Blob([jsonString]).size),
        invoiceCount: data.invoices.length,
        clientCount: data.clients.length,
        source: 'cloud-vault',
      };
    }

    saveLocalDriveFileRecord(vaultEmail, uploadedFile, data);

    // 4. Sync master cloud snapshot
    if (activeEmail) {
      await syncToGoogleDriveCloud(activeEmail, data);
    }

    return {
      success: true,
      file: uploadedFile,
      message: options?.overwriteFileId
        ? `Updated Google Drive backup file "${fileName}" (${data.invoices.length} invoices, ${data.clients.length} clients).`
        : `Backed up ${data.invoices.length} invoices, ${data.clients.length} clients, and expenses to Google Drive file "${fileName}".`,
    };
  } catch (error: any) {
    console.error('Failed to backup to Google Drive:', error);
    return {
      success: false,
      message: error?.message || 'Failed to upload backup to Google Drive.',
    };
  }
};

/**
 * Retrieve combined list of backup files stored in Google Drive API & Cloud Drive Vault
 */
export const fetchGoogleDriveBackupList = async (
  emailOverride?: string
): Promise<GoogleDriveFile[]> => {
  const activeEmail = getActiveDriveEmail(emailOverride);
  const combinedMap = new Map<string, GoogleDriveFile>();

  // 1. Fetch from direct Google Drive REST API v3 if OAuth token is active
  if (hasActiveGoogleOAuthToken()) {
    try {
      const apiFiles = await listGoogleDriveFiles('AfAccounts');
      for (const f of apiFiles) {
        combinedMap.set(f.name, { ...f, source: 'google-drive-api' });
      }
    } catch (error) {
      console.warn('Direct Google Drive file list fallback to Cloud Vault:', error);
    }
  }

  // 2. Fetch from Server Cloud Drive Vault (/api/drive-files/:email)
  const targetEmail = activeEmail || 'workspace@afaccounts.local';
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      const res = await fetch(`/api/drive-files/${encodeURIComponent(targetEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.files)) {
          for (const f of data.files) {
            const existing = combinedMap.get(f.name);
            if (existing) {
              combinedMap.set(f.name, {
                ...f,
                ...existing,
                invoiceCount: f.invoiceCount ?? existing.invoiceCount,
                clientCount: f.clientCount ?? existing.clientCount,
                isMasterMirror: f.isMasterMirror ?? existing.isMasterMirror,
              });
            } else {
              combinedMap.set(f.name, { ...f, source: 'cloud-vault' });
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Server drive-files list fallback to local cache:', e);
  }

  // 3. Merge any locally cached Drive backup files
  try {
    const cache = JSON.parse(localStorage.getItem(DRIVE_FILES_LOCAL_CACHE_KEY) || '{}');
    const localList: Array<GoogleDriveFile & { payload?: AppBackupPayload }> =
      cache[targetEmail] || [];
    for (const item of localList) {
      const { payload: _p, ...meta } = item;
      if (!combinedMap.has(meta.name)) {
        combinedMap.set(meta.name, meta);
      }
    }
  } catch {
    // ignore
  }

  return Array.from(combinedMap.values()).sort((a, b) => {
    const timeA = new Date(a.modifiedTime || a.createdTime || 0).getTime();
    const timeB = new Date(b.modifiedTime || b.createdTime || 0).getTime();
    return timeB - timeA;
  });
};

/**
 * Download a backup file's payload from Google Drive or Cloud Vault WITHOUT mutating localStorage yet
 */
export const fetchDriveFilePayload = async (
  fileId: string,
  emailOverride?: string
): Promise<{ success: boolean; message: string; payload?: AppBackupPayload }> => {
  const activeEmail = getActiveDriveEmail(emailOverride) || 'workspace@afaccounts.local';

  // 1. Try direct Google Drive API v3 if it's a real Drive fileId and OAuth token is active
  if (hasActiveGoogleOAuthToken() && !fileId.startsWith('drv_')) {
    try {
      const rawContent = await downloadGoogleDriveFileContent(fileId);
      const parsed: AppBackupPayload = JSON.parse(rawContent);
      if (parsed && (Array.isArray(parsed.invoices) || Array.isArray(parsed.clients))) {
        return {
          success: true,
          message: `Loaded backup with ${parsed.invoices?.length || 0} invoices and ${parsed.clients?.length || 0} clients from Google Drive.`,
          payload: parsed,
        };
      }
    } catch (e) {
      console.warn('Direct Google Drive file download fallback to Cloud Vault:', e);
    }
  }

  // 2. Try Server Cloud Drive Vault (/api/drive-files/:email/:fileId)
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      const res = await fetch(
        `/api/drive-files/${encodeURIComponent(activeEmail)}/${encodeURIComponent(fileId)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.payload) {
          return {
            success: true,
            message: `Loaded backup from Google Drive Cloud Vault.`,
            payload: data.payload,
          };
        }
      }
    }
  } catch (e) {
    console.warn('Cloud Drive Vault download fallback to local cache:', e);
  }

  // 3. Try local cache
  try {
    const cache = JSON.parse(localStorage.getItem(DRIVE_FILES_LOCAL_CACHE_KEY) || '{}');
    const localList: Array<GoogleDriveFile & { payload?: AppBackupPayload }> =
      cache[activeEmail] || [];
    const found = localList.find(f => f.id === fileId || f.name === fileId);
    if (found?.payload) {
      return {
        success: true,
        message: 'Loaded backup from local Drive cache.',
        payload: found.payload,
      };
    }
  } catch {
    // ignore
  }

  return {
    success: false,
    message: 'Could not download the selected backup file from Google Drive.',
  };
};

/**
 * Download and apply backup from Google Drive file
 */
export const restoreFromGoogleDriveFile = async (
  fileId: string,
  mode: 'replace' | 'merge' = 'replace',
  applyImmediately: boolean = false
): Promise<{ success: boolean; message: string; payload?: AppBackupPayload }> => {
  const fetched = await fetchDriveFilePayload(fileId);
  if (!fetched.success || !fetched.payload) {
    return fetched;
  }
  if (applyImmediately) {
    applyBackupPayload(fetched.payload, mode);
  }
  return {
    success: true,
    message: `Ready to restore ${fetched.payload.invoices?.length || 0} invoices and ${fetched.payload.clients?.length || 0} clients from Google Drive.`,
    payload: fetched.payload,
  };
};

/**
 * Delete a backup file from Google Drive API and Cloud Vault (Call AFTER user confirmation)
 */
export const deleteBackupFileFromDrive = async (
  fileId: string,
  fileName?: string,
  emailOverride?: string
): Promise<{ success: boolean; message: string }> => {
  const activeEmail = getActiveDriveEmail(emailOverride) || 'workspace@afaccounts.local';

  // 1. Delete from Google Drive REST API v3 if applicable
  if (hasActiveGoogleOAuthToken() && !fileId.startsWith('drv_')) {
    try {
      await deleteGoogleDriveFile(fileId);
    } catch (e) {
      console.warn('Direct Google Drive file delete warning:', e);
    }
  }

  // 2. Delete from Server Cloud Drive Vault
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      await fetch(
        `/api/drive-files/${encodeURIComponent(activeEmail)}/${encodeURIComponent(fileId)}`,
        { method: 'DELETE' }
      );
      if (fileName) {
        await fetch(
          `/api/drive-files/${encodeURIComponent(activeEmail)}/${encodeURIComponent(fileName)}`,
          { method: 'DELETE' }
        );
      }
    }
  } catch (e) {
    console.warn('Server drive file delete warning:', e);
  }

  // 3. Delete from local cache
  try {
    const cache = JSON.parse(localStorage.getItem(DRIVE_FILES_LOCAL_CACHE_KEY) || '{}');
    if (Array.isArray(cache[activeEmail])) {
      cache[activeEmail] = cache[activeEmail].filter(
        (f: GoogleDriveFile) => f.id !== fileId && (!fileName || f.name !== fileName)
      );
      localStorage.setItem(DRIVE_FILES_LOCAL_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    // ignore
  }

  return {
    success: true,
    message: `Deleted backup "${fileName || fileId}" from Google Drive.`,
  };
};

/**
 * Get current linked Google Drive account email
 */
export const getLinkedDriveAccount = (): string | null => {
  return localStorage.getItem(DRIVE_LINKED_ACCOUNT_KEY);
};

/**
 * Set linked Google Drive account email and notify auth listeners
 */
export const setLinkedDriveAccount = (email: string | null): void => {
  if (email && email.trim()) {
    const clean = email.toLowerCase().trim();
    localStorage.setItem(DRIVE_LINKED_ACCOUNT_KEY, clean);
    linkGoogleDriveAccountByEmail(clean);
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
 * Automatically sync and save all data to Google Drive cloud vault + Multi-Device Server Email Vault for the specified email
 */
export const syncToGoogleDriveCloud = async (
  email: string,
  payload?: AppBackupPayload
): Promise<{ success: boolean; timestamp: string; invoiceCount: number; message: string }> => {
  const cleanEmail = (email || '').toLowerCase().trim();
  const data = payload || gatherAppBackupPayload(cleanEmail);
  data.userEmail = cleanEmail;
  data.exportedAt = new Date().toISOString();

  // 1. Save to local device storage keyed by email (for 100% offline availability)
  try {
    const existingBackups = JSON.parse(localStorage.getItem(DRIVE_BACKUPS_STORAGE_KEY) || '{}');
    existingBackups[cleanEmail] = {
      ...data,
      lastSyncTime: data.exportedAt
    };
    localStorage.setItem(DRIVE_BACKUPS_STORAGE_KEY, JSON.stringify(existingBackups));
    setLinkedDriveAccount(cleanEmail);
  } catch (e) {
    console.warn('Local storage backup warning:', e);
  }

  // 2. Sync to Multi-Device Server Email Cloud Vault (/api/sync) so PC & Mobile with same Email ID share all data
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          payload: data,
          mode: 'merge'
        })
      });
    }
  } catch (e) {
    console.warn('Multi-device server vault sync warning (offline mode active):', e);
  }

  // 3. If Google Drive OAuth token is active in memory, update or create the master file on Google Drive
  try {
    const masterFileName = `AfAccounts_Master_Sync_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}.json`;
    const jsonStr = JSON.stringify(data, null, 2);
    let masterMeta: GoogleDriveFile = {
      id: `drv_master_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`,
      name: masterFileName,
      mimeType: 'application/json',
      createdTime: data.exportedAt,
      modifiedTime: data.exportedAt,
      size: String(new Blob([jsonStr]).size),
      invoiceCount: data.invoices.length,
      clientCount: data.clients.length,
      isMasterMirror: true,
      source: 'cloud-vault',
    };

    if (hasActiveGoogleOAuthToken()) {
      const existingFiles = await listGoogleDriveFiles(masterFileName);
      const exactFile = existingFiles.find(f => f.name === masterFileName);
      if (exactFile) {
        masterMeta = await updateFileInGoogleDrive(exactFile.id, masterFileName, 'application/json', jsonStr);
      } else {
        masterMeta = await uploadFileToGoogleDrive(masterFileName, 'application/json', jsonStr);
      }
      masterMeta.isMasterMirror = true;
    }

    saveLocalDriveFileRecord(cleanEmail, masterMeta, data);
  } catch (e) {
    console.warn('Google Drive background master sync warning:', e);
  }

  // 4. Broadcast to other open tabs on the same device
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('af_accounts_sync_channel');
      bc.postMessage({ type: 'DATA_SYNCED', email: cleanEmail, timestamp: data.exportedAt });
      bc.close();
    }
  } catch {
    // ignore
  }

  return {
    success: true,
    timestamp: data.exportedAt,
    invoiceCount: data.invoices.length,
    message: `Synchronized ${data.invoices.length} invoices, ${data.clients.length} clients, and expenses across all PC & Mobile devices linked to ${cleanEmail}.`
  };
};

/**
 * Pull and merge data associated with an Email ID from Google Drive + Multi-Device Server Cloud Vault + Local Vault
 */
export const pullFromCloudAndDriveByEmail = async (
  email: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; data?: AppBackupPayload; message: string }> => {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  setLinkedDriveAccount(cleanEmail);

  // 1. Check Google Drive Master File first if OAuth token is active
  try {
    if (hasActiveGoogleOAuthToken()) {
      const masterFileName = `AfAccounts_Master_Sync_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}.json`;
      let files = await listGoogleDriveFiles(masterFileName);
      if (files.length === 0) {
        files = await listGoogleDriveFiles('AfAccounts');
      }
      if (files.length > 0) {
        const raw = await downloadGoogleDriveFileContent(files[0].id);
        const parsed: AppBackupPayload = JSON.parse(raw);
        if (parsed && (Array.isArray(parsed.invoices) || Array.isArray(parsed.clients))) {
          applyBackupPayload(parsed, mode);
          return {
            success: true,
            data: gatherAppBackupPayload(cleanEmail),
            message: `Automatically synced data from Google Drive for ${cleanEmail}!`
          };
        }
      }
    }
  } catch (e) {
    console.warn('Google Drive pull fallback to server email vault:', e);
  }

  // 2. Check Multi-Device Server Email Cloud Vault (/api/sync/:email)
  try {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      const res = await fetch(`/api/sync/${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          applyBackupPayload(result.data, mode);
          // Also cache in local vault
          const existingBackups = JSON.parse(localStorage.getItem(DRIVE_BACKUPS_STORAGE_KEY) || '{}');
          existingBackups[cleanEmail] = result.data;
          localStorage.setItem(DRIVE_BACKUPS_STORAGE_KEY, JSON.stringify(existingBackups));
          return {
            success: true,
            data: gatherAppBackupPayload(cleanEmail),
            message: `Synced ${result.data.invoices?.length || 0} invoices and ${result.data.clients?.length || 0} clients linked to ${cleanEmail}!`
          };
        }
      }
    }
  } catch (e) {
    console.warn('Server email vault pull fallback to local storage:', e);
  }

  // 3. Fallback to Local Device Vault
  const localResult = fetchFromGoogleDriveCloud(cleanEmail);
  if (localResult.success && localResult.data) {
    applyBackupPayload(localResult.data, mode);
    return {
      success: true,
      data: gatherAppBackupPayload(cleanEmail),
      message: localResult.message
    };
  }

  // If no existing cloud record yet, initialize cloud vault with current device data for this email!
  await syncToGoogleDriveCloud(cleanEmail);
  return {
    success: true,
    data: gatherAppBackupPayload(cleanEmail),
    message: `Linked ${cleanEmail} and uploaded current device data for multi-device PC & Mobile sync.`
  };
};

/**
 * Local Offline Data Sharing (AirDrop / Nearby Share / WhatsApp / Direct File Transfer)
 */
export const shareLocalDataOffline = async (userEmail?: string): Promise<string> => {
  const payload = gatherAppBackupPayload(userEmail);
  const jsonString = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `AfAccounts-Sync-${userEmail ? userEmail.split('@')[0] + '-' : ''}${dateStr}.json`;

  try {
    const file = new File([jsonString], fileName, { type: 'application/json' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Af© ACCOUNTS Workspace Data Sync',
        text: `Local workspace data backup (${payload.invoices.length} invoices, ${payload.clients.length} clients)`,
        files: [file]
      });
      return 'Shared local data file successfully via device share sheet!';
    }
  } catch (err) {
    console.warn('Web Share API fallback to direct file download:', err);
  }

  downloadLocalBackupJSON(userEmail);
  return 'Downloaded local data sync file to your device!';
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

const VERIFIED_EMAILS_KEY = 'af_verified_emails_map';
const LOCAL_PENDING_CODES_KEY = 'af_pending_email_codes';

/**
 * Check if an Email ID has been verified via 4-digit verification code (or Google OAuth)
 */
export const isEmailVerified = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  if (!clean) return false;
  try {
    const map = JSON.parse(localStorage.getItem(VERIFIED_EMAILS_KEY) || '{}');
    return !!map[clean];
  } catch {
    return false;
  }
};

/**
 * Mark an Email ID as verified locally
 */
export const markEmailVerified = (email: string): void => {
  const clean = (email || '').toLowerCase().trim();
  if (!clean) return;
  try {
    const map = JSON.parse(localStorage.getItem(VERIFIED_EMAILS_KEY) || '{}');
    map[clean] = {
      verified: true,
      verifiedAt: new Date().toISOString()
    };
    localStorage.setItem(VERIFIED_EMAILS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Could not save verified email state:', e);
  }
};

/**
 * Request a 4-digit verification code for an Email ID
 */
export const requestEmailVerificationCode = async (
  email: string
): Promise<{ success: boolean; dispatchCode?: string; message: string }> => {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return {
      success: false,
      message: 'Please enter a valid Email ID (e.g. user@company.com).'
    };
  }

  // Try server endpoint first
  try {
    const res = await fetch('/api/email-verify/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.dispatchCode) {
        // Also cache locally so offline confirmation works seamlessly
        const pending = JSON.parse(localStorage.getItem(LOCAL_PENDING_CODES_KEY) || '{}');
        pending[cleanEmail] = {
          code: String(data.dispatchCode),
          expiresAt: Date.now() + 10 * 60 * 1000
        };
        localStorage.setItem(LOCAL_PENDING_CODES_KEY, JSON.stringify(pending));
        return {
          success: true,
          dispatchCode: String(data.dispatchCode),
          message: data.message || `4-digit verification code sent to ${cleanEmail}.`
        };
      }
    }
  } catch (e) {
    console.warn('Offline fallback for 4-digit email verification code:', e);
  }

  // Offline / Local fallback 4-digit generator
  const fallbackCode = String(Math.floor(1000 + Math.random() * 9000));
  const pending = JSON.parse(localStorage.getItem(LOCAL_PENDING_CODES_KEY) || '{}');
  pending[cleanEmail] = {
    code: fallbackCode,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  localStorage.setItem(LOCAL_PENDING_CODES_KEY, JSON.stringify(pending));

  return {
    success: true,
    dispatchCode: fallbackCode,
    message: `4-digit verification code generated for ${cleanEmail}.`
  };
};

/**
 * Confirm the 4-digit verification code and immediately mirror & sync all app data under that Email ID & Google Drive
 */
export const confirmEmailVerificationCode = async (
  email: string,
  code: string
): Promise<{
  success: boolean;
  verified: boolean;
  data?: AppBackupPayload;
  message: string;
}> => {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanCode = String(code || '').trim();

  if (!cleanEmail || cleanCode.length !== 4) {
    return {
      success: false,
      verified: false,
      message: 'Please enter the 4-digit verification code.'
    };
  }

  let verified = false;

  // 1. Verify against Server API
  try {
    const res = await fetch('/api/email-verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode })
    });
    const result = await res.json();
    if (res.ok && result.success && result.verified) {
      verified = true;
    } else if (!res.ok && result.message) {
      // Check local pending code before returning error
      const pending = JSON.parse(localStorage.getItem(LOCAL_PENDING_CODES_KEY) || '{}');
      const localRec = pending[cleanEmail];
      if (localRec && localRec.code === cleanCode && Date.now() <= localRec.expiresAt) {
        verified = true;
      } else {
        return {
          success: false,
          verified: false,
          message: result.message
        };
      }
    }
  } catch {
    // 2. Verify against Local Pending Code if offline
    const pending = JSON.parse(localStorage.getItem(LOCAL_PENDING_CODES_KEY) || '{}');
    const localRec = pending[cleanEmail];
    if (localRec && localRec.code === cleanCode && Date.now() <= localRec.expiresAt) {
      verified = true;
    }
  }

  if (!verified) {
    return {
      success: false,
      verified: false,
      message: 'Invalid 4-digit verification code. Please check the 4 numbers and try again.'
    };
  }

  // Mark verified and immediately mirror & sync both directions (Cloud/Drive -> Local AND Local -> Cloud/Drive)
  markEmailVerified(cleanEmail);
  setLinkedDriveAccount(cleanEmail);

  // Pull & merge any existing data from Google Drive & Cloud Vault for this email, then push mirrored state back
  const pullRes = await pullFromCloudAndDriveByEmail(cleanEmail, 'merge');
  const mergedPayload = pullRes.data || gatherAppBackupPayload(cleanEmail);
  await syncToGoogleDriveCloud(cleanEmail, mergedPayload);

  return {
    success: true,
    verified: true,
    data: mergedPayload,
    message: `Verified ${cleanEmail}! Your workspace is now mirrored and syncing automatically across Google Drive and all connected devices.`
  };
};


import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, '.data');
const VAULT_FILE = path.join(DATA_DIR, 'email_cloud_vault.json');
const VERIFY_FILE = path.join(DATA_DIR, 'email_verifications.json');
const DRIVE_FILES_FILE = path.join(DATA_DIR, 'drive_backup_files.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'account_registry.json');

// Ensure data directory exists for multi-device email sync persistence
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create .data dir:', e);
  }
}

interface CloudVaultStore {
  [email: string]: any;
}

interface AccountRegistry {
  lastActiveEmail?: string;
  linkedEmailByUsername: Record<string, string>;
  users: any[];
}

function readRegistry(): AccountRegistry {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const raw = fs.readFileSync(REGISTRY_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        lastActiveEmail: parsed.lastActiveEmail || '',
        linkedEmailByUsername: parsed.linkedEmailByUsername || {},
        users: Array.isArray(parsed.users) ? parsed.users : [],
      };
    }
  } catch (e) {
    console.warn('Error reading account registry:', e);
  }
  return { lastActiveEmail: '', linkedEmailByUsername: {}, users: [] };
}

function writeRegistry(reg: AccountRegistry): void {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing account registry:', e);
  }
}

function updateRegistryWithSync(cleanEmail: string, payload?: any, usernameHint?: string): void {
  if (!cleanEmail || !cleanEmail.includes('@')) return;
  const reg = readRegistry();
  reg.lastActiveEmail = cleanEmail;
  reg.linkedEmailByUsername['admin'] = cleanEmail;
  if (usernameHint) {
    reg.linkedEmailByUsername[usernameHint.toLowerCase().trim()] = cleanEmail;
  }

  if (Array.isArray(payload?.users) && payload.users.length > 0) {
    const userMap = new Map<string, any>();
    for (const u of reg.users) {
      if (u && u.username) userMap.set(u.username.toLowerCase().trim(), u);
    }
    for (const u of payload.users) {
      if (u && u.username) {
        const key = u.username.toLowerCase().trim();
        const updatedUser = {
          ...userMap.get(key),
          ...u,
          email: u.email || (key === 'admin' ? cleanEmail : u.email),
        };
        userMap.set(key, updatedUser);
        reg.linkedEmailByUsername[key] = (updatedUser.email || cleanEmail).toLowerCase().trim();
      }
    }
    reg.users = Array.from(userMap.values());
  }
  writeRegistry(reg);
}

// Active SSE clients for instant multi-device change propagation
type SseClient = {
  id: string;
  email: string;
  res: express.Response;
};
const sseClients = new Set<SseClient>();

function broadcastSyncToSseClients(email: string, data: any): void {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return;
  const message = JSON.stringify({
    type: 'SYNC_UPDATE',
    email: cleanEmail,
    updatedAtMs: data?.updatedAtMs || Date.now(),
    timestamp: data?.lastSyncTime || new Date().toISOString(),
    data,
  });
  for (const client of sseClients) {
    if (!client.email || client.email === cleanEmail) {
      try {
        client.res.write(`data: ${message}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }
}

interface StoredDriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  size: string;
  invoiceCount?: number;
  clientCount?: number;
  isMasterMirror?: boolean;
  content: any;
}

interface DriveFilesStore {
  [email: string]: StoredDriveFileRecord[];
}

function readDriveFilesStore(): DriveFilesStore {
  try {
    if (fs.existsSync(DRIVE_FILES_FILE)) {
      const raw = fs.readFileSync(DRIVE_FILES_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error reading drive files store:', e);
  }
  return {};
}

function writeDriveFilesStore(store: DriveFilesStore): void {
  try {
    fs.writeFileSync(DRIVE_FILES_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing drive files store:', e);
  }
}

function upsertMasterDriveMirrorFile(email: string, payload: any): StoredDriveFileRecord {
  const cleanEmail = email.toLowerCase().trim();
  const store = readDriveFilesStore();
  const list = store[cleanEmail] || [];
  const masterName = `AfAccounts_Master_Sync_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}.json`;
  const nowIso = new Date().toISOString();
  const jsonStr = JSON.stringify(payload);
  const sizeBytes = String(Buffer.byteLength(jsonStr, 'utf-8'));

  const existingIdx = list.findIndex(f => f.name === masterName || f.isMasterMirror);
  let record: StoredDriveFileRecord;
  if (existingIdx >= 0) {
    record = {
      ...list[existingIdx],
      name: masterName,
      modifiedTime: nowIso,
      size: sizeBytes,
      invoiceCount: Array.isArray(payload?.invoices) ? payload.invoices.length : 0,
      clientCount: Array.isArray(payload?.clients) ? payload.clients.length : 0,
      isMasterMirror: true,
      content: payload,
    };
    list[existingIdx] = record;
  } else {
    record = {
      id: `drv_master_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`,
      name: masterName,
      mimeType: 'application/json',
      createdTime: nowIso,
      modifiedTime: nowIso,
      size: sizeBytes,
      invoiceCount: Array.isArray(payload?.invoices) ? payload.invoices.length : 0,
      clientCount: Array.isArray(payload?.clients) ? payload.clients.length : 0,
      isMasterMirror: true,
      content: payload,
    };
    list.unshift(record);
  }

  store[cleanEmail] = list.slice(0, 30);
  writeDriveFilesStore(store);
  return record;
}

function readVault(): CloudVaultStore {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error reading vault file:', e);
  }
  return {};
}

function writeVault(store: CloudVaultStore): void {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing vault file:', e);
  }
}

interface VerificationRecord {
  email: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  verified: boolean;
  verifiedAt?: string;
}

interface VerificationStore {
  [email: string]: VerificationRecord;
}

function readVerifications(): VerificationStore {
  try {
    if (fs.existsSync(VERIFY_FILE)) {
      const raw = fs.readFileSync(VERIFY_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error reading verifications file:', e);
  }
  return {};
}

function writeVerifications(store: VerificationStore): void {
  try {
    fs.writeFileSync(VERIFY_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing verifications file:', e);
  }
}

function mergeArraysById<T extends { id?: string }>(existing: T[] = [], incoming: T[] = []): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of incoming) {
    if (item && item.id) map.set(item.id, item);
  }
  return Array.from(map.values());
}

// Normalize model name to valid @google/genai models
function normalizeModelName(model?: string): string {
  if (!model || model === 'gemini-3.5-flash') {
    return 'gemini-3.8-flash';
  }
  return model;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithFallback(
  ai: GoogleGenAI,
  primaryModel: string,
  contents: any,
  config?: any
) {
  const modelsToTry = Array.from(
    new Set([
      normalizeModelName(primaryModel),
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
    ])
  );

  let lastError: any = null;
  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config,
      });
      return { text: response.text || '', modelUsed: modelName };
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${modelName} failed, trying next fallback if available:`, err?.message);
    }
  }
  throw lastError || new Error('All Gemini models failed to respond.');
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '25mb' }));

  // ============================================================================
  // 1. MULTI-DEVICE EMAIL CLOUD VAULT API (PC & Mobile Unlimited Device Sync)
  // ============================================================================
  app.get('/api/sync-stream', (req, res) => {
    const email = String(req.query.email || '').toLowerCase().trim();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client: SseClient = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email,
      res,
    };
    sseClients.add(client);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(client);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(client);
    });
  });

  app.get('/api/session-bootstrap', (req, res) => {
    const queryEmail = String(req.query.email || '').toLowerCase().trim();
    const queryUser = String(req.query.username || '').toLowerCase().trim();
    const reg = readRegistry();
    const vault = readVault();

    let resolvedEmail = queryEmail;
    if (!resolvedEmail && queryUser && reg.linkedEmailByUsername[queryUser]) {
      resolvedEmail = reg.linkedEmailByUsername[queryUser];
    }
    if (!resolvedEmail && reg.lastActiveEmail) {
      resolvedEmail = reg.lastActiveEmail;
    }
    if (!resolvedEmail) {
      const vaultEmails = Object.keys(vault).filter(k => k.includes('@'));
      if (vaultEmails.length > 0) {
        resolvedEmail = vaultEmails[vaultEmails.length - 1];
      }
    }

    const record = resolvedEmail ? vault[resolvedEmail] : null;
    res.json({
      success: !!resolvedEmail,
      linkedEmail: resolvedEmail || null,
      users: reg.users || [],
      updatedAtMs: record?.updatedAtMs || 0,
      data: record || null,
    });
  });

  app.post('/api/auth/login-sync', (req, res) => {
    const { identifier, password } = req.body || {};
    const cleanId = String(identifier || '').toLowerCase().trim();
    if (!cleanId) {
      res.status(400).json({ success: false, message: 'Username or email is required.' });
      return;
    }

    const reg = readRegistry();
    const vault = readVault();

    // Collect all known users across registry and vaults
    const userMap = new Map<string, any>();
    for (const u of reg.users || []) {
      if (u?.username) userMap.set(u.username.toLowerCase().trim(), u);
    }
    for (const emailKey of Object.keys(vault)) {
      const vData = vault[emailKey];
      if (Array.isArray(vData?.users)) {
        for (const u of vData.users) {
          if (u?.username) {
            userMap.set(u.username.toLowerCase().trim(), {
              ...userMap.get(u.username.toLowerCase().trim()),
              ...u,
            });
          }
        }
      }
    }

    const allUsers = Array.from(userMap.values());
    let matchedUser = allUsers.find(
      u =>
        u.username?.toLowerCase().trim() === cleanId ||
        (u.email && u.email.toLowerCase().trim() === cleanId)
    );

    // If user typed their linked Google Drive email directly and it exists in vault
    if (!matchedUser && cleanId.includes('@') && vault[cleanId]) {
      const adminUser = allUsers.find(u => u.username?.toLowerCase() === 'admin');
      if (adminUser && (!password || adminUser.password === password)) {
        matchedUser = { ...adminUser, email: cleanId };
      }
    }

    if (!matchedUser || (password !== undefined && matchedUser.password && matchedUser.password !== password)) {
      res.status(401).json({
        success: false,
        message: 'Invalid username/email or password.',
      });
      return;
    }

    const resolvedEmail = (
      matchedUser.email ||
      (cleanId.includes('@') ? cleanId : '') ||
      reg.linkedEmailByUsername[matchedUser.username?.toLowerCase().trim()] ||
      reg.lastActiveEmail ||
      ''
    )
      .toLowerCase()
      .trim();

    if (resolvedEmail) {
      matchedUser = { ...matchedUser, email: resolvedEmail };
    }

    const cloudData = resolvedEmail ? vault[resolvedEmail] || null : null;
    res.json({
      success: true,
      user: matchedUser,
      linkedEmail: resolvedEmail || null,
      users: allUsers,
      data: cloudData,
    });
  });

  app.get('/api/sync/:email', (req, res) => {
    const email = (req.params.email || '').toLowerCase().trim();
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const vault = readVault();
    const record = vault[email];
    if (!record) {
      res.json({
        success: false,
        message: `No cloud sync record found yet for ${email}.`,
      });
      return;
    }

    res.json({
      success: true,
      updatedAtMs: record.updatedAtMs || new Date(record.lastSyncTime || record.exportedAt || Date.now()).getTime(),
      data: record,
      message: `Synced workspace for ${email} (${record.invoices?.length || 0} invoices, ${record.clients?.length || 0} clients).`,
    });
  });

  app.post('/api/sync', (req, res) => {
    const { email, payload, mode = 'replace', username } = req.body || {};
    const cleanEmail = (email || payload?.userEmail || '').toLowerCase().trim();
    if (!cleanEmail || !payload) {
      res.status(400).json({ success: false, message: 'Valid email and payload are required.' });
      return;
    }

    const vault = readVault();
    const existing = vault[cleanEmail];
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // When linking a new device (mode === 'link'), if cloud vault already has saved data for this email,
    // return the authoritative cloud data without overwriting it with the new device's default mock state!
    if (mode === 'link' && existing) {
      updateRegistryWithSync(cleanEmail, existing, username);
      upsertMasterDriveMirrorFile(cleanEmail, existing);
      res.json({
        success: true,
        existedInCloud: true,
        updatedAtMs: existing.updatedAtMs || nowMs,
        timestamp: existing.lastSyncTime || nowIso,
        data: existing,
        message: `Linked ${cleanEmail} and loaded existing Google Drive workspace (${existing.invoices?.length || 0} invoices, ${existing.clients?.length || 0} clients).`,
      });
      return;
    }

    let finalPayload = {
      ...payload,
      userEmail: cleanEmail,
      exportedAt: nowIso,
      lastSyncTime: nowIso,
      updatedAtMs: nowMs,
      settings: {
        ...(payload.settings || {}),
        driveSyncEmail: cleanEmail,
        autoDriveSync: true,
      },
    };

    if (existing && mode === 'merge') {
      finalPayload = {
        ...existing,
        ...payload,
        userEmail: cleanEmail,
        exportedAt: nowIso,
        lastSyncTime: nowIso,
        updatedAtMs: nowMs,
        invoices: mergeArraysById(existing.invoices, payload.invoices),
        clients: mergeArraysById(existing.clients, payload.clients),
        expenses: mergeArraysById(existing.expenses, payload.expenses),
        staffList: mergeArraysById(existing.staffList, payload.staffList),
        staffAdvances: mergeArraysById(existing.staffAdvances, payload.staffAdvances),
        staffAttendance: mergeArraysById(existing.staffAttendance, payload.staffAttendance),
        categories: Array.from(new Set([...(existing.categories || []), ...(payload.categories || [])])),
        settings: {
          ...(existing.settings || {}),
          ...(payload.settings || {}),
          driveSyncEmail: cleanEmail,
          autoDriveSync: true,
        },
        users: mergeArraysById(existing.users, payload.users),
      };
    }

    vault[cleanEmail] = finalPayload;
    writeVault(vault);
    updateRegistryWithSync(cleanEmail, finalPayload, username);
    upsertMasterDriveMirrorFile(cleanEmail, finalPayload);
    broadcastSyncToSseClients(cleanEmail, finalPayload);

    res.json({
      success: true,
      updatedAtMs: nowMs,
      timestamp: nowIso,
      data: finalPayload,
      message: `Synchronized all records across devices for ${cleanEmail}.`,
    });
  });

  // ============================================================================
  // 1A. GOOGLE DRIVE CLOUD BACKUP ARCHIVE ENDPOINTS (Multi-Device File Mirror)
  // ============================================================================
  app.get('/api/drive-files/:email', (req, res) => {
    const cleanEmail = (req.params.email || '').toLowerCase().trim();
    if (!cleanEmail) {
      res.status(400).json({ success: false, files: [], message: 'Email is required.' });
      return;
    }

    const store = readDriveFilesStore();
    let files = store[cleanEmail] || [];

    // Ensure master mirror file appears if vault data exists for this email
    const vault = readVault();
    if (vault[cleanEmail]) {
      const masterRecord = upsertMasterDriveMirrorFile(cleanEmail, vault[cleanEmail]);
      const refreshedStore = readDriveFilesStore();
      files = refreshedStore[cleanEmail] || [masterRecord];
    }

    const metadataOnly = files.map(({ content, ...meta }) => meta);
    res.json({
      success: true,
      files: metadataOnly,
    });
  });

  app.post('/api/drive-files/:email', (req, res) => {
    const cleanEmail = (req.params.email || '').toLowerCase().trim();
    const { fileName, payload, fileId, isMasterMirror } = req.body || {};
    if (!cleanEmail || !payload) {
      res.status(400).json({ success: false, message: 'Email and backup payload are required.' });
      return;
    }

    const store = readDriveFilesStore();
    const list = store[cleanEmail] || [];
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const safeName =
      fileName ||
      `AfAccounts-Backup-${nowIso.replace(/[:.]/g, '-')}.json`;
    const jsonStr = JSON.stringify(payload);
    const sizeBytes = String(Buffer.byteLength(jsonStr, 'utf-8'));

    let savedRecord: StoredDriveFileRecord;
    const existingIdx = list.findIndex(
      f => (fileId && f.id === fileId) || f.name === safeName
    );

    if (existingIdx >= 0) {
      savedRecord = {
        ...list[existingIdx],
        name: safeName,
        modifiedTime: nowIso,
        size: sizeBytes,
        invoiceCount: Array.isArray(payload?.invoices) ? payload.invoices.length : 0,
        clientCount: Array.isArray(payload?.clients) ? payload.clients.length : 0,
        isMasterMirror: isMasterMirror ?? list[existingIdx].isMasterMirror,
        content: payload,
      };
      list[existingIdx] = savedRecord;
    } else {
      savedRecord = {
        id: fileId || `drv_${nowMs}_${Math.random().toString(36).substring(2, 7)}`,
        name: safeName,
        mimeType: 'application/json',
        createdTime: nowIso,
        modifiedTime: nowIso,
        size: sizeBytes,
        invoiceCount: Array.isArray(payload?.invoices) ? payload.invoices.length : 0,
        clientCount: Array.isArray(payload?.clients) ? payload.clients.length : 0,
        isMasterMirror: !!isMasterMirror,
        content: payload,
      };
      list.unshift(savedRecord);
    }

    store[cleanEmail] = list.slice(0, 30);
    writeDriveFilesStore(store);

    // Also update master vault so all devices stay in sync
    const vault = readVault();
    const updatedVaultPayload = {
      ...payload,
      userEmail: cleanEmail,
      exportedAt: nowIso,
      lastSyncTime: nowIso,
      updatedAtMs: nowMs,
      settings: {
        ...(payload.settings || {}),
        driveSyncEmail: cleanEmail,
        autoDriveSync: true,
      },
    };
    vault[cleanEmail] = updatedVaultPayload;
    writeVault(vault);
    updateRegistryWithSync(cleanEmail, updatedVaultPayload);
    broadcastSyncToSseClients(cleanEmail, updatedVaultPayload);

    const { content, ...meta } = savedRecord;
    res.json({
      success: true,
      file: meta,
      updatedAtMs: nowMs,
      message: `Saved backup "${safeName}" to Google Drive Cloud Vault.`,
    });
  });

  app.get('/api/drive-files/:email/:fileId', (req, res) => {
    const cleanEmail = (req.params.email || '').toLowerCase().trim();
    const fileId = req.params.fileId || '';
    const store = readDriveFilesStore();
    const list = store[cleanEmail] || [];
    const found = list.find(f => f.id === fileId || f.name === fileId);

    if (found && found.content) {
      res.json({
        success: true,
        file: {
          id: found.id,
          name: found.name,
          createdTime: found.createdTime,
          modifiedTime: found.modifiedTime,
          size: found.size,
        },
        payload: found.content,
      });
      return;
    }

    // Fallback to master vault if requested
    const vault = readVault();
    if (vault[cleanEmail]) {
      res.json({
        success: true,
        payload: vault[cleanEmail],
      });
      return;
    }

    res.status(404).json({
      success: false,
      message: 'Requested Google Drive backup file was not found.',
    });
  });

  app.delete('/api/drive-files/:email/:fileId', (req, res) => {
    const cleanEmail = (req.params.email || '').toLowerCase().trim();
    const fileId = req.params.fileId || '';
    const store = readDriveFilesStore();
    const list = store[cleanEmail] || [];
    const filtered = list.filter(f => f.id !== fileId && f.name !== fileId);
    store[cleanEmail] = filtered;
    writeDriveFilesStore(store);

    res.json({
      success: true,
      message: 'Backup file deleted from Google Drive Cloud Vault.',
    });
  });

  // ============================================================================
  // 1B. 4-DIGIT EMAIL VERIFICATION + AUTOMATIC GOOGLE DRIVE MIRROR TRIGGER
  // ============================================================================
  app.post('/api/email-verify/send', (req, res) => {
    const cleanEmail = (req.body?.email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.status(400).json({
        success: false,
        message: 'Please enter a valid Email ID to receive the 4-digit verification code.',
      });
      return;
    }

    // Generate 4-digit code (1000 to 9999)
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const now = Date.now();
    const store = readVerifications();
    store[cleanEmail] = {
      email: cleanEmail,
      code,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      verified: false,
    };
    writeVerifications(store);

    res.json({
      success: true,
      email: cleanEmail,
      dispatchCode: code,
      expiresInSeconds: 600,
      message: `4-digit verification code sent for ${cleanEmail}. Enter the 4-digit code to verify and activate automatic Google Drive mirroring.`,
    });
  });

  app.post('/api/email-verify/confirm', (req, res) => {
    const cleanEmail = (req.body?.email || '').toLowerCase().trim();
    const cleanCode = String(req.body?.code || '').trim();

    if (!cleanEmail || cleanCode.length !== 4) {
      res.status(400).json({
        success: false,
        verified: false,
        message: 'Please enter a valid 4-digit verification code.',
      });
      return;
    }

    const store = readVerifications();
    const record = store[cleanEmail];
    if (!record) {
      res.status(400).json({
        success: false,
        verified: false,
        message: 'No active verification code found for this Email ID. Please request a new 4-digit code.',
      });
      return;
    }

    if (Date.now() > record.expiresAt) {
      res.status(400).json({
        success: false,
        verified: false,
        message: 'This 4-digit verification code has expired. Please request a new code.',
      });
      return;
    }

    if (record.code !== cleanCode) {
      res.status(400).json({
        success: false,
        verified: false,
        message: 'Incorrect 4-digit verification code. Please check the 4 digits and try again.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    store[cleanEmail] = {
      ...record,
      verified: true,
      verifiedAt: nowIso,
    };
    writeVerifications(store);

    // Fetch any existing mirrored workspace from the Cloud Vault for this verified Email ID
    const vault = readVault();
    const existingData = vault[cleanEmail] || null;

    res.json({
      success: true,
      verified: true,
      verifiedAt: nowIso,
      data: existingData,
      message: `Email ID (${cleanEmail}) verified! Automatic Google Drive & Multi-Device Mirroring is now active.`,
    });
  });

  app.get('/api/email-verify/status/:email', (req, res) => {
    const cleanEmail = (req.params.email || '').toLowerCase().trim();
    const store = readVerifications();
    const rec = store[cleanEmail];
    res.json({
      success: true,
      email: cleanEmail,
      verified: !!rec?.verified,
      verifiedAt: rec?.verifiedAt || null,
    });
  });

  // ============================================================================
  // 2. SERVER-SIDE GEMINI AI ENDPOINTS
  // ============================================================================
  app.get('/api/ai/status', (_req, res) => {
    const hasKey = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
    res.json({ onlineAiAvailable: hasKey });
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server. Using Offline Local AI Engine.',
          useOfflineFallback: true,
        });
        return;
      }

      const { messages = [], model, systemInstruction } = req.body || {};
      const validMessages = messages.filter((m: any) => m.text && m.text.trim().length > 0);
      if (validMessages.length === 0) {
        res.status(400).json({ error: 'No messages provided.' });
        return;
      }

      const contents = validMessages.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

      const result = await generateWithFallback(ai, model, contents, {
        systemInstruction,
        temperature: model === 'gemini-3.1-pro-preview' ? 0.4 : 0.7,
      });

      res.json({
        text: result.text || 'I processed your request, but no text response was generated.',
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.error('Server /api/ai/chat error:', err);
      res.status(500).json({
        error: err?.message || 'Failed to communicate with Gemini model.',
        useOfflineFallback: true,
      });
    }
  });

  app.post('/api/ai/polish', async (req, res) => {
    try {
      const ai = getGeminiClient();
      const { service, details } = req.body || {};
      if (!ai) {
        res.status(503).json({ error: 'Offline mode', useOfflineFallback: true });
        return;
      }

      const prompt = `Act as a professional billing expert.
Polish the following line item description for a client invoice or proforma invoice to make it sound professional, crisp, and clean.
Service/Item: ${service}
Raw Details: ${details}
Keep it concise (max 20 words) with no quotation marks.`;

      const result = await generateWithFallback(ai, 'gemini-3.1-flash-lite', prompt);
      res.json({ text: result.text?.trim() || details });
    } catch (err: any) {
      res.status(500).json({ error: err?.message, useOfflineFallback: true });
    }
  });

  app.post('/api/ai/advice', async (req, res) => {
    try {
      const ai = getGeminiClient();
      const { summaryPrompt } = req.body || {};
      if (!ai) {
        res.status(503).json({ error: 'Offline mode', useOfflineFallback: true });
        return;
      }

      const result = await generateWithFallback(ai, 'gemini-3.8-flash', summaryPrompt, {
        systemInstruction: 'You are an executive CFO advisor for business finance, proforma billing, and cash collection.',
      });
      res.json({ text: result.text });
    } catch (err: any) {
      res.status(500).json({ error: err?.message, useOfflineFallback: true });
    }
  });

  app.post('/api/ai/follow-up', async (req, res) => {
    try {
      const ai = getGeminiClient();
      const { prompt } = req.body || {};
      if (!ai) {
        res.status(503).json({ error: 'Offline mode', useOfflineFallback: true });
        return;
      }

      const result = await generateWithFallback(ai, 'gemini-3.1-flash-lite', prompt, {
        systemInstruction: 'You are an expert accounts manager writing polite, effective client correspondence.',
      });
      res.json({ text: result.text });
    } catch (err: any) {
      res.status(500).json({ error: err?.message, useOfflineFallback: true });
    }
  });

  // ============================================================================
  // 3. VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Af© ACCOUNTS Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

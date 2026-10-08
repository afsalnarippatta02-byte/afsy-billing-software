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
      data: record,
      message: `Synced workspace for ${email} (${record.invoices?.length || 0} invoices, ${record.clients?.length || 0} clients).`,
    });
  });

  app.post('/api/sync', (req, res) => {
    const { email, payload, mode = 'merge' } = req.body || {};
    const cleanEmail = (email || payload?.userEmail || '').toLowerCase().trim();
    if (!cleanEmail || !payload) {
      res.status(400).json({ success: false, message: 'Valid email and payload are required.' });
      return;
    }

    const vault = readVault();
    const existing = vault[cleanEmail];
    const nowIso = new Date().toISOString();

    let finalPayload = {
      ...payload,
      userEmail: cleanEmail,
      exportedAt: nowIso,
      lastSyncTime: nowIso,
    };

    if (existing && mode === 'merge') {
      finalPayload = {
        ...existing,
        ...payload,
        userEmail: cleanEmail,
        exportedAt: nowIso,
        lastSyncTime: nowIso,
        invoices: mergeArraysById(existing.invoices, payload.invoices),
        clients: mergeArraysById(existing.clients, payload.clients),
        expenses: mergeArraysById(existing.expenses, payload.expenses),
        staffList: mergeArraysById(existing.staffList, payload.staffList),
        staffAdvances: mergeArraysById(existing.staffAdvances, payload.staffAdvances),
        staffAttendance: mergeArraysById(existing.staffAttendance, payload.staffAttendance),
        categories: Array.from(new Set([...(existing.categories || []), ...(payload.categories || [])])),
        settings: { ...(existing.settings || {}), ...(payload.settings || {}) },
        users: mergeArraysById(existing.users, payload.users),
      };
    }

    vault[cleanEmail] = finalPayload;
    writeVault(vault);

    res.json({
      success: true,
      timestamp: nowIso,
      data: finalPayload,
      message: `Synchronized all records across devices for ${cleanEmail}.`,
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

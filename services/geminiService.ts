import { GoogleGenAI } from "@google/genai";
import { ChatMessage, ChatRolePreset, GeminiModelType, Invoice, Expense, Client, CompanySettings, InvoiceStatus } from "../types";

const getClientAI = () => {
  const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY || '') as string;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

export const CHAT_ROLE_PRESETS: ChatRolePreset[] = [
  {
    id: 'financial_strategist',
    name: 'Agency CFO & Financial Strategist',
    description: 'Specializes in profit optimization, cash flow forecasts, overdue debt recovery, and agency margins.',
    iconName: 'TrendingUp',
    defaultModel: 'gemini-3.5-flash',
    systemInstruction: `You are the virtual Chief Financial Officer and Business Strategist for "Af© ACCOUNTS", a commercial business and billing management platform in Dubai, UAE.
Your role is to:
- Provide high-level financial analysis on billings, proforma invoices, client revenues, cash flow, and operating expenses.
- Recommend actionable pricing strategies, retainer models, and profit margin enhancements.
- Analyze overdue invoices and propose tactical recovery plans.
- Give crisp, mathematically sound, professional advice with clear bullet points, currency in AED (\u20C3), and structured breakdowns.`,
    suggestedPrompts: [
      'Analyze our current invoice cash flow and identify top revenue drivers',
      'What pricing adjustments should we make to increase agency margins by 15%?',
      'Draft a recovery strategy for overdue invoices older than 14 days',
      'Calculate our burn rate and recommend expense optimizations'
    ]
  },
  {
    id: 'complex_analyst',
    name: 'Deep Financial Forecaster & Risk Auditor',
    description: 'Designed for complex reasoning, multi-month projections, risk modeling, and complex contract terms.',
    iconName: 'BrainCircuit',
    defaultModel: 'gemini-3.1-pro-preview',
    systemInstruction: `You are a Senior Strategic Financial Risk Auditor and Quantitative Forecaster for high-growth media agencies.
You excel at:
- Complex multi-scenario modeling (best case, expected case, stress case).
- Advanced client lifetime value (LTV) and customer acquisition cost (CAC) calculations.
- Comprehensive tax planning under UAE Corporate Tax (9%) and 5% VAT.
- In-depth contract clause analysis and risk mitigation for multi-stage video & advertising shoots.
Provide deep, structured, thorough strategic analysis with rigorous rationale.`,
    suggestedPrompts: [
      'Run a 6-month revenue forecast and stress-test scenario based on current billing trends',
      'Analyze our risk exposure across client concentration and project types',
      'Provide a complete audit of our tax and VAT compliance posture for UAE billing'
    ]
  },
  {
    id: 'uae_billing_expert',
    name: 'UAE Tax, Proforma & Invoicing Specialist',
    description: 'Expert on UAE Federal Tax Authority (FTA) 5% VAT rules, Proforma Invoices, TRN formatting, and compliance.',
    iconName: 'FileCheck',
    defaultModel: 'gemini-3.5-flash',
    systemInstruction: `You are a UAE Certified Invoicing and Tax Compliance Consultant specializing in Dubai & UAE commercial regulations.
Your responsibilities:
- Guide the agency on UAE FTA VAT (5%) rules, Tax Invoice vs. Proforma Invoice requirements, TRN numbers, and standard payment terms (7 to 30 days).
- Advise on proper quotation vs. proforma invoice vs. tax invoice disclosures.
- Keep all monetary figures in UAE Dirhams (AED / \u20C3) with clear 5% VAT calculations.`,
    suggestedPrompts: [
      'When should we issue a Proforma Invoice vs a Tax Invoice in the UAE?',
      'What are the mandatory elements for a compliant UAE Tax Invoice?',
      'Draft standard UAE commercial payment terms and advance deposit clauses'
    ]
  },
  {
    id: 'creative_estimator',
    name: 'Creative Production Estimator',
    description: 'Assists with accurate line-item pricing, day rates, equipment rentals, licensing, and proforma breakdowns.',
    iconName: 'Sparkles',
    defaultModel: 'gemini-3.1-flash-lite',
    systemInstruction: `You are an experienced Executive Producer and Line Item Estimator for commercial media production, video shoots, product photography, and 3D motion design.
Your responsibilities:
- Quickly estimate market rates in the UAE (AED) for pre-production, filming crew, camera packages, lighting, editing, color grading, sound design, and talent.
- Suggest detailed line-item breakdowns for client quotations and proforma invoices.
- Keep responses fast, concise, realistic, and instantly usable in an invoice builder.`,
    suggestedPrompts: [
      'Break down line items and AED rates for a 2-day corporate brand video shoot',
      'Suggest pricing for 10 social media reels + monthly retainer package',
      'Estimate post-production rates for 4K color grading and sound mastering'
    ]
  },
  {
    id: 'client_negotiator',
    name: 'Client Relations & Payment Negotiator',
    description: 'Drafts persuasive, tactful emails for proforma approvals, quotations, overdue reminders, and fee negotiations.',
    iconName: 'MessageSquare',
    defaultModel: 'gemini-3.1-flash-lite',
    systemInstruction: `You are a master Client Communications Specialist and Negotiation Coach for creative agencies.
Your duties:
- Rapidly draft polite, firm, or urgent payment reminders for outstanding client balances.
- Write compelling quotation and proforma invoice pitch letters that highlight agency value and advance payment terms.
- Handle tricky fee negotiation pushbacks tactfully without discounting quality.
Keep emails concise, polished, warm, and ready to send.`,
    suggestedPrompts: [
      'Draft a polite 3-day reminder for an invoice due this week',
      'Write a professional email sending a Proforma Invoice requesting 50% advance',
      'Write a firm but professional final notice for an overdue payment'
    ]
  }
];

export interface ChatContextPayload {
  invoices?: Invoice[];
  expenses?: Expense[];
  clients?: Client[];
  settings?: CompanySettings;
}

export function calculateDocTotal(inv: Invoice): number {
  const sub = (inv.items || []).reduce((s, it) => s + ((it.quantity || 0) * (it.rate || 0)), 0);
  const disc = sub * ((inv.discount || 0) / 100);
  return (sub - disc) * (1 + (inv.taxRate || 0) / 100);
}

export function buildBusinessContextSummary(data: ChatContextPayload): string {
  const { invoices = [], expenses = [], clients = [], settings } = data;

  const finalizedInvoices = invoices.filter(
    i => i.status !== InvoiceStatus.QUOTATION && i.status !== InvoiceStatus.PROFORMA
  );
  const proformaInvoices = invoices.filter(i => i.status === InvoiceStatus.PROFORMA);
  const quotationInvoices = invoices.filter(i => i.status === InvoiceStatus.QUOTATION);

  const totalInvoiced = finalizedInvoices.reduce((sum, inv) => sum + calculateDocTotal(inv), 0);
  const paidInvoices = finalizedInvoices.filter(i => i.status === InvoiceStatus.PAID);
  const paidRevenue = paidInvoices.reduce((sum, inv) => sum + calculateDocTotal(inv), 0);
  const unpaidInvoices = finalizedInvoices.filter(i => i.status !== InvoiceStatus.PAID);
  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + calculateDocTotal(inv), 0);
  const overdueInvoices = finalizedInvoices.filter(i => i.status === InvoiceStatus.OVERDUE);
  const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + calculateDocTotal(inv), 0);
  const proformaTotal = proformaInvoices.reduce((sum, inv) => sum + calculateDocTotal(inv), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return `
[LIVE BUSINESS DATA CONTEXT]
- Business Name: ${settings?.name || 'Af© ACCOUNTS'}
- Default Currency: ${settings?.defaultCurrency || 'AED'}
- VAT Tax Rate: ${settings?.defaultTaxRate ?? 5}% | TRN: ${settings?.vatNumber || '100234567890003'}
- Total Registered Clients: ${clients.length} (${clients.map(c => c.company || c.name).slice(0, 8).join(', ') || 'None'})
- Finalized Tax Invoices: ${finalizedInvoices.length} | Total Billed: AED ${Math.round(totalInvoiced).toLocaleString()}
- Settled/Paid Revenue: AED ${Math.round(paidRevenue).toLocaleString()} (${paidInvoices.length} invoices)
- Pending/Unpaid Balance: AED ${Math.round(unpaidTotal).toLocaleString()} (${unpaidInvoices.length} invoices)
- Overdue Invoices: ${overdueInvoices.length} (Totaling AED ${Math.round(overdueTotal).toLocaleString()})
- Active Proforma Invoices: ${proformaInvoices.length} (Totaling AED ${Math.round(proformaTotal).toLocaleString()})
- Active Quotations: ${quotationInvoices.length}
- Total Recorded Expenses: AED ${Math.round(totalExpenses).toLocaleString()} (${expenses.length} records)
- Net Realized Profit (Paid - Expenses): AED ${Math.round(paidRevenue - totalExpenses).toLocaleString()}
`;
}

/**
 * Intelligent Offline Local Financial AI Engine
 * Works 100% offline on PC and Mobile with zero internet connection required,
 * computing real-time insights, emails, estimates, and answers from local app data.
 */
export function runLocalOfflineAIEngine(
  userQuery: string,
  contextPayload?: ChatContextPayload
): string {
  const q = userQuery.toLowerCase().trim();
  const invoices = contextPayload?.invoices || JSON.parse(localStorage.getItem('cf_invoices') || '[]');
  const expenses = contextPayload?.expenses || JSON.parse(localStorage.getItem('cf_expenses') || '[]');
  const clients = contextPayload?.clients || JSON.parse(localStorage.getItem('cf_clients') || '[]');
  const settings = contextPayload?.settings || JSON.parse(localStorage.getItem('cf_settings') || '{}');

  const currency = settings?.defaultCurrency || 'AED';
  const businessName = settings?.name || 'Af© ACCOUNTS';
  const clientMap = new Map<string, Client>(clients.map((c: Client) => [c.id, c]));

  const finalized = invoices.filter(
    (i: Invoice) => i.status !== InvoiceStatus.QUOTATION && i.status !== InvoiceStatus.PROFORMA
  );
  const proformas = invoices.filter((i: Invoice) => i.status === InvoiceStatus.PROFORMA);
  const quotations = invoices.filter((i: Invoice) => i.status === InvoiceStatus.QUOTATION);
  const paid = finalized.filter((i: Invoice) => i.status === InvoiceStatus.PAID);
  const unpaid = finalized.filter((i: Invoice) => i.status !== InvoiceStatus.PAID);
  const overdue = finalized.filter((i: Invoice) => i.status === InvoiceStatus.OVERDUE);

  const totalBilled = finalized.reduce((s: number, i: Invoice) => s + calculateDocTotal(i), 0);
  const paidTotal = paid.reduce((s: number, i: Invoice) => s + calculateDocTotal(i), 0);
  const unpaidTotal = unpaid.reduce((s: number, i: Invoice) => s + calculateDocTotal(i), 0);
  const overdueTotal = overdue.reduce((s: number, i: Invoice) => s + calculateDocTotal(i), 0);
  const proformaTotal = proformas.reduce((s: number, i: Invoice) => s + calculateDocTotal(i), 0);
  const expenseTotal = expenses.reduce((s: number, e: Expense) => s + (e.amount || 0), 0);
  const netProfit = paidTotal - expenseTotal;
  const profitMargin = paidTotal > 0 ? ((netProfit / paidTotal) * 100).toFixed(1) : '0.0';

  // Top clients by revenue
  const clientRev: Record<string, { name: string; billed: number; paid: number; unpaid: number }> = {};
  finalized.forEach((inv: Invoice) => {
    const c = clientMap.get(inv.clientId);
    const name = c?.company || c?.name || 'Direct Client';
    if (!clientRev[name]) clientRev[name] = { name, billed: 0, paid: 0, unpaid: 0 };
    const amt = calculateDocTotal(inv);
    clientRev[name].billed += amt;
    if (inv.status === InvoiceStatus.PAID) clientRev[name].paid += amt;
    else clientRev[name].unpaid += amt;
  });
  const topClients = Object.values(clientRev).sort((a, b) => b.billed - a.billed);

  // Expense breakdown by category
  const expByCat: Record<string, number> = {};
  expenses.forEach((e: Expense) => {
    const cat = e.category || 'General';
    expByCat[cat] = (expByCat[cat] || 0) + (e.amount || 0);
  });
  const topExpenseCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);

  // 1. Proforma Invoice queries
  if (q.includes('proforma') || q.includes('perfoma') || q.includes('advance')) {
    return `### 📄 Proforma Invoice & Advance Billing Analysis (Local AI Engine)

**Current Proforma Pipeline:**
- **Active Proforma Invoices:** ${proformas.length} documents
- **Total Proforma Value:** ${currency} ${Math.round(proformaTotal).toLocaleString()}
- **Active Quotations:** ${quotations.length} documents

**When to Use a Proforma Invoice vs. Tax Invoice in UAE:**
1. **Proforma Invoice (\`PI-\`):** Issued *before* full service delivery or to request an upfront deposit (e.g., 50% mobilization advance) without triggering immediate FTA VAT liability until payment/tax point occurs.
2. **Tax Invoice (\`INV-\`):** Official UAE FTA VAT-compliant document with TRN (${settings?.vatNumber || '100234567890003'}) issued upon completion or formal billing milestone.
3. **1-Click Conversion:** In **Invoices**, you can create a **Proforma Invoice** directly and convert it into a **Tax Invoice** with one click once approved or paid.

---
**Sample Proforma Cover Email:**
> **Subject:** Proforma Invoice for Upcoming Project — ${businessName}
> 
> Dear Valued Client,
> 
> Please find attached the Proforma Invoice for our upcoming engagement. Kindly initiate the advance mobilization payment via bank transfer to confirm production scheduling. Once settled, a formal UAE Tax Invoice will be issued.
> 
> Best regards,  
> **${businessName} Accounts Team**`;
  }

  // 2. Overdue / Reminders / Recovery / Email drafting
  if (q.includes('overdue') || q.includes('reminder') || q.includes('follow') || q.includes('email') || q.includes('notice') || q.includes('unpaid')) {
    const overdueList = (overdue.length > 0 ? overdue : unpaid).slice(0, 5).map((inv: Invoice) => {
      const c = clientMap.get(inv.clientId);
      return `- **#${inv.id}** (${c?.company || c?.name || 'Client'}): **${currency} ${Math.round(calculateDocTotal(inv)).toLocaleString()}** — Due: ${inv.dueDate} (${inv.status})`;
    }).join('\n');

    return `### 🔔 Receivables & Payment Recovery Plan (Local AI Engine)

**Outstanding & Overdue Summary:**
- **Total Unpaid Balance:** ${currency} ${Math.round(unpaidTotal).toLocaleString()} across ${unpaid.length} invoices
- **Strictly Overdue Invoices:** ${overdue.length} invoices totaling **${currency} ${Math.round(overdueTotal).toLocaleString()}**

${overdueList ? `**Priority Accounts to Follow Up:**\n${overdueList}\n` : '- All finalized invoices are currently settled!'}

**Recommended 3-Step Recovery Action:**
1. **Immediate Follow-up:** Send a polite statement summary generated from the **Statements** tab (filtered by *Unpaid*).
2. **Milestone Hold:** Pause delivery of final master files until pending stage balances are cleared.
3. **Ready-to-Send Payment Reminder Email:**

> **Subject:** Friendly Payment Reminder — Outstanding Balance with ${businessName}
>
> Dear Client Partner,
>
> We hope your week is going well. This is a courteous reminder regarding your outstanding invoice balance with **${businessName}**.
>
> Kindly share the remittance advice once the bank transfer has been processed so we can update your statement to **Paid**.
>
> Warm regards,  
> **${businessName} Finance Department**`;
  }

  // 3. Expense / Burn Rate / Cost Optimization
  if (q.includes('expense') || q.includes('burn') || q.includes('cost') || q.includes('spend')) {
    const catBreakdown = topExpenseCats.slice(0, 5).map(([cat, amt]) => {
      const pct = expenseTotal > 0 ? ((amt / expenseTotal) * 100).toFixed(1) : '0';
      return `- **${cat}:** ${currency} ${Math.round(amt).toLocaleString()} (${pct}% of spend)`;
    }).join('\n');

    return `### 💳 Expense & Burn Rate Audit (Local AI Engine)

**Operating Expense Overview:**
- **Total Recorded Expenses:** ${currency} ${Math.round(expenseTotal).toLocaleString()} (${expenses.length} entries)
- **Paid Revenue vs. Spend:** ${currency} ${Math.round(paidTotal).toLocaleString()} revenue vs. ${currency} ${Math.round(expenseTotal).toLocaleString()} expenses
- **Net Realized Profit:** **${currency} ${Math.round(netProfit).toLocaleString()}** (${profitMargin}% net margin)

**Top Expense Categories:**
${catBreakdown || '- No expenses recorded yet.'}

**Actionable Cost Optimizations:**
1. **Pass-Through Production Costs:** Ensure equipment rentals, location permits, and freelance crew expenses are itemized directly on client Proforma & Tax Invoices.
2. **Vendor Consolidation:** Negotiate monthly account rates with top recurring vendors in *${topExpenseCats[0]?.[0] || 'Production'}* to save 10–15%.`;
  }

  // 4. Pricing / Line item estimation / Shoot rates
  if (q.includes('rate') || q.includes('price') || q.includes('pricing') || q.includes('estimate') || q.includes('shoot') || q.includes('reel') || q.includes('margin')) {
    return `### 🎬 UAE Commercial Production & Billing Estimator (Local AI Engine)

**Recommended UAE Market Line-Item Rates (${currency}):**
- **Pre-Production & Creative Direction:** ${currency} 3,500 – 7,500 / project
- **Full-Day Cinema Camera & Lighting Crew (2-Day Shoot):** ${currency} 12,000 – 18,000
- **Social Media Reels Retainer (10 Reels / Month):** ${currency} 8,500 – 14,000 / month
- **4K Video Editing, Color Grading & Sound Mastering:** ${currency} 2,500 – 5,500 / deliverable
- **Poster / Key Visual Design Campaign:** ${currency} 1,800 – 4,200

**Margin Optimization Tips (Current Margin: ${profitMargin}%):**
1. **50% Proforma Mobilization:** Issue a **Proforma Invoice** for 50% upfront before booking crew or equipment.
2. **Itemize Revisions:** Include 2 standard revision rounds in the invoice notes and bill additional rounds at ${currency} 450/hour.
3. **5% UAE VAT:** Always ensure ${settings?.defaultTaxRate ?? 5}% VAT is applied on top of net creative fees.`;
  }

  // 5. Tax / VAT / UAE FTA Compliance
  if (q.includes('vat') || q.includes('tax') || q.includes('trn') || q.includes('uae') || q.includes('fta')) {
    const totalVat = finalized.reduce((sum: number, inv: Invoice) => {
      const sub = (inv.items || []).reduce((s, it) => s + (it.quantity * it.rate), 0);
      const disc = sub * ((inv.discount || 0) / 100);
      return sum + (sub - disc) * ((inv.taxRate || 0) / 100);
    }, 0);

    return `### 🏛️ UAE VAT & FTA Compliance Summary (Local AI Engine)

**Registered Tax Profile:**
- **Entity Name:** ${businessName}
- **TRN (Tax Registration Number):** ${settings?.vatNumber || '100234567890003'}
- **Default VAT Rate:** ${settings?.defaultTaxRate ?? 5}%
- **Estimated Output VAT on Finalized Invoices:** **${currency} ${Math.round(totalVat).toLocaleString()}**

**UAE FTA Tax Invoice Checklist:**
1. Prominent **"TAX INVOICE"** label (or **"PROFORMA INVOICE"** for preliminary deposit requests).
2. Supplier & Client legal names, addresses, and **TRN** numbers.
3. Sequential invoice number, issue date, line-item net amounts, 5% VAT rate & amount in **AED**, and gross total payable.`;
  }

  // Default comprehensive CFO executive summary
  const topClientLines = topClients.slice(0, 4).map(
    (c, idx) => `${idx + 1}. **${c.name}** — Billed: ${currency} ${Math.round(c.billed).toLocaleString()} (Paid: ${currency} ${Math.round(c.paid).toLocaleString()} | Unpaid: ${currency} ${Math.round(c.unpaid).toLocaleString()})`
  ).join('\n');

  return `### 📊 Executive CFO Financial Briefing — ${businessName} (Online + Offline Ready)

**1. Cash Flow & Revenue Position:**
- **Total Finalized Billing:** ${currency} ${Math.round(totalBilled).toLocaleString()} (${finalized.length} Tax Invoices)
- **Collected / Paid Revenue:** **${currency} ${Math.round(paidTotal).toLocaleString()}** (${paid.length} settled)
- **Outstanding Receivables:** **${currency} ${Math.round(unpaidTotal).toLocaleString()}** (${unpaid.length} pending, including ${overdue.length} overdue)
- **Active Proforma Invoices:** ${proformas.length} totaling **${currency} ${Math.round(proformaTotal).toLocaleString()}**

**2. Profitability & Expenses:**
- **Total Operating Expenses:** ${currency} ${Math.round(expenseTotal).toLocaleString()} across ${expenses.length} records
- **Net Realized Cash Profit:** **${currency} ${Math.round(netProfit).toLocaleString()}** (${profitMargin}% net margin)

**3. Top Revenue Clients:**
${topClientLines || '- No client billing records yet.'}

**4. Strategic CFO Recommendations:**
- **Convert Proformas & Quotations:** Follow up on your ${proformas.length} Proforma Invoices and ${quotations.length} Quotations to lock in upcoming revenue.
- **Accelerate Collections:** Use the **Statements** tab with *Date-wise / Month-wise* and *Unpaid* filters to send clean account statements to clients with pending balances.`;
}

function polishLocalDescription(service: string, details: string): string {
  const cleanService = (service || 'Professional Service').trim();
  const cleanDetails = (details || '').trim();
  if (!cleanDetails) {
    return `Comprehensive ${cleanService.toLowerCase()} deliverables, production execution, and quality assurance.`;
  }
  const capitalized = cleanDetails.charAt(0).toUpperCase() + cleanDetails.slice(1);
  if (capitalized.length > 90) return capitalized;
  return `${cleanService}: ${capitalized.replace(/\.$/, '')} — full commercial production and delivery.`;
}

export const geminiService = {
  /**
   * Multi-turn chat conversation sender with Server Proxy + Direct SDK + Offline Local Engine
   */
  async sendChatMessage(params: {
    messages: ChatMessage[];
    model: GeminiModelType;
    systemInstruction?: string;
    contextPayload?: ChatContextPayload;
  }): Promise<{ text: string; modelUsed: GeminiModelType }> {
    const { messages, model, systemInstruction, contextPayload } = params;

    const validMessages = messages.filter(m => m.text && m.text.trim().length > 0);
    if (validMessages.length === 0) {
      throw new Error('No messages provided.');
    }

    const lastUserMessage = [...validMessages].reverse().find(m => m.role === 'user')?.text || validMessages[validMessages.length - 1].text;

    // If explicitly using Local Offline AI or browser is offline
    if (model === 'local-offline-ai' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return {
        text: runLocalOfflineAIEngine(lastUserMessage, contextPayload),
        modelUsed: 'local-offline-ai',
      };
    }

    let fullSystemInstruction = systemInstruction || CHAT_ROLE_PRESETS[0].systemInstruction;
    if (contextPayload) {
      const summary = buildBusinessContextSummary(contextPayload);
      fullSystemInstruction += `\n\n${summary}\nUse this live business data to provide hyper-accurate and context-aware responses when requested by the user.`;
    }

    // 1. Try Server-Side Gemini Endpoint first (/api/ai/chat)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: validMessages,
          model,
          systemInstruction: fullSystemInstruction,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          return {
            text: data.text,
            modelUsed: (data.modelUsed as GeminiModelType) || model,
          };
        }
      }
    } catch (serverErr) {
      console.warn('Server AI endpoint unreachable, trying client SDK or local AI engine:', serverErr);
    }

    // 2. Try Direct Client SDK if API key is injected in client env
    const clientAi = getClientAI();
    if (clientAi) {
      const contents = validMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));
      const targetModel = model === 'gemini-3.5-flash' ? 'gemini-3.8-flash' : model;
      try {
        const response = await clientAi.models.generateContent({
          model: targetModel,
          contents,
          config: {
            systemInstruction: fullSystemInstruction,
            temperature: model === 'gemini-3.1-pro-preview' ? 0.4 : 0.7,
          },
        });
        if (response.text) {
          return {
            text: response.text,
            modelUsed: model,
          };
        }
      } catch (sdkErr) {
        console.warn('Client Gemini SDK fallback to Local Offline AI Engine:', sdkErr);
      }
    }

    // 3. Seamless Fallback to Built-in Local Offline AI Engine (never fails!)
    return {
      text: runLocalOfflineAIEngine(lastUserMessage, contextPayload),
      modelUsed: 'local-offline-ai',
    };
  },

  async polishInvoiceDescription(service: string, details: string): Promise<string> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return polishLocalDescription(service, details);
    }

    try {
      const res = await fetch('/api/ai/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, details }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) return data.text;
      }
    } catch {
      // ignore and fall back
    }

    try {
      const ai = getClientAI();
      if (ai) {
        const prompt = `Act as a professional billing expert. 
Polish the following line item description for a client invoice to make it sound professional, crisp, and clean.
Service/Item: ${service}
Raw Details: ${details}
Keep it concise (max 20 words) with no quotation marks.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
        });
        if (response.text) return response.text.trim();
      }
    } catch {
      // ignore and use local polish
    }

    return polishLocalDescription(service, details);
  },

  async getFinancialAdvice(invoices: Invoice[]): Promise<string> {
    const summaryPrompt = `Analyze the following invoice dataset for a UAE commercial business and provide 4 concise, high-impact actionable financial insights to improve cash collection, proforma conversions, and margins.
Invoices Summary: ${JSON.stringify(
      invoices.map(i => ({
        id: i.id,
        status: i.status,
        total: calculateDocTotal(i),
        date: i.date,
        dueDate: i.dueDate,
      }))
    )}
Return 4 bullet points formatted with clear actionable advice in AED.`;

    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch('/api/ai/advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summaryPrompt }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) return data.text;
        }
      } catch {
        // fallback below
      }
    }

    return runLocalOfflineAIEngine('executive financial summary and advice', { invoices });
  },

  async draftFollowUpEmail(clientName: string, amount: number, dueDate: string): Promise<string> {
    const prompt = `Write a polite, professional, and clear payment follow-up email for an invoice.
Client: ${clientName}
Amount Due: AED ${amount.toLocaleString()}
Due Date: ${dueDate}
Business Name: Af© ACCOUNTS
Include bank transfer reminder and standard polite closing.`;

    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const res = await fetch('/api/ai/follow-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) return data.text;
        }
      } catch {
        // fallback below
      }
    }

    return `Subject: Friendly Payment Reminder — Invoice Due (${dueDate}) | Af© ACCOUNTS\n\nDear ${clientName},\n\nWe hope this message finds you well.\n\nThis is a courteous reminder regarding the outstanding invoice balance of AED ${amount.toLocaleString()}, which was due on ${dueDate}.\n\nKindly share the bank transfer confirmation once processed so we may update your statement of account.\n\nWarm regards,\nAf© ACCOUNTS Finance Team`;
  },
};

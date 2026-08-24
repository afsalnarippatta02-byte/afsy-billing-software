
import { GoogleGenAI } from "@google/genai";
import { ChatMessage, ChatRolePreset, GeminiModelType, Invoice, Expense, Client, CompanySettings } from "../types";

// Always use named parameter for apiKey and assume it is available in process.env.API_KEY or process.env.GEMINI_API_KEY
const getAI = () => {
  const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY || '') as string;
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
- Provide high-level financial analysis on billings, client revenues, cash flow, and operating expenses.
- Recommend actionable pricing strategies, retainer models, and profit margin enhancements.
- Analyze overdue invoices and propose tactical recovery plans.
- Give crisp, mathematically sound, professional advice with clear bullet points, currency in AED (د.إ), and structured breakdowns.`,
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
    name: 'UAE Tax & Invoicing Specialist',
    description: 'Expert on UAE Federal Tax Authority (FTA) 5% VAT rules, TRN formatting, AED standard billing, and compliance.',
    iconName: 'FileCheck',
    defaultModel: 'gemini-3.5-flash',
    systemInstruction: `You are a UAE Certified Invoicing and Tax Compliance Consultant specializing in Dubai & UAE commercial regulations.
Your responsibilities:
- Guide the agency on UAE FTA VAT (5%) rules, Tax Invoice requirements, TRN numbers, and standard payment terms (7 to 30 days).
- Advise on proper quotation vs. tax invoice disclosures and reverse charge mechanisms where applicable.
- Keep all monetary figures in UAE Dirhams (AED / د.إ) with clear 5% VAT calculations.`,
    suggestedPrompts: [
      'What are the mandatory elements for a compliant UAE Tax Invoice?',
      'How should we structure VAT on a multi-stage video shoot with foreign talent?',
      'Draft standard UAE commercial payment terms and late payment clauses'
    ]
  },
  {
    id: 'creative_estimator',
    name: 'Creative Production Estimator',
    description: 'Assists with accurate line-item pricing, day rates, equipment rentals, licensing, and quotation breakdowns.',
    iconName: 'Sparkles',
    defaultModel: 'gemini-3.1-flash-lite',
    systemInstruction: `You are an experienced Executive Producer and Line Item Estimator for commercial media production, video shoots, product photography, and 3D motion design.
Your responsibilities:
- Quickly estimate market rates in the UAE (AED) for pre-production, filming crew, camera packages, lighting, editing, color grading, sound design, and talent.
- Suggest detailed line-item breakdowns for client quotations.
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
    description: 'Drafts persuasive, tactful emails for quotations, overdue reminders, and fee negotiations.',
    iconName: 'MessageSquare',
    defaultModel: 'gemini-3.1-flash-lite',
    systemInstruction: `You are a master Client Communications Specialist and Negotiation Coach for creative agencies.
Your duties:
- Rapidly draft polite, firm, or urgent payment reminders for outstanding client balances.
- Write compelling quotation pitch letters that highlight agency value and premium craft.
- Handle tricky fee negotiation pushbacks tactfully without discounting quality.
Keep emails concise, polished, warm, and ready to send.`,
    suggestedPrompts: [
      'Draft a polite 3-day reminder for an invoice due this week',
      'Write a firm but professional final notice for an overdue payment',
      'Write a proposal cover email explaining why our media rates reflect premium ROI'
    ]
  }
];

export interface ChatContextPayload {
  invoices?: Invoice[];
  expenses?: Expense[];
  clients?: Client[];
  settings?: CompanySettings;
}

export function buildBusinessContextSummary(data: ChatContextPayload): string {
  const { invoices = [], expenses = [], clients = [], settings } = data;

  const totalInvoiced = invoices.reduce((sum, inv) => {
    const sub = inv.items.reduce((s, it) => s + (it.quantity * it.rate), 0);
    const disc = sub * (inv.discount / 100);
    return sum + (sub - disc) * (1 + inv.taxRate / 100);
  }, 0);

  const paidInvoices = invoices.filter(i => i.status === 'Paid');
  const paidRevenue = paidInvoices.reduce((sum, inv) => {
    const sub = inv.items.reduce((s, it) => s + (it.quantity * it.rate), 0);
    const disc = sub * (inv.discount / 100);
    return sum + (sub - disc) * (1 + inv.taxRate / 100);
  }, 0);

  const overdueInvoices = invoices.filter(i => i.status === 'Overdue');
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return `
[LIVE BUSINESS DATA CONTEXT]
- Business Name: ${settings?.name || 'Af© ACCOUNTS'}
- Default Currency: ${settings?.defaultCurrency || 'AED'}
- VAT Tax Rate: ${settings?.defaultTaxRate ?? 5}% | TRN: ${settings?.vatNumber || '100234567890003'}
- Total Registered Clients: ${clients.length} (${clients.map(c => c.company).slice(0, 5).join(', ') || 'None'})
- Total Invoices: ${invoices.length} | Paid Revenue: AED ${Math.round(paidRevenue).toLocaleString()}
- Total Invoiced Volume: AED ${Math.round(totalInvoiced).toLocaleString()}
- Total Recorded Expenses: AED ${Math.round(totalExpenses).toLocaleString()}
- Net Recorded Profit: AED ${Math.round(paidRevenue - totalExpenses).toLocaleString()}
- Overdue Invoices Count: ${overdueInvoices.length} (Totaling approx. AED ${Math.round(overdueInvoices.reduce((s, inv) => s + inv.items.reduce((x, y) => x + (y.quantity * y.rate), 0), 0)).toLocaleString()})
`;
}

export const geminiService = {
  /**
   * Multi-turn chat conversation sender
   */
  async sendChatMessage(params: {
    messages: ChatMessage[];
    model: GeminiModelType;
    systemInstruction?: string;
    contextPayload?: ChatContextPayload;
  }): Promise<{ text: string; modelUsed: GeminiModelType }> {
    const ai = getAI();
    const { messages, model, systemInstruction, contextPayload } = params;

    // Filter out error messages or empty texts
    const validMessages = messages.filter(m => m.text && m.text.trim().length > 0);
    if (validMessages.length === 0) {
      throw new Error('No messages provided.');
    }

    // Build system instruction with optional business context
    let fullSystemInstruction = systemInstruction || CHAT_ROLE_PRESETS[0].systemInstruction;
    if (contextPayload) {
      const summary = buildBusinessContextSummary(contextPayload);
      fullSystemInstruction += `\n\n${summary}\nUse this live business data to provide hyper-accurate and context-aware responses when requested by the user.`;
    }

    // Format contents array for multi-turn chat
    const contents = validMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
          systemInstruction: fullSystemInstruction,
          temperature: model === 'gemini-3.1-pro-preview' ? 0.4 : 0.7,
        },
      });

      const replyText = response.text || "I processed your request, but no text response was generated.";
      return {
        text: replyText,
        modelUsed: model,
      };
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      // If error occurs, format helpful message
      throw new Error(err?.message || 'Failed to communicate with Gemini model.');
    }
  },

  async polishInvoiceDescription(service: string, details: string) {
    try {
      const ai = getAI();
      const prompt = `Act as a professional billing expert. 
Polish the following line item description for a client invoice to make it sound professional, crisp, and clean.
Service/Item: ${service}
Raw Details: ${details}
Keep it concise (max 20 words) with no quotation marks.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });
      return response.text?.trim() || details;
    } catch (e) {
      console.warn('Polishing fallback:', e);
      return details;
    }
  },

  async getFinancialAdvice(invoices: Invoice[]) {
    try {
      const ai = getAI();
      const prompt = `Analyze the following invoice dataset for a UAE commercial business and provide 4 concise, high-impact actionable financial insights to improve cash collection and margins.
Invoices Summary: ${JSON.stringify(invoices.map(i => ({ id: i.id, status: i.status, total: i.items.reduce((s, it) => s + (it.quantity * it.rate), 0), date: i.date, dueDate: i.dueDate })))}
Return 4 bullet points formatted with clear actionable advice in AED.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are an executive CFO advisor for business finance and billing.',
        }
      });
      return response.text || "No insights available at this time.";
    } catch (e) {
      console.error(e);
      return "Ensure overdue invoices are followed up within 7 days.\nOffer a 2% early payment discount for bank transfers.\nSet up milestone-based invoicing for large project contracts.";
    }
  },

  async draftFollowUpEmail(clientName: string, amount: number, dueDate: string) {
    try {
      const ai = getAI();
      const prompt = `Write a polite, professional, and clear payment follow-up email for an invoice.
Client: ${clientName}
Amount Due: AED ${amount.toLocaleString()}
Due Date: ${dueDate}
Business Name: Af© ACCOUNTS
Include bank transfer reminder and standard polite closing.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction: 'You are an expert accounts manager writing client correspondence.',
        }
      });
      return response.text || "";
    } catch (e) {
      console.error(e);
      return `Dear ${clientName},\n\nWe hope this email finds you well.\n\nThis is a friendly reminder regarding invoice payment of AED ${amount.toLocaleString()} which was due on ${dueDate}.\n\nPlease let us know once the transfer has been initiated.\n\nBest regards,\nAf© ACCOUNTS Team`;
    }
  }
};

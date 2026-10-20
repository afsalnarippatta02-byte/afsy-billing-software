import { ProjectType, Client, Invoice, InvoiceStatus, CompanySettings, Expense, ExpenseCategory, ReminderTemplate } from './types';
import { AF_LOGO_SVG_DATA_URI } from './components/AfLogo';

export interface CountryInfo {
  code: string;
  name: string;
  defaultCurrency: string;
  currencySymbol: string;
  defaultTaxRate: number;
  taxName: string;
  flag: string;
}

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { code: 'AE', name: 'United Arab Emirates (UAE)', defaultCurrency: 'AED', currencySymbol: '\u20C3', defaultTaxRate: 5, taxName: 'VAT', flag: '🇦🇪' },
  { code: 'IN', name: 'India', defaultCurrency: 'INR', currencySymbol: '₹', defaultTaxRate: 18, taxName: 'GST', flag: '🇮🇳' },
  { code: 'US', name: 'United States (America)', defaultCurrency: 'USD', currencySymbol: '$', defaultTaxRate: 0, taxName: 'Sales Tax', flag: '🇺🇸' },
  { code: 'SA', name: 'Saudi Arabia', defaultCurrency: 'SAR', currencySymbol: 'ر.س', defaultTaxRate: 15, taxName: 'VAT', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', defaultCurrency: 'QAR', currencySymbol: 'ر.ق', defaultTaxRate: 0, taxName: 'Tax', flag: '🇶🇦' },
  { code: 'OM', name: 'Oman', defaultCurrency: 'OMR', currencySymbol: 'ر.ع', defaultTaxRate: 5, taxName: 'VAT', flag: '🇴🇲' },
  { code: 'KW', name: 'Kuwait', defaultCurrency: 'KWD', currencySymbol: 'د.ك', defaultTaxRate: 0, taxName: 'Tax', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain', defaultCurrency: 'BHD', currencySymbol: 'د.ب', defaultTaxRate: 10, taxName: 'VAT', flag: '🇧🇭' },
  { code: 'GB', name: 'United Kingdom (UK)', defaultCurrency: 'GBP', currencySymbol: '£', defaultTaxRate: 20, taxName: 'VAT', flag: '🇬🇧' },
  { code: 'EU', name: 'European Union (EU)', defaultCurrency: 'EUR', currencySymbol: '€', defaultTaxRate: 21, taxName: 'VAT', flag: '🇪🇺' },
  { code: 'CA', name: 'Canada', defaultCurrency: 'CAD', currencySymbol: 'CA$', defaultTaxRate: 5, taxName: 'GST/HST', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', defaultCurrency: 'AUD', currencySymbol: 'A$', defaultTaxRate: 10, taxName: 'GST', flag: '🇦🇺' },
  { code: 'SG', name: 'Singapore', defaultCurrency: 'SGD', currencySymbol: 'S$', defaultTaxRate: 9, taxName: 'GST', flag: '🇸🇬' },
  { code: 'MY', name: 'Malaysia', defaultCurrency: 'MYR', currencySymbol: 'RM', defaultTaxRate: 6, taxName: 'SST', flag: '🇲🇾' },
  { code: 'PK', name: 'Pakistan', defaultCurrency: 'PKR', currencySymbol: '₨', defaultTaxRate: 17, taxName: 'GST', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', defaultCurrency: 'BDT', currencySymbol: '৳', defaultTaxRate: 15, taxName: 'VAT', flag: '🇧🇩' },
  { code: 'PH', name: 'Philippines', defaultCurrency: 'PHP', currencySymbol: '₱', defaultTaxRate: 12, taxName: 'VAT', flag: '🇵🇭' },
  { code: 'JP', name: 'Japan', defaultCurrency: 'JPY', currencySymbol: '¥', defaultTaxRate: 10, taxName: 'Consumption Tax', flag: '🇯🇵' },
  { code: 'CN', name: 'China', defaultCurrency: 'CNY', currencySymbol: '¥', defaultTaxRate: 13, taxName: 'VAT', flag: '🇨🇳' },
  { code: 'GLOBAL', name: 'Other / International', defaultCurrency: 'USD', currencySymbol: '$', defaultTaxRate: 0, taxName: 'Tax', flag: '🌐' }
];

export const DEFAULT_REMINDER_TEMPLATES: ReminderTemplate[] = [
  {
    id: 'gentle',
    name: 'Upcoming / Due Today Notice',
    stageLabel: 'On or Before Due Date',
    daysThreshold: 0,
    tone: 'gentle',
    enabled: true,
    subject: 'Upcoming Payment Reminder: Invoice #{{invoice_id}} from {{company_name}}',
    body: `Dear {{customer_name}},

This is a courteous reminder that Invoice #{{invoice_id}} for {{currency}} {{total_amount}} is scheduled for payment on {{due_date}}.

Please find our payment remittance details below:
{{bank_details}}

If payment has already been initiated, please disregard this reminder. Thank you for your business and partnership!

Warm regards,
{{company_name}} Accounts Team
{{company_phone}} | {{company_email}}`
  },
  {
    id: 'first_overdue',
    name: 'First Overdue Notice',
    stageLabel: '3 to 7 Days Overdue',
    daysThreshold: 3,
    tone: 'polite',
    enabled: true,
    subject: 'Friendly Overdue Notice: Invoice #{{invoice_id}} ({{days_overdue}} Days Past Due)',
    body: `Dear {{customer_name}},

We hope you are having a productive week.

According to our accounts ledger, Invoice #{{invoice_id}} was due on {{due_date}} and is currently {{days_overdue}} days overdue.

Outstanding Balance: {{currency}} {{total_amount}}

Please arrange for payment at your earliest convenience using the details below:
{{bank_details}}

If you have already processed this remittance or require another copy of the invoice, kindly reply to this email with the bank transfer advice.

Sincerely,
Finance & Accounts Department
{{company_name}}`
  },
  {
    id: 'urgent',
    name: 'Second Follow-up (Urgent)',
    stageLabel: '14 Days Overdue',
    daysThreshold: 14,
    tone: 'urgent',
    enabled: true,
    subject: 'URGENT: Overdue Account Follow-up - Invoice #{{invoice_id}}',
    body: `Dear {{customer_name}},

This is an urgent follow-up regarding unpaid Invoice #{{invoice_id}}, which is now {{days_overdue}} days past its due date of {{due_date}}.

Total Amount Overdue: {{currency}} {{total_amount}}

To keep your commercial credit terms in good standing and ensure uninterrupted service, please settle this outstanding balance immediately.

Bank Remittance Details:
{{bank_details}}

Please reply to this email immediately with your transfer confirmation.

Thank you for your prompt cooperation,
Accounts Receivable
{{company_name}}
{{company_phone}}`
  },
  {
    id: 'final_demand',
    name: 'Final Demand Notice',
    stageLabel: '30+ Days Overdue (Final)',
    daysThreshold: 30,
    tone: 'legal',
    enabled: true,
    subject: 'FINAL DEMAND FOR PAYMENT: Invoice #{{invoice_id}} - Immediate Action Required',
    body: `Dear {{customer_name}},

Despite our previous reminders, our accounting records indicate that Invoice #{{invoice_id}} remains unpaid and is now {{days_overdue}} days past due.

Final Amount Payable: {{currency}} {{total_amount}}

Please be advised that full settlement is required within 48 business hours to avoid commercial service suspension and escalation under UAE Federal Commercial regulations.

Direct Remittance Details:
{{bank_details}}

Please forward bank transfer proof to {{company_email}} immediately upon completion.

Management & Legal Collections,
{{company_name}}`
  }
];

export const INITIAL_SETTINGS: CompanySettings = {
  name: 'AFSY BILLING',
  email: '',
  phone: '',
  address: '',
  logoUrl: '',
  country: 'AE',
  countryName: 'United Arab Emirates (UAE)',
  defaultCurrency: 'AED',
  currency: 'AED',
  currencySymbol: '\u20C3',
  defaultTaxRate: 5,
  taxRate: 5,
  taxName: 'VAT',
  vatNumber: '100293848100003',
  trnNumber: '100293848100003',
  bankName: '',
  bankAccount: '',
  invoiceFooterNote: 'Thank you for your business.',
  headerStatusMode: 'symbol',
  aiFloatingEnabled: true,
  aiNavEnabled: true,
  aiButtonStyle: 'compact',
  aiPositionPreset: 'bottom-right',
  aiCustomPosition: null,
  aiDraggable: true,
  aiThemeColor: 'indigo',
  aiDefaultMode: 'hybrid',
  invoicePrefix: 'INV-',
  invoiceTemplate: 'uae_standard_simple',
  invoiceAccentColor: '#0f172a',
  invoiceHeaderLayout: 'split',
  invoiceTableStyle: 'bordered',
  invoiceFontStyle: 'sans',
  invoiceCustomTitle: 'TAX INVOICE',
  invoiceSubtitle: 'Commercial Goods & Services Supply',
  invoiceDefaultPaymentTerms: 'none',
  invoiceShowPaymentTerms: false,
  invoiceShowSignatures: true,
  invoiceShowCategoryCol: false,
  invoiceShowBankDetails: true,
  invoiceShowRemarks: true,
  invoiceShowAmountInWords: true,
  invoiceShowFooterNote: true,
  invoiceShowDueDate: true,
  invoiceCompactMode: false,
  statementTemplate: 'standard_audit',
  statementAccentColor: '#0f172a',
  statementHeaderLayout: 'split',
  statementTableStyle: 'striped',
  statementCustomTitle: 'STATEMENT OF ACCOUNT',
  statementShowSummaryBox: true,
  statementShowRemittance: true,
  statementCompactMode: false,
  statementDefaultView: 'date_wise',
  statementDefaultOrientation: 'portrait',
  autoRemindersEnabled: true,
  reminderFrequency: 'weekly',
  reminderCustomIntervalDays: 7,
  reminderSendBeforeDue: true,
  reminderBeforeDueDays: 3,
  reminderSendOnDueDate: true,
  reminderMaxCountPerInvoice: 4,
  reminderMinBalanceThreshold: 5,
  reminderSenderName: 'AFSY BILLING Accounts',
  reminderReplyToEmail: '',
  reminderCcAccountsEmail: '',
  reminderTemplates: DEFAULT_REMINDER_TEMPLATES,
  reminderLogs: []
};

export interface DocumentTemplatePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  accentColor: string;
  headerLayout: 'split' | 'banner' | 'centered' | 'reversed';
  tableStyle: 'striped' | 'bordered' | 'minimal';
  fontStyle?: 'sans' | 'serif' | 'mono';
  compactMode?: boolean;
}

export const INVOICE_TEMPLATE_PRESETS: DocumentTemplatePreset[] = [
  {
    id: 'personal_neat_custom',
    name: 'Personal Neat Custom Invoice',
    category: 'Personal Business • Fully Customizable',
    description: 'Neat, personalized business invoice format. Customize all sections, colors, fonts, and headers to match your business.',
    accentColor: '#0f172a',
    headerLayout: 'split',
    tableStyle: 'bordered',
    fontStyle: 'sans',
    compactMode: false
  },
  {
    id: 'uae_standard_simple',
    name: 'UAE Standard Tax Invoice (Simple)',
    category: 'Default • All Businesses',
    description: 'Clean, FTA-compliant UAE standard layout with TRN, SL#, Item Description, Qty, Unit Price, 5% VAT & Total.',
    accentColor: '#0f172a',
    headerLayout: 'split',
    tableStyle: 'bordered',
    fontStyle: 'sans',
    compactMode: false
  },
  {
    id: 'executive_indigo',
    name: 'Executive Corporate',
    category: 'UAE Corporate',
    description: 'Clean top accent bar, left corporate branding, structured line items, and clear VAT breakdown.',
    accentColor: '#4f46e5',
    headerLayout: 'split',
    tableStyle: 'striped',
    fontStyle: 'sans',
    compactMode: false
  },
  {
    id: 'emirates_gold',
    name: 'Emirates Royal Gold',
    category: 'Prestige Gold',
    description: 'Warm gold header rules, formal TRN tax box, classic typography, and gold-accented table.',
    accentColor: '#b45309',
    headerLayout: 'split',
    tableStyle: 'bordered',
    fontStyle: 'serif',
    compactMode: false
  },
  {
    id: 'corporate_navy',
    name: 'Dark Navy Banner',
    category: 'Enterprise & Trading',
    description: 'Full-width deep navy header banner with white typography and crisp commercial grid lines.',
    accentColor: '#0f172a',
    headerLayout: 'banner',
    tableStyle: 'bordered',
    fontStyle: 'sans',
    compactMode: false
  },
  {
    id: 'dubai_minimal',
    name: 'Minimalist Clean',
    category: 'Simple & Modern',
    description: 'Ultra-clean monochrome layout with hairline dividers, unboxed metadata, and airy spacing.',
    accentColor: '#1e293b',
    headerLayout: 'split',
    tableStyle: 'minimal',
    fontStyle: 'sans',
    compactMode: false
  },
  {
    id: 'modern_emerald',
    name: 'Modern Emerald Split',
    category: 'Commercial Green',
    description: 'Contemporary emerald header accents, clean customer card, and highlighted settlement totals.',
    accentColor: '#047857',
    headerLayout: 'reversed',
    tableStyle: 'striped',
    fontStyle: 'sans',
    compactMode: false
  },
  {
    id: 'classic_ledger',
    name: 'Traditional Framed Ledger',
    category: 'Accounting Grid',
    description: 'Centered formal letterhead with full 4-sided accounting table borders and classic audit layout.',
    accentColor: '#334155',
    headerLayout: 'centered',
    tableStyle: 'bordered',
    fontStyle: 'serif',
    compactMode: false
  },
  {
    id: 'compact_commercial',
    name: 'Compact Wholesale & Retail',
    category: 'High Density',
    description: 'Space-optimized commercial tax layout engineered to fit 20+ items cleanly on one A4 page.',
    accentColor: '#0f766e',
    headerLayout: 'split',
    tableStyle: 'bordered',
    fontStyle: 'mono',
    compactMode: true
  }
];

export const STATEMENT_TEMPLATE_PRESETS: DocumentTemplatePreset[] = [
  {
    id: 'standard_audit',
    name: 'Standard Accounting Audit',
    category: 'Official Ledger',
    description: 'Classic black corporate rule, side-by-side Account Holder & Summary box, and dark ledger header.',
    accentColor: '#0f172a',
    headerLayout: 'split',
    tableStyle: 'striped',
    compactMode: false
  },
  {
    id: 'executive_navy',
    name: 'Executive Navy Banner',
    category: 'Corporate Banner',
    description: 'Full-width deep indigo-navy header banner with white typography and structured summary cards.',
    accentColor: '#1e3a8a',
    headerLayout: 'banner',
    tableStyle: 'striped',
    compactMode: false
  },
  {
    id: 'emirates_gold_ledger',
    name: 'UAE Royal Gold Statement',
    category: 'Prestige Gold',
    description: 'Warm gold-accented statement of account with formal bordered ledger cells and executive summary.',
    accentColor: '#b45309',
    headerLayout: 'split',
    tableStyle: 'bordered',
    compactMode: false
  },
  {
    id: 'minimal_clean',
    name: 'Minimalist Unboxed Ledger',
    category: 'Clean Editorial',
    description: 'Modern unboxed typography with subtle horizontal hairlines and distraction-free financial figures.',
    accentColor: '#334155',
    headerLayout: 'split',
    tableStyle: 'minimal',
    compactMode: false
  },
  {
    id: 'emerald_financial',
    name: 'Emerald Banking Statement',
    category: 'Banking Style',
    description: 'Financial institution style with emerald header band, clear debit/credit columns, and balance box.',
    accentColor: '#047857',
    headerLayout: 'banner',
    tableStyle: 'striped',
    compactMode: false
  },
  {
    id: 'classic_boxed',
    name: 'Classic Boxed Audit Grid',
    category: 'Full Grid',
    description: 'Centered corporate header with complete vertical & horizontal grid lines for formal audit review.',
    accentColor: '#1e293b',
    headerLayout: 'centered',
    tableStyle: 'bordered',
    compactMode: false
  },
  {
    id: 'corporate_teal',
    name: 'Corporate Teal Ledger',
    category: 'Modern Reversed',
    description: 'Right-aligned brand emblem with ocean-teal table headers and clean alternating transaction rows.',
    accentColor: '#0f766e',
    headerLayout: 'reversed',
    tableStyle: 'striped',
    compactMode: false
  },
  {
    id: 'compact_statement',
    name: 'High-Density Compact Ledger',
    category: 'Multi-Row',
    description: 'Tight row spacing and compact tabular numerals to fit maximum monthly invoices per A4 sheet.',
    accentColor: '#4f46e5',
    headerLayout: 'split',
    tableStyle: 'bordered',
    compactMode: true
  }
];

export const CURRENCIES = [
  { code: 'AED', symbol: '\u20C3', name: 'UAE Dirham / DH (AED - \u20C3)' },
  { code: 'USD', symbol: '$', name: 'US Dollar (USD - $)' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR - ₹)' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal (SAR - ر.س)' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal (QAR - ر.ق)' },
  { code: 'OMR', symbol: 'ر.ع', name: 'Omani Rial (OMR - ر.ع)' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar (KWD - د.ك)' },
  { code: 'BHD', symbol: 'د.ب', name: 'Bahraini Dinar (BHD - د.ب)' },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR - €)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (GBP - £)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CAD - CA$)' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (AUD - A$)' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (SGD - S$)' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit (MYR - RM)' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee (PKR - ₨)' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (BDT - ৳)' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso (PHP - ₱)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY - ¥)' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (CNY - ¥)' }
];

export const SERVICE_CATALOG: Record<string, string[]> = {
  'General Trading': ['Product Supply', 'Wholesale Goods', 'Materials & Parts', 'Equipment Supply', 'General Item'],
  'Services': ['Consultation', 'Installation & Setup', 'Maintenance & Repair', 'Service Charge', 'Support'],
  'Contracting': ['Civil & Fit-out Works', 'MEP & Technical Works', 'Labor & Manpower', 'Project Milestone', 'Site Supply'],
  'IT & Digital': ['Software & Licensing', 'Web & App Development', 'Hardware & Networking', 'Annual Maintenance (AMC)'],
  'Logistics & Transport': ['Delivery & Freight', 'Customs & Clearance', 'Warehousing', 'Transportation'],
  'General': ['Standard Item', 'General Service', 'Miscellaneous']
};

export const SERVICE_PRESETS = Object.entries(SERVICE_CATALOG).map(([category, services]) => ({
  category,
  services
}));

export const MOCK_CLIENTS: Client[] = [];

export const MOCK_STAFF = [];

export const MOCK_STAFF_ADVANCES = [];

export const MOCK_STAFF_ATTENDANCE = [];

export const MOCK_INVOICES: Invoice[] = [];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Purchases & Inventory',
  'Rent & Utilities',
  'Salaries & Wages',
  'Office Supplies',
  'Fuel & Transport',
  'Maintenance & Repairs',
  'Software & Telecom',
  'Marketing & Business',
  'Government & Visa Fees',
  'Miscellaneous'
];

export const MOCK_EXPENSES: Expense[] = [];

export const SERVICE_DEFAULTS = {
  [ProjectType.GENERAL]: 1000,
  [ProjectType.GOODS_SUPPLY]: 2500,
  [ProjectType.SERVICES]: 1500,
  [ProjectType.CONSULTING]: 3000,
  [ProjectType.CONTRACTING]: 5000,
  [ProjectType.IT_SOFTWARE]: 4000,
  [ProjectType.VIDEO_PRODUCTION]: 5000,
  [ProjectType.PRODUCT_SHOOT]: 2500,
  [ProjectType.AD_CAMPAIGN]: 5000,
  [ProjectType.POSTER_DESIGN]: 1000,
  [ProjectType.POST_PRODUCTION]: 1500,
  [ProjectType.SOCIAL_MEDIA]: 2000,
};

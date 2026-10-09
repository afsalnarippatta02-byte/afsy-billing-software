import { ProjectType, Client, Invoice, InvoiceStatus, CompanySettings, Expense, ExpenseCategory } from './types';
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
  vatNumber: '',
  trnNumber: '',
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
  invoiceTemplate: 'executive_indigo',
  invoiceAccentColor: '#4f46e5',
  invoiceHeaderLayout: 'split',
  invoiceTableStyle: 'striped',
  invoiceFontStyle: 'sans',
  invoiceCustomTitle: 'TAX INVOICE',
  invoiceShowCategoryCol: true,
  invoiceShowBankDetails: true,
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
  statementDefaultOrientation: 'portrait'
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
    id: 'executive_indigo',
    name: 'Executive Corporate',
    category: 'UAE Standard',
    description: 'Clean top accent bar, left corporate branding, high-contrast date badges, and structured totals.',
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
    description: 'Warm gold header rules, formal TRN tax box, luxury editorial typography, and gold-accented table.',
    accentColor: '#b45309',
    headerLayout: 'split',
    tableStyle: 'bordered',
    fontStyle: 'serif',
    compactMode: false
  },
  {
    id: 'corporate_navy',
    name: 'Dark Navy Banner',
    category: 'Enterprise',
    description: 'Full-width deep navy header banner with white typography and crisp corporate grid lines.',
    accentColor: '#0f172a',
    headerLayout: 'banner',
    tableStyle: 'bordered',
    fontStyle: 'sans',
    compactMode: false
  },
  {
    id: 'dubai_minimal',
    name: 'Minimalist Swiss Studio',
    category: 'Editorial Clean',
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
    category: 'Financial Green',
    description: 'Contemporary emerald header accents, tinted client card, and highlighted settlement totals.',
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
    id: 'creative_agency',
    name: 'Creative Production Bold',
    category: 'Media & Studio',
    description: 'Vibrant violet studio banner designed for creative agencies, production houses, and campaigns.',
    accentColor: '#7c3aed',
    headerLayout: 'banner',
    tableStyle: 'striped',
    fontStyle: 'sans',
    compactMode: false
  },
  {
    id: 'compact_commercial',
    name: 'Compact Commercial Tax',
    category: 'High Density',
    description: 'Space-optimized commercial tax layout engineered to fit 20+ line items cleanly on one A4 page.',
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
  'Ad Campaign': ['Shoot', 'Pre-Production', 'Creative Direction', 'Talent & Casting', 'Location Permit'],
  'Video Production': ['Commercial Shoot', 'Corporate Video', 'Drone Cinematography', 'Studio Lighting & Grip'],
  'Poster Design': ['Key Visual Design', 'Social Media Poster', 'Billboard Layout', 'Print Ready Artwork'],
  'Post Production': ['4K Video Editing', 'Color Grading', '3D & VFX Motion', 'Sound Design & Mastering'],
  'Social Media': ['Monthly Retainer', 'Reels Package (10x)', 'Content Strategy', 'Paid Media Management'],
  'Photography': ['Product Shoot', 'Fashion & Editorial', 'Event Coverage', 'High-End Retouching'],
  'Branding': ['Logo & Identity', 'Brand Guidelines', 'Packaging Design', 'Pitch Deck Design']
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
  'Office Supplies',
  'Software & Subscriptions',
  'Rent & Utilities',
  'Marketing & Advertising',
  'Travel & Transport',
  'Equipment & Hardware',
  'Professional Services',
  'Fuel & Vehicle',
  'Meals & Entertainment',
  'Miscellaneous'
];

export const MOCK_EXPENSES: Expense[] = [];

export const SERVICE_DEFAULTS = {
  [ProjectType.VIDEO_PRODUCTION]: 12000,
  [ProjectType.PRODUCT_SHOOT]: 5000,
  [ProjectType.AD_CAMPAIGN]: 25000,
  [ProjectType.POSTER_DESIGN]: 1500,
  [ProjectType.POST_PRODUCTION]: 2500,
  [ProjectType.SOCIAL_MEDIA]: 3500,
};

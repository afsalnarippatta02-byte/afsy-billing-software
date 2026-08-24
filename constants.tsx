
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
  { code: 'AE', name: 'United Arab Emirates (UAE)', defaultCurrency: 'AED', currencySymbol: 'د.إ', defaultTaxRate: 5, taxName: 'VAT', flag: '🇦🇪' },
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
  currencySymbol: 'د.إ',
  defaultTaxRate: 5,
  taxRate: 5,
  taxName: 'VAT',
  vatNumber: '',
  trnNumber: '',
  bankName: '',
  bankAccount: '',
  invoiceFooterNote: 'Thank you for your business.'
};

export const CURRENCIES = [
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham / DH (AED - د.إ)' },
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

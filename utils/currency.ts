import { Invoice, InvoiceStatus } from '../types';

/**
 * Official Central Bank of the UAE Dirham Sign (Unicode 18.0 Code Point U+20C3)
 * Stylized Latin capital letter "D" crossed with two horizontal parallel lines.
 */
export const UAE_DIRHAM_SYMBOL = '\u20C3';

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  nativeSymbol: string;
}

export const ALL_CURRENCIES: CurrencyInfo[] = [
  { code: 'AED', symbol: '\u20C3', name: 'UAE Dirham (\u20C3 / AED)', nativeSymbol: '\u20C3' },
  { code: 'USD', symbol: '$', name: 'US Dollar (USD - $)', nativeSymbol: '$' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR - ₹)', nativeSymbol: '₹' },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR - €)', nativeSymbol: '€' },
  { code: 'GBP', symbol: '£', name: 'British Pound (GBP - £)', nativeSymbol: '£' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal (SAR)', nativeSymbol: 'ر.س' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal (QAR)', nativeSymbol: 'ر.ق' },
  { code: 'OMR', symbol: 'ر.ع', name: 'Omani Rial (OMR)', nativeSymbol: 'ر.ع' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar (KWD)', nativeSymbol: 'د.ك' },
  { code: 'BHD', symbol: 'د.ب', name: 'Bahraini Dinar (BHD)', nativeSymbol: 'د.ب' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CAD)', nativeSymbol: '$' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (AUD)', nativeSymbol: '$' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (SGD)', nativeSymbol: '$' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit (MYR)', nativeSymbol: 'RM' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee (PKR)', nativeSymbol: '₨' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (BDT)', nativeSymbol: '৳' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso (PHP)', nativeSymbol: '₱' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY)', nativeSymbol: '¥' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (CNY)', nativeSymbol: '¥' }
];

export const getCurrencySymbol = (currencyCodeOrSymbol?: string): string => {
  if (!currencyCodeOrSymbol) return UAE_DIRHAM_SYMBOL;
  const trimmed = currencyCodeOrSymbol.trim();
  // Always replace legacy Arabic Dirham symbol or AED code with the new official U+20C3 UAE Dirham symbol
  if (trimmed === 'د.إ' || trimmed === '\u20C3') {
    return UAE_DIRHAM_SYMBOL;
  }
  if (['₹', '$', '€', '£', '¥', 'ر.س', 'ر.ق', 'ر.ع', 'د.ك', 'د.ب', 'CA$', 'A$', 'S$', 'RM', '₨', '৳', '₱'].includes(trimmed)) {
    return trimmed;
  }
  const codeClean = trimmed.toUpperCase();
  const found = ALL_CURRENCIES.find(c => c.code.toUpperCase() === codeClean);
  if (found) return found.symbol;
  if (codeClean === 'DH' || codeClean === 'DHS' || codeClean === 'DIRHAM' || codeClean === 'DIRHAMS' || codeClean === 'AED') {
    return UAE_DIRHAM_SYMBOL;
  }
  if (codeClean === 'DOLLAR' || codeClean === 'DOLLARS' || codeClean === 'USD') return '$';
  if (codeClean === 'RUPEE' || codeClean === 'RUPEES' || codeClean === 'RS' || codeClean === 'INR') return '₹';
  if (codeClean === 'RIYAL' || codeClean === 'SAR') return 'ر.س';
  if (codeClean === 'EURO' || codeClean === 'EUR') return '€';
  if (codeClean === 'POUND' || codeClean === 'GBP') return '£';
  return trimmed;
};

export const formatMoney = (amount: number | undefined | null, currencyCode?: string, decimalPlaces: number = 2): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = Math.abs(validAmount).toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });
  const prefix = validAmount < 0 ? '-' : '';
  return `${prefix}${symbol} ${formatted}`;
};

export const formatMoneyCompact = (amount: number | undefined | null, currencyCode?: string): string => {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol} ${Math.round(validAmount).toLocaleString()}`;
};

/**
 * Checks whether an invoice is overdue.
 */
export const isInvoiceOverdue = (invoice: Invoice): boolean => {
  if (!invoice) return false;
  if (
    invoice.status === InvoiceStatus.PAID ||
    invoice.status === InvoiceStatus.QUOTATION ||
    invoice.status === InvoiceStatus.PROFORMA
  ) {
    return false;
  }
  if (invoice.status === InvoiceStatus.OVERDUE) {
    return true;
  }
  if (!invoice.dueDate) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  return invoice.dueDate < todayStr;
};

/**
 * Calculates days overdue for an invoice.
 */
export const getDaysOverdue = (invoice: Invoice): number => {
  if (!isInvoiceOverdue(invoice) || !invoice.dueDate) return 0;
  const today = new Date();
  const due = new Date(invoice.dueDate);
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

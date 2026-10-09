import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Invoice, Client, CompanySettings, InvoiceStatus } from '../types';

export interface ExportProgressCallback {
  (status: 'preparing' | 'rendering' | 'saving' | 'done' | 'error', message?: string): void;
}

export interface StatementLedgerRowPdf {
  id: string;
  refNumber: string;
  date: string;
  dueDate?: string;
  partyName: string;
  category: string;
  description: string;
  statusLabel: string;
  isPaid: boolean;
  isOverdue: boolean;
  debitAmount: number;
  creditAmount: number;
  balanceAmount: number;
  runningBalance: number;
}

export interface StatementMonthGroupPdf {
  monthKey: string;
  monthLabel: string;
  rows: StatementLedgerRowPdf[];
  invoiced: number;
  paid: number;
  balance: number;
}

export interface StatementCategoryRowPdf {
  category: string;
  latestDate: string;
  count: number;
  invoiced: number;
  paid: number;
  balance: number;
}

export interface StatementPdfExportParams {
  ledgerSource: 'invoices' | 'expenses';
  viewMode: 'date_wise' | 'month_wise' | 'category_wise';
  selectedClient: Client | null;
  periodLabel: string;
  statusFilter: 'all' | 'paid' | 'unpaid' | 'overdue';
  selectedCategory: string;
  searchQuery?: string;
  currencyCode: string;
  currencySymbol: string;
  settings?: CompanySettings;
  applySignature: boolean;
  applySeal: boolean;
  summary: {
    count: number;
    totalInvoiced: number;
    totalPaid: number;
    totalBalance: number;
  };
  ledgerRows: StatementLedgerRowPdf[];
  monthWiseGroups: StatementMonthGroupPdf[];
  categoryWiseRows: StatementCategoryRowPdf[];
  orientation?: 'portrait' | 'landscape';
  filename?: string;
}

/**
 * Helper to load any image URL or data URI into a normalized PNG data URL with dimensions
 * so jsPDF can embed logos, transparent signatures, and seals without aspect-ratio distortion.
 */
const loadImageAsPngDataUrl = (
  src?: string
): Promise<{ dataUrl: string; width: number; height: number } | null> => {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width || 200;
          const height = img.naturalHeight || img.height || 200;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          resolve({ dataUrl, width, height });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
};

/**
 * Formats an ISO YYYY-MM-DD date string into "DD MMM YYYY" (e.g. "08 Oct 2026")
 */
const formatPdfDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    const day = parts[2].padStart(2, '0');
    const mon = months[mIdx] || parts[1];
    return `${day} ${mon} ${year}`;
  }
  return dateStr;
};

const formatPdfNumber = (amount: number): string =>
  (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

/**
 * Draws the official 2026 UAE Dirham symbol (U+20C3: bold capital Latin 'D' crossed by
 * two parallel horizontal bars) using native jsPDF vector primitives at (x, baselineY).
 * Returns the advance width in mm.
 */
const drawVectorUaeDirhamSymbol = (
  doc: jsPDF,
  x: number,
  baselineY: number,
  fontSizePt: number,
  colorRgb: [number, number, number]
): number => {
  const prevFont = doc.getFont();
  const prevSize = doc.getFontSize();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizePt);
  doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
  doc.setFillColor(colorRgb[0], colorRgb[1], colorRgb[2]);

  const dWidth = doc.getTextWidth('D');
  const capHeightMm = fontSizePt * 0.352778 * 0.718;
  const protrudeLeft = dWidth * 0.14;
  const barWidth = dWidth * 1.12;
  const barThickness = Math.max(0.24, capHeightMm * 0.118);

  // Draw the base capital 'D' shifted slightly right of the left bar protrusion
  const dX = x + protrudeLeft;
  doc.text('D', dX, baselineY);

  // Draw the two horizontal parallel bars across the 'D'
  const upperBarY = baselineY - capHeightMm * 0.65 - barThickness / 2;
  const lowerBarY = baselineY - capHeightMm * 0.37 - barThickness / 2;
  doc.rect(x, upperBarY, barWidth, barThickness, 'F');
  doc.rect(x, lowerBarY, barWidth, barThickness, 'F');

  // Restore font state
  doc.setFont(prevFont.fontName, prevFont.fontStyle);
  doc.setFontSize(prevSize);

  return barWidth + dWidth * 0.08;
};

/**
 * Renders a currency amount (with the vector 2026 UAE Dirham symbol when AED is active)
 * aligned either left or right at (x, baselineY).
 */
const drawPdfCurrencyAmount = (
  doc: jsPDF,
  amount: number,
  x: number,
  baselineY: number,
  options: {
    currencyCode: string;
    currencySymbol: string;
    fontSizePt: number;
    fontStyle?: 'normal' | 'bold';
    colorRgb?: [number, number, number];
    align?: 'left' | 'right';
    includeSymbol?: boolean;
  }
) => {
  const {
    currencyCode,
    currencySymbol,
    fontSizePt,
    fontStyle = 'bold',
    colorRgb = [15, 23, 42],
    align = 'right',
    includeSymbol = true
  } = options;

  const formattedNum = formatPdfNumber(amount);
  const isUaeDirham =
    currencyCode?.toUpperCase() === 'AED' || currencySymbol === '\u20C3';

  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSizePt);
  doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);

  if (!includeSymbol) {
    doc.text(formattedNum, x, baselineY, { align });
    return;
  }

  if (isUaeDirham) {
    const numWidth = doc.getTextWidth(formattedNum);
    const dWidth = doc.getTextWidth('D') * 1.2;
    const gap = 1.1;
    const totalWidth = dWidth + gap + numWidth;

    const startX = align === 'right' ? x - totalWidth : x;
    const symAdvance = drawVectorUaeDirhamSymbol(doc, startX, baselineY, fontSizePt, colorRgb);
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSizePt);
    doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
    doc.text(formattedNum, startX + symAdvance + gap * 0.6, baselineY);
  } else {
    const safePrefix =
      currencySymbol && currencySymbol.charCodeAt(0) <= 255
        ? currencySymbol
        : currencyCode || 'AED';
    const fullText = `${safePrefix} ${formattedNum}`;
    doc.text(fullText, x, baselineY, { align });
  }
};

/**
 * Generates and downloads a clean, professionally formatted vector PDF Statement of Account
 * directly using jsPDF, respecting all active filters, grouping modes, and signature/seal settings.
 */
export const exportStatementToPdf = async (
  params: StatementPdfExportParams
): Promise<boolean> => {
  const {
    ledgerSource,
    viewMode,
    selectedClient,
    periodLabel,
    statusFilter,
    selectedCategory,
    searchQuery,
    currencyCode,
    currencySymbol,
    settings,
    applySignature,
    applySeal,
    summary,
    ledgerRows,
    monthWiseGroups,
    categoryWiseRows,
    orientation = 'portrait',
    filename
  } = params;

  const isUaeDirham =
    currencyCode?.toUpperCase() === 'AED' || currencySymbol === '\u20C3';

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomSafeY = pageHeight - 18;

  // Preload Logo, Signature, and Company Seal images in parallel
  const [logoImg, sigImg, sealImg] = await Promise.all([
    loadImageAsPngDataUrl(settings?.logoUrl),
    applySignature && settings?.signatureUrl
      ? loadImageAsPngDataUrl(settings.signatureUrl)
      : Promise.resolve(null),
    applySeal && settings?.companySealUrl
      ? loadImageAsPngDataUrl(settings.companySealUrl)
      : Promise.resolve(null)
  ]);

  let cursorY = margin;

  // =========================================================================
  // 1. CORPORATE HEADER
  // =========================================================================
  let leftX = margin;
  if (logoImg) {
    const maxLogoBox = 16;
    const ratio = Math.min(maxLogoBox / logoImg.width, maxLogoBox / logoImg.height);
    const drawW = Math.max(8, logoImg.width * ratio);
    const drawH = Math.max(8, logoImg.height * ratio);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(leftX, cursorY, maxLogoBox, maxLogoBox, 2, 2, 'S');
    doc.addImage(
      logoImg.dataUrl,
      'PNG',
      leftX + (maxLogoBox - drawW) / 2,
      cursorY + (maxLogoBox - drawH) / 2,
      drawW,
      drawH,
      undefined,
      'FAST'
    );
    leftX += maxLogoBox + 4;
  } else {
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(leftX, cursorY, 14, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('Af', leftX + 7, cursorY + 9, { align: 'center' });
    leftX += 18;
  }

  // Company Name & Details (Left Column)
  let companyY = cursorY + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text((settings?.name || 'AF CREATIVE FLOW').toUpperCase(), leftX, companyY);
  companyY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  if (settings?.address) {
    const addrLines = doc.splitTextToSize(settings.address, contentWidth * 0.48);
    doc.text(addrLines, leftX, companyY);
    companyY += addrLines.length * 3.8;
  }

  const contactParts: string[] = [];
  if (settings?.phone) contactParts.push(`Tel: ${settings.phone}`);
  if (settings?.email) contactParts.push(`Email: ${settings.email}`);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  |  '), leftX, companyY);
    companyY += 3.8;
  }

  if (settings?.trnNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`TRN: ${settings.trnNumber}`, leftX, companyY);
    companyY += 4;
  }

  // Statement Title & Metadata (Right Column)
  const rightX = pageWidth - margin;
  let rightY = cursorY + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  const docTitle =
    ledgerSource === 'expenses' ? 'EXPENSE STATEMENT' : 'STATEMENT OF ACCOUNT';
  doc.text(docTitle, rightX, rightY, { align: 'right' });
  rightY += 5.5;

  const todayFormatted = formatPdfDate(new Date().toISOString().split('T')[0]);
  const metaRows: Array<{ label: string; value: string }> = [
    { label: 'Statement Date:', value: todayFormatted },
    { label: 'Statement Period:', value: periodLabel || 'All Dates' }
  ];

  const viewModeLabels: Record<string, string> = {
    date_wise: 'Date-Wise Standard Ledger',
    month_wise: 'Month-Wise Grouped Ledger',
    category_wise: 'Category-Wise Summary'
  };
  metaRows.push({ label: 'Statement View:', value: viewModeLabels[viewMode] || 'Standard Ledger' });

  if (statusFilter !== 'all' || selectedCategory !== 'ALL' || (searchQuery && searchQuery.trim())) {
    const scopeParts: string[] = [];
    if (statusFilter !== 'all') scopeParts.push(`${statusFilter.toUpperCase()} ONLY`);
    if (selectedCategory !== 'ALL') scopeParts.push(selectedCategory);
    if (searchQuery && searchQuery.trim()) scopeParts.push(`"${searchQuery.trim()}"`);
    metaRows.push({ label: 'Filter Scope:', value: scopeParts.join(' · ') });
  }

  metaRows.forEach((m) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const valW = doc.getTextWidth(m.value);
    doc.text(m.value, rightX, rightY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, rightX - valW - 1.5, rightY, { align: 'right' });
    rightY += 4.1;
  });

  // Currency metadata line with vector 2026 UAE Dirham symbol
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  if (isUaeDirham) {
    const closeParenW = doc.getTextWidth(')');
    doc.text(')', rightX, rightY, { align: 'right' });
    const dSymW = doc.getTextWidth('D') * 1.25;
    drawVectorUaeDirhamSymbol(
      doc,
      rightX - closeParenW - dSymW,
      rightY,
      8.5,
      [15, 23, 42]
    );
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const prefixText = `${currencyCode} (`;
    const prefixW = doc.getTextWidth(prefixText);
    doc.text(prefixText, rightX - closeParenW - dSymW - 0.5, rightY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Currency:', rightX - closeParenW - dSymW - prefixW - 2, rightY, {
      align: 'right'
    });
  } else {
    const currVal = `${currencyCode}`;
    const valW = doc.getTextWidth(currVal);
    doc.text(currVal, rightX, rightY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Currency:', rightX - valW - 1.5, rightY, { align: 'right' });
  }
  rightY += 3;

  cursorY = Math.max(companyY, rightY) + 2.5;

  // Heavy Divider Rule
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 5;

  // =========================================================================
  // 2. ACCOUNT HOLDER (LEFT BOX) & ACCOUNT SUMMARY (RIGHT BOX)
  // =========================================================================
  const colGap = 5;
  const halfWidth = (contentWidth - colGap) / 2;
  const summaryBoxHeight = 28;

  // Left Box: Account Holder (Client / Customer)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cursorY, halfWidth, summaryBoxHeight, 2, 2, 'FD');

  let clientBoxY = cursorY + 4.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ACCOUNT OF (CLIENT / CUSTOMER)', margin + 3.5, clientBoxY);
  clientBoxY += 4.5;

  if (selectedClient) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const clientTitle = selectedClient.company || selectedClient.name || 'Client Account';
    doc.text(doc.splitTextToSize(clientTitle, halfWidth - 7)[0], margin + 3.5, clientBoxY);
    clientBoxY += 4.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    if (selectedClient.name && selectedClient.company) {
      doc.text(`Attn: ${selectedClient.name}`, margin + 3.5, clientBoxY);
      clientBoxY += 3.6;
    }
    if (selectedClient.address) {
      const cAddr = doc.splitTextToSize(selectedClient.address, halfWidth - 7);
      doc.text(cAddr.slice(0, 2), margin + 3.5, clientBoxY);
      clientBoxY += Math.min(2, cAddr.length) * 3.5;
    }
    const clientContacts: string[] = [];
    if (selectedClient.phone) clientContacts.push(`Tel: ${selectedClient.phone}`);
    if (selectedClient.email) clientContacts.push(selectedClient.email);
    if (clientContacts.length > 0 && clientBoxY <= cursorY + summaryBoxHeight - 3) {
      doc.text(clientContacts.join('  |  '), margin + 3.5, clientBoxY);
      clientBoxY += 3.5;
    }
    if (selectedClient.trn && clientBoxY <= cursorY + summaryBoxHeight - 2) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Client TRN: ${selectedClient.trn}`, margin + 3.5, clientBoxY);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('All Clients — Consolidated Account Statement', margin + 3.5, clientBoxY);
    clientBoxY += 4.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const scopeLine = `Showing ${summary.count} ${
      summary.count === 1 ? 'transaction' : 'transactions'
    } across ${selectedCategory === 'ALL' ? 'all categories' : selectedCategory}.`;
    doc.text(doc.splitTextToSize(scopeLine, halfWidth - 7), margin + 3.5, clientBoxY);
  }

  // Right Box: Account Summary
  const sumX = margin + halfWidth + colGap;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.roundedRect(sumX, cursorY, halfWidth, summaryBoxHeight, 2, 2, 'S');

  // Summary Header Band
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(sumX, cursorY, halfWidth, 6.8, 1.8, 1.8, 'F');
  doc.rect(sumX, cursorY + 3.5, halfWidth, 3.3, 'F'); // square bottom corners of header band

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('ACCOUNT SUMMARY', sumX + 3.5, cursorY + 4.6);
  doc.text('AMOUNT', sumX + halfWidth - 3.5, cursorY + 4.6, { align: 'right' });

  // Summary Row 1: Total Invoiced
  const row1Y = cursorY + 11.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    ledgerSource === 'expenses' ? 'Total Expenses Recorded' : 'Total Invoiced (Billed)',
    sumX + 3.5,
    row1Y
  );
  drawPdfCurrencyAmount(doc, summary.totalInvoiced, sumX + halfWidth - 3.5, row1Y, {
    currencyCode,
    currencySymbol,
    fontSizePt: 8.5,
    fontStyle: 'bold',
    colorRgb: [15, 23, 42],
    align: 'right'
  });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(sumX, cursorY + 13.8, sumX + halfWidth, cursorY + 13.8);

  // Summary Row 2: Less Paid
  const row2Y = cursorY + 18.6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    ledgerSource === 'expenses' ? 'Total Paid Out' : 'Less: Amount Received (Paid)',
    sumX + 3.5,
    row2Y
  );
  drawPdfCurrencyAmount(doc, summary.totalPaid, sumX + halfWidth - 3.5, row2Y, {
    currencyCode,
    currencySymbol,
    fontSizePt: 8.5,
    fontStyle: 'bold',
    colorRgb: [4, 120, 87],
    align: 'right'
  });

  // Summary Row 3: Total Balance Due (Shaded bottom row)
  const row3Top = cursorY + 20.6;
  const row3Height = summaryBoxHeight - 20.6;
  doc.setFillColor(241, 245, 249);
  doc.rect(sumX + 0.2, row3Top, halfWidth - 0.4, row3Height - 0.3, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.line(sumX, row3Top, sumX + halfWidth, row3Top);

  const row3Y = row3Top + 5.1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    ledgerSource === 'expenses' ? 'NET EXPENSE TOTAL' : 'TOTAL BALANCE DUE (UNPAID)',
    sumX + 3.5,
    row3Y
  );
  drawPdfCurrencyAmount(
    doc,
    ledgerSource === 'expenses' ? summary.totalInvoiced : summary.totalBalance,
    sumX + halfWidth - 3.5,
    row3Y,
    {
      currencyCode,
      currencySymbol,
      fontSizePt: 9.5,
      fontStyle: 'bold',
      colorRgb: [15, 23, 42],
      align: 'right'
    }
  );

  cursorY += summaryBoxHeight + 6;

  // =========================================================================
  // 3. STATEMENT TABLE (DATE-WISE, MONTH-WISE, OR CATEGORY-WISE)
  // =========================================================================
  const showClientCol = selectedClient === null;

  interface ColDef {
    key: string;
    label: string;
    width: number;
    align: 'left' | 'center' | 'right';
  }

  const getLedgerColumns = (): ColDef[] => {
    if (viewMode === 'category_wise') {
      const dateW = 28;
      const countW = 24;
      const amtW = 32;
      const catW = contentWidth - dateW - countW - amtW * 3;
      return [
        { key: 'date', label: 'INVOICE DATE', width: dateW, align: 'left' },
        { key: 'category', label: 'SERVICE / EXPENSE CATEGORY', width: catW, align: 'left' },
        { key: 'count', label: 'TRANSACTIONS', width: countW, align: 'center' },
        { key: 'invoiced', label: 'TOTAL AMOUNT', width: amtW, align: 'right' },
        { key: 'paid', label: 'PAID', width: amtW, align: 'right' },
        { key: 'balance', label: 'UNPAID BALANCE', width: amtW, align: 'right' }
      ];
    }

    const dateW = 23;
    const refW = 23;
    const statusW = 19;
    const numW = 25;
    const remaining = contentWidth - dateW - refW - statusW - numW * 3;

    if (showClientCol) {
      const clientW = Math.round(remaining * 0.36);
      const partW = remaining - clientW;
      return [
        { key: 'date', label: 'INVOICE DATE', width: dateW, align: 'left' },
        { key: 'ref', label: 'INVOICE / REF', width: refW, align: 'left' },
        { key: 'client', label: 'CLIENT / PARTY', width: clientW, align: 'left' },
        { key: 'particulars', label: 'PARTICULARS / CATEGORY', width: partW, align: 'left' },
        { key: 'status', label: 'STATUS', width: statusW, align: 'center' },
        { key: 'invoiced', label: 'INVOICED', width: numW, align: 'right' },
        { key: 'paid', label: 'PAID', width: numW, align: 'right' },
        { key: 'balance', label: 'BALANCE', width: numW, align: 'right' }
      ];
    }

    return [
      { key: 'date', label: 'INVOICE DATE', width: dateW, align: 'left' },
      { key: 'ref', label: 'INVOICE / REF', width: refW, align: 'left' },
      { key: 'particulars', label: 'PARTICULARS / CATEGORY', width: remaining, align: 'left' },
      { key: 'status', label: 'STATUS', width: statusW, align: 'center' },
      { key: 'invoiced', label: 'INVOICED', width: numW, align: 'right' },
      { key: 'paid', label: 'PAID', width: numW, align: 'right' },
      { key: 'balance', label: 'BALANCE', width: numW, align: 'right' }
    ];
  };

  const columns = getLedgerColumns();

  const drawTableHeader = (y: number): number => {
    const headerH = 7.5;
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, headerH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(255, 255, 255);

    let colX = margin;
    columns.forEach((col, i) => {
      const textY = y + 5;
      if (col.align === 'left') {
        doc.text(col.label, colX + 2.2, textY);
      } else if (col.align === 'center') {
        doc.text(col.label, colX + col.width / 2, textY, { align: 'center' });
      } else {
        doc.text(col.label, colX + col.width - 2.2, textY, { align: 'right' });
      }

      if (i < columns.length - 1) {
        doc.setDrawColor(51, 65, 85);
        doc.setLineWidth(0.2);
        doc.line(colX + col.width, y, colX + col.width, y + headerH);
      }
      colX += col.width;
    });

    return y + headerH;
  };

  const ensureSpace = (neededHeight: number, repeatTableHeader = true) => {
    if (cursorY + neededHeight > bottomSafeY) {
      doc.addPage();
      cursorY = margin;
      if (repeatTableHeader) {
        cursorY = drawTableHeader(cursorY);
      }
    }
  };

  const drawStandardLedgerRow = (row: StatementLedgerRowPdf, rowIndex: number) => {
    const particularsText =
      row.description && row.description !== row.category
        ? `${row.category} — ${row.description}`
        : row.category || 'General Services';

    const partCol = columns.find((c) => c.key === 'particulars')!;
    const clientCol = columns.find((c) => c.key === 'client');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    const partLines = doc.splitTextToSize(particularsText, partCol.width - 4.4).slice(0, 3);
    const clientLines = clientCol
      ? doc.splitTextToSize(row.partyName || 'Client', clientCol.width - 4.4).slice(0, 2)
      : [''];

    const maxLines = Math.max(partLines.length, clientLines.length, 1);
    const rowH = Math.max(7.2, maxLines * 3.8 + 3.2);

    ensureSpace(rowH, true);

    // Row Background
    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, cursorY, contentWidth, rowH, 'F');

    // Cell Borders
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, cursorY, contentWidth, rowH, 'S');

    let colX = margin;
    const textBaselineY = cursorY + 4.8;

    columns.forEach((col, i) => {
      if (i < columns.length - 1) {
        doc.setDrawColor(226, 232, 240);
        doc.line(colX + col.width, cursorY, colX + col.width, cursorY + rowH);
      }

      if (col.key === 'date') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        doc.text(formatPdfDate(row.date), colX + 2.2, textBaselineY);
      } else if (col.key === 'ref') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(15, 23, 42);
        const refTrunc = doc.splitTextToSize(String(row.refNumber || ''), col.width - 4)[0] || '';
        doc.text(refTrunc, colX + 2.2, textBaselineY);
      } else if (col.key === 'client') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        doc.text(clientLines, colX + 2.2, textBaselineY);
      } else if (col.key === 'particulars') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(51, 65, 85);
        doc.text(partLines, colX + 2.2, textBaselineY);
      } else if (col.key === 'status') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.3);
        if (row.isPaid) {
          doc.setTextColor(4, 120, 87);
        } else if (row.isOverdue) {
          doc.setTextColor(190, 18, 60);
        } else {
          doc.setTextColor(180, 83, 9);
        }
        doc.text(row.statusLabel.toUpperCase(), colX + col.width / 2, textBaselineY, {
          align: 'center'
        });
      } else if (col.key === 'invoiced') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(formatPdfNumber(row.debitAmount), colX + col.width - 2.2, textBaselineY, {
          align: 'right'
        });
      } else if (col.key === 'paid') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(4, 120, 87);
        doc.text(formatPdfNumber(row.creditAmount), colX + col.width - 2.2, textBaselineY, {
          align: 'right'
        });
      } else if (col.key === 'balance') {
        const balVal =
          ledgerSource === 'expenses' ? row.runningBalance : row.balanceAmount;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(formatPdfNumber(balVal), colX + col.width - 2.2, textBaselineY, {
          align: 'right'
        });
      }

      colX += col.width;
    });

    cursorY += rowH;
  };

  cursorY = drawTableHeader(cursorY);

  if (viewMode === 'date_wise') {
    if (ledgerRows.length === 0) {
      const emptyH = 14;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, cursorY, contentWidth, emptyH, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'No transactions match the selected filter criteria.',
        margin + contentWidth / 2,
        cursorY + 8.5,
        { align: 'center' }
      );
      cursorY += emptyH;
    } else {
      ledgerRows.forEach((row, idx) => drawStandardLedgerRow(row, idx));
    }
  } else if (viewMode === 'month_wise') {
    if (monthWiseGroups.length === 0) {
      const emptyH = 14;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, cursorY, contentWidth, emptyH, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'No monthly records found for the selected criteria.',
        margin + contentWidth / 2,
        cursorY + 8.5,
        { align: 'center' }
      );
      cursorY += emptyH;
    } else {
      const numColWidth = columns[columns.length - 1].width;
      const spanWidth = contentWidth - numColWidth * 3;

      monthWiseGroups.forEach((group) => {
        const groupHeaderH = 7;
        ensureSpace(groupHeaderH + 7.5, true);

        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.25);
        doc.rect(margin, cursorY, contentWidth, groupHeaderH, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        doc.text(
          `${group.monthLabel.toUpperCase()} (${group.rows.length} ${
            group.rows.length === 1 ? 'INVOICE' : 'INVOICES'
          })`,
          margin + 2.5,
          cursorY + 4.7
        );

        let gx = margin + spanWidth;
        doc.line(gx, cursorY, gx, cursorY + groupHeaderH);
        doc.text(formatPdfNumber(group.invoiced), gx + numColWidth - 2.2, cursorY + 4.7, {
          align: 'right'
        });

        gx += numColWidth;
        doc.line(gx, cursorY, gx, cursorY + groupHeaderH);
        doc.setTextColor(4, 120, 87);
        doc.text(formatPdfNumber(group.paid), gx + numColWidth - 2.2, cursorY + 4.7, {
          align: 'right'
        });

        gx += numColWidth;
        doc.line(gx, cursorY, gx, cursorY + groupHeaderH);
        doc.setTextColor(15, 23, 42);
        doc.text(formatPdfNumber(group.balance), gx + numColWidth - 2.2, cursorY + 4.7, {
          align: 'right'
        });

        cursorY += groupHeaderH;

        group.rows.forEach((row, rIdx) => drawStandardLedgerRow(row, rIdx));
      });
    }
  } else if (viewMode === 'category_wise') {
    if (categoryWiseRows.length === 0) {
      const emptyH = 14;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, cursorY, contentWidth, emptyH, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'No category records found for the selected criteria.',
        margin + contentWidth / 2,
        cursorY + 8.5,
        { align: 'center' }
      );
      cursorY += emptyH;
    } else {
      categoryWiseRows.forEach((catRow, idx) => {
        const rowH = 7.5;
        ensureSpace(rowH, true);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.rect(margin, cursorY, contentWidth, rowH, 'FD');

        let colX = margin;
        const textY = cursorY + 5;

        columns.forEach((col, i) => {
          if (i < columns.length - 1) {
            doc.line(colX + col.width, cursorY, colX + col.width, cursorY + rowH);
          }

          if (col.key === 'date') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text(formatPdfDate(catRow.latestDate), colX + 2.2, textY);
          } else if (col.key === 'category') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            const cText = doc.splitTextToSize(catRow.category, col.width - 4.4)[0] || '';
            doc.text(cText, colX + 2.2, textY);
          } else if (col.key === 'count') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            doc.text(String(catRow.count), colX + col.width / 2, textY, { align: 'center' });
          } else if (col.key === 'invoiced') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(formatPdfNumber(catRow.invoiced), colX + col.width - 2.2, textY, {
              align: 'right'
            });
          } else if (col.key === 'paid') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(4, 120, 87);
            doc.text(formatPdfNumber(catRow.paid), colX + col.width - 2.2, textY, {
              align: 'right'
            });
          } else if (col.key === 'balance') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(formatPdfNumber(catRow.balance), colX + col.width - 2.2, textY, {
              align: 'right'
            });
          }

          colX += col.width;
        });

        cursorY += rowH;
      });
    }
  }

  // Grand Total Table Footer Row
  if (summary.count > 0) {
    const totalRowH = 8.5;
    ensureSpace(totalRowH, false);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.rect(margin, cursorY, contentWidth, totalRowH, 'FD');

    const numColWidth = columns[columns.length - 1].width;
    const spanWidth = contentWidth - numColWidth * 3;
    const totalTextY = cursorY + 5.6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `STATEMENT TOTAL (${summary.count} ${
        summary.count === 1 ? 'TRANSACTION' : 'TRANSACTIONS'
      })`,
      margin + spanWidth - 3,
      totalTextY,
      { align: 'right' }
    );

    let tx = margin + spanWidth;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(tx, cursorY, tx, cursorY + totalRowH);
    drawPdfCurrencyAmount(doc, summary.totalInvoiced, tx + numColWidth - 2.2, totalTextY, {
      currencyCode,
      currencySymbol,
      fontSizePt: 8.2,
      fontStyle: 'bold',
      colorRgb: [15, 23, 42],
      align: 'right'
    });

    tx += numColWidth;
    doc.line(tx, cursorY, tx, cursorY + totalRowH);
    drawPdfCurrencyAmount(doc, summary.totalPaid, tx + numColWidth - 2.2, totalTextY, {
      currencyCode,
      currencySymbol,
      fontSizePt: 8.2,
      fontStyle: 'bold',
      colorRgb: [4, 120, 87],
      align: 'right'
    });

    tx += numColWidth;
    doc.line(tx, cursorY, tx, cursorY + totalRowH);
    drawPdfCurrencyAmount(
      doc,
      ledgerSource === 'expenses' ? summary.totalInvoiced : summary.totalBalance,
      tx + numColWidth - 2.2,
      totalTextY,
      {
        currencyCode,
        currencySymbol,
        fontSizePt: 8.2,
        fontStyle: 'bold',
        colorRgb: [15, 23, 42],
        align: 'right'
      }
    );

    cursorY += totalRowH;
  }

  // =========================================================================
  // 4. BANK REMITTANCE INSTRUCTIONS & AUTHORIZED SIGNATURE + COMPANY SEAL
  // =========================================================================
  const footerBlockHeight = 44;
  cursorY += 7;
  ensureSpace(footerBlockHeight, false);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 5;

  // Left: Remittance & Payment Instructions
  let remitY = cursorY + 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text('BANK REMITTANCE & PAYMENT INSTRUCTIONS', margin, remitY);
  remitY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  if (settings?.bankName || settings?.bankAccount) {
    if (settings.bankName) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Bank: ', margin, remitY);
      const bw = doc.getTextWidth('Bank: ');
      doc.setFont('helvetica', 'normal');
      doc.text(settings.bankName, margin + bw, remitY);
      remitY += 4;
    }
    if (settings.bankAccount) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Account / IBAN: ', margin, remitY);
      const aw = doc.getTextWidth('Account / IBAN: ');
      doc.setFont('helvetica', 'normal');
      doc.text(settings.bankAccount, margin + aw, remitY);
      remitY += 4;
    }
  } else {
    const remitFallback = doc.splitTextToSize(
      `Please remit the balance due via Bank Transfer or Cheque payable to ${
        settings?.name || 'our company'
      } and quote your Invoice Reference #.`,
      halfWidth
    );
    doc.text(remitFallback, margin, remitY);
    remitY += remitFallback.length * 3.8;
  }

  if (settings?.invoiceFooterNote) {
    remitY += 1.5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const noteLines = doc.splitTextToSize(settings.invoiceFooterNote, halfWidth);
    doc.text(noteLines.slice(0, 2), margin, remitY);
  }

  // Right: Authorized Signatory & Official Company Seal
  let signY = cursorY + 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `FOR ${(settings?.name || 'AF CREATIVE FLOW').toUpperCase()}`,
    rightX,
    signY,
    { align: 'right' }
  );
  signY += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signatory & Official Company Seal', rightX, signY, { align: 'right' });
  signY += 2.5;

  // Render Transparent Signature and/or Company Seal Images
  const stampAreaHeight = 20;
  let currentRightImgX = rightX;

  if (sigImg) {
    const maxSigW = 38;
    const maxSigH = 16;
    const ratio = Math.min(maxSigW / sigImg.width, maxSigH / sigImg.height);
    const w = sigImg.width * ratio;
    const h = sigImg.height * ratio;
    currentRightImgX -= w;
    doc.addImage(
      sigImg.dataUrl,
      'PNG',
      currentRightImgX,
      signY + (stampAreaHeight - h) / 2,
      w,
      h,
      undefined,
      'FAST'
    );
    currentRightImgX -= 4;
  }

  if (sealImg) {
    const maxSealBox = 20;
    const ratio = Math.min(maxSealBox / sealImg.width, maxSealBox / sealImg.height);
    const w = sealImg.width * ratio;
    const h = sealImg.height * ratio;
    currentRightImgX -= w;
    doc.addImage(
      sealImg.dataUrl,
      'PNG',
      currentRightImgX,
      signY + (stampAreaHeight - h) / 2,
      w,
      h,
      undefined,
      'FAST'
    );
  }

  const sigLineY = signY + stampAreaHeight + 2;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(rightX - 48, sigLineY, rightX, sigLineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(settings?.signatoryName || 'Authorized Signature', rightX, sigLineY + 4, {
    align: 'right'
  });

  if (settings?.signatoryTitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(100, 116, 139);
    doc.text(settings.signatoryTitle, rightX, sigLineY + 7.5, { align: 'right' });
  }

  // =========================================================================
  // 5. PAGE NUMBERS & TIMESTAMP FOOTER ON ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  const clientScopeLabel = selectedClient
    ? selectedClient.company || selectedClient.name
    : 'All Clients (Consolidated)';

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 8;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 3.5, pageWidth - margin, footerY - 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${docTitle} · ${clientScopeLabel} · Period: ${periodLabel} · Generated ${todayFormatted}`,
      margin,
      footerY
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  const scopeSlug = selectedClient
    ? (selectedClient.company || selectedClient.name).replace(/[^a-zA-Z0-9_-]/g, '_')
    : 'All_Clients';
  const finalFilename =
    filename ||
    `Statement_of_Account_${scopeSlug}_${new Date().toISOString().split('T')[0]}.pdf`;

  doc.save(finalFilename.endsWith('.pdf') ? finalFilename : `${finalFilename}.pdf`);
  return true;
};

/**
 * Generates and downloads a formal Account Clearance Certificate PDF directly using jsPDF.
 */
export const exportClearanceCertificateToPdf = async (params: {
  selectedClient: Client | null;
  periodLabel: string;
  totalInvoiced: number;
  currencyCode: string;
  currencySymbol: string;
  settings?: CompanySettings;
  applySignature: boolean;
  applySeal: boolean;
}): Promise<boolean> => {
  const {
    selectedClient,
    periodLabel,
    totalInvoiced,
    currencyCode,
    currencySymbol,
    settings,
    applySignature,
    applySeal
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const [sigImg, sealImg] = await Promise.all([
    applySignature && settings?.signatureUrl
      ? loadImageAsPngDataUrl(settings.signatureUrl)
      : Promise.resolve(null),
    applySeal && settings?.companySealUrl
      ? loadImageAsPngDataUrl(settings.companySealUrl)
      : Promise.resolve(null)
  ]);

  // Outer Certificate Frame
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, 25, contentWidth, 130, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(
    (settings?.name || 'AF CREATIVE FLOW').toUpperCase(),
    pageWidth / 2,
    40,
    { align: 'center' }
  );

  doc.setFontSize(9.5);
  doc.setTextColor(4, 120, 87);
  doc.text(
    'CERTIFICATE OF FINANCIAL CLEARANCE & ZERO BALANCE',
    pageWidth / 2,
    47,
    { align: 'center' }
  );

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin + 12, 53, pageWidth - margin - 12, 53);

  const clientName = selectedClient
    ? selectedClient.company || selectedClient.name
    : 'Consolidated Clients';
  const safeCurr =
    currencyCode?.toUpperCase() === 'AED' ? 'AED' : currencyCode || 'AED';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const bodyText = `This is to certify that the account of ${clientName} for the statement period (${periodLabel}) has been settled in full, with a total billed amount of ${safeCurr} ${formatPdfNumber(
    totalInvoiced
  )} and a closing outstanding balance of ${safeCurr} 0.00.`;
  const wrappedBody = doc.splitTextToSize(bodyText, contentWidth - 24);
  doc.text(wrappedBody, margin + 12, 66);

  const todayFormatted = formatPdfDate(new Date().toISOString().split('T')[0]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Date of Issue:', margin + 12, 132);
  doc.setFont('helvetica', 'normal');
  doc.text(todayFormatted, margin + 12, 137);

  const rightEdge = pageWidth - margin - 12;
  let imgX = rightEdge;
  if (sigImg) {
    const ratio = Math.min(36 / sigImg.width, 16 / sigImg.height);
    const w = sigImg.width * ratio;
    const h = sigImg.height * ratio;
    imgX -= w;
    doc.addImage(sigImg.dataUrl, 'PNG', imgX, 110 + (18 - h) / 2, w, h, undefined, 'FAST');
    imgX -= 4;
  }
  if (sealImg) {
    const ratio = Math.min(20 / sealImg.width, 20 / sealImg.height);
    const w = sealImg.width * ratio;
    const h = sealImg.height * ratio;
    imgX -= w;
    doc.addImage(sealImg.dataUrl, 'PNG', imgX, 108 + (20 - h) / 2, w, h, undefined, 'FAST');
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(rightEdge - 48, 131, rightEdge, 131);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(settings?.signatoryName || 'Authorized Signatory', rightEdge, 136, {
    align: 'right'
  });
  if (settings?.signatoryTitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(settings.signatoryTitle, rightEdge, 140, { align: 'right' });
  }

  const slug = clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Clearance_Certificate_${slug}_${new Date().toISOString().split('T')[0]}.pdf`);
  return true;
};


/**
 * Cleanly print an element by isolating its HTML into a hidden iframe
 * and triggering print on that iframe. This completely avoids iframe / sidebar
 * layout issues, scroll clipping, or unstyled outputs.
 */
export const printElementDirectly = (elementId: string, title?: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        window.print();
        resolve(true);
        return;
      }

      // Collect all stylesheets and style tags from current document
      let stylesHtml = '';
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        stylesHtml += node.outerHTML;
      });

      // Create a hidden print iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('title', title || 'Print Document');
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        window.print();
        resolve(true);
        return;
      }

      // Clone content and remove any elements marked with .no-print
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.no-print').forEach((el) => el.remove());
      clone.querySelectorAll('.hidden.print\\:block, [class*="print:block"]').forEach((el) => {
        (el as HTMLElement).style.display = 'block';
      });

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${title || 'Document'}</title>
            ${stylesHtml}
            <style>
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'UAEDirham', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 12px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print { display: none !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 6px 8px; }
            </style>
          </head>
          <body>
            ${clone.outerHTML}
          </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.error('Iframe print error, falling back to window.print', err);
          window.print();
          resolve(true);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 350);
    } catch (e) {
      console.error('Print failed:', e);
      window.print();
      resolve(false);
    }
  });
};

/**
 * Exports any DOM element to a clean, crisp A4 PDF file and triggers instant browser download.
 */
export const downloadElementAsPdf = async (
  elementId: string,
  filename: string,
  onProgress?: ExportProgressCallback
): Promise<boolean> => {
  try {
    if (onProgress) onProgress('preparing', 'Preparing document for PDF export...');
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found.`);
    }

    // Scroll to top of element to ensure full capture
    element.scrollIntoView();

    if (onProgress) onProgress('rendering', 'Rendering high-resolution canvas...');

    // High quality canvas capture with onclone transforming inputs/textareas/selects into clean visible text
    const canvas = await html2canvas(element, {
      scale: 2, // High resolution (2x retina)
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      onclone: (clonedDoc, clonedElement) => {
        // 1. Hide interactive non-printable elements
        clonedElement.querySelectorAll('.no-print').forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });

        // 2. Make all print fallback elements visible
        clonedElement.querySelectorAll('.hidden.print\\:block, [class*="print:block"], .print-visible, .item-description-print, .item-qty-print, .item-rate-print, .notes-print').forEach((el) => {
          (el as HTMLElement).style.display = 'block';
          (el as HTMLElement).classList.remove('hidden');
        });

        // 3. Convert any inputs to visible rendered text
        clonedElement.querySelectorAll('input').forEach((input) => {
          if (input.type === 'button' || input.type === 'submit') return;
          if (input.parentElement?.querySelector('.print\\:block, .item-description-print, .item-qty-print, .item-rate-print')) {
            // Already handled by print sibling
            return;
          }
          const span = clonedDoc.createElement('span');
          span.textContent = input.value || '';
          span.className = input.className.replace('no-print', '').replace('bg-slate-100', 'bg-transparent');
          input.parentNode?.replaceChild(span, input);
        });

        // 4. Convert textareas to pre-lined text blocks
        clonedElement.querySelectorAll('textarea').forEach((ta) => {
          if (ta.parentElement?.querySelector('.print\\:block, .notes-print')) {
            return;
          }
          const div = clonedDoc.createElement('div');
          div.textContent = ta.value || '';
          div.style.whiteSpace = 'pre-line';
          div.className = 'text-sm text-slate-700 leading-relaxed';
          ta.parentNode?.replaceChild(div, ta);
        });

        // 5. Convert select dropdowns to selected text
        clonedElement.querySelectorAll('select').forEach((sel) => {
          if (sel.parentElement?.querySelector('.print\\:block')) {
            return;
          }
          const selectedText = sel.options[sel.selectedIndex]?.text || '';
          const div = clonedDoc.createElement('div');
          div.textContent = selectedText;
          div.className = 'font-bold text-slate-900 text-base';
          sel.parentNode?.replaceChild(div, sel);
        });
      }
    });

    if (onProgress) onProgress('saving', 'Generating PDF file...');

    const imgData = canvas.toDataURL('image/png');
    
    // A4 dimensions in mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = 210; // A4 width
    const pdfHeight = 297; // A4 height
    
    // Calculate aspect ratio
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    // Handle multi-page if content exceeds 1 page
    while (heightLeft > 5) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    if (onProgress) onProgress('done', 'PDF downloaded successfully!');
    return true;
  } catch (error) {
    console.error('PDF export failed:', error);
    if (onProgress) onProgress('error', 'Could not generate PDF. Opening print dialog instead.');
    
    // Fallback: Direct print to PDF
    printElementDirectly(elementId, filename);
    return false;
  }
};

/**
 * Programmatically generates a standalone, styled HTML file download as an ultra-reliable
 * offline backup if browser blocking prevents canvas capture.
 */
export const downloadDocumentAsHtml = (
  elementId: string, 
  filename: string, 
  title: string
) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print').forEach((el) => el.remove());
  clone.querySelectorAll('.hidden.print\\:block, [class*="print:block"]').forEach((el) => {
    (el as HTMLElement).style.display = 'block';
  });

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #f8fafc; padding: 40px 20px; }
    .date-badge-black { background: #000; color: #fff; padding: 6px 14px; border-radius: 8px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-xl">
    ${clone.outerHTML}
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.html') ? filename : `${filename}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


export enum ProjectType {
  VIDEO_PRODUCTION = 'Video Production',
  PRODUCT_SHOOT = 'Product Shoot',
  AD_CAMPAIGN = 'Ad Campaign',
  POSTER_DESIGN = 'Poster Design',
  POST_PRODUCTION = 'Post Production',
  SOCIAL_MEDIA = 'Social Media'
}

export enum InvoiceStatus {
  QUOTATION = 'Quotation',
  PROFORMA = 'Proforma',
  DRAFT = 'Draft',
  SENT = 'Sent',
  PAID = 'Paid',
  OVERDUE = 'Overdue'
}

export enum PaymentMethod {
  CASH = 'Cash',
  BANK_TRANSFER = 'Bank Transfer',
  CHEQUE = 'Cheque',
  ONLINE = 'Online Payment'
}

export enum ExpenseCategory {
  FUEL = 'Fuel',
  FOOD = 'Food',
  TAXI = 'Taxi',
  EQUIPMENT = 'Equipment',
  TRAVEL = 'Travel',
  MARKETING = 'Marketing',
  OTHER = 'Other'
}

export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff'
}

export interface StaffPermissions {
  canManageInvoices: boolean;
  canManageExpenses: boolean;
  canManageClients: boolean;
  canViewStatements: boolean;
  canUseAI: boolean;
  canAccessSettings: boolean;
  canCreateInvoices?: boolean;
  canLogExpenses?: boolean;
  canViewStaff?: boolean;
  canUseGemini?: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  password?: string;
  role: UserRole;
  email?: string;
  phone?: string;
  permissions?: StaffPermissions;
  avatar?: string;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  address: string;
  trn?: string;
  phone?: string;
  notes?: string;
  orderIndex?: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  basicSalary: number;
  standardDays: number;
  allowances?: number;
  joinDate?: string;
  status: 'active' | 'inactive';
}

export interface StaffAdvance {
  id: string;
  staffId: string;
  date: string;
  amount: number;
  reason: string;
  paymentMethod?: PaymentMethod | string;
  month: string;
}

export interface StaffAttendanceRecord {
  id: string;
  staffId: string;
  month: string;
  totalMonthDays: number;
  daysWorked: number;
  absentDays: number;
  overtimeBonus?: number;
  advanceDeducted?: number;
  otherDeductions?: number;
  notes?: string;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
  paymentDate?: string;
}

export interface LineItem {
  id: string;
  description: string;
  serviceType: ProjectType;
  category?: string;
  service?: string;
  quantity: number;
  rate: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  documentType?: 'INVOICE' | 'PROFORMA' | 'QUOTATION';
  items: LineItem[];
  notes?: string;
  taxRate: number;
  currency: string;
  discount: number;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  includeSignature?: boolean;
  includeSeal?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory | string;
  amount: number;
  description: string;
  currency: string;
  vendor?: string;
  paymentMethod?: PaymentMethod | string;
  receiptNumber?: string;
  taxAmount?: number;
  quantity?: number;
  unitPrice?: number;
  notes?: string;
  clientId?: string;
}

export interface CompanySettings {
  name: string;
  email: string;
  address: string;
  logoUrl: string;
  defaultCurrency: string;
  currency?: string;
  currencySymbol?: string;
  country?: string;
  countryName?: string;
  defaultTaxRate: number;
  taxRate?: number;
  taxName?: string;
  vatNumber: string;
  trnNumber?: string;
  phone?: string;
  bankName?: string;
  bankAccount?: string;
  bankDetails?: string;
  invoiceFooterNote?: string;
  signatureUrl?: string;
  companySealUrl?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  autoApplySignature?: boolean;
  autoApplySeal?: boolean;
  driveSyncEmail?: string;
  autoDriveSync?: boolean;
  lastDriveSync?: string;
  // Header Status Symbol & Save Animation Settings
  headerStatusMode?: 'symbol' | 'hidden';
  // AI Tool Customization & Manual Move Settings
  aiFloatingEnabled?: boolean;
  aiNavEnabled?: boolean;
  aiButtonStyle?: 'full' | 'compact' | 'icon';
  aiPositionPreset?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'custom';
  aiCustomPosition?: { x: number; y: number } | null;
  aiDraggable?: boolean;
  aiThemeColor?: 'indigo' | 'emerald' | 'violet' | 'slate' | 'amber';
  aiDefaultMode?: 'hybrid' | 'offline' | 'cloud';
  // Invoice & Statement Format & Template Customization Settings
  invoicePrefix?: string;
  beneficiaryName?: string;
  iban?: string;
  invoiceTemplate?:
    | 'executive_indigo'
    | 'emirates_gold'
    | 'dubai_minimal'
    | 'corporate_navy'
    | 'modern_emerald'
    | 'classic_ledger'
    | 'creative_agency'
    | 'compact_commercial';
  invoiceAccentColor?: string;
  invoiceHeaderLayout?: 'split' | 'banner' | 'centered' | 'reversed';
  invoiceTableStyle?: 'striped' | 'bordered' | 'minimal';
  invoiceFontStyle?: 'sans' | 'serif' | 'mono';
  invoiceCustomTitle?: string;
  invoiceShowCategoryCol?: boolean;
  invoiceShowBankDetails?: boolean;
  invoiceCompactMode?: boolean;
  statementTemplate?:
    | 'standard_audit'
    | 'executive_navy'
    | 'emirates_gold_ledger'
    | 'minimal_clean'
    | 'emerald_financial'
    | 'classic_boxed'
    | 'corporate_teal'
    | 'compact_statement';
  statementAccentColor?: string;
  statementHeaderLayout?: 'split' | 'banner' | 'centered' | 'reversed';
  statementTableStyle?: 'striped' | 'bordered' | 'minimal';
  statementCustomTitle?: string;
  statementShowSummaryBox?: boolean;
  statementShowRemittance?: boolean;
  statementCompactMode?: boolean;
  statementDefaultView?: 'date_wise' | 'month_wise' | 'category_wise';
  statementDefaultOrientation?: 'portrait' | 'landscape';
}

export type View = 'dashboard' | 'invoices' | 'clients' | 'statements' | 'expenses' | 'staff' | 'ai-helper' | 'settings';

export type GeminiModelType = 'gemini-3.8-flash' | 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite' | 'local-offline-ai';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: GeminiModelType;
  rolePreset?: string;
  isError?: boolean;
}

export interface ChatRolePreset {
  id: string;
  name: string;
  description: string;
  iconName: string;
  defaultModel: GeminiModelType;
  systemInstruction: string;
  suggestedPrompts: string[];
}

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

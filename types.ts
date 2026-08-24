
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
  quantity: number;
  rate: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  items: LineItem[];
  notes?: string;
  taxRate: number;
  currency: string;
  discount: number;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
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
  invoiceFooterNote?: string;
  driveSyncEmail?: string;
  autoDriveSync?: boolean;
  lastDriveSync?: string;
}

export type View = 'dashboard' | 'invoices' | 'clients' | 'statements' | 'expenses' | 'staff' | 'ai-helper' | 'settings';

export type GeminiModelType = 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite';

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

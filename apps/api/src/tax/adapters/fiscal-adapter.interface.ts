// ─── OFD Fiscal Adapter Interface (Provider-agnostic) ──────────────────────
// Har qanday OFD provider (REGOS, SmartFiscal, va boshqalar)
// shu interfeysni implement qiladi.
// ⚠️ Sale ni HECH QACHON block qilma fiscal xato bo'lsa

export interface FiscalReceiptPayload {
  tenantId: string;
  orderId: string;
  orderNumber: number;
  total: number;
  taxAmount: number;
  items: FiscalReceiptItem[];
  cashierName: string;
  branchName?: string;
  inn?: string;
  createdAt: Date;
}

export interface FiscalReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  ikpuCode?: string;
}

export interface FiscalReceiptResult {
  fiscalId: string;
  fiscalQr: string;
  terminalId?: string;
  fiscalSign?: string;
  sentAt: Date;
  provider: string;
}

export interface FiscalZReportPayload {
  tenantId: string;
  sequenceNumber: number;
  date: Date;
  totalRevenue: number;
  totalTax: number;
  totalOrders: number;
  cashAmount: number;
  terminalAmount: number;
}

export interface FiscalZReportResult {
  fiscalZId: string;
  sentAt: Date;
  provider: string;
}

export interface FiscalAdapter {
  readonly provider: string;

  sendReceipt(payload: FiscalReceiptPayload): Promise<FiscalReceiptResult>;
  sendZReport(payload: FiscalZReportPayload): Promise<FiscalZReportResult>;
  checkReceipt(qrCodeUrl: string): Promise<{ valid: boolean; data?: Record<string, unknown> }>;
}

export const FISCAL_ADAPTER = Symbol('FISCAL_ADAPTER');

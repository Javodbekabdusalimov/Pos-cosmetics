import { Injectable, Logger } from '@nestjs/common';
import type {
  FiscalAdapter,
  FiscalReceiptPayload,
  FiscalReceiptResult,
  FiscalZReportPayload,
  FiscalZReportResult,
} from './fiscal-adapter.interface';

// ─── Stub OFD Adapter (dev/test) ────────────────────────────────────────────
// OFD_PROVIDER=STUB yoki OFD env yo'q bo'lsa ishlaydi
// Real API chaqirmaydi — simulatsiya qiladi

@Injectable()
export class StubAdapter implements FiscalAdapter {
  readonly provider = 'STUB';
  private readonly logger = new Logger(StubAdapter.name);

  async sendReceipt(payload: FiscalReceiptPayload): Promise<FiscalReceiptResult> {
    this.logger.warn(`STUB: simulating receipt for order=${payload.orderId}`, {
      tenantId: payload.tenantId,
    });

    const fiscalId = `STUB-${payload.orderId.slice(0, 8).toUpperCase()}-${Date.now()}`;

    return {
      fiscalId,
      fiscalQr: `https://ofd.soliq.uz/epi?t=STUB000001&r=${payload.orderNumber}&c=${this.timestamp()}&s=${fiscalId}`,
      terminalId: 'STUB000001',
      fiscalSign: fiscalId,
      sentAt: new Date(),
      provider: this.provider,
    };
  }

  async sendZReport(payload: FiscalZReportPayload): Promise<FiscalZReportResult> {
    this.logger.warn(`STUB: simulating Z-report seq=#${payload.sequenceNumber}`, {
      tenantId: payload.tenantId,
    });

    return {
      fiscalZId: `STUB-Z-${payload.sequenceNumber}-${Date.now()}`,
      sentAt: new Date(),
      provider: this.provider,
    };
  }

  async checkReceipt(_qrCodeUrl: string): Promise<{ valid: boolean }> {
    return { valid: true };
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[-T:Z.]/g, '').slice(0, 14);
  }
}

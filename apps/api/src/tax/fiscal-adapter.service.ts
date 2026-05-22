import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  FiscalAdapter,
  FiscalReceiptPayload,
  FiscalReceiptResult,
  FiscalZReportPayload,
  FiscalZReportResult,
} from './adapters/fiscal-adapter.interface';
import { RegosAdapter } from './adapters/regos.adapter';
import { StubAdapter } from './adapters/stub.adapter';

// Re-export for backward compatibility
export type { FiscalReceiptPayload, FiscalReceiptResult, FiscalZReportPayload, FiscalZReportResult };

// ─── Fiscal Adapter Service (Provider-agnostic) ─────────────────────────────
// OFD_PROVIDER env orqali adapter tanlanadi:
//   REGOS → real REGOS OFD API
//   STUB  → dev/test simulatsiya (default)
//
// ⚠️ Sale ni HECH QACHON block qilma fiscal xato bo'lsa
//    Fail → PENDING, queue orqali retry (3x, exponential)

@Injectable()
export class FiscalAdapterService {
  private readonly logger = new Logger(FiscalAdapterService.name);
  private readonly adapter: FiscalAdapter;

  constructor(private readonly config: ConfigService) {
    const provider = this.config.get<string>('OFD_PROVIDER', 'STUB').toUpperCase();

    if (provider === 'REGOS' && this.config.get<string>('OFD_API_URL') && this.config.get<string>('OFD_API_KEY')) {
      this.adapter = new RegosAdapter(config);
      this.logger.log('Fiscal adapter: REGOS (real OFD)');
    } else {
      this.adapter = new StubAdapter();
      if (provider === 'REGOS') {
        this.logger.warn('OFD_PROVIDER=REGOS but OFD_API_URL/KEY missing — falling back to STUB');
      } else {
        this.logger.log('Fiscal adapter: STUB (dev/test)');
      }
    }
  }

  get provider(): string {
    return this.adapter.provider;
  }

  async sendReceipt(payload: FiscalReceiptPayload): Promise<FiscalReceiptResult> {
    return this.adapter.sendReceipt(payload);
  }

  async sendZReport(payload: FiscalZReportPayload): Promise<FiscalZReportResult> {
    return this.adapter.sendZReport(payload);
  }

  async checkReceipt(qrCodeUrl: string): Promise<{ valid: boolean; data?: Record<string, unknown> }> {
    return this.adapter.checkReceipt(qrCodeUrl);
  }
}

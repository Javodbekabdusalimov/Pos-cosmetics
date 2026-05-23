import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { extractVAT, UZ_VAT_RATE } from '../common/utils/currency.util';

// ─── VMQ 943 Receipt Template ─────────────────────────────────────────────────
// Chek formati O'zbekiston VMQ 943 ga mos:
// Kompaniya nomi, INN, mahsulotlar, 12% QQS, to'lov, fiscal ID, QR
// ⚠️ INN optional — E-IMZO Abdulaziz da, tenant da bor bo'lsa ko'rsatadi

export interface ReceiptData {
  // Header
  companyName: string;
  legalName: string | null;
  inn: string | null;
  branchName: string | null;
  branchAddress: string | null;

  // Order info
  orderId: string;
  orderNumber: number;
  cashierName: string;
  createdAt: Date;

  // Items
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;

  // Totals
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  vatRate: number;
  total: number;

  // Payments
  payments: Array<{
    method: string;
    amount: number;
  }>;

  // Fiscal
  fiscalStatus: string;
  fiscalId: string | null;
  fiscalQr: string | null;

  // Footer
  receiptHeader: string | null;
  receiptFooter: string | null;
}

export interface ReceiptTextResult {
  receipt: ReceiptData;
  text: string;
}

@Injectable()
export class ReceiptTemplateService {
  private readonly logger = new Logger(ReceiptTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── GET RECEIPT DATA ───────────────────────────────────────────────────────

  async getReceiptData(tenantId: string, orderId: string): Promise<ReceiptData> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        items: true,
        user: { select: { name: true } },
        branch: { select: { name: true, address: true } },
        tenant: {
          select: {
            name: true,
            legalName: true,
            inn: true,
          },
        },
        paymentIntents: {
          where: { status: 'SETTLED' },
          select: { method: true, amount: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { receiptHeader: true, receiptFooter: true },
    });

    const total = Number(order.total);
    const { subtotal, vatAmount } = extractVAT(total);

    return {
      companyName: order.tenant.name,
      legalName: order.tenant.legalName,
      inn: order.tenant.inn,
      branchName: order.branch?.name ?? null,
      branchAddress: order.branch?.address ?? null,

      orderId: order.id,
      orderNumber: order.orderNumber,
      cashierName: order.user.name,
      createdAt: order.createdAt,

      items: order.items.map((item) => ({
        name: item.productName,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discountAmount),
        total: Number(item.total),
      })),

      subtotal: Math.round(subtotal),
      discountAmount: Number(order.discountAmount),
      vatAmount: Math.round(vatAmount),
      vatRate: UZ_VAT_RATE,
      total,

      payments: order.paymentIntents.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),

      fiscalStatus: order.fiscalStatus,
      fiscalId: order.fiscalId,
      fiscalQr: order.fiscalQr,

      receiptHeader: settings?.receiptHeader ?? null,
      receiptFooter: settings?.receiptFooter ?? null,
    };
  }

  // ─── FORMAT AS TEXT ─────────────────────────────────────────────────────────
  // POS printer uchun 48 belgili kenglikda text format

  async getReceiptText(tenantId: string, orderId: string): Promise<ReceiptTextResult> {
    const receipt = await this.getReceiptData(tenantId, orderId);
    const text = this.formatReceiptText(receipt);

    this.logger.log(`Receipt generated for order ${orderId}`, { tenantId });

    return { receipt, text };
  }

  private formatReceiptText(r: ReceiptData): string {
    const W = 48; // thermal printer width (chars)
    const lines: string[] = [];

    const center = (s: string) => {
      const pad = Math.max(0, Math.floor((W - s.length) / 2));
      return ' '.repeat(pad) + s;
    };
    const divider = () => '='.repeat(W);
    const dashes = () => '-'.repeat(W);
    const leftRight = (left: string, right: string) => {
      const gap = Math.max(1, W - left.length - right.length);
      return left + ' '.repeat(gap) + right;
    };
    const fmt = (n: number) => n.toLocaleString('uz-UZ');

    // ─── Header
    if (r.receiptHeader) {
      lines.push(center(r.receiptHeader));
    }
    lines.push(center(r.companyName.toUpperCase()));
    if (r.legalName) {
      lines.push(center(r.legalName));
    }
    if (r.inn) {
      lines.push(center(`INN: ${r.inn}`));
    }
    if (r.branchName) {
      lines.push(center(r.branchName));
    }
    if (r.branchAddress) {
      lines.push(center(r.branchAddress));
    }

    lines.push(divider());

    // ─── Order info
    lines.push(leftRight(`Chek #${r.orderNumber}`, this.formatDate(r.createdAt)));
    lines.push(`Kassir: ${r.cashierName}`);

    lines.push(dashes());

    // ─── Items
    for (const item of r.items) {
      lines.push(item.name);
      const qtyLine = `  ${item.quantity} x ${fmt(item.unitPrice)}`;
      const totalStr = `${fmt(item.total)} so'm`;
      lines.push(leftRight(qtyLine, totalStr));
      if (item.discount > 0) {
        lines.push(leftRight('  Chegirma', `-${fmt(item.discount)} so'm`));
      }
    }

    lines.push(dashes());

    // ─── Totals
    if (r.discountAmount > 0) {
      lines.push(leftRight('Chegirma:', `-${fmt(r.discountAmount)} so'm`));
    }
    lines.push(leftRight('Subtotal:', `${fmt(r.subtotal)} so'm`));
    lines.push(leftRight(`QQS (${r.vatRate * 100}%):`, `${fmt(r.vatAmount)} so'm`));

    lines.push(divider());
    lines.push(leftRight('JAMI:', `${fmt(r.total)} so'm`));
    lines.push(divider());

    // ─── Payments
    if (r.payments.length > 0) {
      for (const p of r.payments) {
        const label = this.paymentMethodLabel(p.method);
        lines.push(leftRight(label, `${fmt(p.amount)} so'm`));
      }
      lines.push(dashes());
    }

    // ─── Fiscal
    if (r.fiscalId) {
      lines.push(`Fiskal ID: ${r.fiscalId}`);
    }
    if (r.fiscalQr) {
      lines.push(`QR: ${r.fiscalQr}`);
    }
    if (r.fiscalStatus === 'PENDING' || r.fiscalStatus === 'FAILED') {
      lines.push(center('* Fiskal chek kutilmoqda *'));
    }

    // ─── Footer
    lines.push('');
    if (r.receiptFooter) {
      lines.push(center(r.receiptFooter));
    } else {
      lines.push(center('Xaridingiz uchun rahmat!'));
    }

    return lines.join('\n');
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  }

  private paymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      CASH: 'Naqd',
      TERMINAL: 'Terminal',
      CLICK: 'Click',
      PAYME: 'Payme',
      BANK_TRANSFER: 'Bank o\'tkazma',
    };
    return labels[method] ?? method;
  }
}

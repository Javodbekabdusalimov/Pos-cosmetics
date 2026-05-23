import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TaxService } from './tax.service';
import { ReceiptTemplateService } from './receipt-template.service';

@ApiTags('Tax / Fiscal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tax')
export class TaxController {
  constructor(
    private readonly taxService: TaxService,
    private readonly receiptTemplateService: ReceiptTemplateService,
  ) {}

  @Get('report')
  @ApiOperation({ summary: 'Davriy QQS (NDS) hisoboti — 12% VAT' })
  @ApiQuery({ name: 'from', type: String, description: 'ISO date: 2026-01-01' })
  @ApiQuery({ name: 'to', type: String, description: 'ISO date: 2026-01-31' })
  getTaxReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.taxService.getTaxReport(tenantId, from, to);
  }

  @Get('fiscal/:orderId')
  @ApiOperation({ summary: 'Buyurtma fiskal holati' })
  getFiscalStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.taxService.getFiscalStatus(tenantId, orderId);
  }

  @Post('fiscal/:orderId/retry')
  @ApiOperation({ summary: 'Fiskal chek qayta yuborish (FAILED holatdagi)' })
  retryFiscal(
    @CurrentUser('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.taxService.retryFiscal(tenantId, orderId);
  }

  // ─── RECEIPT TEMPLATE (M-6) ─────────────────────────────────────────────────

  @Get('receipt/:orderId')
  @ApiOperation({ summary: 'Chek ma\'lumotlari (JSON) — VMQ 943 format' })
  getReceiptData(
    @CurrentUser('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.receiptTemplateService.getReceiptData(tenantId, orderId);
  }

  @Get('receipt/:orderId/text')
  @ApiOperation({ summary: 'Chek text format (POS printer uchun)' })
  getReceiptText(
    @CurrentUser('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.receiptTemplateService.getReceiptText(tenantId, orderId);
  }
}

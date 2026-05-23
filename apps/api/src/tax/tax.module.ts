import { Module } from '@nestjs/common';
import { TaxService } from './tax.service';
import { TaxController } from './tax.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../common/queue/queue.module';
import { FiscalAdapterService } from './fiscal-adapter.service';
import { ReceiptTemplateService } from './receipt-template.service';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [TaxController],
  providers: [TaxService, FiscalAdapterService, ReceiptTemplateService],
  exports: [TaxService, FiscalAdapterService, ReceiptTemplateService],
})
export class TaxModule {}

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Post, HttpException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ZzoneOutboundService } from './zzone-outbound.service';

class ZzoneConnectDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  password!: string;
}

class ZzoneTokenDto {
  @ApiProperty({ description: 'Pre-generated ZZone JWT token (alternative to phone/password)' })
  @IsOptional()
  @IsString()
  token?: string;
}

@ApiTags('ZZone Integration')
@ApiBearerAuth()
@Controller('integrations/zzone')
@Roles('OWNER', 'ADMIN')
export class ZzoneSettingsController {
  private readonly logger = new Logger(ZzoneSettingsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: ZzoneOutboundService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'ZZone (Adetal) integration holati' })
  async getStatus(@CurrentTenant() tenantId: string) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'ZZONE' } },
    });

    if (!config) return { exists: false, isActive: false, productCount: 0, hasToken: false };

    const cfg = (config.config ?? {}) as { token?: string; productMappings?: Record<string, string> };
    const isAlive = cfg.token ? await this.outbound.healthCheck() : false;

    return {
      exists:       true,
      isActive:     config.isActive,
      hasToken:     !!cfg.token,
      productCount: Object.keys(cfg.productMappings ?? {}).length,
      apiAlive:     isAlive,
      updatedAt:    config.updatedAt,
    };
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ZZone (Adetal) phone+password bilan ulash — token oladi va saqlaydi' })
  async connect(
    @CurrentTenant() tenantId: string,
    @Body() dto: ZzoneConnectDto,
  ) {
    const { token } = await this.outbound.login(dto.phone, dto.password);

    await this.upsertConfig(tenantId, token, true);
    this.logger.log(`[ZZone] Tenant ${tenantId} connected via phone login`);

    return { success: true, connected: true };
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ZZone tokenni to\'g\'ridan-to\'g\'ri saqlash (Adetal admin tomonidan berilgan token)' })
  async saveToken(
    @CurrentTenant() tenantId: string,
    @Body() dto: ZzoneTokenDto,
  ) {
    if (!dto.token) return { success: false, message: 'token is required' };

    await this.upsertConfig(tenantId, dto.token, true);
    return { success: true, saved: true };
  }

  @Post('sync-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Barcha mahsulotlarni RAOS → Adetal'ga yuborish (bir martalik to\'liq sync)' })
  async syncAll(@CurrentTenant() tenantId: string) {
    const zzoneConfig = await this.getZzoneConfigFull(tenantId);
    if (!zzoneConfig) {
      throw new HttpException('Avval Adetal bilan ulaning (connect qiling)', HttpStatus.BAD_REQUEST);
    }

    // Get all active products for this tenant
    const products = await this.prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, sellPrice: true, description: true, imageUrl: true, sku: true },
    });

    const pushed:  Array<{ productId: string; zzoneId: string }> = [];
    const failed:  Array<{ productId: string; error: string }>   = [];
    const already: string[] = [];
    const currentMappings = { ...zzoneConfig.productMappings };

    for (const p of products) {
      // Skip if already mapped
      if (currentMappings[p.id]) {
        already.push(p.id);
        continue;
      }
      try {
        const result = await this.outbound.createProduct(zzoneConfig.token, {
          name:        p.name,
          price:       Number(p.sellPrice),
          category:    'cosmetics',
          description: p.description ?? '',
          stock:       0,
          externalId:  p.id,
        });
        currentMappings[p.id] = result.zzoneProductId;
        pushed.push({ productId: p.id, zzoneId: result.zzoneProductId });
      } catch (err) {
        failed.push({ productId: p.id, error: (err as Error).message });
      }
    }

    // Save updated mappings
    if (pushed.length > 0) {
      const existing = await this.prisma.integrationConfig.findUnique({
        where: { tenantId_provider: { tenantId, provider: 'ZZONE' } },
      });
      if (existing) {
        const cfg = (existing.config ?? {}) as Record<string, unknown>;
        cfg.token           = zzoneConfig.token;
        cfg.productMappings = currentMappings;
        await this.prisma.integrationConfig.update({
          where: { id: existing.id },
          data:  { config: cfg as object },
        });
      }
    }

    this.logger.log(`[ZZone SyncAll] tenant=${tenantId} pushed=${pushed.length} failed=${failed.length} already=${already.length}`);

    return {
      success: true,
      pushed:  pushed.length,
      failed:  failed.length,
      already: already.length,
      errors:  failed.slice(0, 10),
    };
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ZZone integratsiyani o\'chirish' })
  async disconnect(@CurrentTenant() tenantId: string) {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'ZZONE' } },
    });

    if (!config) return { success: true, message: 'Already disconnected' };

    const cfg = (config.config ?? {}) as Record<string, unknown>;
    cfg.token = '';

    await this.prisma.integrationConfig.update({
      where: { id: config.id },
      data: { config: cfg as object, isActive: false },
    });

    return { success: true, disconnected: true };
  }

  private async getZzoneConfigFull(tenantId: string): Promise<{
    token: string;
    productMappings: Record<string, string>;
  } | null> {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'ZZONE' } },
    });
    if (!config || !config.isActive) return null;
    const cfg = (config.config ?? {}) as { token?: string; productMappings?: Record<string, string> };
    if (!cfg.token) return null;
    return { token: cfg.token, productMappings: cfg.productMappings ?? {} };
  }

  private async upsertConfig(tenantId: string, token: string, isActive: boolean) {
    const existing = await this.prisma.integrationConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider: 'ZZONE' } },
    });

    if (existing) {
      const cfg = (existing.config ?? {}) as Record<string, unknown>;
      cfg.token = token;
      await this.prisma.integrationConfig.update({
        where: { id: existing.id },
        data: { config: cfg as object, isActive },
      });
    } else {
      await this.prisma.integrationConfig.create({
        data: {
          tenantId,
          provider: 'ZZONE',
          config: { token, productMappings: {} },
          isActive,
        },
      });
    }
  }
}

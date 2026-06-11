import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * RAOS → ZZone (Outbound)
 *
 * Pushes data FROM RAOS TO ZZone automatically.
 * Called by event listeners when products/stock change.
 */

@Injectable()
export class ZzoneOutboundService {
  private readonly logger = new Logger(ZzoneOutboundService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('ZZONE_API_URL');
    if (!url) {
      this.logger.warn('ZZONE_API_URL not set — outbound sync disabled');
    }
    this.baseUrl = url || '';
  }

  // ─── AUTH ────────────────────────────────────────────────────────────

  async login(phone: string, password: string): Promise<{ token: string; userId: string }> {
    const res = await this.request('POST', '/api/auth/login', { phone, password }) as {
      token: string;
      user: { id: string };
    };
    return { token: res.token, userId: res.user.id };
  }

  // ─── PRODUCTS (push to ZZone) ───────────────────────────────────────

  async createProduct(
    token: string,
    product: { name: string; price: number; category: string; description?: string; stock: number },
  ): Promise<{ zzoneProductId: string }> {
    const res = await this.request('POST', '/api/products', product, token) as {
      product: { _id: string };
    };
    return { zzoneProductId: res.product._id };
  }

  async updateProduct(
    token: string,
    zzoneProductId: string,
    updates: Partial<{ name: string; price: number; stock: number; description: string }>,
  ): Promise<void> {
    await this.request('PATCH', `/api/products/${zzoneProductId}`, updates, token);
  }

  async updateStock(token: string, zzoneProductId: string, stock: number): Promise<void> {
    await this.request('PATCH', `/api/products/${zzoneProductId}`, { stock }, token);
  }

  async deleteProduct(token: string, zzoneProductId: string): Promise<void> {
    await this.request('DELETE', `/api/products/${zzoneProductId}`, undefined, token);
  }

  // ─── ORDERS (pull from ZZone) ───────────────────────────────────────

  async getSellerOrders(
    token: string,
    params?: { status?: string; page?: number },
  ): Promise<{ orders: unknown[]; pagination: Record<string, unknown> }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request('GET', `/api/orders/seller${qs}`, undefined, token) as Promise<{
      orders: unknown[];
      pagination: Record<string, unknown>;
    }>;
  }

  async updateOrderStatus(token: string, orderId: string, status: string): Promise<void> {
    await this.request('PATCH', `/api/orders/${orderId}/status`, { status }, token);
  }

  // ─── HEALTH ──────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── INTERNAL ────────────────────────────────────────────────────────

  private async request(method: string, path: string, body?: unknown, token?: string): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = { method, headers, signal: AbortSignal.timeout(15000) };
    if (body && method !== 'GET') options.body = JSON.stringify(body);

    this.logger.debug(`[ZZone→] ${method} ${path}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      this.logger.error(`[ZZone→] ${method} ${path} → ${response.status}`, { body: errorBody });
      throw new Error(`ZZone API ${response.status}: ${errorBody}`);
    }

    const json = await response.json();
    if (json.success === false) {
      throw new Error(`ZZone: ${json.message}`);
    }
    return json.data;
  }
}

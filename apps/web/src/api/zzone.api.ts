import { apiClient } from './client';

export interface ZzoneStatus {
  exists: boolean;
  isActive: boolean;
  hasToken: boolean;
  productCount: number;
  apiAlive: boolean;
  updatedAt?: string;
}

export const zzoneApi = {
  getStatus(): Promise<ZzoneStatus> {
    return apiClient.get<ZzoneStatus>('/integrations/zzone/status').then((r) => r.data);
  },

  connect(phone: string, password: string): Promise<{ success: boolean; connected: boolean }> {
    return apiClient.post('/integrations/zzone/connect', { phone, password }).then((r) => r.data);
  },

  disconnect(): Promise<{ success: boolean }> {
    return apiClient.delete('/integrations/zzone/disconnect').then((r) => r.data);
  },
};

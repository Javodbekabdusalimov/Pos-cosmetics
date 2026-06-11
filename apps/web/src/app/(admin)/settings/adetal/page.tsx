'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2, CheckCircle2, AlertCircle, Loader2,
  Eye, EyeOff, RefreshCw, Unlink, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { zzoneApi } from '@/api/zzone.api';
import { PageLayout } from '@/components/layout/PageLayout';

export default function AdetalIntegrationPage() {
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['zzone-status'],
    queryFn: () => zzoneApi.getStatus(),
    refetchInterval: 30_000,
  });

  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const connectMut = useMutation({
    mutationFn: () => zzoneApi.connect(phone, password),
    onSuccess: () => {
      toast.success("Adetal bilan muvaffaqiyatli ulandi!");
      qc.invalidateQueries({ queryKey: ['zzone-status'] });
      setPassword('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Ulanishda xato yuz berdi. Telefon/parolni tekshiring.");
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => zzoneApi.disconnect(),
    onSuccess: () => {
      toast.success("Adetal integratsiyasi o'chirildi");
      qc.invalidateQueries({ queryKey: ['zzone-status'] });
    },
  });

  const isConnected = status?.isActive && status?.hasToken;

  return (
    <PageLayout title="Adetal Integratsiya" description="Adetal marketplace bilan mahsulot va buyurtmalarni sinxronlash">
      <div className="max-w-xl space-y-6">

        {/* Status Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Ulanish holati</h2>
            </div>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['zzone-status'] })}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Tekshirilmoqda...</span>
            </div>
          ) : isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="font-medium text-emerald-700">Ulangan</span>
                {status?.apiAlive && (
                  <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-600 px-2 py-0.5 rounded-full">
                    API faol
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Package className="w-4 h-4" />
                <span>{status?.productCount ?? 0} ta mahsulot sinxronlangan</span>
              </div>
              <button
                onClick={() => disconnectMut.mutate()}
                disabled={disconnectMut.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {disconnectMut.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Unlink className="w-4 h-4" />}
                Integratsiyani o&apos;chirish
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <AlertCircle className="w-5 h-5 text-gray-400" />
              <span className="text-sm">Adetal bilan ulanish sozlanmagan</span>
            </div>
          )}
        </div>

        {/* Connect Form */}
        {!isConnected && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-1">Adetal hisobini ulash</h2>
            <p className="text-sm text-gray-500 mb-4">
              Adetal sotuvchi hisobingizning telefon raqami va parolini kiriting.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Telefon raqam
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Parol
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Adetal parolingiz"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => connectMut.mutate()}
                disabled={connectMut.isPending || !phone || !password}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {connectMut.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Link2 className="w-4 h-4" />}
                Ulash
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900">Bu integratsiya nima qiladi?</p>
          <ul className="space-y-1.5">
            {[
              "RAOS'da mahsulot qo'shsangiz — Adetal'da ham avtomatik ko'rinadi",
              "Zaxira o'zgarganda Adetal'ga avtomatik yangilanadi",
              "Adetal'dan kelgan buyurtmalar RAOS'ga avtomatik tushadi",
            ].map((txt, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {txt}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </PageLayout>
  );
}

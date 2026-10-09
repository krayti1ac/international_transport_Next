import React from 'react';
import { verifyClearanceByHashAction } from '@/features/finance/services/financial-export.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/forex';
import { ShieldCheck, ShieldAlert, CheckCircle2, Building, Calendar, User, FileText, Lock } from 'lucide-react';

interface ClearanceVerifyPageProps {
  params: Promise<{ hash: string }>;
}

export default async function ClearanceVerifyPage({ params }: ClearanceVerifyPageProps) {
  const { hash } = await params;
  const result = await verifyClearanceByHashAction(hash);

  const isValid = result.isValid && result.statement;
  const stmt = result.statement;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-lg border-2 border-slate-200 dark:border-slate-800">
        <CardHeader className="text-center pb-4 border-b">
          <div className="mx-auto mb-3 flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
            {isValid ? (
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-rose-600" />
            )}
          </div>
          <CardTitle className="text-xl font-bold">
            {isValid ? 'وثيقة إبراء ذمة رسمية معتمدة' : 'فشل التحقق الرقمي من الوثيقة'}
          </CardTitle>
          <CardDescription className="text-xs">
            {isValid
              ? 'تم التحقق من صحة الكشف ومطابقته الرقمية مع سجلات شركة ترانس بودانون'
              : 'الرمز التشفيري لا يتطابق مع أي كشف رسمي مسجل في النظام'}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {isValid && stmt ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>شهادة التوثيق والأصالة نشطة</span>
                </div>
                <Badge className="bg-emerald-600 text-white font-mono text-xs">
                  {stmt.status.toUpperCase()}
                </Badge>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    رقم الكشف المرجعي:
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {stmt.statement_number}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    السائق المعني:
                  </span>
                  <span className="font-bold text-foreground">
                    {result.driverName || `#${stmt.driver_id}`}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    الفترة التشغيلية:
                  </span>
                  <span className="font-mono font-medium">
                    {stmt.period_start} ➔ {stmt.period_end}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">صافي الصرف المعتمد:</span>
                  <span className="font-mono font-black text-sm text-primary">
                    {formatCurrency(stmt.net_payout_mad, 'MAD')}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" />
                    الجهة المصدرة:
                  </span>
                  <span className="font-medium text-foreground">
                    Trans Bodanon S.A.R.L.
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border text-[10px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Lock className="w-3 h-3 text-primary" />
                  <span>الختم التشفيري (HMAC-SHA256):</span>
                </div>
                <div className="font-mono break-all text-[9px] text-muted-foreground">
                  {hash}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-2 text-rose-600">
              <p className="text-sm font-semibold">
                تحذير: هذه الوثيقة غير مسجلة أو قد تكون تعرضت للتعديل.
              </p>
              <p className="text-xs text-muted-foreground">
                يرجى التواصل مع الإدارة المالية لشركة ترانس بودانون للتأكد من صحة المستند المطبوع.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


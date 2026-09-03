import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "النقل الدولي - تسجيل الدخول",
  description: "نظام إدارة النقل الدولي",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full flex flex-col bg-gradient-to-br from-blue-100 via-blue-50 to-slate-100">
      {children}
    </div>
  );
}

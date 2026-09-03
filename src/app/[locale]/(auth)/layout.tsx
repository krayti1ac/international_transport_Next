import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trans Bodanon - Authentication",
  description: "International Transport Management System",
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

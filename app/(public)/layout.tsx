import { PublicFooter, PublicHeader } from "@/components/public-site-shell";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}

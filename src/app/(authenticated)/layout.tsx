import Sidebar from '@/app/_components/sidebar';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar />
      <main className="ml-[260px] transition-all duration-300">
        {children}
      </main>
    </div>
  );
}

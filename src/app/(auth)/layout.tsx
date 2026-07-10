import { Logo } from "@/components/branding/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-orange-50 via-background to-emerald-50 dark:from-background dark:via-background dark:to-background">
      <header className="flex justify-center px-4 py-8">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}

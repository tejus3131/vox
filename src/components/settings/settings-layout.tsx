"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Settings, Users, CreditCard, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface Props {
  orgSlug: string;
  children: React.ReactNode;
}

const navItems = [
  { href: "/settings", label: "General", icon: Settings },
  { href: "/settings/members", label: "Members", icon: Users },
  { href: "/settings/databases", label: "Databases", icon: Database },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
];

export function SettingsLayout({ orgSlug, children }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Link
            href={`/${orgSlug}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="text-border">/</span>
          <h1 className="font-semibold">Settings</h1>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex">
        <nav className="w-56 shrink-0 border-r border-border p-4 space-y-1 max-md:hidden">
          {navItems.map(({ href, label, icon: Icon }) => {
            const fullHref = `/${orgSlug}${href}`;
            const isActive = pathname === fullHref;
            return (
              <Link
                key={href}
                href={fullHref}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                  ${isActive
                    ? "bg-accent/60 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-6 md:p-10 max-w-4xl">
          {children}
        </main>
      </div>
    </div>
  );
}

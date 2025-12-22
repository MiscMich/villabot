'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users,
  ChevronRight,
  Shield,
  Loader2,
} from 'lucide-react';

const adminNavigation = [
  {
    name: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Platform metrics',
  },
  {
    name: 'Workspaces',
    href: '/admin/workspaces',
    icon: Building2,
    description: 'Manage workspaces',
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'Platform users',
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !profile?.is_platform_admin) {
      router.push('/dashboard');
    }
  }, [isLoading, profile, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!profile?.is_platform_admin) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Admin Sidebar */}
      <div className="flex h-full w-72 flex-col bg-card border-r border-border/50 relative overflow-hidden">
        {/* Background gradient decoration */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />

        {/* Logo Section */}
        <div className="relative flex h-20 items-center gap-3 px-6 border-b border-border/50">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl blur-lg opacity-50 animate-pulse-slow" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-xs text-muted-foreground font-medium">Platform Management</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-4 py-6 relative">
          <p className="px-3 mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Admin Navigation
          </p>
          {adminNavigation.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 relative overflow-hidden',
                  'opacity-0 animate-slide-in-right',
                  isActive
                    ? 'bg-gradient-to-r from-purple-500/15 to-purple-600/10 text-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-purple-400 to-purple-600 rounded-r-full" />
                )}

                {/* Icon container */}
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-md'
                      : 'bg-secondary/70 text-muted-foreground group-hover:bg-purple-500/10 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span
                    className={cn(
                      'block text-xs truncate transition-colors',
                      isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'
                    )}
                  >
                    {item.description}
                  </span>
                </div>

                {/* Arrow indicator */}
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-all duration-200',
                    isActive
                      ? 'text-purple-500 translate-x-0 opacity-100'
                      : 'text-muted-foreground -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* Back to Dashboard */}
        <div className="px-4 py-4 border-t border-border/50 relative">
          <Link
            href="/dashboard"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background">
              <LayoutDashboard className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1 text-left">
              <span className="block text-sm font-medium">Back to Dashboard</span>
              <span className="block text-xs text-muted-foreground">Main application</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

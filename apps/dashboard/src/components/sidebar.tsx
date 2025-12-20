'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Settings,
  BarChart3,
  Brain,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  MessageSquare,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  {
    name: 'Overview',
    href: '/',
    icon: LayoutDashboard,
    description: 'Dashboard & metrics',
  },
  {
    name: 'Documents',
    href: '/documents',
    icon: FileText,
    description: 'Knowledge base files',
  },
  {
    name: 'Knowledge',
    href: '/knowledge',
    icon: Brain,
    description: 'Learned facts & corrections',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Usage & performance',
  },
  {
    name: 'Conversations',
    href: '/conversations',
    icon: MessageSquare,
    description: 'Bot interactions',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Configuration',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for dark mode preference
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  return (
    <div className="flex h-full w-72 flex-col bg-card border-r border-border/50 relative overflow-hidden">
      {/* Background gradient decoration */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-amber-500/3 to-transparent pointer-events-none" />

      {/* Logo Section */}
      <div className="relative flex h-20 items-center gap-3 px-6 border-b border-border/50">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl blur-lg opacity-50 animate-pulse-slow" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">VillaBot</h1>
          <p className="text-xs text-muted-foreground font-medium">Admin Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6 relative">
        <p className="px-3 mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Navigation
        </p>
        {navigation.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 relative overflow-hidden',
                'opacity-0 animate-slide-in-right',
                isActive
                  ? 'bg-gradient-to-r from-amber-500/15 to-amber-600/10 text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-amber-400 to-amber-600 rounded-r-full" />
              )}

              {/* Icon container */}
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md'
                    : 'bg-secondary/70 text-muted-foreground group-hover:bg-amber-500/10 group-hover:text-amber-600 dark:group-hover:text-amber-400'
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
                    ? 'text-amber-500 translate-x-0 opacity-100'
                    : 'text-muted-foreground -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                )}
              />
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="px-4 py-4 border-t border-border/50 relative">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background">
            {isDark ? (
              <Moon className="h-4 w-4 text-amber-400" />
            ) : (
              <Sun className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <div className="flex-1 text-left">
            <span className="block text-sm font-medium">
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
            <span className="block text-xs text-muted-foreground">
              Click to toggle theme
            </span>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border/50 relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Villa Paraíso
            </p>
            <p className="text-xs text-muted-foreground/60">v0.1.0</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
            <span className="text-xs font-bold text-white">VP</span>
          </div>
        </div>
      </div>
    </div>
  );
}

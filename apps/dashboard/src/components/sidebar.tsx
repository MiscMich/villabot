'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Settings,
  BarChart3,
  Brain,
  Sparkles,
  ChevronRight,
  MessageSquare,
  Bot,
  ThumbsUp,
  Wand2,
  AlertCircle,
  Menu,
  X,
  LogOut,
  User,
  Users,
  CreditCard,
  Lightbulb,
} from 'lucide-react';
import { useState, useEffect, createContext, useContext } from 'react';
import { useSetupStatus, getSetupProgress } from '@/hooks/useSetupStatus';
import { useAuth } from '@/contexts/AuthContext';
import { fadeInUp, staggerContainer } from '@/lib/motion';

// Mobile sidebar context
const MobileSidebarContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <MobileSidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

export function MobileMenuButton() {
  const { isOpen, setIsOpen } = useMobileSidebar();
  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="md:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-void-elevated/80 backdrop-blur-xl border border-white/10 shadow-glass"
      aria-label="Toggle menu"
    >
      {isOpen ? (
        <X className="h-5 w-5 text-white" />
      ) : (
        <Menu className="h-5 w-5 text-white" />
      )}
    </button>
  );
}

const navigation = [
  {
    name: 'Overview',
    href: '/dashboard',
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
    name: 'Bots',
    href: '/bots',
    icon: Bot,
    description: 'Manage bot instances',
  },
  {
    name: 'Feedback',
    href: '/feedback',
    icon: ThumbsUp,
    description: 'Response feedback & ratings',
  },
  {
    name: 'Ideas & Bugs',
    href: '/platform-feedback',
    icon: Lightbulb,
    description: 'Feature requests & bug reports',
  },
  {
    name: 'Team',
    href: '/team',
    icon: Users,
    description: 'Manage team members',
  },
  {
    name: 'Billing',
    href: '/billing',
    icon: CreditCard,
    description: 'Subscription & usage',
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
  const { data: setupStatus } = useSetupStatus();
  const setupProgress = getSetupProgress(setupStatus);
  const isSetupComplete = setupStatus?.completed ?? true;
  const { isOpen, setIsOpen } = useMobileSidebar();
  const { signOut, user, profile } = useAuth();

  // Get display name and email from auth context
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || 'No email';

  // Close sidebar on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-void/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div
        className={cn(
          'flex h-full w-72 flex-col relative overflow-hidden',
          // Glassmorphism background
          'bg-void-light/50 backdrop-blur-xl border-r border-white/5',
          // Mobile: fixed overlay that slides in
          'fixed md:relative z-50 transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Background gradient decoration */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-violet-600/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-pink-600/5 to-transparent pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo Section */}
        <div className="relative flex h-20 items-center gap-3 px-6 border-b border-white/5">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-pink-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Cluebase<span className="text-violet-400">AI</span>
            </h1>
            <p className="text-xs text-white/50 font-medium">Knowledge Assistant</p>
          </div>
        </div>

        {/* Setup Alert Banner */}
        {!isSetupComplete && (
          <div className="px-4 pt-4 relative">
            <Link
              href="/setup"
              className="block p-3 rounded-xl bg-gradient-to-r from-violet-600/20 to-pink-600/10 border border-violet-500/20 hover:border-violet-500/40 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-glow-purple">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Complete Setup</span>
                    <AlertCircle className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${setupProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/50">{setupProgress}%</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-violet-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        )}

        {/* Navigation */}
        <motion.nav
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex-1 space-y-1 px-4 py-6 relative overflow-y-auto"
        >
          <p className="px-3 mb-4 text-xs font-semibold text-white/40 uppercase tracking-wider">
            Navigation
          </p>
          {navigation.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <motion.div
                key={item.name}
                variants={fadeInUp}
                custom={index}
              >
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 relative overflow-hidden',
                    isActive
                      ? 'bg-gradient-to-r from-violet-600/20 to-pink-600/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-violet-500 to-pink-500 rounded-r-full"
                    />
                  )}

                  {/* Icon container */}
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-br from-violet-600 to-pink-600 text-white shadow-glow-purple'
                        : 'bg-white/5 text-white/60 group-hover:bg-violet-600/20 group-hover:text-violet-400'
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
                        isActive ? 'text-white/50' : 'text-white/30'
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
                        ? 'text-violet-400 translate-x-0 opacity-100'
                        : 'text-white/40 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                    )}
                  />
                </Link>
              </motion.div>
            );
          })}
        </motion.nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-white/5 relative">
          <div data-testid="user-menu" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
              <span className="text-sm font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-white/50 truncate">{displayEmail}</p>
            </div>
            <button
              aria-label="Sign out"
              data-testid="sign-out-button"
              onClick={signOut}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/50">Cluebase AI</p>
              <p className="text-xs text-white/30">v1.0.0</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600">
              <span className="text-xs font-bold text-white">CB</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

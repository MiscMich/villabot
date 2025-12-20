'use client';

import '../globals.css';

/**
 * Setup Layout - Full-screen wizard without sidebar
 * This bypasses the main dashboard layout for a focused onboarding experience
 */
export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background font-geist relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      {/* Ambient glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-amber-600/8 rounded-full blur-[100px] pointer-events-none" />

      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

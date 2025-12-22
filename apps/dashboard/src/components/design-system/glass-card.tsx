'use client';

import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { glassCardHover } from '@/lib/motion';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'purple' | 'blue' | 'pink' | 'cyan' | 'none';
  variant?: 'default' | 'subtle' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const glowColors = {
  purple: 'hover:shadow-glow-purple',
  blue: 'hover:shadow-glow-blue',
  pink: 'hover:shadow-glow-pink',
  cyan: 'hover:shadow-glow-cyan',
  none: '',
};

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      hover = true,
      glow = 'purple',
      variant = 'default',
      padding = 'md',
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: 'glass-card',
      subtle: 'glass-card-subtle',
      elevated: 'glass-card-elevated',
    };

    return (
      <motion.div
        ref={ref}
        variants={hover ? glassCardHover : undefined}
        initial="initial"
        whileHover={hover ? 'hover' : undefined}
        whileTap={hover ? 'tap' : undefined}
        className={cn(
          variantClasses[variant],
          paddingClasses[padding],
          glow !== 'none' && glowColors[glow],
          className
        )}
        {...props}
      >
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

// Simple non-animated variant
export function GlassCardStatic({
  children,
  className,
  variant = 'default',
  padding = 'md',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}) {
  const variantClasses = {
    default: 'glass-card',
    subtle: 'glass-card-subtle',
    elevated: 'glass-card-elevated',
  };

  return (
    <div className={cn(variantClasses[variant], paddingClasses[padding], className)}>
      {children}
    </div>
  );
}

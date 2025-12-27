'use client';

import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hoverScale, tapScale, springTransition } from '@/lib/motion';

export interface GlowButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
}

const variants = {
  primary: cn(
    'bg-gradient-to-r from-violet-600 to-pink-600',
    'text-white font-medium',
    'shadow-glow-purple hover:shadow-glow-purple-lg',
    'border-0'
  ),
  secondary: cn(
    'bg-white/5 backdrop-blur-sm',
    'text-white font-medium',
    'border border-white/10 hover:border-white/20',
    'hover:bg-white/10'
  ),
  ghost: cn(
    'bg-transparent',
    'text-white/80 hover:text-white font-medium',
    'hover:bg-white/5'
  ),
  outline: cn(
    'bg-transparent',
    'text-white font-medium',
    'border border-violet-500/50 hover:border-violet-400',
    'hover:bg-violet-500/10'
  ),
};

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-base rounded-xl',
  lg: 'px-8 py-4 text-lg rounded-xl',
};

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      glow: _glow = true,
      fullWidth = false,
      loading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={!disabled && !loading ? hoverScale : undefined}
        whileTap={!disabled && !loading ? tapScale : undefined}
        transition={springTransition}
        disabled={disabled || loading}
        className={cn(
          'relative overflow-hidden',
          'transition-all duration-300',
          'inline-flex items-center justify-center gap-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {/* Shimmer effect on hover */}
        {variant === 'primary' && (
          <span className="absolute inset-0 overflow-hidden rounded-xl">
            <span className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </span>
        )}

        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Content */}
        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  }
);

GlowButton.displayName = 'GlowButton';

// Icon button variant
export function IconButton({
  children,
  className,
  variant = 'ghost',
  size = 'md',
  ...props
}: Omit<GlowButtonProps, 'fullWidth' | 'loading'>) {
  const iconSizes = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  return (
    <motion.button
      whileHover={hoverScale}
      whileTap={tapScale}
      transition={springTransition}
      className={cn(
        'relative overflow-hidden rounded-xl',
        'transition-all duration-300',
        'inline-flex items-center justify-center',
        variants[variant],
        iconSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

// Animated CTA button with arrow
export function CTAButton({
  children,
  className,
  ...props
}: GlowButtonProps) {
  return (
    <GlowButton
      className={cn('group', className)}
      {...props}
    >
      {children}
      <motion.span
        className="inline-block"
        initial={{ x: 0 }}
        whileHover={{ x: 4 }}
        transition={{ duration: 0.2 }}
      >
        →
      </motion.span>
    </GlowButton>
  );
}

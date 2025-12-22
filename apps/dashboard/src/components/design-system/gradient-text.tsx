'use client';

import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { textRevealContainer, textRevealChar, fadeInUp } from '@/lib/motion';

export interface GradientTextProps extends Omit<HTMLMotionProps<'span'>, 'children'> {
  children: ReactNode;
  className?: string;
  variant?: 'cosmic' | 'pink' | 'blue' | 'cyan';
  animate?: boolean;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'p';
}

const gradientClasses = {
  cosmic: 'bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400',
  pink: 'bg-gradient-to-r from-violet-400 via-pink-500 to-rose-400',
  blue: 'bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400',
  cyan: 'bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400',
};

export const GradientText = forwardRef<HTMLElement, GradientTextProps>(
  ({ children, className, variant = 'cosmic', animate = true, as = 'span', ...props }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Component = motion[as] as any;

    return (
      <Component
        ref={ref}
        variants={animate ? fadeInUp : undefined}
        initial={animate ? 'initial' : undefined}
        animate={animate ? 'animate' : undefined}
        className={cn(
          gradientClasses[variant],
          'bg-clip-text text-transparent',
          'inline-block',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GradientText.displayName = 'GradientText';

// Typewriter-style text reveal animation
export function TextReveal({
  text,
  className,
  variant = 'cosmic',
}: {
  text: string;
  className?: string;
  variant?: 'cosmic' | 'pink' | 'blue' | 'cyan';
}) {
  const words = text.split(' ');

  return (
    <motion.span
      variants={textRevealContainer}
      initial="initial"
      animate="animate"
      className={cn('inline-block', className)}
    >
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block mr-[0.25em]">
          {word.split('').map((char, charIndex) => (
            <motion.span
              key={charIndex}
              variants={textRevealChar}
              className={cn(
                gradientClasses[variant],
                'bg-clip-text text-transparent inline-block'
              )}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.span>
  );
}

// Animated underline effect
export function GradientUnderline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-block group', className)}>
      {children}
      <motion.span
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400"
        initial={{ width: 0 }}
        whileInView={{ width: '100%' }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      />
    </span>
  );
}

// Shimmering text effect
export function ShimmerText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block bg-gradient-to-r from-violet-400 via-white to-pink-400',
        'bg-[length:200%_100%] bg-clip-text text-transparent',
        'animate-gradient-shift',
        className
      )}
      style={{ backgroundSize: '200% 100%' }}
    >
      {children}
    </span>
  );
}

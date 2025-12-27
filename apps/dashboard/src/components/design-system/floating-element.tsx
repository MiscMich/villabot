'use client';

import { type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';


export interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
  direction?: 'vertical' | 'horizontal' | 'diagonal';
  slow?: boolean;
}

export function FloatingElement({
  children,
  className,
  delay = 0,
  duration = 4,
  distance = 10,
  direction = 'vertical',
  slow = false,
}: FloatingElementProps) {
  const getAnimation = (): Variants => {
    const baseTransition = {
      duration: slow ? duration * 1.5 : duration,
      repeat: Infinity,
      ease: 'easeInOut',
      delay,
    };

    switch (direction) {
      case 'horizontal':
        return {
          animate: {
            x: [0, distance, 0],
            transition: baseTransition,
          },
        };
      case 'diagonal':
        return {
          animate: {
            x: [0, distance * 0.7, 0],
            y: [0, -distance * 0.7, 0],
            transition: baseTransition,
          },
        };
      default:
        return {
          animate: {
            y: [0, -distance, 0],
            transition: baseTransition,
          },
        };
    }
  };

  return (
    <motion.div
      variants={getAnimation()}
      animate="animate"
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  );
}

// Orbit animation for decorative elements
export function OrbitElement({
  children,
  className,
  radius = 100,
  duration = 20,
  reverse = false,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
  duration?: number;
  reverse?: boolean;
}) {
  return (
    <motion.div
      className={cn('absolute', className)}
      animate={{
        rotate: reverse ? -360 : 360,
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        width: radius * 2,
        height: radius * 2,
      }}
    >
      <div
        className="absolute"
        style={{
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}

// Parallax scrolling element
export function ParallaxElement({
  children,
  className,
  speed = 0.5,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  return (
    <motion.div
      className={cn('will-change-transform', className)}
      initial={{ y: 0 }}
      whileInView={{ y: 0 }}
      viewport={{ once: false }}
      style={{
        transform: `translateY(calc(var(--scroll-y, 0) * ${speed}px))`,
      }}
    >
      {children}
    </motion.div>
  );
}

// Pulsing decorative dot
export function PulsingDot({
  className,
  color = 'violet',
  size = 'md',
}: {
  className?: string;
  color?: 'violet' | 'pink' | 'blue' | 'cyan';
  size?: 'sm' | 'md' | 'lg';
}) {
  const colors = {
    violet: 'bg-violet-500',
    pink: 'bg-pink-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
  };

  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const glowColors = {
    violet: 'rgba(124, 58, 237, 0.5)',
    pink: 'rgba(236, 72, 153, 0.5)',
    blue: 'rgba(59, 130, 246, 0.5)',
    cyan: 'rgba(6, 182, 212, 0.5)',
  };

  return (
    <motion.div
      className={cn('rounded-full', colors[color], sizes[size], className)}
      animate={{
        scale: [1, 1.2, 1],
        boxShadow: [
          `0 0 0 0 ${glowColors[color]}`,
          `0 0 20px 8px ${glowColors[color]}`,
          `0 0 0 0 ${glowColors[color]}`,
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Decorative grid of dots
export function DotGrid({
  className,
  rows = 5,
  cols = 5,
  gap = 24,
}: {
  className?: string;
  rows?: number;
  cols?: number;
  gap?: number;
}) {
  return (
    <div
      className={cn('grid pointer-events-none', className)}
      style={{
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
      }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1 h-1 rounded-full bg-white/10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.02 }}
        />
      ))}
    </div>
  );
}

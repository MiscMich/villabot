'use client';

import { useRef, useState, useCallback, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SpotlightProps {
  children: ReactNode;
  className?: string;
  spotlightClassName?: string;
  color?: 'purple' | 'blue' | 'pink' | 'cyan';
  size?: number;
  opacity?: number;
}

const spotlightColors = {
  purple: 'rgba(124, 58, 237, 0.15)',
  blue: 'rgba(59, 130, 246, 0.15)',
  pink: 'rgba(236, 72, 153, 0.15)',
  cyan: 'rgba(6, 182, 212, 0.15)',
};

export function Spotlight({
  children,
  className,
  spotlightClassName,
  color = 'purple',
  size = 600,
  opacity = 1,
}: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    []
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn('relative overflow-hidden', className)}
    >
      {/* Spotlight effect */}
      <motion.div
        className={cn(
          'pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300',
          spotlightClassName
        )}
        style={{
          background: `radial-gradient(${size}px circle at ${position.x}px ${position.y}px, ${spotlightColors[color]}, transparent 40%)`,
          opacity: isHovering ? opacity : 0,
        }}
      />

      {/* Content */}
      {children}
    </div>
  );
}

// Standalone spotlight background for sections
export function SpotlightBackground({
  className,
  color = 'purple',
}: {
  className?: string;
  color?: 'purple' | 'blue' | 'pink' | 'cyan';
}) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div
      onMouseMove={handleMouseMove}
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{
        background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, ${spotlightColors[color]}, transparent 40%)`,
      }}
    />
  );
}

// Multi-spotlight effect with fixed positions
export function MultiSpotlight({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 pointer-events-none overflow-hidden', className)}>
      {/* Top left purple */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-50"
        style={{
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, transparent 70%)',
        }}
      />

      {/* Top right blue */}
      <div
        className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
        }}
      />

      {/* Bottom center pink */}
      <div
        className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

// Animated spotlight that moves automatically
export function AnimatedSpotlight({
  className,
  color = 'purple',
}: {
  className?: string;
  color?: 'purple' | 'blue' | 'pink';
}) {
  return (
    <motion.div
      className={cn('absolute pointer-events-none', className)}
      animate={{
        x: ['0%', '100%', '50%', '0%'],
        y: ['0%', '50%', '100%', '0%'],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        width: 800,
        height: 800,
        background: `radial-gradient(circle, ${spotlightColors[color]} 0%, transparent 60%)`,
        filter: 'blur(40px)',
      }}
    />
  );
}

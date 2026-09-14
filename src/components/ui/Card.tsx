import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  variant?: 'standard' | 'gold' | 'glass' | 'interactive';
  className?: string;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'standard',
  className = '',
  glow = false,
  ...props
}) => {
  const variantStyles = {
    standard: 'bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs',
    gold: 'bg-white dark:bg-[#111827] border border-[#7C5CFC]/30 dark:border-[#7C5CFC]/30 shadow-xs',
    glass: 'bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs',
    interactive: 'bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xs hover:border-[#D1D5DB] dark:hover:border-[#4B5563] hover:shadow-sm transition-all duration-150',
  };

  return (
    <motion.div
      className={`rounded-2xl p-6 sm:p-8 relative overflow-hidden ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};


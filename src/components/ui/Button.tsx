import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'pink' | 'gold' | 'glass' | 'outline' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'pink',
  size = 'md',
  type = 'button',
  children,
  icon,
  isLoading = false,
  className = '',
  ...props
}) => {
  const variantStyles = {
    pink: 'bg-[#6D28D9] hover:bg-[#5B21B6] text-white shadow-xs border border-transparent font-bold transition-all duration-150',
    gold: 'bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-extrabold shadow-xs border border-transparent transition-all duration-150',
    glass: 'bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] border border-[#E5E7EB] dark:border-[#374151] hover:bg-[#F5F5F5] dark:hover:bg-[#1F2937] transition-all duration-150',
    outline: 'border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB] hover:border-[#D1D5DB] dark:hover:border-[#4B5563] hover:bg-[#F5F5F5] dark:hover:bg-[#1F2937] transition-all duration-150',
    purple: 'bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-extrabold shadow-xs transition-all duration-150',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm rounded-xl gap-1.5 font-semibold',
    md: 'px-6 py-3 text-base rounded-2xl gap-2 font-bold',
    lg: 'px-8 py-4 text-lg rounded-3xl gap-2.5 font-extrabold tracking-wide',
  };

  return (
    <motion.button
      type={type}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={`inline-flex items-center justify-center cursor-pointer transition-all duration-200 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        <>
          {icon && <span className="inline-flex">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </motion.button>
  );
};


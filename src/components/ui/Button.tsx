'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'coral' | 'lavender';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-lime text-navy border-[3px] border-navy press-3 press-navy',
  secondary:
    'bg-navy text-lime border-[3px] border-lime press-3 press-black hover:bg-navy-light',
  outline:
    'bg-transparent text-navy border-[3px] border-navy hover:bg-navy hover:text-lime',
  ghost:
    'bg-transparent text-navy/60 border-[3px] border-transparent hover:bg-cloud hover:text-navy',
  coral:
    'bg-coral text-white border-[3px] border-navy press-3 press-black',
  lavender:
    'bg-lavender text-white border-[3px] border-navy press-3 press-black',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-7 py-3 text-sm gap-2.5',
  xl: 'px-8 py-3.5 text-base gap-3',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-display font-bold rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-lime/30 focus:ring-offset-2';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size={size} />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

function LoadingSpinner({ size }: { size: ButtonSize }) {
  const spinnerSize = size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <svg className={`animate-spin ${spinnerSize}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon'> {
  icon: React.ReactNode;
  'aria-label': string;
}

export function IconButton({ icon, size = 'md', className = '', ...props }: IconButtonProps) {
  const iconSizeStyles: Record<ButtonSize, string> = {
    sm: 'p-2',
    md: 'p-2.5',
    lg: 'p-3',
    xl: 'p-3.5',
  };

  return (
    <Button size={size} className={`${iconSizeStyles[size]} !rounded-xl ${className}`} {...props}>
      {icon}
    </Button>
  );
}

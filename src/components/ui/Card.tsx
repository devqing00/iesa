'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'lime' | 'lavender' | 'coral' | 'teal' | 'sunny' | 'navy' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const variantStyles = {
  default: 'card',
  lime: 'card card-lime',
  lavender: 'card card-lavender',
  coral: 'card card-coral',
  teal: 'card card-teal',
  sunny: 'card card-sunny',
  navy: 'card card-navy',
  ghost: 'card card-ghost',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  variant = 'default',
  padding = 'md',
  hover = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${hover ? 'transition-all duration-200 hover:shadow-[10px_10px_0_0_#000] hover:-translate-y-1' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  label?: string;
  number?: string | number;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ label, number, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-2">
        {number && (
          <span className="font-display font-bold text-xs uppercase tracking-wider bg-cloud px-2 py-0.5 rounded-xl">{String(number).padStart(2, '0')}</span>
        )}
        {label && (
          <span className="font-display font-bold text-xs uppercase tracking-wider font-semibold bg-lime-light text-teal px-2 py-0.5 rounded-xl">
            {label}
          </span>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export interface CardTitleProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  className?: string;
}

export function CardTitle({ children, as: Tag = 'h3', className = '' }: CardTitleProps) {
  return (
    <Tag className={`font-display font-black text-xl text-navy ${className}`}>
      {children}
    </Tag>
  );
}

export function CardDescription({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-navy/60 leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mt-4 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-6 pt-4 border-t-[3px] border-navy flex items-center gap-3 ${className}`}>
      {children}
    </div>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  variant?: 'default' | 'lime' | 'lavender' | 'coral' | 'teal' | 'sunny' | 'navy';
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  variant = 'default',
  className = '',
}: StatCardProps) {
  return (
    <Card variant={variant} className={className} hover>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display font-bold text-xs text-slate uppercase tracking-wider mb-3">{label}</p>
          <p className="font-display font-black text-3xl text-navy">{value}</p>
          {change && (
            <span className={`inline-flex items-center gap-1 mt-2 text-xs font-medium rounded-full px-2 py-0.5 ${
              changeType === 'positive' ? 'bg-teal-light text-teal-dark' :
              changeType === 'negative' ? 'bg-coral-light text-coral' :
              'bg-cloud text-slate'
            }`}>
              {change}
            </span>
          )}
        </div>
        {icon && (
          <div className="p-2.5 bg-cloud rounded-xl text-navy/60">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

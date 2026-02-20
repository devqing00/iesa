'use client';

import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  variant = 'default',
}: EmptyStateProps) {
  const variantClasses = {
    default: 'py-16',
    compact: 'py-8',
    card: 'card p-8',
  };

  return (
    <div className={`flex flex-col items-center text-center ${variantClasses[variant]} ${className}`}>
      <div className="mb-4 text-slate">
        {icon || <DefaultEmptyIcon />}
      </div>
      <h3 className="font-display font-black text-xl text-navy mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-navy/60 max-w-sm">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-6">
          {action.label}
        </button>
      )}
    </div>
  );
}

function DefaultEmptyIcon() {
  return (
    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

export function NoDataState({ title = 'No data available', description = 'There is no data to display at this time.', ...props }: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={<svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>}
      title={title}
      description={description}
      {...props}
    />
  );
}

export function NoSearchResultsState({ title = 'No results found', description = "Try adjusting your search or filter to find what you're looking for.", ...props }: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={<svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>}
      title={title}
      description={description}
      {...props}
    />
  );
}

export function NoNotificationsState({ title = 'All caught up', description = 'You have no new notifications.', ...props }: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={<svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>}
      title={title}
      description={description}
      {...props}
    />
  );
}

export function NoEventsState({ title = 'No upcoming events', description = 'Check back later for new events and activities.', ...props }: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={<svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
      title={title}
      description={description}
      {...props}
    />
  );
}

export function NoPaymentsState({ title = 'No payment history', description = 'Your payment transactions will appear here.', ...props }: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={<svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
      title={title}
      description={description}
      {...props}
    />
  );
}

export function ErrorState({ title = 'Something went wrong', description = 'We encountered an error loading this content.', action, ...props }: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={<svg className="w-12 h-12 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
      title={title}
      description={description}
      action={action || { label: 'Try Again', onClick: () => window.location.reload() }}
      {...props}
    />
  );
}

export function ComingSoonState({ title = 'Coming Soon', description = 'This feature is under development and will be available soon.', ...props }: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={<svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>}
      title={title}
      description={description}
      {...props}
    />
  );
}

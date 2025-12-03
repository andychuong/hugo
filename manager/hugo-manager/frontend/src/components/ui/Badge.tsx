import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  className?: string;
  title?: string;
}

export default function Badge({
  children,
  variant = 'neutral',
  className = '',
  title,
}: BadgeProps) {
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };

  return (
    <span className={`badge ${variantClasses[variant]} ${className}`} title={title}>
      {children}
    </span>
  );
}


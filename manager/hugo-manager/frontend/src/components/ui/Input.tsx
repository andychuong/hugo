import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-hugo-text-secondary mb-2"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input w-full ${hasError ? 'border-hugo-status-error focus:ring-hugo-status-error' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-hugo-status-error">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-hugo-text-tertiary">{helperText}</p>
      )}
    </div>
  );
}


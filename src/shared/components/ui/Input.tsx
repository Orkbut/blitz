import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    const inputId = React.useId();
    const errorId = React.useId();
    const hintId = React.useId();

    return (
      <div className="space-y-1">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-secondary-700"
          >
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'input-field',
            error && 'border-error-500 focus:border-error-500 focus:box-shadow-error',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={cn(
            error && errorId,
            hint && hintId
          )}
          {...props}
        />
        
        {hint && !error && (
          <p id={hintId} className="text-xs text-secondary-500">
            {hint}
          </p>
        )}
        
        {error && (
          <p id={errorId} className="text-xs text-error-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    const textareaId = React.useId();
    const errorId = React.useId();
    const hintId = React.useId();

    return (
      <div className="space-y-1">
        {label && (
          <label 
            htmlFor={textareaId}
            className="block text-sm font-medium text-secondary-700"
          >
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'input-field resize-y min-h-[80px]',
            error && 'border-error-500 focus:border-error-500',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={cn(
            error && errorId,
            hint && hintId
          )}
          {...props}
        />
        
        {hint && !error && (
          <p id={hintId} className="text-xs text-secondary-500">
            {hint}
          </p>
        )}
        
        {error && (
          <p id={errorId} className="text-xs text-error-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea'; 
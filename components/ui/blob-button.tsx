'use client';

import React from 'react';

interface BlobButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function BlobButton({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}: BlobButtonProps) {
  const baseStyles = 'blob-btn relative overflow-visible font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed group uppercase';

  const variantStyles = {
    primary: 'text-[#ffde5a] focus:ring-blue-500 border-[2px] border-[#ffde5a] bg-transparent hover:text-black',
    secondary: 'text-gray-900 border-[2px] border-gray-900 bg-transparent hover:text-white focus:ring-gray-500',
    danger: 'text-red-600 border-[2px] border-red-600 bg-transparent hover:text-white focus:ring-red-500',
    ghost: 'text-gray-700 border-[2px] border-gray-700 bg-transparent hover:text-white focus:ring-gray-500',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const blobColors = {
    primary: 'bg-[#ffde5a]',
    secondary: 'bg-gray-900',
    danger: 'bg-red-600',
    ghost: 'bg-gray-700',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Blob container with goo effect */}
      <div className="blob-btn__inner absolute left-0 top-0 w-full h-full overflow-hidden rounded-lg -z-10">
        <div className="blob-btn__blobs relative block h-full" style={{ filter: 'url(#goo)' }}>
          {/* 4 blobs that animate up on hover */}
          <div className={`blob-btn__blob absolute top-[2px] w-1/4 h-full ${blobColors[variant]} rounded-full transition-transform duration-[450ms] ease-out translate-y-[150%] scale-[1.7] group-hover:translate-y-0 group-hover:scale-[1.7] left-0`} />
          <div className={`blob-btn__blob absolute top-[2px] w-1/4 h-full ${blobColors[variant]} rounded-full transition-transform duration-[450ms] ease-out translate-y-[150%] scale-[1.7] group-hover:translate-y-0 group-hover:scale-[1.7] left-[30%] delay-[80ms]`} />
          <div className={`blob-btn__blob absolute top-[2px] w-1/4 h-full ${blobColors[variant]} rounded-full transition-transform duration-[450ms] ease-out translate-y-[150%] scale-[1.7] group-hover:translate-y-0 group-hover:scale-[1.7] left-[60%] delay-[160ms]`} />
          <div className={`blob-btn__blob absolute top-[2px] w-1/4 h-full ${blobColors[variant]} rounded-full transition-transform duration-[450ms] ease-out translate-y-[150%] scale-[1.7] group-hover:translate-y-0 group-hover:scale-[1.7] left-[90%] delay-[240ms]`} />
        </div>
      </div>

      {/* Content */}
      <span className="relative z-10">
        {isLoading ? (
          <span className="flex items-center gap-2 justify-center">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {children}
          </span>
        ) : (
          children
        )}
      </span>

      {/* SVG Filter for Goo Effect */}
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
    </button>
  );
}

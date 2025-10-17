'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface BentoWidgetProps {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function BentoWidget({ 
  children, 
  title, 
  icon, 
  className = '', 
  contentClassName = '' 
}: BentoWidgetProps) {
  return (
    <motion.div
      className={`
        bg-transparent backdrop-blur-sm rounded-lg shadow-md border border-white/20 
        overflow-hidden h-full flex flex-col
        ${className}
      `}
      whileHover={{ 
        borderColor: '#ffde5a',
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {title && (
        <div className="flex items-center gap-2 p-4 pb-2 border-b border-white/10">
          <h3 className="text-[#ffde5a] font-semibold text-sm truncate">
            {title}
          </h3>
        </div>
      )}
      
      <div className={`flex-1 p-4 overflow-hidden ${contentClassName}`}>
        {children}
      </div>
    </motion.div>
  );
}
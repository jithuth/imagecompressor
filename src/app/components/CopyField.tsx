'use client'

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyFieldProps {
  label: string;
  value: string;
  color?: 'purple' | 'emerald';
  showCount?: boolean;
}

export default function CopyField({ label, value, color = 'purple', showCount = true }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = value.length;
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  const labelColor = color === 'emerald' ? 'text-emerald-500' : 'text-purple-400';
  const countColor = color === 'emerald' ? 'text-emerald-600' : 'text-purple-600';

  return (
    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 group/field">
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-[10px] font-semibold ${labelColor} uppercase tracking-wider`}>{label}</h3>
        <div className="flex items-center gap-3">
          {showCount && (
            <span className={`text-[10px] ${countColor} font-mono`}>
              {wordCount}w · {charCount}c
            </span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors opacity-0 group-hover/field:opacity-100"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
            ) : (
              <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
            )}
          </button>
        </div>
      </div>
      <p className="text-zinc-300 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

'use client'

import { motion } from 'framer-motion';
import { TrendingDown, Image as ImageIcon, Zap } from 'lucide-react';

interface StatsPanelProps {
  images: {
    status: string;
    originalSize: number;
    compressedSize?: number;
  }[];
}

export default function StatsPanel({ images }: StatsPanelProps) {
  const completed = images.filter(i => i.status === 'success' && i.compressedSize);
  if (completed.length === 0) return null;

  const totalOriginal = completed.reduce((s, i) => s + i.originalSize, 0);
  const totalCompressed = completed.reduce((s, i) => s + (i.compressedSize ?? 0), 0);
  const totalSaved = totalOriginal - totalCompressed;
  const avgReduction = Math.round((totalSaved / totalOriginal) * 100);

  const fmt = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const stats = [
    { label: 'Images Processed', value: completed.length.toString(), icon: ImageIcon, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Total Saved', value: fmt(totalSaved), icon: TrendingDown, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Avg. Reduction', value: `${avgReduction}%`, icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-3 gap-4 p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl"
    >
      {stats.map(s => (
        <div key={s.label} className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border ${s.bg}`}>
          <s.icon className={`w-5 h-5 ${s.color}`} />
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-zinc-500 text-center">{s.label}</p>
        </div>
      ))}

      {/* Progress bar showing original vs compressed */}
      <div className="col-span-3 space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Original: {fmt(totalOriginal)}</span>
          <span>Compressed: {fmt(totalCompressed)}</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
            initial={{ width: '100%' }}
            animate={{ width: `${100 - avgReduction}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <p className="text-center text-xs text-zinc-500">
          You saved <span className="text-emerald-400 font-semibold">{fmt(totalSaved)}</span> — {avgReduction}% smaller
        </p>
      </div>
    </motion.div>
  );
}

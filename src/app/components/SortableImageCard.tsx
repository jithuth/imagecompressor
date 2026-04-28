'use client'

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, AlertCircle, X, GripVertical, Download } from 'lucide-react';
import { saveAs } from 'file-saver';

interface ProcessedImage {
  id: string;
  originalFile: File;
  compressedBlob: Blob | null;
  status: 'pending' | 'compressing' | 'success' | 'error';
  originalSize: number;
  compressedSize?: number;
  progress?: number;
  errorMsg?: string;
  previewUrl: string;
}

interface SortableImageCardProps {
  img: ProcessedImage;
  onRemove: (id: string) => void;
  formatSize: (bytes: number) => string;
}

export default function SortableImageCard({ img, onRemove, formatSize }: SortableImageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const savingsPercent = img.originalSize && img.compressedSize
    ? Math.round((1 - img.compressedSize / img.originalSize) * 100)
    : null;

  const handleDownload = () => {
    if (!img.compressedBlob) return;
    const ext = img.originalFile.name.split('.').pop() || 'jpg';
    const name = img.originalFile.name.substring(0, img.originalFile.name.lastIndexOf('.'));
    saveAs(img.compressedBlob, `${name}_compressed.${ext}`);
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 left-3 z-10 p-1.5 bg-black/40 backdrop-blur-md rounded-lg cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4 text-zinc-400" />
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(img.id)}
        className="absolute top-3 right-3 z-10 p-1.5 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4 text-zinc-300" />
      </button>

      {/* Thumbnail */}
      <div className="relative h-40 bg-zinc-800/50 shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />

        {/* Savings badge */}
        {savingsPercent !== null && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-emerald-500/90 text-white text-xs font-bold rounded-full">
            -{savingsPercent}%
          </div>
        )}
      </div>

      {/* Progress bar */}
      {img.status === 'compressing' && (
        <div className="relative h-1 bg-zinc-800">
          <motion.div
            className="absolute h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: '0%' }}
            animate={{ width: `${img.progress ?? 0}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm truncate leading-tight" title={img.originalFile.name}>
            {img.originalFile.name}
          </p>
          {img.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
          {img.status === 'compressing' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0 mt-0.5" />}
          {img.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
        </div>

        <div className="space-y-1 text-xs text-zinc-400 mt-auto">
          <div className="flex justify-between">
            <span>Original</span>
            <span>{formatSize(img.originalSize)}</span>
          </div>
          {img.status === 'compressing' && img.progress !== undefined && (
            <div className="flex justify-between text-indigo-400">
              <span>Compressing...</span>
              <span className="font-mono font-bold">{img.progress}%</span>
            </div>
          )}
          {img.compressedSize && (
            <div className="flex justify-between font-medium text-emerald-400">
              <span>Compressed</span>
              <span>{formatSize(img.compressedSize)}</span>
            </div>
          )}
          {img.status === 'error' && <p className="text-rose-400 truncate">{img.errorMsg}</p>}
        </div>

        {img.status === 'success' && img.compressedBlob && (
          <button
            onClick={handleDownload}
            className="mt-1 w-full py-2 flex items-center justify-center gap-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-colors text-zinc-200"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        )}
      </div>
    </motion.div>
  );
}

export type { ProcessedImage };

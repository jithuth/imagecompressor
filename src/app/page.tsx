'use client'

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { UploadCloud, CheckCircle, Loader2, Image as ImageIcon, Download, AlertCircle, Wand2, Sparkles, Copy, Check, FileText } from 'lucide-react';
import type { Tone } from './components/ToneSelector';
import SortableImageCard, { ProcessedImage } from './components/SortableImageCard';
import StatsPanel from './components/StatsPanel';
import CopyField from './components/CopyField';

const ParticleBackground = dynamic(() => import('./components/ParticleBackground'), { ssr: false });
const ToneSelector = dynamic(() => import('./components/ToneSelector'), { ssr: false });

interface ImageDescriptions {
  shortDescription: string;
  longDescription: string;
  productDescription: string;
  seoTitle: string;
  seoDescription: string;
  seoAltText: string;
}

interface AnalyzedImage {
  file: File;
  previewUrl: string;
  isAnalyzing: boolean;
  descriptions?: ImageDescriptions;
  errorMsg?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'compressor' | 'analyzer'>('compressor');

  // Compressor
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  // Analyzer
  const [analyzedImage, setAnalyzedImage] = useState<AnalyzedImage | null>(null);
  const [uspText, setUspText] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [copiedAll, setCopiedAll] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- COMPRESSOR ---
  const onDropCompressor = useCallback(async (acceptedFiles: File[]) => {
    const newImages: ProcessedImage[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      originalFile: file,
      compressedBlob: null,
      status: 'pending',
      originalSize: file.size,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
    }));
    setImages(prev => [...prev, ...newImages]);
    for (const img of newImages) compressImage(img);
  }, []);

  const compressImage = async (image: ProcessedImage) => {
    setImages(prev => prev.map(i => i.id === image.id ? { ...i, status: 'compressing', progress: 0 } : i));
    try {
      const compressed = await imageCompression(image.originalFile, {
        maxSizeMB: 4.5,
        maxWidthOrHeight: 7000,
        useWebWorker: true,
        initialQuality: 0.9,
        onProgress: (p: number) => {
          setImages(prev => prev.map(i => i.id === image.id ? { ...i, progress: p } : i));
        },
      });
      setImages(prev => prev.map(i => i.id === image.id ? { ...i, status: 'success', compressedBlob: compressed, compressedSize: compressed.size, progress: 100 } : i));
    } catch {
      setImages(prev => prev.map(i => i.id === image.id ? { ...i, status: 'error', errorMsg: 'Compression failed' } : i));
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const removed = prev.find(i => i.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages(prev => {
        const oldIndex = prev.findIndex(i => i.id === active.id);
        const newIndex = prev.findIndex(i => i.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const downloadZip = async () => {
    const successful = images.filter(i => i.status === 'success' && i.compressedBlob);
    if (!successful.length) return;
    setIsZipping(true);
    const zip = new JSZip();
    successful.forEach((img, idx) => {
      const ext = img.originalFile.name.split('.').pop() || 'jpg';
      const name = img.originalFile.name.substring(0, img.originalFile.name.lastIndexOf('.')) || `image_${idx}`;
      zip.file(`${name}_compressed.${ext}`, img.compressedBlob!);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'compressed_images.zip');
    setIsZipping(false);
  };

  const { getRootProps: getCompRootProps, getInputProps: getCompInputProps, isDragActive: isCompDragActive } = useDropzone({
    onDrop: onDropCompressor, accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.bmp'] }
  });

  // --- ANALYZER ---
  const analyzeFile = useCallback(async (file: File) => {
    setAnalyzedImage(prev => prev
      ? { ...prev, isAnalyzing: true, descriptions: undefined, errorMsg: undefined }
      : { file, previewUrl: URL.createObjectURL(file), isAnalyzing: true }
    );
    try {
      const small = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true });
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(small);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type, usp: uspText.trim(), tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAnalyzedImage(prev => prev ? { ...prev, isAnalyzing: false, descriptions: data } : null);
    } catch (err: any) {
      setAnalyzedImage(prev => prev ? { ...prev, isAnalyzing: false, errorMsg: err.message } : null);
    }
  }, [uspText, tone]);

  const onDropAnalyzer = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (analyzedImage?.previewUrl) URL.revokeObjectURL(analyzedImage.previewUrl);
    setAnalyzedImage({ file, previewUrl: URL.createObjectURL(file), isAnalyzing: false });
    analyzeFile(file);
  }, [analyzedImage, analyzeFile]);

  const { getRootProps: getAnaRootProps, getInputProps: getAnaInputProps, isDragActive: isAnaDragActive } = useDropzone({
    onDrop: onDropAnalyzer, accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.bmp'] }, maxFiles: 1
  });

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024, i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  const exportPDF = async () => {
    if (!analyzedImage?.descriptions) return;
    const { default: jsPDF } = await import('jspdf');
    const d = analyzedImage.descriptions;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('AI-Generated Listing Content', 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated for: ${analyzedImage.file.name}`, 14, 28);
    let y = 40;
    const addSection = (title: string, text: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(80, 60, 200);
      doc.text(title, 14, y); y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(text, 182);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 10;
    };
    addSection('Short Listing Description', d.shortDescription);
    addSection('Full Listing Description', d.longDescription);
    addSection('Product Description', d.productDescription);
    addSection('SEO Title', d.seoTitle);
    addSection('SEO Meta Description', d.seoDescription);
    addSection('Alt Text', d.seoAltText);
    doc.save(`listing-content-${analyzedImage.file.name}.pdf`);
  };

  const copyAll = () => {
    if (!analyzedImage?.descriptions) return;
    const d = analyzedImage.descriptions;
    const text = `Short: ${d.shortDescription}\n\nFull: ${d.longDescription}\n\nProduct Description:\n${d.productDescription}\n\nSEO Title: ${d.seoTitle}\n\nSEO Description: ${d.seoDescription}\n\nAlt Text: ${d.seoAltText}`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const allDone = images.length > 0 && images.every(i => i.status === 'success' || i.status === 'error');
  const hasSuccess = images.some(i => i.status === 'success');

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-zinc-800/50">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-[#09090b] to-purple-950/40" />
        <ParticleBackground />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 text-center">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Image Tools
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-white via-white/90 to-white/40 bg-clip-text text-transparent mb-4">
            Image Studio Pro
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-zinc-400 text-lg max-w-xl mx-auto">
            Compress, analyze, and generate marketplace-ready content from your images — all in one place.
          </motion.p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className="bg-zinc-900/80 backdrop-blur-md p-1.5 rounded-2xl flex gap-1 border border-zinc-800 shadow-xl">
            {[
              { id: 'compressor', label: 'Batch Compressor', icon: ImageIcon, activeClass: 'bg-indigo-600 shadow-indigo-500/25' },
              { id: 'analyzer', label: 'AI Image Analyzer', icon: Sparkles, activeClass: 'bg-purple-600 shadow-purple-500/25' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${activeTab === tab.id ? `${tab.activeClass} text-white shadow-lg` : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ===== COMPRESSOR ===== */}
          {activeTab === 'compressor' ? (
            <motion.div key="compressor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div {...getCompRootProps()} className={`group cursor-pointer border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 ${isCompDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/40'}`}>
                <input {...getCompInputProps()} />
                <div className="flex flex-col items-center gap-5 pointer-events-none">
                  <div className={`p-4 rounded-full transition-colors ${isCompDragActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-indigo-400'}`}>
                    <UploadCloud className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="text-xl font-medium mb-1">{isCompDragActive ? 'Drop images...' : 'Drag & drop images'}</p>
                    <p className="text-zinc-500 text-sm">JPG · PNG · WEBP · Max 7000×7000px · Output &lt;4.5 MB</p>
                  </div>
                </div>
              </div>

              {images.length > 0 && (
                <div className="mt-10 space-y-6">
                  <StatsPanel images={images} />

                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Queue <span className="text-zinc-500 font-normal text-base ml-1">({images.length})</span></h2>
                    {allDone && hasSuccess && (
                      <button onClick={downloadZip} disabled={isZipping}
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50">
                        {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Download ZIP ({images.filter(i => i.status === 'success').length})
                      </button>
                    )}
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence>
                          {images.map(img => (
                            <SortableImageCard key={img.id} img={img} onRemove={removeImage} formatSize={formatSize} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </motion.div>
          ) : (
          /* ===== ANALYZER ===== */
            <motion.div key="analyzer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* USP + Tone */}
              <div className="mb-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Unique Selling Points
                    <span className="text-zinc-600 font-normal text-xs ml-1">— optional</span>
                  </label>
                  <textarea value={uspText} onChange={e => setUspText(e.target.value)}
                    placeholder="e.g. Handmade in Italy, Limited edition, BPA-free, Ships in 24hrs..."
                    rows={2}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Tone of Voice</label>
                  <ToneSelector value={tone} onChange={setTone} />
                </div>
              </div>

              {!analyzedImage ? (
                <div {...getAnaRootProps()} className={`group cursor-pointer border-2 border-dashed rounded-3xl p-20 text-center transition-all duration-300 ${isAnaDragActive ? 'border-purple-500 bg-purple-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/40'}`}>
                  <input {...getAnaInputProps()} />
                  <div className="flex flex-col items-center gap-5 pointer-events-none">
                    <div className={`p-4 rounded-full transition-colors ${isAnaDragActive ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-purple-400'}`}>
                      <Wand2 className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-xl font-medium mb-1">Drop a single image to analyze</p>
                      <p className="text-zinc-500 text-sm">Powered by Gemini AI — Free, instant results</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  {/* Image */}
                  <div className="space-y-4 sticky top-8">
                    <div className="relative rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-square flex items-center justify-center p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={analyzedImage.previewUrl} alt="Analyzing" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                      {analyzedImage.isAnalyzing && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-3xl">
                          <div className="relative">
                            <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                            <Sparkles className="w-5 h-5 text-purple-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          </div>
                          <p className="text-purple-300 font-medium animate-pulse">Analyzing with Gemini AI...</p>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setAnalyzedImage(null)}
                      className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium rounded-2xl transition-colors text-sm">
                      ← Analyze Another Image
                    </button>
                  </div>

                  {/* Results */}
                  <div className="space-y-3">
                    {analyzedImage.errorMsg ? (
                      <div className="bg-rose-950/30 border border-rose-800/50 rounded-3xl p-8 flex flex-col items-center gap-4 text-rose-400 text-center">
                        <AlertCircle className="w-12 h-12" />
                        <p className="font-medium">{analyzedImage.errorMsg}</p>
                      </div>
                    ) : analyzedImage.descriptions ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                        <div className="flex items-center gap-2 pb-2">
                          <Sparkles className="w-5 h-5 text-purple-400" />
                          <h2 className="text-lg font-semibold">Listing Content</h2>
                          <span className="ml-auto text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">✓ Ready to publish</span>
                        </div>

                        <CopyField label="Short Listing Description" value={analyzedImage.descriptions.shortDescription} color="purple" />
                        <CopyField label="Full Listing Description" value={analyzedImage.descriptions.longDescription} color="purple" />

                        <div className="bg-gradient-to-br from-purple-950/40 to-indigo-950/30 border border-purple-800/40 rounded-xl p-4 group/field">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" /> Product Description
                              <span className="text-[9px] text-purple-600 font-mono ml-2">
                                {analyzedImage.descriptions.productDescription.split(/\s+/).filter(Boolean).length}w · {analyzedImage.descriptions.productDescription.length}c
                              </span>
                            </h3>
                            <button onClick={() => navigator.clipboard.writeText(analyzedImage.descriptions!.productDescription)}
                              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors opacity-0 group-hover/field:opacity-100">
                              <Copy className="w-3.5 h-3.5" /><span>Copy</span>
                            </button>
                          </div>
                          <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{analyzedImage.descriptions.productDescription}</p>
                        </div>

                        <CopyField label="Platform / SEO Title" value={analyzedImage.descriptions.seoTitle} color="emerald" />
                        <CopyField label="SEO Meta Description" value={analyzedImage.descriptions.seoDescription} color="emerald" />
                        <CopyField label="Image Alt Text" value={analyzedImage.descriptions.seoAltText} color="emerald" />

                        <div className="flex gap-3 pt-2">
                          <button onClick={() => analyzedImage.file && analyzeFile(analyzedImage.file)} disabled={analyzedImage.isAnalyzing}
                            className="flex-1 py-3 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-medium rounded-2xl transition-colors text-sm border border-zinc-700">
                            {analyzedImage.isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" />Regenerating...</> : <><Wand2 className="w-4 h-4 text-purple-400" />Regenerate</>}
                          </button>
                          <button onClick={exportPDF}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-2xl transition-colors text-sm border border-zinc-700">
                            <FileText className="w-4 h-4 text-emerald-400" />PDF
                          </button>
                          <button onClick={copyAll}
                            className="flex-1 py-3 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-2xl transition-colors text-sm">
                            {copiedAll ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy All</>}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-20 flex flex-col items-center gap-4 text-zinc-600">
                        <Wand2 className="w-12 h-12 opacity-20" />
                        <p>Awaiting analysis results...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

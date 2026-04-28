'use client'

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle, Loader2, Image as ImageIcon, Download, X, AlertCircle, Wand2, Sparkles, Copy, Check } from 'lucide-react';

interface ImageDescriptions {
  shortDescription: string;
  longDescription: string;
  productDescription: string;
  seoTitle: string;
  seoDescription: string;
  seoAltText: string;
}

interface ProcessedImage {
  id: string;
  originalFile: File;
  compressedBlob: Blob | null;
  status: 'pending' | 'compressing' | 'success' | 'error';
  originalSize: number;
  compressedSize?: number;
  errorMsg?: string;
  previewUrl: string;
}

interface AnalyzedImage {
  file: File;
  previewUrl: string;
  isAnalyzing: boolean;
  descriptions?: ImageDescriptions;
  errorMsg?: string;
}

function CopyField({ label, value, color = 'purple' }: { label: string; value: string; color?: 'purple' | 'emerald' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const labelColor = color === 'emerald' ? 'text-emerald-500' : 'text-purple-400';

  return (
    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 group/field">
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-[10px] font-semibold ${labelColor} uppercase tracking-wider`}>{label}</h3>
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
      <p className="text-zinc-300 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'compressor' | 'analyzer'>('compressor');

  // Compressor State
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  // Analyzer State
  const [analyzedImage, setAnalyzedImage] = useState<AnalyzedImage | null>(null);
  const [uspText, setUspText] = useState('');

  // --- COMPRESSOR LOGIC ---
  const onDropCompressor = useCallback(async (acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      originalFile: file,
      compressedBlob: null,
      status: 'pending' as const,
      originalSize: file.size,
      previewUrl: URL.createObjectURL(file),
    }));

    setImages(prev => [...prev, ...newImages]);

    for (const image of newImages) {
      compressImage(image);
    }
  }, []);

  const compressImage = async (image: ProcessedImage) => {
    setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'compressing' } : img));
    const options = { maxSizeMB: 4.5, maxWidthOrHeight: 7000, useWebWorker: true, initialQuality: 0.9 };
    try {
      const compressedFile = await imageCompression(image.originalFile, options);
      setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'success', compressedBlob: compressedFile, compressedSize: compressedFile.size } : img));
    } catch {
      setImages(prev => prev.map(img => img.id === image.id ? { ...img, status: 'error', errorMsg: 'Failed to compress' } : img));
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const removed = prev.find(img => img.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  const downloadZip = async () => {
    const successful = images.filter(img => img.status === 'success' && img.compressedBlob);
    if (!successful.length) return;
    setIsZipping(true);
    const zip = new JSZip();
    successful.forEach((img, i) => {
      const ext = img.originalFile.name.split('.').pop() || 'jpg';
      const name = img.originalFile.name.substring(0, img.originalFile.name.lastIndexOf('.')) || `image_${i}`;
      zip.file(`${name}_compressed.${ext}`, img.compressedBlob!);
    });
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'compressed_images.zip');
    } finally {
      setIsZipping(false);
    }
  };

  const { getRootProps: getCompressorRootProps, getInputProps: getCompressorInputProps, isDragActive: isCompressorDragActive } = useDropzone({
    onDrop: onDropCompressor, accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.bmp'] }
  });

  // --- ANALYZER LOGIC ---
  const analyzeFile = useCallback(async (file: File) => {
    setAnalyzedImage(prev => prev ? { ...prev, isAnalyzing: true, descriptions: undefined, errorMsg: undefined } : { file, previewUrl: URL.createObjectURL(file), isAnalyzing: true });

    try {
      const compressionOptions = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
      const smallFile = await imageCompression(file, compressionOptions);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(smallFile);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type, usp: uspText.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to analyze image');

      setAnalyzedImage(prev => prev ? { ...prev, isAnalyzing: false, descriptions: data } : null);
    } catch (error: any) {
      setAnalyzedImage(prev => prev ? { ...prev, isAnalyzing: false, errorMsg: error.message } : null);
    }
  }, [uspText]);

  const onDropAnalyzer = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (analyzedImage?.previewUrl) URL.revokeObjectURL(analyzedImage.previewUrl);
    setAnalyzedImage({ file, previewUrl: URL.createObjectURL(file), isAnalyzing: false });
    analyzeFile(file);
  }, [analyzedImage, analyzeFile]);

  const { getRootProps: getAnalyzerRootProps, getInputProps: getAnalyzerInputProps, isDragActive: isAnalyzerDragActive } = useDropzone({
    onDrop: onDropAnalyzer, accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.bmp'] }, maxFiles: 1
  });

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['Bytes', 'KB', 'MB', 'GB'][i];
  };

  const allDone = images.length > 0 && images.every(img => img.status === 'success' || img.status === 'error');
  const hasSuccess = images.some(img => img.status === 'success');

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30">
      <main className="max-w-6xl mx-auto px-6 py-16">

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-14">
          <div className="bg-zinc-900/80 backdrop-blur-md p-1.5 rounded-2xl flex items-center gap-1 border border-zinc-800 shadow-xl">
            <button
              onClick={() => setActiveTab('compressor')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${activeTab === 'compressor' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            >
              <ImageIcon className="w-4 h-4" />
              Batch Compressor
            </button>
            <button
              onClick={() => setActiveTab('analyzer')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${activeTab === 'analyzer' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            >
              <Sparkles className="w-4 h-4" />
              AI Image Analyzer
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ===== COMPRESSOR TAB ===== */}
          {activeTab === 'compressor' ? (
            <motion.div key="compressor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <header className="mb-12 text-center space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">
                  Compress without compromise.
                </h1>
                <p className="text-zinc-400 max-w-xl mx-auto">
                  Upload images and we'll compress them below 4.5 MB (max 7000×7000px), then bundle them into a ZIP.
                </p>
              </header>

              <div {...getCompressorRootProps()} className={`group cursor-pointer border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 ${isCompressorDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/40'}`}>
                <input {...getCompressorInputProps()} />
                <div className="flex flex-col items-center gap-5 pointer-events-none">
                  <div className={`p-4 rounded-full transition-colors ${isCompressorDragActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-indigo-400'}`}>
                    <UploadCloud className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="text-xl font-medium mb-1">{isCompressorDragActive ? 'Drop your images...' : 'Drag & drop images here'}</p>
                    <p className="text-zinc-500 text-sm">JPG, PNG, WEBP supported</p>
                  </div>
                </div>
              </div>

              {images.length > 0 && (
                <div className="mt-14 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Processing Queue <span className="text-zinc-500 text-lg font-normal ml-2">({images.length} images)</span></h2>
                    {allDone && hasSuccess && (
                      <button onClick={downloadZip} disabled={isZipping} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] disabled:opacity-50">
                        {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {isZipping ? 'Zipping...' : `Download ZIP (${images.filter(i => i.status === 'success').length})`}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                      {images.map(img => (
                        <motion.div key={img.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
                          <button onClick={() => removeImage(img.id)} className="absolute top-3 right-3 z-10 p-1.5 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-4 h-4 text-zinc-300" />
                          </button>
                          <div className="relative h-40 bg-zinc-800/50 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                            {img.status === 'compressing' && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-700">
                                <motion.div className="h-full bg-indigo-500" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, repeat: Infinity }} />
                              </div>
                            )}
                          </div>
                          <div className="p-5 flex-1 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium text-sm truncate" title={img.originalFile.name}>{img.originalFile.name}</p>
                              {img.status === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
                              {img.status === 'compressing' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />}
                              {img.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
                            </div>
                            <div className="space-y-1.5 text-xs text-zinc-400 mt-auto">
                              <div className="flex justify-between"><span>Original</span><span>{formatSize(img.originalSize)}</span></div>
                              {img.compressedSize && <div className="flex justify-between font-medium text-emerald-400"><span>Compressed</span><span>{formatSize(img.compressedSize)}</span></div>}
                              {img.status === 'error' && <p className="text-rose-400">{img.errorMsg}</p>}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
          /* ===== ANALYZER TAB ===== */
            <motion.div key="analyzer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <header className="mb-10 text-center space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">
                  Intelligent Image Analysis.
                </h1>
                <p className="text-zinc-400 max-w-xl mx-auto">
                  Drop an image, add your product's unique selling points, and get AI-generated listing copy instantly.
                </p>
              </header>

              {/* USP Input — always visible */}
              <div className="mb-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2">
                <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Unique Selling Points (USPs) <span className="text-zinc-500 font-normal text-xs ml-1">— optional but highly recommended</span>
                </label>
                <textarea
                  value={uspText}
                  onChange={e => setUspText(e.target.value)}
                  placeholder={`e.g. Handmade in Italy, Limited edition, BPA-free, Ships in 24hrs, 5-star rated...`}
                  rows={3}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 resize-none transition-colors"
                />
                <p className="text-xs text-zinc-600">These points will be woven directly into your listing descriptions to highlight what makes your product stand out.</p>
              </div>

              {!analyzedImage ? (
                <div {...getAnalyzerRootProps()} className={`group cursor-pointer border-2 border-dashed rounded-3xl p-20 text-center transition-all duration-300 ${isAnalyzerDragActive ? 'border-purple-500 bg-purple-500/5' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/40'}`}>
                  <input {...getAnalyzerInputProps()} />
                  <div className="flex flex-col items-center gap-5 pointer-events-none">
                    <div className={`p-4 rounded-full transition-colors ${isAnalyzerDragActive ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-purple-400'}`}>
                      <Wand2 className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-xl font-medium mb-1">Drop a single image to analyze</p>
                      <p className="text-zinc-500 text-sm">Powered by Gemini AI — No cost, no signup</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  {/* Image Side */}
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
                    <button onClick={() => setAnalyzedImage(null)} className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium rounded-2xl transition-colors text-sm">
                      ← Analyze Another Image
                    </button>
                  </div>

                  {/* Results Side */}
                  <div className="space-y-4">
                    {analyzedImage.errorMsg ? (
                      <div className="bg-rose-950/30 border border-rose-800/50 rounded-3xl p-8 flex flex-col items-center gap-4 text-rose-400 text-center">
                        <AlertCircle className="w-12 h-12" />
                        <p className="font-medium">{analyzedImage.errorMsg}</p>
                        <button onClick={() => setAnalyzedImage(null)} className="mt-2 text-sm text-rose-300 underline underline-offset-2">Try again</button>
                      </div>
                    ) : analyzedImage.descriptions ? (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <div className="flex items-center gap-2 mb-5">
                          <Sparkles className="w-5 h-5 text-purple-400" />
                          <h2 className="text-lg font-semibold text-white">Listing Content</h2>
                          <span className="ml-auto text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">✓ Ready to publish</span>
                        </div>

                        <CopyField label="Short Listing Description" value={analyzedImage.descriptions.shortDescription} color="purple" />
                        <CopyField label="Full Listing Description" value={analyzedImage.descriptions.longDescription} color="purple" />

                        {/* Product Description - highlighted card */}
                        {analyzedImage.descriptions.productDescription && (
                          <div className="bg-gradient-to-br from-purple-950/40 to-indigo-950/30 border border-purple-800/40 rounded-xl p-4 group/field">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" /> Product Description
                              </h3>
                              <button
                                onClick={() => navigator.clipboard.writeText(analyzedImage.descriptions!.productDescription)}
                                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 transition-colors opacity-0 group-hover/field:opacity-100"
                              >
                                <Copy className="w-3.5 h-3.5" /><span>Copy</span>
                              </button>
                            </div>
                            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{analyzedImage.descriptions.productDescription}</p>
                          </div>
                        )}

                        <CopyField label="Platform / SEO Title" value={analyzedImage.descriptions.seoTitle} color="emerald" />
                        <CopyField label="SEO Meta Description" value={analyzedImage.descriptions.seoDescription} color="emerald" />
                        <CopyField label="Image Alt Text" value={analyzedImage.descriptions.seoAltText} color="emerald" />

                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={() => analyzedImage.file && analyzeFile(analyzedImage.file)}
                            disabled={analyzedImage.isAnalyzing}
                            className="flex-1 py-3 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-medium rounded-2xl transition-colors text-sm border border-zinc-700"
                          >
                            {analyzedImage.isAnalyzing
                              ? <><Loader2 className="w-4 h-4 animate-spin" />Regenerating...</>
                              : <><Wand2 className="w-4 h-4 text-purple-400" />Regenerate</>}
                          </button>
                          <button
                            onClick={() => {
                              const d = analyzedImage.descriptions!;
                              const text = `Short: ${d.shortDescription}\n\nLong: ${d.longDescription}\n\nProduct Description:\n${d.productDescription}\n\nSEO Title: ${d.seoTitle}\n\nSEO Description: ${d.seoDescription}\n\nAlt Text: ${d.seoAltText}`;
                              navigator.clipboard.writeText(text);
                            }}
                            className="flex-1 py-3 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-2xl transition-colors text-sm shadow-[0_0_20px_rgba(147,51,234,0.25)]"
                          >
                            <Copy className="w-4 h-4" />
                            Copy All
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-16 flex flex-col items-center gap-4 text-zinc-600">
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

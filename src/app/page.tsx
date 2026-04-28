'use client'

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle, Loader2, Image as ImageIcon, Download, X, AlertCircle } from 'lucide-react';

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

export default function Home() {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
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

    const options = {
      maxSizeMB: 4.5,
      maxWidthOrHeight: 7000,
      useWebWorker: true,
      initialQuality: 0.9,
    };

    try {
      const compressedFile = await imageCompression(image.originalFile, options);
      
      setImages(prev => prev.map(img => img.id === image.id ? { 
        ...img, 
        status: 'success', 
        compressedBlob: compressedFile,
        compressedSize: compressedFile.size 
      } : img));
    } catch (error) {
      console.error('Compression error:', error);
      setImages(prev => prev.map(img => img.id === image.id ? { 
        ...img, 
        status: 'error', 
        errorMsg: 'Failed to compress' 
      } : img));
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.bmp']
    }
  });

  const downloadZip = async () => {
    const successfulImages = images.filter(img => img.status === 'success' && img.compressedBlob);
    if (successfulImages.length === 0) return;

    setIsZipping(true);
    const zip = new JSZip();

    successfulImages.forEach((img, index) => {
      const extension = img.originalFile.name.split('.').pop() || 'jpg';
      const nameWithoutExt = img.originalFile.name.substring(0, img.originalFile.name.lastIndexOf('.')) || `image_${index}`;
      zip.file(`${nameWithoutExt}_compressed.${extension}`, img.compressedBlob!);
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'compressed_images.zip');
    } catch (error) {
      console.error('Failed to create ZIP', error);
    } finally {
      setIsZipping(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const allDone = images.length > 0 && images.every(img => img.status === 'success' || img.status === 'error');
  const hasSuccess = images.some(img => img.status === 'success');

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-indigo-500/30">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <header className="mb-16 text-center space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-4"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Premium Image Compression</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent"
          >
            Compress without compromise.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-zinc-400 max-w-2xl mx-auto"
          >
            Upload your images. We'll elegantly compress them below 4.5 MB, ensuring a maximum resolution of 7000x7000px, whilst preserving breathtaking quality.
          </motion.p>
        </header>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div
            {...getRootProps()} 
            className={`relative overflow-hidden group cursor-pointer border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 ${
              isDragActive 
                ? 'border-indigo-500 bg-indigo-500/5' 
                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/50'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <input {...getInputProps()} />
            
            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className={`p-4 rounded-full transition-colors ${isDragActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-indigo-400'}`}>
                <UploadCloud className="w-10 h-10" />
              </div>
              <div>
                <p className="text-xl font-medium mb-2">
                  {isDragActive ? 'Drop your images here...' : 'Drag & drop your images here'}
                </p>
                <p className="text-zinc-500 text-sm">
                  Supports JPG, PNG, WEBP. Max dimensions 7000x7000px.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {images.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Processing Queue</h2>
              {allDone && hasSuccess && (
                <button
                  onClick={downloadZip}
                  disabled={isZipping}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isZipping ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  {isZipping ? 'Creating ZIP...' : 'Download All as ZIP'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {images.map((img) => (
                  <motion.div
                    key={img.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col"
                  >
                    <button 
                      onClick={() => removeImage(img.id)}
                      className="absolute top-3 right-3 z-10 p-1.5 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-zinc-300 hover:text-white" />
                    </button>
                    
                    <div className="relative h-40 bg-zinc-800/50 w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={img.previewUrl} 
                        alt="preview" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                    </div>

                    <div className="p-5 flex-1 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-sm truncate" title={img.originalFile.name}>
                          {img.originalFile.name}
                        </p>
                        {img.status === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
                        {img.status === 'compressing' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />}
                        {img.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
                        {img.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-zinc-700 shrink-0" />}
                      </div>

                      <div className="mt-auto space-y-2 text-xs text-zinc-400">
                        <div className="flex justify-between">
                          <span>Original:</span>
                          <span>{formatSize(img.originalSize)}</span>
                        </div>
                        {img.status === 'success' && img.compressedSize && (
                          <div className="flex justify-between text-emerald-400/90 font-medium">
                            <span>Compressed:</span>
                            <span>{formatSize(img.compressedSize)}</span>
                          </div>
                        )}
                        {img.status === 'error' && (
                          <div className="text-rose-400">
                            {img.errorMsg}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {img.status === 'compressing' && (
                      <div className="absolute bottom-0 left-0 h-1 bg-indigo-500/20 w-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-500"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

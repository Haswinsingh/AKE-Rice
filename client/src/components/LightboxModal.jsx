import React, { useEffect } from 'react';
import { X, ZoomIn, Download } from 'lucide-react';

export default function LightboxModal({ isOpen, src, title, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 transition-opacity animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
      >
        {/* Controls */}
        <div className="w-full flex items-center justify-between pb-3 text-white">
          <span className="text-sm font-semibold truncate max-w-md">{title || 'Image Preview'}</span>
          <div className="flex items-center gap-2">
            <a
              href={src}
              download
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Download image"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-red-600 text-white transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Content */}
        <div className="overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-black/40">
          <img
            src={src}
            alt={title || 'Preview'}
            className="max-h-[80vh] w-auto max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

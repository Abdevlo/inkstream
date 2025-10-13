'use client';

import { useState, useRef } from 'react';
import { TileWrapper } from './tile-wrapper';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface PPTXTileProps {
  id: string;
  onClose?: () => void;
}

export function PPTXTile({ id, onClose }: PPTXTileProps) {
  const [fileName, setFileName] = useState<string>('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pptx')) {
      toast.error('Please select a .pptx file');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    try {
      // In a real implementation, we would:
      // 1. Upload file to S3 or process it
      // 2. Convert PPTX slides to images using a library or service
      // 3. Store slide images as base64 or URLs

      // For this demo, we'll create placeholder slides
      const mockSlides = Array.from({ length: 5 }, (_, i) =>
        `data:image/svg+xml,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
            <rect width="800" height="600" fill="#f8f9fa"/>
            <text x="400" y="300" font-size="48" text-anchor="middle" fill="#333">
              Slide ${i + 1}
            </text>
            <text x="400" y="350" font-size="24" text-anchor="middle" fill="#666">
              ${file.name}
            </text>
          </svg>
        `)}`
      );

      setSlides(mockSlides);
      setCurrentSlide(0);
      toast.success(`Loaded ${mockSlides.length} slides`);
    } catch (error: any) {
      console.error('Error loading PPTX:', error);
      toast.error('Failed to load presentation');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => Math.max(0, prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1));
  };

  return (
    <TileWrapper
      id={id}
      title="PPTX Viewer"
      onClose={onClose}
      initialWidth={700}
      initialHeight={550}
    >
      <div className="h-full flex flex-col">
        {/* File Upload */}
        {slides.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No presentation loaded</h3>
              <p className="text-gray-600 mb-4">Upload a PowerPoint file to get started</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                isLoading={isLoading}
              >
                Select PPTX File
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Slide Display */}
            <div className="flex-1 bg-gray-900 flex items-center justify-center p-4">
              <img
                src={slides[currentSlide]}
                alt={`Slide ${currentSlide + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Controls */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600 font-medium">
                  {fileName}
                </span>
                <span className="text-sm text-gray-600">
                  Slide {currentSlide + 1} of {slides.length}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handlePrevSlide}
                  disabled={currentSlide === 0}
                  variant="secondary"
                  className="flex-1"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </Button>
                <Button
                  onClick={handleNextSlide}
                  disabled={currentSlide === slides.length - 1}
                  variant="secondary"
                  className="flex-1"
                >
                  Next
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
                <Button
                  onClick={() => {
                    setSlides([]);
                    setFileName('');
                    setCurrentSlide(0);
                  }}
                  variant="ghost"
                >
                  Clear
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </TileWrapper>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { TileWrapper } from './tile-wrapper';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface WebcamTileProps {
  id: string;
  onClose?: () => void;
  onStreamChange?: (stream: MediaStream | null) => void;
}

export function WebcamTile({ id, onClose, onStreamChange }: WebcamTileProps) {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const startWebcam = async () => {
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsActive(true);
      onStreamChange?.(stream);
      toast.success('Webcam started');
    } catch (error: any) {
      console.error('Error accessing webcam:', error);
      toast.error('Failed to access webcam. Please check permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    onStreamChange?.(null);
  };

  const toggleWebcam = () => {
    if (isActive) {
      stopWebcam();
    } else {
      startWebcam();
    }
  };

  return (
    <TileWrapper id={id} title="Webcam" onClose={onClose}>
      <div className="h-full flex flex-col">
        <div className="flex-1 bg-gray-900 flex items-center justify-center">
          {isActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Webcam is off</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <Button
            onClick={toggleWebcam}
            isLoading={isLoading}
            variant={isActive ? 'danger' : 'primary'}
            className="w-full"
          >
            {isActive ? 'Stop Webcam' : 'Start Webcam'}
          </Button>
        </div>
      </div>
    </TileWrapper>
  );
}

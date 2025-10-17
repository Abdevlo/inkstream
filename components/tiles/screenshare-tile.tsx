'use client';

import { useState, useRef, useEffect } from 'react';
import { TileWrapper } from './tile-wrapper';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface ScreenShareTileProps {
  id: string;
  onClose?: () => void;
  onStreamChange?: (stream: MediaStream | null) => void;
}

export function ScreenShareTile({ id, onClose, onStreamChange }: ScreenShareTileProps) {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopScreenShare();
    };
  }, []);

  const startScreenShare = async () => {
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as any,
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Listen for when user stops sharing via browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
        toast.info('Screen sharing stopped');
      });

      setIsActive(true);
      onStreamChange?.(stream);
      toast.success('Screen sharing started');
    } catch (error: any) {
      console.error('Error accessing screen share:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Screen sharing permission denied');
      } else {
        toast.error('Failed to start screen sharing');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopScreenShare = () => {
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

  return (
    <TileWrapper
      id={id}
      title="Screen Share"
      onClose={onClose}
      initialWidth={800}
      initialHeight={500}
    >
      <div className="h-full flex flex-col">
        <div className="flex-1 bg-gray-900 flex items-center justify-center">
          {isActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-center text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p>Screen sharing is off</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <Button
            onClick={isActive ? stopScreenShare : startScreenShare}
            isLoading={isLoading}
            variant={isActive ? 'danger' : 'primary'}
            className="w-full"
          >
            {isActive ? 'Stop Sharing' : 'Start Screen Share'}
          </Button>
        </div>
      </div>
    </TileWrapper>
  );
}

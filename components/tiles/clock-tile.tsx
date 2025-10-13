'use client';

import { useState, useEffect, useRef } from 'react';
import { TileWrapper } from './tile-wrapper';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/utils/session-helpers';

interface ClockTileProps {
  id: string;
  onClose?: () => void;
}

type ClockMode = 'clock' | 'stopwatch' | 'timer';

export function ClockTile({ id, onClose }: ClockTileProps) {
  const [mode, setMode] = useState<ClockMode>('clock');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);

  // Timer state
  const [timerDuration, setTimerDuration] = useState(300); // 5 minutes default
  const [timerRemaining, setTimerRemaining] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerInput, setTimerInput] = useState('5');

  const stopwatchInterval = useRef<NodeJS.Timeout | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  // Clock - update every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Stopwatch logic
  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchInterval.current = setInterval(() => {
        setStopwatchTime((prev) => prev + 1);
      }, 1000);
    } else if (stopwatchInterval.current) {
      clearInterval(stopwatchInterval.current);
    }

    return () => {
      if (stopwatchInterval.current) {
        clearInterval(stopwatchInterval.current);
      }
    };
  }, [stopwatchRunning]);

  // Timer logic
  useEffect(() => {
    if (timerRunning && timerRemaining > 0) {
      timerInterval.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            // Play alert sound (browser default)
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjaJ0fPTgjMGHm7A7+OZTA0PVKrn77BaGAg+ltryxnMpBSp+zPLaizsIGGS57OihUBELTKXh8bllHAU2jdXzzn0vBSF1xe/glEILElyx6+mrWBUIOpjc8sSAMAgadLzv45xPDhJRp+fxsV0bCDuU3PLEfzAFKHzM8dubRQkSYK/q7KdOEwtMpOHysWQdBTaL1PPPgDAFJHLI8N6cRgoSVKvn7q9aGQc5ltzzwn4xBSZ6zPLZjj4IEmax6eeqUhIHRp/g8bZlHgU1i9Xz0IA' />);
            audio.play().catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [timerRunning, timerRemaining]);

  const handleStopwatchStartStop = () => {
    setStopwatchRunning(!stopwatchRunning);
  };

  const handleStopwatchReset = () => {
    setStopwatchRunning(false);
    setStopwatchTime(0);
  };

  const handleTimerSet = () => {
    const minutes = parseInt(timerInput) || 5;
    const seconds = minutes * 60;
    setTimerDuration(seconds);
    setTimerRemaining(seconds);
    setTimerRunning(false);
  };

  const handleTimerStartStop = () => {
    setTimerRunning(!timerRunning);
  };

  const handleTimerReset = () => {
    setTimerRunning(false);
    setTimerRemaining(timerDuration);
  };

  return (
    <TileWrapper
      id={id}
      title="Clock & Timer"
      onClose={onClose}
      initialWidth={400}
      initialHeight={350}
    >
      <div className="h-full flex flex-col">
        {/* Mode Selector */}
        <div className="p-3 border-b border-gray-200 flex gap-2 bg-gray-50">
          {(['clock', 'stopwatch', 'timer'] as ClockMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          {/* Clock Mode */}
          {mode === 'clock' && (
            <div className="text-center">
              <div className="text-6xl font-bold text-gray-900 mb-2">
                {currentTime.toLocaleTimeString()}
              </div>
              <div className="text-xl text-gray-600">
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
          )}

          {/* Stopwatch Mode */}
          {mode === 'stopwatch' && (
            <div className="text-center w-full">
              <div className="text-6xl font-bold text-gray-900 mb-6">
                {formatDuration(stopwatchTime)}
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={handleStopwatchStartStop}
                  variant={stopwatchRunning ? 'danger' : 'primary'}
                >
                  {stopwatchRunning ? 'Stop' : 'Start'}
                </Button>
                <Button onClick={handleStopwatchReset} variant="secondary">
                  Reset
                </Button>
              </div>
            </div>
          )}

          {/* Timer Mode */}
          {mode === 'timer' && (
            <div className="text-center w-full">
              <div
                className={`text-6xl font-bold mb-6 ${
                  timerRemaining < 60 && timerRemaining > 0
                    ? 'text-red-600 animate-pulse'
                    : 'text-gray-900'
                }`}
              >
                {formatDuration(timerRemaining)}
              </div>

              {!timerRunning && timerRemaining === timerDuration && (
                <div className="mb-4">
                  <div className="flex gap-2 items-center justify-center mb-2">
                    <input
                      type="number"
                      value={timerInput}
                      onChange={(e) => setTimerInput(e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                      min="1"
                      max="60"
                    />
                    <span className="text-gray-600">minutes</span>
                  </div>
                  <Button onClick={handleTimerSet} variant="secondary" size="sm">
                    Set Timer
                  </Button>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={handleTimerStartStop}
                  variant={timerRunning ? 'danger' : 'primary'}
                  disabled={timerRemaining === 0}
                >
                  {timerRunning ? 'Pause' : 'Start'}
                </Button>
                <Button onClick={handleTimerReset} variant="secondary">
                  Reset
                </Button>
              </div>

              {timerRemaining === 0 && (
                <div className="mt-4 text-red-600 font-semibold">
                  Time's up!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TileWrapper>
  );
}

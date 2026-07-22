'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type ScannerState = 'idle' | 'starting' | 'active' | 'error';

interface Options {
  onScan:           (code: string, source: 'camera' | 'external') => void;
  disableExternal?: boolean;
}

/**
 * useBarcodeScanner
 *
 * Camera: uses @zxing/library decodeFromConstraints with environment-facing
 *         camera — faster + more reliable on mobile than decodeFromVideoDevice.
 *         timeBetweenDecodingAttempts set to 100ms for snappy response.
 *
 * External: listens for rapid HID keypress bursts ending with Enter.
 */
export function useBarcodeScanner({ onScan, disableExternal = false }: Options) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const readerRef  = useRef<any>(null);

  const [scannerState,    setScannerState]    = useState<ScannerState>('idle');
  const [cameraError,     setCameraError]     = useState('');
  const [externalEnabled, setExternalEnabled] = useState(!disableExternal);
  const [lastExternalScan, setLastExternalScan] = useState('');

  // Keep onScan stable via ref — no stale closures
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  // ── External HID scanner ────────────────────────────────────────────────
  const bufferRef  = useRef('');
  const lastKeyRef = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!externalEnabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA') return;

      const now = Date.now();
      const gap = now - lastKeyRef.current;
      lastKeyRef.current = now;

      if (e.key === 'Enter') {
        const buf = bufferRef.current.trim();
        bufferRef.current = '';
        if (timerRef.current) clearTimeout(timerRef.current);
        if (buf.length >= 4) {
          setLastExternalScan(buf);
          onScanRef.current(buf, 'external');
        }
        return;
      }

      if (e.key.length === 1) {
        if (gap > 300 && bufferRef.current.length > 0) bufferRef.current = '';
        bufferRef.current += e.key;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          const buf = bufferRef.current.trim();
          bufferRef.current = '';
          if (buf.length >= 6) {
            setLastExternalScan(buf);
            onScanRef.current(buf, 'external');
          }
        }, 500);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [externalEnabled]);

  // ── Camera scanner ──────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    try { readerRef.current?.reset(); } catch (_) {}
    readerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerState('idle');
    setCameraError('');
  }, []);

  const startCamera = useCallback(async () => {
    setScannerState('starting');
    setCameraError('');

    try {
      // Dynamically import to avoid SSR issues
      const { BrowserMultiFormatReader } = await import('@zxing/library');

      const reader = new BrowserMultiFormatReader();
      // Faster scan attempts — default is 500ms, this feels snappy
      reader.timeBetweenDecodingAttempts = 100;
      readerRef.current = reader;

      // Use environment (rear) camera on mobile, any camera on desktop
      await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width:      { ideal: 1280 },
            height:     { ideal: 720 },
          },
        },
        videoRef.current!,
        (result, error) => {
          if (result) {
            const code = result.getText();
            stopCamera();
            onScanRef.current(code, 'camera');
          }
          // NotFoundException fires constantly when no barcode visible — ignore
        }
      );

      setScannerState('active');
    } catch (e: any) {
      stopCamera();
      const msg = e?.message ?? '';
      if (/permission|denied/i.test(msg)) {
        setCameraError('Camera permission denied. Please allow access in your browser settings.');
      } else if (/not found|no device|no camera/i.test(msg)) {
        setCameraError('No camera found. Use the search box or an external scanner.');
      } else {
        setCameraError('Could not start camera. Try again or type the barcode manually.');
      }
      setScannerState('error');
    }
  }, [stopCamera]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    scannerState,
    cameraError,
    videoRef,
    startCamera,
    stopCamera,
    externalEnabled,
    setExternalEnabled,
    lastExternalScan,
    onScan,
  };
}
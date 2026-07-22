'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type ScannerState = 'idle' | 'starting' | 'active' | 'error';

interface UseBarcodeScanner {
  // Camera scanner
  scannerState:   ScannerState;
  cameraError:    string;
  videoRef:       React.RefObject<HTMLVideoElement>;
  startCamera:    () => Promise<void>;
  stopCamera:     () => void;

  // External scanner (USB / Bluetooth HID)
  externalEnabled:    boolean;
  setExternalEnabled: (v: boolean) => void;
  lastExternalScan:   string;        // raw string from external device

  // Shared callback
  onScan: (code: string, source: 'camera' | 'external') => void;
}

interface Options {
  onScan: (code: string, source: 'camera' | 'external') => void;
}

/**
 * useBarcode Scanner
 *
 * Camera scanning:  uses @zxing/browser decodeFromVideoDevice (stable API).
 * External scanner: listens for rapid keypress bursts ending with Enter —
 *                   the signature of USB/Bluetooth HID barcode scanners.
 */
export function useBarcodeScanner({ onScan }: Options) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const readerRef    = useRef<any>(null);
  const streamRef    = useRef<MediaStream | null>(null);

  const [scannerState,      setScannerState]      = useState<ScannerState>('idle');
  const [cameraError,       setCameraError]        = useState('');
  const [externalEnabled,   setExternalEnabled]    = useState(true);
  const [lastExternalScan,  setLastExternalScan]   = useState('');

  // ── External scanner listener ─────────────────────────────────────────
  // HID scanners type chars very fast (< 50ms apart) then send Enter.
  // We collect chars; if Enter arrives and buffer filled in < 100ms per char → it's a scanner.
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const bufferRef   = useRef('');
  const lastKeyRef  = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!externalEnabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA') return;
      const now = Date.now();
      const gap  = now - lastKeyRef.current;
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
        if (gap > 300 && bufferRef.current.length > 0) {
          bufferRef.current = '';
        }
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
  }, [externalEnabled]); // no onScan dep — we use the ref instead

  // ── Camera scanner ────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    try { readerRef.current?.reset(); } catch (_) {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    readerRef.current = null;
    if (videoRef.current) { videoRef.current.srcObject = null; }
    setScannerState('idle');
    setCameraError('');
  }, []);

  const startCamera = useCallback(async () => {
    setScannerState('starting');
    setCameraError('');

    try {
      const { BrowserMultiFormatReader, BrowserCodeReader } = await import('@zxing/browser');

      // Pick rear camera if available
      const devices = await BrowserCodeReader.listVideoInputDevices();
      const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
      const deviceId = rear?.deviceId ?? undefined;

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // decodeFromVideoDevice is the stable, non-deprecated API
      // It manages the stream internally — we just give it the video element
      await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        (result, error) => {
          if (result) {
            const code = result.getText();
            stopCamera();
            onScanRef.current(code, 'camera');
          }
          // NotFoundException is fired constantly when no barcode visible — ignore silently
        }
      );

      setScannerState('active');
    } catch (e: any) {
      stopCamera();
      const msg = e?.message ?? '';
      if (/permission|denied/i.test(msg)) {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (/not found|no device/i.test(msg)) {
        setCameraError('No camera found. Use the search box or an external scanner instead.');
      } else {
        setCameraError('Could not start camera. Try again or use the search box.');
      }
      setScannerState('error');
    }
  }, [onScan, stopCamera]);

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
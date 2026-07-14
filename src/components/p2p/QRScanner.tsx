"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { toast } from "sonner";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState("");
  const regionId = "p2p-qr-reader";

  useEffect(() => {
    let isMounted = true;
    const scanner = new Html5Qrcode(regionId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setHasCamera(true);
          const cameraId = devices[0].id; // using first camera, or ideal environment
          scanner
            .start(
              { facingMode: "environment" },
              {
                fps: 20,
                qrbox: { width: 300, height: 300 },
                aspectRatio: 1.0,
              },
              (decodedText) => {
                if (isMounted) {
                  onScanSuccess(decodedText);
                  scanner.stop().catch(console.error);
                }
              },
              (errorMessage) => {
                // frequent scanning errors when no QR is in frame, ignore.
              }
            )
            .catch((err) => {
              console.error(err);
              if (isMounted) setErrorMsg("Failed to start camera. Please grant permissions.");
            });
        } else {
          setHasCamera(false);
          setErrorMsg("No cameras found on this device.");
        }
      })
      .catch((err) => {
        setHasCamera(false);
        setErrorMsg("Error requesting camera permissions.");
      });

    return () => {
      isMounted = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScanSuccess]);

  if (!hasCamera || errorMsg) {
    return (
      <div className="bg-snow border-[3px] border-navy p-6 rounded-2xl shadow-[4px_4px_0_0_#000] text-center max-w-sm w-full">
        <div className="w-12 h-12 bg-coral-light text-coral rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </div>
        <h3 className="font-display font-bold text-navy mb-2">Camera Error</h3>
        <p className="text-sm text-slate mb-4">{errorMsg}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="w-full bg-ghost border-[3px] border-navy text-navy font-bold py-2 rounded-xl hover:bg-cloud transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="bg-snow border-[3px] border-navy rounded-3xl overflow-hidden shadow-[6px_6px_0_0_#000]">
        <div id={regionId} className="w-full h-[300px] bg-black"></div>
        {onClose && (
          <div className="p-4 bg-ghost border-t-[3px] border-navy">
            <button
              onClick={onClose}
              className="w-full py-2 bg-navy text-snow font-bold rounded-xl press-2 press-navy transition-all"
            >
              Cancel Scanning
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

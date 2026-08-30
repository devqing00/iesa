"use client";

import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface PaymentCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string | undefined;
  paymentTitle: string | undefined;
  onCheckInSuccess: () => void;
}

export function PaymentCheckInModal({ isOpen, onClose, paymentId, paymentTitle, onCheckInSuccess }: PaymentCheckInModalProps) {
  const { getAccessToken } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen || !paymentId) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      return;
    }

    setIsScanning(true);
    setLastScan(null);

    const onScanSuccess = async (decodedText: string) => {
      // Prevent multiple rapid scans
      if (lastScan === decodedText) return;
      setLastScan(decodedText);

      try {
        if (!decodedText.startsWith("IESA_EVENT:")) {
          toast.error("Invalid QR code format. Not a valid ticket.");
          setTimeout(() => setLastScan(null), 3000);
          return;
        }

        const token = await getAccessToken();
        const res = await fetch(getApiUrl(`/api/v1/payments/${paymentId}/check-in`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ qrData: decodedText }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.detail || "Check-in failed");
        }

        const data = await res.json();
        if (data.message === "Already checked in") {
          toast.info(data.message);
        } else {
          toast.success(data.message || "Check-in successful");
          onCheckInSuccess();
        }
        setTimeout(() => setLastScan(null), 3000);
      } catch (err: any) {
        toast.error(err.message || "Failed to process QR code");
        setTimeout(() => setLastScan(null), 3000);
      }
    };

    const onScanFailure = (error: any) => {
      // Ignore scan failures
    };

    const scanner = new Html5QrcodeScanner(
      "qr-reader-payment",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    scannerRef.current = scanner;
    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isOpen, paymentId, getAccessToken, lastScan, onCheckInSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-snow rounded-3xl border-[3px] border-navy shadow-[8px_8px_0_0_#000] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b-[3px] border-navy bg-ghost">
          <div>
            <h2 className="font-display font-black text-xl text-navy">Ticket Scanner</h2>
            <p className="text-xs text-navy/60 font-bold truncate max-w-[250px]">{paymentTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-cloud border-[2px] border-transparent hover:border-navy hover:bg-snow transition-all"
          >
            <svg className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <div id="qr-reader-payment" className="w-full rounded-xl overflow-hidden border-[3px] border-navy bg-black"></div>
          <p className="text-center text-sm font-bold text-navy mt-4">
            Point the camera at the student&apos;s ticket QR code.
          </p>
        </div>
      </div>
    </div>
  );
}

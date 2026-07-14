import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useWebRTCShare } from "@/hooks/useWebRTCShare";
import QRScanner from "./QRScanner";
import { saveOfflineResource } from "@/lib/indexedDB";
import { toast } from "sonner";

interface P2PShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "sender" | "receiver";
  resourceToShare?: {
    id: string;
    fileBlob: Blob;
    fileName: string;
  };
}

export default function P2PShareModal({ isOpen, onClose, mode, resourceToShare }: P2PShareModalProps) {
  const {
    connectionState,
    offerToken,
    answerToken,
    progress,
    errorMsg,
    receivedFile,
    initiateShare,
    acceptAnswer,
    prepareToReceive,
    processOffer,
    cleanup,
  } = useWebRTCShare();

  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === "sender" && resourceToShare) {
        initiateShare(resourceToShare.id, resourceToShare.fileBlob, resourceToShare.fileName);
      } else if (mode === "receiver") {
        prepareToReceive();
      }
    } else {
      cleanup();
      setIsScanning(false);
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (receivedFile) {
      // Automatically save to IndexedDB for offline access
      saveOfflineResource(
        receivedFile.metadata.id || receivedFile.metadata.name,
        receivedFile.blob,
        receivedFile.metadata.name,
        receivedFile.metadata.type
      ).then(() => {
        toast.success("Saved to Offline Downloads");
      }).catch((e) => {
        console.error("Failed to save to indexedDB", e);
        toast.error("Failed to save offline");
      });
    }
  }, [receivedFile]);

  const handleManualDownload = () => {
    if (!receivedFile) return;
    const url = URL.createObjectURL(receivedFile.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = receivedFile.metadata.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNativeShare = async () => {
    if (!receivedFile) return;
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([receivedFile.blob], receivedFile.metadata.name, { type: receivedFile.metadata.type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: receivedFile.metadata.name,
            files: [file]
          });
        } else {
          toast.error("Native share not supported for this file type.");
        }
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      toast.error("Native share is not supported on your browser/device.");
    }
  };

  if (!isOpen) return null;

  const handleScanSuccess = (decodedText: string) => {
    setIsScanning(false);
    if (mode === "sender") {
      acceptAnswer(decodedText);
    } else {
      processOffer(decodedText);
    }
  };

  const renderContent = () => {
    if (errorMsg) {
      return (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-coral-light rounded-2xl mx-auto flex items-center justify-center mb-4 border-2 border-navy">
            <svg aria-hidden="true" className="w-8 h-8 text-coral" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <h3 className="font-display font-black text-xl text-navy mb-2">Error Occurred</h3>
          <p className="text-slate text-sm mb-6">{errorMsg}</p>
          <button onClick={onClose} className="px-6 py-3 bg-navy text-snow font-bold rounded-xl press-2 press-navy">
            Close
          </button>
        </div>
      );
    }

    if (connectionState === "transferring" || connectionState === "completed") {
      return (
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-teal/10 rounded-full mx-auto flex items-center justify-center mb-6">
             {connectionState === "completed" ? (
                <svg aria-hidden="true" className="w-10 h-10 text-teal" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
             ) : (
                <svg aria-hidden="true" className="w-10 h-10 text-teal animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.42 3.58-8 8-8zm0 16c-4.42 0-8-3.58-8-8H2c0 5.52 4.48 10 10 10v-2zm8-8c0 4.42-3.58 8-8 8v2c5.52 0 10-4.48 10-10h-2zm-8-8v2c4.42 0 8 3.58 8 8h2c0-5.52-4.48-10-10-10z" />
                </svg>
             )}
          </div>
          <h3 className="font-display font-black text-xl text-navy mb-2">
            {connectionState === "completed" ? "Transfer Complete!" : "Transferring..."}
          </h3>
          <div className="w-full h-4 bg-cloud rounded-full border-2 border-navy overflow-hidden mt-6 mb-2">
            <div className="h-full bg-teal transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="text-xs font-bold text-navy">{progress}%</p>
          {connectionState === "completed" && (
            <div className="mt-6 flex flex-col gap-3">
              <button onClick={handleManualDownload} className="w-full px-6 py-3 bg-teal text-snow font-bold rounded-xl press-2 press-black flex items-center justify-center gap-2">
                <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                Download to Device
              </button>
              {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                <button onClick={handleNativeShare} className="w-full px-6 py-3 bg-snow border-2 border-navy text-navy font-bold rounded-xl press-2 press-navy flex items-center justify-center gap-2">
                  <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92 0-1.61-1.31-2.92-2.92-2.92z"/>
                  </svg>
                  Share via Device
                </button>
              )}
              <button onClick={onClose} className="w-full px-6 py-3 bg-ghost text-slate font-bold rounded-xl hover:bg-cloud transition-colors mt-2">
                Close
              </button>
            </div>
          )}
        </div>
      );
    }

    if (isScanning) {
      return (
        <div className="py-4">
          <h3 className="font-display font-black text-lg text-navy text-center mb-4">
            Scan {mode === "sender" ? "Receiver's" : "Sender's"} QR Code
          </h3>
          <QRScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />
        </div>
      );
    }

    if (mode === "sender") {
      if (connectionState === "generating-offer") {
         return <div className="text-center py-10 font-bold text-navy animate-pulse">Generating Offline Offer...</div>;
      }
      if (connectionState === "waiting-for-answer" && offerToken) {
         return (
            <div className="text-center">
              <h3 className="font-display font-black text-xl text-navy mb-2">Step 1: Share this code</h3>
              <p className="text-sm text-slate mb-6">Have the receiver scan this QR code on their device to initiate the connection.</p>
              <div className="bg-snow inline-block p-4 rounded-2xl border-[3px] border-navy shadow-[4px_4px_0_0_#000] mb-6">
                <QRCodeSVG value={offerToken} size={320} level="L" />
              </div>
              <p className="text-sm text-navy font-bold mb-4">Once they scan it, they will show you a code.</p>
              <button onClick={() => setIsScanning(true)} className="w-full py-3 bg-lime border-[3px] border-navy text-navy font-black rounded-2xl shadow-[3px_3px_0_0_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] transition-all">
                Step 2: Scan Their Code
              </button>
            </div>
         );
      }
    }

    if (mode === "receiver") {
      if (connectionState === "idle") {
        return (
          <div className="text-center py-6">
            <h3 className="font-display font-black text-xl text-navy mb-2">Receive via P2P</h3>
            <p className="text-sm text-slate mb-6">Scan the sender's QR code to start receiving the file.</p>
            <button onClick={() => setIsScanning(true)} className="w-full py-3 bg-lime border-[3px] border-navy text-navy font-black rounded-2xl shadow-[3px_3px_0_0_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000] transition-all">
              Scan Sender Code
            </button>
          </div>
        );
      }
      if (connectionState === "generating-answer") {
         return <div className="text-center py-10 font-bold text-navy animate-pulse">Generating Response...</div>;
      }
      if (connectionState === "waiting-for-sender" && answerToken) {
        return (
          <div className="text-center">
             <h3 className="font-display font-black text-xl text-navy mb-2">Step 2: Show this code</h3>
             <p className="text-sm text-slate mb-6">Show this QR code to the sender so they can complete the connection.</p>
             <div className="bg-snow inline-block p-4 rounded-2xl border-[3px] border-navy shadow-[4px_4px_0_0_#000] mb-6">
               <QRCodeSVG value={answerToken} size={320} level="L" />
             </div>
             <p className="text-sm text-slate animate-pulse">Waiting for sender to connect...</p>
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm">
      <div className="bg-ghost border-[3px] border-navy rounded-[2rem] w-full max-w-md shadow-[8px_8px_0_0_#000] overflow-hidden">
        {/* Header */}
        <div className="bg-snow border-b-[3px] border-navy px-6 py-4 flex items-center justify-between">
          <h2 className="font-display font-black text-lg text-navy">
            {mode === "sender" ? "Share via P2P" : "Receive via P2P"}
          </h2>
          <button onClick={onClose} className="p-2 text-slate hover:text-coral transition-colors rounded-xl hover:bg-coral/10">
            <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        
        {/* Connection Requirement Banner */}
        <div className="bg-lavender/10 border-b-[3px] border-navy px-6 py-2.5 text-xs font-bold text-navy flex items-center gap-2">
          <svg aria-hidden="true" className="w-4 h-4 text-lavender shrink-0" viewBox="0 0 24 24" fill="currentColor">
             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span><strong>Requirement:</strong> Both devices must be connected to the SAME Wi-Fi or Mobile Hotspot (internet not required).</span>
        </div>

        {/* Content */}
        <div className="p-6 bg-ghost">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

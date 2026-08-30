"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";

interface DraggableBoxProps {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  imageBounds: { width: number; height: number };
  onChange: (id: string, newPos: { x: number; y: number; w: number; h: number }) => void;
  color?: string;
}

function DraggableBox({ id, label, x, y, w, h, imageBounds, onChange, color = "#14b8a6" }: DraggableBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ clientX: 0, clientY: 0, initX: x, initY: y, initW: w, initH: h });

  const handleMouseDown = (e: React.MouseEvent, type: "drag" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    if (type === "drag") setIsDragging(true);
    else setIsResizing(true);
    setStartPos({ clientX: e.clientX, clientY: e.clientY, initX: x, initY: y, initW: w, initH: h });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging && !isResizing) return;
      if (!imageBounds.width || !imageBounds.height) return;

      const dx = ((e.clientX - startPos.clientX) / imageBounds.width) * 100;
      const dy = ((e.clientY - startPos.clientY) / imageBounds.height) * 100;

      if (isDragging) {
        onChange(id, {
          x: Math.max(0, Math.min(100 - w, startPos.initX + dx)),
          y: Math.max(0, Math.min(100 - h, startPos.initY + dy)),
          w,
          h,
        });
      } else if (isResizing) {
        onChange(id, {
          x,
          y,
          w: Math.max(5, Math.min(100 - x, startPos.initW + dx)),
          h: Math.max(5, Math.min(100 - y, startPos.initH + dy)),
        });
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, startPos, imageBounds, x, y, w, h, id, onChange]);

  return (
    <div
      onMouseDown={(e) => handleMouseDown(e, "drag")}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
        borderColor: color,
        backgroundColor: `${color}33`,
      }}
      className="absolute border-2 border-dashed flex flex-col items-center justify-center cursor-move touch-none z-10 hover:z-20 group"
    >
      <span style={{ backgroundColor: color }} className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap opacity-80 group-hover:opacity-100">
        {label}
      </span>
      <div
        onMouseDown={(e) => handleMouseDown(e, "resize")}
        style={{ backgroundColor: color }}
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:scale-150 transition-transform"
      />
    </div>
  );
}

interface TicketConfigModalProps {
  paymentId: string;
  paymentTitle: string;
  paidCount: number;
  existingConfig?: any;
  onClose: () => void;
  onConfigSaved: () => void;
}

export default function TicketConfigModal({ paymentId, paymentTitle, paidCount, existingConfig, onClose, onConfigSaved }: TicketConfigModalProps) {
  const { getAccessToken } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(existingConfig?.templateUrl ? 2 : 1);
  const [templateUrl, setTemplateUrl] = useState(existingConfig?.templateUrl || "");
  const [uploading, setUploading] = useState(false);
  
  // Coordinate states
  const [qrCode, setQrCode] = useState(existingConfig?.qrCode || { x: 70, y: 70, w: 20, h: 20 });
  const [studentName, setStudentName] = useState(existingConfig?.studentName || { x: 10, y: 70, w: 50, h: 10 });
  const [matricNumber, setMatricNumber] = useState(existingConfig?.matricNumber || { x: 10, y: 85, w: 40, h: 5 });
  
  const [imageBounds, setImageBounds] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const handleResize = useCallback(() => {
    if (imgRef.current) {
      setImageBounds({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  const handleImageLoad = () => {
    handleResize();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(getApiUrl(`/api/v1/payments/${paymentId}/ticket-template`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload template");
      }

      const data = await res.json();
      setTemplateUrl(data.url);
      toast.success("Template uploaded successfully!");
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload template");
    } finally {
      setUploading(false);
    }
  };

  const handleBoxChange = (id: string, newPos: { x: number; y: number; w: number; h: number }) => {
    if (id === "qrCode") setQrCode(newPos);
    else if (id === "studentName") setStudentName(newPos);
    else if (id === "matricNumber") setMatricNumber(newPos);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const token = await getAccessToken();
      const payload = {
        templateUrl,
        qrCode,
        studentName,
        matricNumber,
        fontFamily: "Helvetica" // Default for now
      };

      const res = await fetch(getApiUrl(`/api/v1/payments/${paymentId}/ticket-config`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save configuration");
      
      toast.success("Ticket design saved!");
      onConfigSaved();
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to save design");
    } finally {
      setSaving(false);
    }
  };

  const dispatchTickets = async () => {
    setDispatching(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/payments/${paymentId}/send-tickets`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to dispatch tickets");
      
      const data = await res.json();
      toast.success(`Started dispatching tickets to ${data.count} students!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch tickets");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
      <div className="bg-snow border-[4px] border-navy rounded-3xl shadow-[12px_12px_0_0_#000] w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-[4px] border-navy bg-sunny">
          <div>
            <h3 className="font-display font-black text-2xl text-navy">Ticket Generator</h3>
            <p className="text-sm font-bold text-navy/70">{paymentTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl border-[3px] border-navy bg-snow hover:bg-cloud flex items-center justify-center transition-colors press-2 press-navy"
            aria-label="Close modal"
          >
            <svg aria-hidden="true" className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Steps */}
        <div className="flex bg-navy">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 p-3 text-center text-xs font-bold uppercase tracking-wider border-r-[2px] border-snow/10 last:border-0 ${step === s ? 'bg-lime text-navy' : step > s ? 'bg-navy text-lime' : 'bg-navy text-snow/40'}`}>
              Step {s}: {s === 1 ? "Upload Design" : s === 2 ? "Map Details" : "Dispatch"}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center bg-ghost">
          {step === 1 && (
            <div className="max-w-md w-full space-y-6">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 mx-auto bg-lavender border-[3px] border-navy rounded-3xl shadow-[4px_4px_0_0_#000] flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <h4 className="font-display font-black text-2xl text-navy">Upload Ticket Template</h4>
                <p className="text-sm text-navy/70">
                  Upload your blank ticket design (JPEG/PNG). We recommend a high-resolution portrait or landscape format.
                </p>
              </div>

              <div className="relative border-[3px] border-dashed border-navy/30 rounded-3xl p-10 text-center hover:bg-cloud hover:border-navy transition-colors">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="font-bold text-navy">
                  {uploading ? "Uploading..." : "Click or drag image here"}
                </span>
                <p className="text-xs text-navy/50 mt-2">Max 5MB</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="w-full h-full flex flex-col xl:flex-row gap-6 items-start">
              <div className="flex-1 w-full bg-snow border-[3px] border-navy rounded-3xl shadow-[6px_6px_0_0_#000] p-4 flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="font-bold text-navy text-sm">Visual Mapper</h4>
                  <p className="text-xs text-slate">Drag and resize the boxes to position them</p>
                </div>
                <div className="relative w-full rounded-xl overflow-hidden bg-cloud flex items-center justify-center" style={{ minHeight: "400px" }}>
                  <img
                    ref={imgRef}
                    src={templateUrl}
                    alt="Template"
                    onLoad={handleImageLoad}
                    className="max-w-full max-h-[60vh] object-contain pointer-events-none"
                  />
                  {imageBounds.width > 0 && (
                    <div className="absolute inset-0 m-auto" style={{ width: imageBounds.width, height: imageBounds.height }}>
                      <DraggableBox id="qrCode" label="QR Code" color="#14b8a6" {...qrCode} imageBounds={imageBounds} onChange={handleBoxChange} />
                      <DraggableBox id="studentName" label="Student Name" color="#f43f5e" {...studentName} imageBounds={imageBounds} onChange={handleBoxChange} />
                      <DraggableBox id="matricNumber" label="Matric Number" color="#8b5cf6" {...matricNumber} imageBounds={imageBounds} onChange={handleBoxChange} />
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full xl:w-80 space-y-4 shrink-0">
                <div className="bg-snow border-[3px] border-navy rounded-3xl p-5 shadow-[4px_4px_0_0_#000]">
                  <h4 className="font-display font-black text-lg text-navy mb-3">Controls</h4>
                  <p className="text-xs text-navy/70 mb-5">
                    Map the placeholders visually on the template. The system will auto-scale the QR code and text to fit within your designated boxes.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-[#14b8a6]"></div>
                      <span className="text-sm font-bold text-navy">QR Code Space</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-[#f43f5e]"></div>
                      <span className="text-sm font-bold text-navy">Student Name</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-[#8b5cf6]"></div>
                      <span className="text-sm font-bold text-navy">Matric Number</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 bg-cloud border-[3px] border-navy rounded-2xl font-bold text-navy hover:bg-snow press-2 press-navy">
                    Back
                  </button>
                  <button onClick={saveConfig} disabled={saving} className="flex-1 py-3 bg-lime border-[3px] border-navy rounded-2xl font-black text-navy press-2 press-navy disabled:opacity-50">
                    {saving ? "Saving..." : "Save Design"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-md w-full text-center space-y-6 pt-10">
              <div className="w-24 h-24 mx-auto bg-teal border-[4px] border-navy rounded-full shadow-[6px_6px_0_0_#000] flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-snow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h4 className="font-display font-black text-3xl text-navy">Design Saved!</h4>
              <p className="text-navy/70">
                Your ticket template and mappings have been securely saved. You can now dispatch the tickets.
              </p>

              <div className="bg-sunny-light border-[3px] border-navy rounded-2xl p-5 my-6 text-left shadow-[4px_4px_0_0_#000]">
                <p className="text-xs font-bold uppercase tracking-wider text-slate mb-1">Recipients</p>
                <p className="font-display font-black text-2xl text-navy">{paidCount} <span className="text-lg">Students</span></p>
                <p className="text-xs text-navy/60 mt-2">Only students who have fully paid this due will receive the generated ticket via email.</p>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setStep(2)} className="flex-1 py-3.5 bg-cloud border-[3px] border-navy rounded-2xl font-bold text-navy hover:bg-snow press-2 press-navy">
                  Edit Design
                </button>
                <button 
                  onClick={dispatchTickets} 
                  disabled={dispatching || paidCount === 0} 
                  className="flex-[2] py-3.5 bg-navy border-[3px] border-navy rounded-2xl font-black text-snow press-2 press-black hover:bg-navy/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {dispatching ? "Dispatching..." : "Send Tickets"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

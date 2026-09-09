"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import RichTextEditor from "@/components/ui/RichTextEditor";

const DEFAULT_CONFERENCE_HTML = `<p>Dear <strong>{{first_name}}</strong>,</p>

<p>Thank you for choosing to be part of this year’s experience and for securing the <strong>Paid Attendee ticket</strong>.</p>

<p>Your <strong>Personalized Conference Ticket</strong> is attached to this email. 🎟️</p>

<p>Kindly take a moment to confirm the details on your ticket and if there is an error on it, send a WhatsApp message to Alex <a href="https://wa.link/1bdrt1" target="_blank" rel="noopener noreferrer" style="color:#9B72CF !important;font-weight:700;text-decoration:underline;"><strong><u>here</u></strong></a>.</p>

<p>This ticket contains your registered identity and serves as your confirmation for the Paid attendee package.</p>

<p><strong>Important:</strong> This ticket is assigned specifically to you. Please do not share or transfer it without contacting the conference organizers.</p>

<p>Remember, as a paid attendee, you get more. Your decision to register as a paid attendee comes with additional benefits beyond the regular conference experience.</p>

<h2>📍 <strong>Conference Details</strong></h2>
<p>Date: <strong><em>SEPTEMBER 10TH, 2026</em></strong></p>
<p>Venue: <strong><em>KAAF AUDITORIUM, HUMAN NUTRITION &amp; DIETETICS</em></strong></p>
<p>Time: <strong><em>9AM</em></strong></p>

<p>Want Your Own <strong><em>‘I will be attending’</em></strong> Personalized Conference Flyer to let everyone know you're coming?, We can design one for you!</p>
<p>If you're interested, send a message to <strong>Samuel</strong> here:<br>
👉 <a href="https://wa.link/gu2156" target="_blank" rel="noopener noreferrer" style="color:#9B72CF !important;font-weight:700;text-decoration:underline;"><strong><u>https://wa.link/gu2156</u></strong></a></p>

<p>Join the conference group for more updates <a href="https://chat.whatsapp.com/G2p8sAbGUxWIas4caTZWdY?s=cl&amp;p=a&amp;ilr=1" target="_blank" rel="noopener noreferrer" style="color:#9B72CF !important;font-weight:700;text-decoration:underline;"><strong><u>here</u></strong></a>.</p>

<p>Once again, thank you for registering as a paid attendee.</p>

<p><strong>See you at the conference!</strong> 🔥</p>

<p><em>Warm regards,</em><br>
<strong>Conference Team</strong><br>
Forge the Future Conference<br>
IESA Process Day 2026</p>`;

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
  const { user, getAccessToken } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(existingConfig?.templateUrl ? 2 : 1);
  const [templateUrl, setTemplateUrl] = useState(existingConfig?.templateUrl || "");
  const [uploading, setUploading] = useState(false);
  
  // Coordinate states
  const [qrCode, setQrCode] = useState(existingConfig?.qrCode || { x: 70, y: 70, w: 20, h: 20 });
  const [studentName, setStudentName] = useState(existingConfig?.studentName || { x: 10, y: 70, w: 50, h: 10 });
  const [matricNumber, setMatricNumber] = useState(existingConfig?.matricNumber || { x: 10, y: 85, w: 40, h: 5 });
  
  // Custom Message & Subject states
  const [emailSubject, setEmailSubject] = useState(
    existingConfig?.emailSubject || (
      paymentTitle.toLowerCase().includes("conference") 
        ? "Your IESA Process Day 2026 Paid Ticket is here 🎟️" 
        : `Your Ticket: ${paymentTitle}`
    )
  );

  const [emailContent, setEmailContent] = useState(
    existingConfig?.emailContent || (
      paymentTitle.toLowerCase().includes("conference")
        ? DEFAULT_CONFERENCE_HTML
        : `<p>Dear <strong>{{first_name}}</strong>,</p><p>Your personalized ticket for <strong>${paymentTitle}</strong> is attached to this email.</p><p>Please present the QR code on your ticket at the entrance for verification.</p>`
    )
  );

  const [testEmail, setTestEmail] = useState(user?.email || "adetayoalexander12@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);

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
        fontFamily: "Helvetica",
        emailSubject,
        emailContent,
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
      
      toast.success("Ticket design & message saved!");
      onConfigSaved();
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to save design");
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid test email address");
      return;
    }
    setSendingTest(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/payments/${paymentId}/send-tickets`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: emailSubject,
          content: emailContent,
          testEmail: testEmail.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to send test email");
      }

      toast.success(`Test ticket email sent to ${testEmail}! Check your inbox.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const dispatchTickets = async () => {
    if (!window.confirm(`Are you sure you want to dispatch tickets to all ${paidCount} paid students?`)) {
      return;
    }
    setDispatching(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(getApiUrl(`/api/v1/payments/${paymentId}/send-tickets`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: emailSubject,
          content: emailContent,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to dispatch tickets");
      }
      
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
            <div className="w-full flex flex-col items-center">
              <div className="w-full max-w-4xl bg-snow border-[3px] border-navy rounded-2xl p-4 mb-4 flex items-center justify-between shadow-[4px_4px_0_0_#000]">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-navy/60">Positioning Mode:</span>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#14b8a6]/20 text-[#0d9488] border border-[#14b8a6]">
                      <span className="w-2 h-2 rounded-full bg-[#14b8a6]" /> QR Code
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#8b5cf6]/20 text-[#7c3aed] border border-[#8b5cf6]">
                      <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" /> Student Name
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f59e0b]/20 text-[#d97706] border border-[#f59e0b]">
                      <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Matric Number
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-navy hover:underline flex items-center gap-1"
                >
                  Change Image
                </button>
              </div>

              {/* Canvas Preview Area */}
              <div className="relative border-[4px] border-navy rounded-2xl overflow-hidden shadow-[8px_8px_0_0_#000] bg-black max-w-4xl w-full select-none">
                <img
                  ref={imgRef}
                  src={templateUrl}
                  alt="Ticket Template"
                  onLoad={handleImageLoad}
                  className="w-full h-auto block pointer-events-none"
                />

                {imageBounds.width > 0 && (
                  <>
                    <DraggableBox
                      id="qrCode"
                      label="QR Code"
                      x={qrCode.x}
                      y={qrCode.y}
                      w={qrCode.w}
                      h={qrCode.h}
                      color="#14b8a6"
                      imageBounds={imageBounds}
                      onChange={handleBoxChange}
                    />
                    <DraggableBox
                      id="studentName"
                      label="Student Name"
                      x={studentName.x}
                      y={studentName.y}
                      w={studentName.w}
                      h={studentName.h}
                      color="#8b5cf6"
                      imageBounds={imageBounds}
                      onChange={handleBoxChange}
                    />
                    <DraggableBox
                      id="matricNumber"
                      label="Matric Number"
                      x={matricNumber.x}
                      y={matricNumber.y}
                      w={matricNumber.w}
                      h={matricNumber.h}
                      color="#f59e0b"
                      imageBounds={imageBounds}
                      onChange={handleBoxChange}
                    />
                  </>
                )}
              </div>

              <div className="w-full max-w-4xl flex items-center justify-between mt-6">
                <p className="text-xs text-navy/60 font-medium">
                  Drag boxes to position. Drag bottom-right handles to resize bounds.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="py-3 px-5 bg-cloud border-[3px] border-navy rounded-2xl font-bold text-navy hover:bg-snow press-2 press-navy text-sm">
                    Back
                  </button>
                  <button onClick={saveConfig} disabled={saving} className="py-3 px-6 bg-lime border-[3px] border-navy rounded-2xl font-black text-navy press-2 press-navy disabled:opacity-50 text-sm flex items-center gap-2">
                    {saving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                        <span>Saving Design...</span>
                      </>
                    ) : (
                      <span>Save &amp; Continue to Message &rarr;</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="w-full max-w-4xl space-y-6 py-2">
              {/* Summary Header */}
              <div className="bg-sunny-light border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal animate-pulse" />
                    <p className="text-xs font-bold uppercase tracking-wider text-navy/70">Personalized Ticket Dispatch</p>
                  </div>
                  <p className="font-display font-black text-2xl text-navy">
                    {paidCount} Paid Attendee{paidCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-snow border-[2px] border-navy px-3.5 py-1.5 rounded-xl text-xs font-bold text-navy shadow-[2px_2px_0_0_#000]">
                  <span>🎟️ Personalized Visual Ticket attached as PNG</span>
                </div>
              </div>

              {/* Subject Line Input */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-navy">
                    Email Subject Line
                  </label>
                  <span className="text-[11px] text-navy/60 font-medium">Supports placeholders</span>
                </div>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. Your IESA Process Day 2026 Paid Ticket is here 🎟️"
                  className="w-full px-4 py-2.5 bg-snow border-[3px] border-navy rounded-xl font-bold text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-teal text-sm shadow-[2px_2px_0_0_#000]"
                />
              </div>

              {/* Rich Text Editor with Placeholders */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-navy">
                    Email Body Message
                  </label>
                  <span className="text-[11px] text-navy/60 font-medium">Click variable chip to insert</span>
                </div>
                <div className="border-[3px] border-navy rounded-2xl overflow-hidden shadow-[4px_4px_0_0_#000] bg-snow">
                  <RichTextEditor
                    value={emailContent}
                    onChange={(val) => setEmailContent(val)}
                    minHeight="min-h-[300px]"
                    availableVariables={[
                      { label: "First Name", value: "{{first_name}}", description: "Student's first name (e.g. Samuel)" },
                      { label: "Full Name", value: "{{student_name}}", description: "Full student name (e.g. Samuel Oluwafemi Toriola)" },
                      { label: "Matric No", value: "{{matric_number}}", description: "Matriculation number (e.g. 258451)" },
                    ]}
                  />
                </div>
              </div>

              {/* Test Email Section */}
              <div className="bg-lavender/30 border-[3px] border-navy rounded-2xl p-4 shadow-[4px_4px_0_0_#000] text-left space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧪</span>
                  <div>
                    <h5 className="font-display font-black text-sm text-navy">Send A Test Email First</h5>
                    <p className="text-xs text-navy/70">
                      Verify the personalized formatting and generated visual ticket attachment in your inbox before blasting to all students.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className="flex-1 px-3 py-2 bg-snow border-[2px] border-navy rounded-xl text-xs font-bold text-navy focus:outline-none focus:ring-2 focus:ring-teal shadow-[2px_2px_0_0_#000]"
                  />
                  <button
                    type="button"
                    onClick={sendTestEmail}
                    disabled={sendingTest}
                    className="px-5 py-2.5 bg-sunny border-[2px] border-navy rounded-xl text-xs font-black text-navy press-2 press-navy hover:bg-sunny/80 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap shadow-[2px_2px_0_0_#000]"
                  >
                    {sendingTest ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                        <span>Sending Test...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Test Email</span>
                        <span>🚀</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-3 px-5 bg-cloud border-[3px] border-navy rounded-2xl font-bold text-navy hover:bg-snow press-2 press-navy text-sm"
                >
                  &larr; Back to Ticket Layout
                </button>
                <button
                  type="button"
                  onClick={dispatchTickets}
                  disabled={dispatching || paidCount === 0}
                  className="flex-1 py-3.5 px-6 bg-navy border-[3px] border-navy rounded-2xl font-black text-snow press-2 press-black hover:bg-navy/90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-[4px_4px_0_0_#000]"
                >
                  {dispatching ? (
                    <>
                      <span className="w-4 h-4 border-2 border-snow border-t-transparent rounded-full animate-spin" />
                      <span>Dispatching Tickets...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span>Send Tickets to All ({paidCount} Students)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { QRCodeSVG } from 'qrcode.react';

interface EventTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  userId: string;
}

export function EventTicketModal({ isOpen, onClose, event, userId }: EventTicketModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-snow rounded-3xl w-full max-w-sm overflow-hidden shadow-[8px_8px_0_0_#000] border-[4px] border-navy flex flex-col items-center">
        {/* Header */}
        <div className="bg-navy w-full text-snow p-6 text-center border-b-[4px] border-navy relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-snow/10 hover:bg-snow/20 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-snow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="w-12 h-12 bg-lime border-[3px] border-navy rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0_0_#000]">
            <svg className="w-6 h-6 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <h3 className="font-display font-black text-2xl uppercase tracking-wider">{event?.title}</h3>
          <p className="text-lime text-sm font-bold mt-1">Official Ticket</p>
        </div>
        
        {/* Body */}
        <div className="p-8 w-full flex flex-col items-center bg-[url('/assets/images/noise.png')]">
          <div className="bg-white p-4 border-[4px] border-navy rounded-2xl shadow-[4px_4px_0_0_#000] mb-6">
            <QRCodeSVG 
              value={userId} 
              size={200}
              level="H"
              fgColor="#031F3F" // navy
              bgColor="#ffffff"
            />
          </div>
          
          <div className="text-center space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate">Admit One</p>
            <p className="text-body font-bold text-lg text-navy line-clamp-1">{event?.title}</p>
            <p className="text-sm text-navy/70">
              {event?.date ? new Date(event.date).toLocaleDateString() : ''} 
              {event?.time ? ` • ${event.time}` : ''}
            </p>
          </div>
        </div>
        
        {/* Footer / Tear-off line */}
        <div className="w-full relative border-t-[3px] border-dashed border-navy/30 bg-cloud/50 p-6 flex flex-col items-center justify-center">
          <div className="absolute top-[-10px] left-[-10px] w-5 h-5 bg-navy/60 rounded-full" />
          <div className="absolute top-[-10px] right-[-10px] w-5 h-5 bg-navy/60 rounded-full" />
          
          <p className="text-xs text-navy/60 font-medium text-center">
            Present this QR code at the entrance for scanning. Do not share this ticket.
          </p>
        </div>
      </div>
    </div>
  );
}

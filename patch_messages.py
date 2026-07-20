import re

with open(r"c:\Users\QING\Desktop\Qing\iesa\src\app\(student)\dashboard\messages\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add transcription to Message interface
content = re.sub(
    r"reactions\?: Reaction\[\];\n\s*isPinned\?: boolean;\n  }",
    "reactions?: Reaction[];\n    isPinned?: boolean;\n    transcription?: string | null;\n  }",
    content
)

# 2. Add refs and state variables for visualizer and gestures
content = re.sub(
    r"const recordingTimerRef = useRef<ReturnType<typeof setInterval> \| null>\(null\);",
    """const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isCanceling, setIsCanceling] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number } | null>(null);""",
    content
)

# 3. Replace stopVoiceRecording
content = re.sub(
    r"const stopVoiceRecording = useCallback\(\(\) => \{\n\s*if \(recordingTimerRef\.current\) \{\n\s*clearInterval\(recordingTimerRef\.current\);\n\s*recordingTimerRef\.current = null;\n\s*\}\n\s*mediaRecorderRef\.current\?\.stop\(\);\n\s*mediaStreamRef\.current\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\);\n\s*mediaStreamRef\.current = null;\n\s*setRecordingVoice\(false\);\n\s*\}, \[\]\);",
    """const stopVoiceRecording = useCallback((cancel = false) => {
    if (cancel) setIsCanceling(true);
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecordingVoice(false);
    setIsRecordingLocked(false);
    setDragOffset({ x: 0, y: 0 });
    dragStartRef.current = null;
  }, []);""",
    content
)

# 4. Replace startVoiceRecording
content = re.sub(
    r"const startVoiceRecording = async \(\) => \{\n\s*if \(!isConnected \|\| uploading \|\| recordingVoice\) return;\n\s*try \{\n\s*const stream = await navigator\.mediaDevices\.getUserMedia\(\{ audio: true \}\);\n\s*mediaStreamRef\.current = stream;\n\s*const recorder = new MediaRecorder\(stream\);\n\s*mediaRecorderRef\.current = recorder;\n\s*voiceChunksRef\.current = \[\];\n\s*setRecordingSeconds\(0\);\n\n\s*recorder\.ondataavailable = \(event\) => \{\n\s*if \(event\.data && event\.data\.size > 0\) voiceChunksRef\.current\.push\(event\.data\);\n\s*\};\n\n\s*recorder\.onstop = \(\) => \{\n\s*const chunks = voiceChunksRef\.current;\n\s*voiceChunksRef\.current = \[\];\n\s*const mimeType = recorder\.mimeType \|\| \"audio/webm\";\n\s*const ext = mimeType\.includes\(\"ogg\"\) \? \"ogg\" : mimeType\.includes\(\"mp4\"\) \? \"m4a\" : \"webm\";\n\s*const blob = new Blob\(chunks, \{ type: mimeType \}\);\n\s*const file = new File\(\[blob\], `voice-note-\$\{Date\.now\(\)\}\.\$\{ext\}`\, \{ type: mimeType \}\);\n\s*if \(file\.size > 0\) void handleFileUpload\(file\);\n\s*\};\n\n\s*recorder\.start\(\);\n\s*setRecordingVoice\(true\);\n\s*recordingTimerRef\.current = setInterval\(\(\) => \{\n\s*setRecordingSeconds\(\(prev\) => prev \+ 1\);\n\s*\}, 1000\);\n\s*\} catch \{\n\s*toast\.error\(\"Microphone access is required to record voice notes\.\"\);\n\s*\}\n\s*\};",
    """const startVoiceRecording = async () => {
    if (!isConnected || uploading || recordingVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecordingLocked(false);
      setDragOffset({ x: 0, y: 0 });
      setIsCanceling(false);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const drawVisualizer = () => {
          if (!analyserRef.current || !visualizerCanvasRef.current) return;
          const canvas = visualizerCanvasRef.current;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const width = canvas.width;
          const height = canvas.height;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, width, height);
          const barWidth = 4;
          const gap = 2;
          const bars = Math.floor(width / (barWidth + gap));
          
          for (let i = 0; i < bars; i++) {
            const val = dataArray[i * 2] || 0;
            const percent = val / 255;
            const barHeight = Math.max(4, percent * height);
            
            // It will be red if canceling, teal otherwise
            ctx.fillStyle = "#14b8a6";
            ctx.beginPath();
            ctx.roundRect(i * (barWidth + gap), height / 2 - barHeight / 2, barWidth, barHeight, 2);
            ctx.fill();
          }
          animationFrameRef.current = requestAnimationFrame(drawVisualizer);
        };
        drawVisualizer();
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) voiceChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const chunks = voiceChunksRef.current;
        voiceChunksRef.current = [];
        const mimeType = recorder.mimeType || "audio/webm";
        const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: mimeType });
        // Use a functional state check since isCanceling might be stale in closure
        setIsCanceling(currentIsCanceling => {
           if (file.size > 0 && !currentIsCanceling) void handleFileUpload(file);
           return currentIsCanceling;
        });
      };

      recorder.start();
      setRecordingVoice(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      toast.error("Microphone access is required to record voice notes.");
    }
  };

  const handleRecordPointerDown = (e: React.PointerEvent) => {
    if (uploading || !isConnected) return;
    if (recordingVoice) {
       if (isRecordingLocked) stopVoiceRecording(false);
       return;
    }
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    void startVoiceRecording();
  };

  const handleRecordPointerMove = (e: React.PointerEvent) => {
    if (!recordingVoice || isRecordingLocked || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    if (dx < -100) {
      stopVoiceRecording(true);
      toast.info("Recording cancelled");
      return;
    }
    if (dy < -80) {
      setIsRecordingLocked(true);
      setDragOffset({ x: 0, y: 0 });
      dragStartRef.current = null;
      toast.info("Recording locked");
      return;
    }
    
    setDragOffset({ x: Math.min(0, dx), y: Math.min(0, dy) });
    setIsCanceling(dx < -40);
  };

  const handleRecordPointerUp = (e: React.PointerEvent) => {
    if (!recordingVoice || isRecordingLocked) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    stopVoiceRecording(isCanceling);
  };""",
    content
)

# 5. Fix UI for the record UI banner and button
content = re.sub(
    r"\{recordingVoice && \(\n\s*<div className=\"mb-2 flex items-center justify-between gap-2 px-3 py-2 bg-coral-light rounded-xl border-\[2px\] border-coral/30\">\n\s*<p className=\"text-xs font-bold text-navy\">Recording voice note… \{Math\.floor\(recordingSeconds / 60\)\}:\{String\(recordingSeconds % 60\)\.padStart\(2, \"0\"\)\}</p>\n\s*<button\n\s*type=\"button\"\n\s*onClick=\{stopVoiceRecording\}\n\s*className=\"px-2\.5 py-1 rounded-lg bg-coral border-\[2px\] border-navy text-snow text-\[10px\] font-bold press-1 press-black\"\n\s*>\n\s*Stop & send\n\s*</button>\n\s*</div>\n\s*\)\}",
    """{recordingVoice && isRecordingLocked && (
                      <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 bg-teal-50 rounded-xl border-[2px] border-teal-200 shadow-sm animate-slide-up">
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-teal"></span>
                          </span>
                          <p className="text-xs font-bold text-navy w-10">{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</p>
                          <canvas ref={visualizerCanvasRef} width={80} height={24} className="opacity-80" />
                        </div>
                        <div className="flex items-center gap-2">
                           <button type="button" onClick={() => stopVoiceRecording(true)} className="p-1.5 rounded-lg hover:bg-coral-light text-slate hover:text-coral transition-colors" title="Cancel">
                              <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                           </button>
                           <button type="button" onClick={() => stopVoiceRecording(false)} className="px-3 py-1 rounded-lg bg-teal border-[2px] border-navy text-snow text-[10px] font-bold press-1 press-black flex items-center gap-1">
                              <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
                              Send
                           </button>
                        </div>
                      </div>
                    )}""",
    content
)

# 6. Replace the record button
content = re.sub(
    r"<button\n\s*type=\"button\"\n\s*onClick=\{\(\) => \{\n\s*if \(recordingVoice\) stopVoiceRecording\(\);\n\s*else void startVoiceRecording\(\);\n\s*\}\}\n\s*disabled=\{uploading\}\n\s*className=\{`shrink-0 w-10 h-10 rounded-xl border-\[2px\] flex items-center justify-center transition-colors disabled:opacity-50 \$\{recordingVoice \? \"bg-coral-light border-coral text-coral\" : \"bg-ghost border-cloud text-slate hover:border-navy\"}`\}\n\s*title=\{recordingVoice \? \"Stop recording\" : \"Record voice note\"\}\n\s*>\n\s*<svg aria-hidden=\"true\" className=\"w-5 h-5\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n\s*<path d=\"M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 1 0 10 0Z\" />\n\s*</svg>\n\s*</button>",
    """{recordingVoice && !isRecordingLocked && (
                             <div className="absolute left-4 right-16 bottom-2 h-10 bg-snow rounded-xl border-[2px] border-navy shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] flex items-center justify-between px-3 z-10 overflow-hidden animate-slide-up">
                                <div className="flex items-center gap-3">
                                  <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-coral"></span>
                                  </span>
                                  <p className="text-xs font-bold text-navy w-8">{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</p>
                                  <canvas ref={visualizerCanvasRef} width={60} height={24} className="opacity-80" />
                                </div>
                                <div className="flex items-center gap-1.5 text-navy text-[10px] font-bold opacity-60">
                                   {isCanceling ? (
                                      <span className="text-coral">Release to cancel</span>
                                   ) : (
                                      <>
                                         <svg aria-hidden="true" className="w-3 h-3 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 19l-7-7 7-7"/></svg>
                                         Slide to cancel
                                      </>
                                   )}
                                </div>
                             </div>
                           )}
                           <button
                              type="button"
                              onPointerDown={handleRecordPointerDown}
                              onPointerMove={handleRecordPointerMove}
                              onPointerUp={handleRecordPointerUp}
                              onPointerCancel={handleRecordPointerUp}
                              disabled={uploading}
                              className={`shrink-0 w-10 h-10 rounded-xl border-[2px] flex items-center justify-center transition-colors disabled:opacity-50 z-20 touch-none ${recordingVoice ? isCanceling ? "bg-coral text-snow border-navy scale-110 shadow-[4px_4px_0_0_#000]" : "bg-teal text-snow border-navy scale-125 shadow-[4px_4px_0_0_#000]" : "bg-ghost border-cloud text-slate hover:border-navy"}`}
                              style={{ transform: recordingVoice && !isRecordingLocked ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(${isCanceling ? 1.1 : 1.25})` : undefined }}
                              title={recordingVoice ? "Recording..." : "Hold to record"}
                            >
                              <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 1 0 10 0Z" />
                              </svg>
                              {recordingVoice && !isRecordingLocked && dragOffset.y === 0 && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-navy text-snow text-[9px] px-2 py-1 rounded-md font-bold whitespace-nowrap shadow-sm pointer-events-none opacity-80 flex flex-col items-center animate-fade-in">
                                   <svg aria-hidden="true" className="w-3 h-3 mb-0.5 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                   Lock
                                </div>
                              )}
                            </button>""",
    content
)

# 7. Add transcription to bubble UI
content = re.sub(
    r"att\.type\?\.startsWith\(\"audio/\"\)\ \?\ \(\n\s*<AudioWaveformPlayer key=\{i\} attachment=\{att\} />\n\s*\)",
    """att.type?.startsWith("audio/") ? (
                              <div key={i} className="flex flex-col gap-2">
                                <AudioWaveformPlayer attachment={att} />
                                {msg.transcription && (
                                  <div className={`p-2.5 rounded-xl border-[1px] text-[11px] leading-relaxed ${isMine ? "bg-snow/10 border-snow/20 text-snow/90" : "bg-ghost border-cloud text-navy-muted"}`}>
                                    <span className="font-bold mr-1 opacity-75">Transcript:</span>
                                    {msg.transcription}
                                  </div>
                                )}
                              </div>
                            )""",
    content
)

with open(r"c:\Users\QING\Desktop\Qing\iesa\src\app\(student)\dashboard\messages\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patch successful!")

import { useState, useRef, useCallback } from "react";

export type P2PRole = "sender" | "receiver";
export type ConnectionState =
  | "idle"
  | "generating-offer"
  | "waiting-for-answer"
  | "generating-answer"
  | "waiting-for-sender"
  | "connected"
  | "transferring"
  | "completed"
  | "error";

interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
}

const CHUNK_SIZE = 16384; // 16KB per chunk, safe for WebRTC

export function useWebRTCShare() {
  const [role, setRole] = useState<P2PRole | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [offerToken, setOfferToken] = useState<string>("");
  const [answerToken, setAnswerToken] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  // Receiver side
  const [receivedFile, setReceivedFile] = useState<{ blob: Blob; metadata: FileMetadata } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  
  const fileToTransferRef = useRef<File | Blob | null>(null);
  const fileMetadataRef = useRef<FileMetadata | null>(null);
  const receiveBufferRef = useRef<ArrayBuffer[]>([]);
  const bytesReceivedRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRole(null);
    setConnectionState("idle");
    setOfferToken("");
    setAnswerToken("");
    setProgress(0);
    setErrorMsg("");
    setReceivedFile(null);
    receiveBufferRef.current = [];
    bytesReceivedRef.current = 0;
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [], // Pure P2P, no STUN/TURN needed for local LAN
    });

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        setConnectionState("error");
        setErrorMsg("Connection lost or failed. Please ensure both devices are connected to the SAME Wi-Fi or Mobile Hotspot.");
      }
    };

    return pc;
  }, []);

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    dcRef.current = channel;
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      setConnectionState("connected");
      if (role === "sender" && fileToTransferRef.current && fileMetadataRef.current) {
        sendFile(fileToTransferRef.current, fileMetadataRef.current);
      }
    };

    channel.onclose = () => {
      if (connectionState !== "completed" && connectionState !== "error") {
        setConnectionState("idle"); // reset if unexpected
      }
    };

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        // Metadata message
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "metadata") {
            fileMetadataRef.current = msg.data;
            receiveBufferRef.current = [];
            bytesReceivedRef.current = 0;
            setConnectionState("transferring");
            setProgress(0);
          } else if (msg.type === "done") {
            // File transfer complete
            if (fileMetadataRef.current) {
              const blob = new Blob(receiveBufferRef.current, { type: fileMetadataRef.current.type });
              setReceivedFile({ blob, metadata: fileMetadataRef.current });
              setConnectionState("completed");
              setProgress(100);
            }
          }
        } catch (e) {
          console.error("Failed to parse metadata", e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Chunk message
        receiveBufferRef.current.push(event.data);
        bytesReceivedRef.current += event.data.byteLength;
        if (fileMetadataRef.current) {
          const percentage = Math.round((bytesReceivedRef.current / fileMetadataRef.current.size) * 100);
          setProgress(percentage);
        }
      }
    };
  }, [connectionState, role]);

  const sendFile = (file: File | Blob, metadata: FileMetadata) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    setConnectionState("transferring");
    
    // Send metadata
    dcRef.current.send(JSON.stringify({ type: "metadata", data: metadata }));

    const reader = new FileReader();
    let offset = 0;

    reader.onload = (e) => {
      if (!dcRef.current || dcRef.current.readyState !== "open") return;
      if (e.target?.result instanceof ArrayBuffer) {
        dcRef.current.send(e.target.result);
        offset += e.target.result.byteLength;
        setProgress(Math.round((offset / metadata.size) * 100));

        if (offset < metadata.size) {
          readNextChunk();
        } else {
          // Send done signal
          dcRef.current.send(JSON.stringify({ type: "done" }));
          setConnectionState("completed");
        }
      }
    };

    const readNextChunk = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    readNextChunk();
  };

  // --- Sender Methods ---

  const initiateShare = async (id: string, file: File | Blob, name: string) => {
    cleanup();
    setRole("sender");
    setConnectionState("generating-offer");
    fileToTransferRef.current = file;
    fileMetadataRef.current = { id, name, size: file.size, type: file.type || "application/octet-stream" };

    const pc = createPeerConnection();
    pcRef.current = pc;

    const dc = pc.createDataChannel("file-transfer");
    setupDataChannel(dc);

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        // Gathering completed, generate token
        const offer = pc.localDescription;
        if (offer) {
          // Compress the SDP by base64 encoding it to make QR smaller
          const token = btoa(JSON.stringify(offer));
          setOfferToken(token);
          setConnectionState("waiting-for-answer");
        }
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Fallback if ICE gathering takes too long, though local network ICE is fast
      setTimeout(() => {
        if (pc.iceGatheringState !== "complete" && pc.localDescription) {
           const token = btoa(JSON.stringify(pc.localDescription));
           setOfferToken(token);
           setConnectionState("waiting-for-answer");
        }
      }, 2000);
    } catch (e) {
      console.error(e);
      setConnectionState("error");
      setErrorMsg("Failed to generate offer.");
    }
  };

  const acceptAnswer = async (token: string) => {
    if (!pcRef.current) return;
    try {
      const answerStr = atob(token);
      const answer = JSON.parse(answerStr);
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error(e);
      setConnectionState("error");
      setErrorMsg("Invalid Answer QR Code.");
    }
  };

  // --- Receiver Methods ---

  const prepareToReceive = () => {
    cleanup();
    setRole("receiver");
    setConnectionState("idle");
  };

  const processOffer = async (token: string) => {
    setConnectionState("generating-answer");
    const pc = createPeerConnection();
    pcRef.current = pc;

    pc.ondatachannel = (e) => {
      setupDataChannel(e.channel);
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        const answer = pc.localDescription;
        if (answer) {
          const ansToken = btoa(JSON.stringify(answer));
          setAnswerToken(ansToken);
          setConnectionState("waiting-for-sender");
        }
      }
    };

    try {
      const offerStr = atob(token);
      const offer = JSON.parse(offerStr);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Fallback timer
      setTimeout(() => {
        if (pc.iceGatheringState !== "complete" && pc.localDescription) {
           const ansToken = btoa(JSON.stringify(pc.localDescription));
           setAnswerToken(ansToken);
           setConnectionState("waiting-for-sender");
        }
      }, 2000);
    } catch (e) {
      console.error(e);
      setConnectionState("error");
      setErrorMsg("Invalid Offer QR Code.");
    }
  };

  return {
    role,
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
    cleanup
  };
}

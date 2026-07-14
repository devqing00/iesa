const CHUNK_SIZE = 16384;
let pc = null;
let dc = null;
let role = null;
let fileToTransfer = null;
let fileMetadata = null;
let receiveBuffer = [];
let bytesReceived = 0;

function cleanup() {
  if (dc) { dc.close(); dc = null; }
  if (pc) { pc.close(); pc = null; }
  role = null;
  fileToTransfer = null;
  fileMetadata = null;
  receiveBuffer = [];
  bytesReceived = 0;
  updateP2PUI('idle');
}

function createPeerConnection() {
  const conn = new RTCPeerConnection({ iceServers: [] });
  conn.oniceconnectionstatechange = () => {
    if (conn.iceConnectionState === "failed" || conn.iceConnectionState === "disconnected") {
      showP2PError("Connection lost or failed. Ensure both devices are on the SAME Wi-Fi or Mobile Hotspot.");
    }
  };
  return conn;
}

function setupDataChannel(channel) {
  dc = channel;
  channel.binaryType = "arraybuffer";

  channel.onopen = () => {
    updateP2PUI('transferring', 0);
    if (role === "sender" && fileToTransfer && fileMetadata) {
      sendFile(fileToTransfer, fileMetadata);
    }
  };

  channel.onclose = () => {
    // handled by cleanup usually
  };

  channel.onmessage = (event) => {
    if (typeof event.data === "string") {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "metadata") {
          fileMetadata = msg.data;
          receiveBuffer = [];
          bytesReceived = 0;
          updateP2PUI('transferring', 0);
        } else if (msg.type === "done") {
          if (fileMetadata) {
            const blob = new Blob(receiveBuffer, { type: fileMetadata.type });
            saveReceivedFile(blob, fileMetadata);
            updateP2PUI('completed', 100);
          }
        }
      } catch (e) {
        console.error(e);
      }
    } else if (event.data instanceof ArrayBuffer) {
      receiveBuffer.push(event.data);
      bytesReceived += event.data.byteLength;
      if (fileMetadata) {
        const percentage = Math.round((bytesReceived / fileMetadata.size) * 100);
        updateP2PUI('transferring', percentage);
      }
    }
  };
}

function sendFile(file, metadata) {
  if (!dc || dc.readyState !== "open") return;
  dc.send(JSON.stringify({ type: "metadata", data: metadata }));
  
  const reader = new FileReader();
  let offset = 0;

  reader.onload = (e) => {
    if (!dc || dc.readyState !== "open") return;
    if (e.target.result instanceof ArrayBuffer) {
      dc.send(e.target.result);
      offset += e.target.result.byteLength;
      updateP2PUI('transferring', Math.round((offset / metadata.size) * 100));

      if (offset < metadata.size) {
        readNextChunk();
      } else {
        dc.send(JSON.stringify({ type: "done" }));
        updateP2PUI('completed', 100);
      }
    }
  };

  function readNextChunk() {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    reader.readAsArrayBuffer(slice);
  }

  readNextChunk();
}

async function initiateShare(id, file, name) {
  cleanup();
  role = "sender";
  fileToTransfer = file;
  fileMetadata = { id, name, size: file.size, type: file.type || "application/octet-stream" };
  
  pc = createPeerConnection();
  const channel = pc.createDataChannel("file-transfer");
  setupDataChannel(channel);

  pc.onicecandidate = (e) => {
    if (!e.candidate) {
      const offer = pc.localDescription;
      if (offer) {
        const token = btoa(JSON.stringify(offer));
        showP2PToken(token, "waiting-for-answer");
      }
    }
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    setTimeout(() => {
      if (pc.iceGatheringState !== "complete" && pc.localDescription) {
        const token = btoa(JSON.stringify(pc.localDescription));
        showP2PToken(token, "waiting-for-answer");
      }
    }, 2000);
  } catch (e) {
    showP2PError("Failed to generate offer.");
  }
}

async function acceptAnswer(token) {
  if (!pc) return;
  try {
    const answer = JSON.parse(atob(token));
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (e) {
    showP2PError("Invalid Answer QR Code.");
  }
}

function prepareToReceive() {
  cleanup();
  role = "receiver";
  startScanner((token) => {
    processOffer(token);
  });
}

async function processOffer(token) {
  pc = createPeerConnection();
  
  pc.ondatachannel = (e) => {
    setupDataChannel(e.channel);
  };

  pc.onicecandidate = (e) => {
    if (!e.candidate) {
      const answer = pc.localDescription;
      if (answer) {
        const ansToken = btoa(JSON.stringify(answer));
        showP2PToken(ansToken, "waiting-for-sender");
      }
    }
  };

  try {
    const offer = JSON.parse(atob(token));
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    setTimeout(() => {
      if (pc.iceGatheringState !== "complete" && pc.localDescription) {
        const ansToken = btoa(JSON.stringify(pc.localDescription));
        showP2PToken(ansToken, "waiting-for-sender");
      }
    }, 2000);
  } catch (e) {
    showP2PError("Invalid Offer QR Code.");
  }
}

function saveReceivedFile(blob, metadata) {
  const req = indexedDB.open('iesa_offline_db', 1);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('offline_resources')) {
      db.createObjectStore('offline_resources', { keyPath: 'id' });
    }
  };
  req.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction('offline_resources', 'readwrite');
    const store = tx.objectStore('offline_resources');
    store.put({
      id: metadata.id || metadata.name,
      blob: blob,
      title: metadata.name,
      fileType: metadata.type,
      timestamp: Date.now()
    });
    tx.oncomplete = () => {
      alert("Saved to Offline Downloads!");
      if(typeof loadOfflineFiles === 'function') loadOfflineFiles();
    };
  };
}

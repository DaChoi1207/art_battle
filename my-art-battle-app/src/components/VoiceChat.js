import React, { useEffect, useRef, useState } from 'react';
import socket from '../socket';
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';

// GLOBAL mute state key
const MUTE_KEY = 'voicechat_muted';

// Singleton local audio stream
async function getGlobalAudioStream(muted) {
  if (!window.__voiceStream) {
    window.__voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }
  window.__voiceStream.getAudioTracks().forEach(track => {
    track.enabled = !muted;
  });
  return window.__voiceStream;
}

export default function VoiceChat({ roomId }) {
  // Global mute state
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem(MUTE_KEY) === 'true';
  });
  const [peers, setPeers] = useState([]); // [{ id, stream }]
  const peerConnections = useRef({});
  const localStreamRef = useRef(null);

  // Sync mute state across tabs
  useEffect(() => {
    const sync = () => setMuted(localStorage.getItem(MUTE_KEY) === 'true');
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // Acquire global stream and set up mic state
  useEffect(() => {
    let mounted = true;
    getGlobalAudioStream(muted).then(stream => {
      if (!mounted) return;
      localStreamRef.current = stream;
    });
    return () => { mounted = false; };
  }, [muted]);

  // --- WebRTC mesh logic ---
  useEffect(() => {
    if (!roomId) return; // Only connect if in a room
    // Join voice room
    socket.emit('voice-join', { roomId });
    // --- Signaling handlers ---
    function handleOffer({ from, offer }) {
      createPeerConnection(from, false, offer);
    }
    function handleAnswer({ from, answer }) {
      const pc = peerConnections.current[from];
      if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
    function handleCandidate({ from, candidate }) {
      const pc = peerConnections.current[from];
      if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    function handleLeave({ from }) {
      if (peerConnections.current[from]) {
        peerConnections.current[from].close();
        delete peerConnections.current[from];
      }
      setPeers(p => p.filter(peer => peer.id !== from));
    }
    socket.on('voice-offer', handleOffer);
    socket.on('voice-answer', handleAnswer);
    socket.on('voice-candidate', handleCandidate);
    socket.on('voice-leave', handleLeave);
    socket.on('voice-peer-joined', ({ peerId }) => {
      if (peerId !== socket.id) createPeerConnection(peerId, true);
    });
    // Announce ready
    socket.emit('voice-ready', { roomId });
    // Cleanup
    return () => {
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      setPeers([]);
      socket.emit('voice-leave', { roomId });
      socket.off('voice-offer', handleOffer);
      socket.off('voice-answer', handleAnswer);
      socket.off('voice-candidate', handleCandidate);
      socket.off('voice-leave', handleLeave);
      socket.off('voice-peer-joined');
    };
  }, [roomId]);

  // --- Peer connection logic ---
  async function createPeerConnection(peerId, isInitiator, remoteOffer) {
    if (peerConnections.current[peerId]) return;
    const pc = new RTCPeerConnection({
      iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ]
    });
    peerConnections.current[peerId] = pc;
    // Attach local audio
    const stream = await getGlobalAudioStream(muted);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice-candidate', { to: peerId, candidate: event.candidate });
      }
    };
    pc.ontrack = (event) => {
      setPeers(p => {
        if (p.find(peer => peer.id === peerId)) return p;
        return [...p, { id: peerId, stream: event.streams[0] }];
      });
    };
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice-offer', { to: peerId, offer });
    } else if (remoteOffer) {
      await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice-answer', { to: peerId, answer });
    }
  }

  // --- Toggle mute globally ---
  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    localStorage.setItem(MUTE_KEY, newMuted ? 'true' : 'false');
    getGlobalAudioStream(newMuted); // immediately apply
  };

  // --- Render mic button and remote audio ---
  return (
    <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 1000 }}>
      <button
        onClick={toggleMute}
        style={{
          background: muted ? '#e63946' : '#5b5f97',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: 56,
          height: 56,
          fontSize: 28,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
      >
        {muted ? (
          <FaMicrophoneSlash size={28} />
        ) : (
          <FaMicrophone size={28} />
        )}
      </button>
      {/* Render remote audio elements */}
      {peers.map(peer => (
        <audio
          key={peer.id}
          ref={el => {
            if (el && peer.stream) {
              el.srcObject = peer.stream;
              el.play().catch(() => {});
            }
          }}
          autoPlay
        />
      ))}
    </div>
  );
}

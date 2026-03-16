// useAudioPlayer hook — decodes and plays base64 PCM audio chunks from Gemini (24kHz, mono, int16)
import { useRef, useState } from 'react';

export function useAudioPlayer() {
  const ctxRef = useRef(null);
  const queueRef = useRef([]);
  const playingRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const silenceTimerRef = useRef(null);

  function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    return ctxRef.current;
  }

  function setSpeaking(val) {
    if (val) {
      clearTimeout(silenceTimerRef.current);
      setIsSpeaking(true);
    } else {
      // debounce stop — absorbs gaps between tool processing and next audio
      silenceTimerRef.current = setTimeout(() => setIsSpeaking(false), 600);
    }
  }

  function playNext() {
    if (playingRef.current || queueRef.current.length === 0) {
      if (!playingRef.current) setSpeaking(false);
      return;
    }
    const ctx = getCtx();
    if (ctx.state === 'suspended') { ctx.resume().then(playNext); return; }

    playingRef.current = true;
    setSpeaking(true);
    const { buffer } = queueRef.current.shift();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => { playingRef.current = false; playNext(); };
    source.start();
  }

  function playChunk(base64) {
    const ctx = getCtx();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    queueRef.current.push({ buffer });
    playNext();
  }

  function clearQueue() {
    queueRef.current = [];
    playingRef.current = false;
    // don't immediately set isSpeaking false — debounce handles it
  }

  function stop() {
    clearTimeout(silenceTimerRef.current);
    queueRef.current = [];
    playingRef.current = false;
    setIsSpeaking(false);
    ctxRef.current?.close();
    ctxRef.current = null;
  }

  return { playChunk, stop, clearQueue, isSpeaking };
}

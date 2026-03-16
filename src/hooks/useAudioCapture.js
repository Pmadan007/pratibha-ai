// useAudioCapture hook — captures microphone audio and streams PCM chunks to the session
import { useState, useRef, useEffect } from 'react';

export function useAudioCapture({ onAudioChunk }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const contextRef = useRef(null);
  const workletRef = useRef(null);
  const streamRef = useRef(null);

  function cleanup() {
    workletRef.current?.disconnect();
    contextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    workletRef.current = null;
    contextRef.current = null;
    streamRef.current = null;
  }

  async function startListening() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const context = new AudioContext({ sampleRate: 16000 });
      contextRef.current = context;

      await context.audioWorklet.addModule('/pcm-processor.js');

      const source = context.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(context, 'pcm-processor');
      workletRef.current = worklet;

      worklet.port.onmessage = (e) => {
        const bytes = new Uint8Array(e.data);
        const base64 = btoa(String.fromCharCode(...bytes));
        onAudioChunk(base64);
      };

      source.connect(worklet);
      setIsListening(true);
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone permission denied.'
        : err.message;
      setError(msg);
      cleanup();
    }
  }

  function stopListening() {
    cleanup();
    setIsListening(false);
  }

  useEffect(() => cleanup, []);

  return { startListening, stopListening, isListening, error };
}

// useCamera hook — accesses device camera and captures frames with adaptive quality
import { useState, useRef, useEffect } from 'react';

const TIERS = {
  good:   { width: 1280, quality: 0.8, interval: 1000 },
  medium: { width: 640,  quality: 0.6, interval: 1500 },
  poor:   { width: 320,  quality: 0.4, interval: 2000 },
};

function getInitialTier() {
  const conn = navigator.connection;
  if (!conn) return 'good';
  const type = conn.effectiveType ?? conn.type ?? '';
  if (type === '2g' || type === 'slow-2g') return 'poor';
  if (type === '3g') return 'medium';
  return 'good';
}

export function useCamera({ onFrame }) {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [qualityTier, setQualityTier] = useState(getInitialTier);
  const streamRef = useRef(null);
  const offscreenVideoRef = useRef(null);
  const intervalRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const tierRef = useRef(qualityTier);
  const fastCountRef = useRef(0);

  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);
  useEffect(() => { tierRef.current = qualityTier; }, [qualityTier]);

  function setTier(t) { tierRef.current = t; setQualityTier(t); }

  function adjustTier(uploadMs) {
    const current = tierRef.current;
    if (uploadMs > 800) {
      fastCountRef.current = 0;
      if (current === 'good') setTier('medium');
      else if (current === 'medium') setTier('poor');
    } else {
      fastCountRef.current += 1;
      if (fastCountRef.current >= 5) {
        fastCountRef.current = 0;
        if (current === 'poor') setTier('medium');
        else if (current === 'medium') setTier('good');
      }
    }
  }

  function captureFrame() {
    const video = offscreenVideoRef.current;
    if (!video || !video.videoWidth) return null;
    const { width, quality } = TIERS[tierRef.current];
    const aspect = video.videoHeight / video.videoWidth;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round(width * aspect);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality).split(',')[1];
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      const v = document.createElement('video');
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      v.play();
      offscreenVideoRef.current = v;
      setIsActive(true);
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : err.message);
    }
  }

  function stopCamera() {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    offscreenVideoRef.current = null;
    intervalRef.current = null;
    setIsActive(false);
  }

  useEffect(() => {
    if (!isActive) return;
    const send = () => {
      const f = captureFrame();
      if (!f) return;
      const t0 = Date.now();
      onFrameRef.current(f);
      adjustTier(Date.now() - t0);
    };
    const timeout = setTimeout(() => {
      send();
      // Re-schedule with current tier interval dynamically
      const schedule = () => {
        intervalRef.current = setTimeout(() => { send(); schedule(); }, TIERS[tierRef.current].interval);
      };
      schedule();
    }, 1000);
    return () => { clearTimeout(timeout); clearTimeout(intervalRef.current); };
  }, [isActive]);

  useEffect(() => stopCamera, []);

  return { isActive, error, qualityTier, startCamera, stopCamera, captureFrame, stream: streamRef };
}

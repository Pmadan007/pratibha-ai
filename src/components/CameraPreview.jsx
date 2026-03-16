// CameraPreview component — shows device camera feed; only rendered when avatarState === SEEING
import { useRef, useEffect } from 'react';

export default function CameraPreview({ isActive, stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream?.current) {
      videoRef.current.srcObject = stream.current;
    }
  }, [isActive, stream]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      height: '40%',
      transform: isActive ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 300ms ease-in-out',
      borderRadius: '1.5rem 1.5rem 0 0',
      overflow: 'hidden',
      background: '#000',
      pointerEvents: isActive ? 'auto' : 'none',
    }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

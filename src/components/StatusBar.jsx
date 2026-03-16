// StatusBar component — displays current avatarState label to the user
import { AVATAR_STATES } from '../constants/avatarStates';

const LABELS = {
  [AVATAR_STATES.IDLE]:      'Tap mic to speak • बोलने के लिए दबाएं',
  [AVATAR_STATES.LISTENING]: 'Listening... • सुन रही हूँ...',
  [AVATAR_STATES.SPEAKING]:  'Mam is speaking... • मैम बोल रही हैं...',
  [AVATAR_STATES.SEEING]:    'Mam is looking... • मैम देख रही हैं...',
};

export default function StatusBar({ isConnected, avatarState, qualityTier }) {
  const label = isConnected ? (LABELS[avatarState] ?? LABELS[AVATAR_STATES.IDLE]) : 'Connecting... • जोड़ रहे हैं...';
  const dotColor = { good: '#48bb78', medium: '#ecc94b', poor: '#fc8181' }[qualityTier] ?? '#a0aec0';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#718096', textAlign: 'center', letterSpacing: '0.01em' }}>
        {label}
      </p>
      {qualityTier && (
        <span
          title="Network quality"
          style={{
            position: 'absolute', top: 0, right: -14,
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor, display: 'inline-block',
          }}
        />
      )}
    </div>
  );
}

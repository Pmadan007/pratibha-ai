// LanguageSelector component — shown once on first launch to pick preferred language
const LANGUAGES = [
  { code: 'hi', label: 'हिंदी', name: 'Hindi' },
  { code: 'en', label: 'English', name: 'English' },
  { code: 'ta', label: 'தமிழ்', name: 'Tamil' },
  { code: 'te', label: 'తెలుగు', name: 'Telugu' },
  { code: 'mr', label: 'मराठी', name: 'Marathi' },
  { code: 'bn', label: 'বাংলা', name: 'Bengali' },
  { code: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'gu', label: 'ગુજરાતી', name: 'Gujarati' },
];

export default function LanguageSelector({ onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: '1.5rem', gap: '1rem' }}>
      <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, textAlign: 'center' }}>🌟 Pratibha AI</p>
      <p style={{ fontSize: '1rem', fontWeight: 500, margin: 0, textAlign: 'center', color: '#555' }}>अपनी भाषा चुनें / Choose your language</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', width: '100%', maxWidth: 320 }}>
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => onSelect(l)}
            style={{ padding: '0.75rem', borderRadius: 12, border: '2px solid #3182ce', background: '#fff', fontSize: '1rem', cursor: 'pointer', fontWeight: 500 }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

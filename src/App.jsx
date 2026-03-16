// Root component — composes Avatar, controls session lifecycle
import { useEffect, useState, useRef } from 'react';
import { useGeminiSession } from './hooks/useGeminiSession';
import { useAvatarState } from './hooks/useAvatarState';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useCamera } from './hooks/useCamera';
import { AVATAR_STATES } from './constants/avatarStates';
import Avatar from './components/Avatar';
import CameraPreview from './components/CameraPreview';
import StatusBar from './components/StatusBar';
import LanguageSelector from './components/LanguageSelector';
import { loadUserProfile } from './lib/firestore';

function buildPrefix(language, profile) {
  const langNote = `The child speaks ${language.name}. Always respond in ${language.name} unless they switch languages.`;
  if (profile) {
    return `${langNote} You are talking to ${profile.name}, Class ${profile.class}. They previously struggled with: ${profile.weak_topics ?? 'nothing noted yet'}. Greet them warmly by name and start naturally.`;
  }
  return `${langNote} This is the child's first session. Greet them warmly and ask their name and class. After they answer, call save_profile silently. Never use a placeholder name.`;
}

export default function App() {
  const [language, setLanguage] = useState(null);
  const [systemPrefix, setSystemPrefix] = useState(null);
  const [greetMsg, setGreetMsg] = useState(null);
  const [logs, setLogs] = useState([]);
  const logRef = useRef([]);

  useEffect(() => {
    const orig = console.log.bind(console);
    const origErr = console.error.bind(console);
    const push = (pfx, args) => {
      const line = pfx + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      logRef.current = [line, ...logRef.current].slice(0, 20);
      setLogs([...logRef.current]);
      pfx === '[ERR] ' ? origErr(...args) : orig(...args);
    };
    console.log = (...a) => push('', a);
    console.error = (...a) => push('[ERR] ', a);
    return () => { console.log = orig; console.error = origErr; };
  }, []);


  function handleLanguageSelect(lang) {
    setLanguage(lang);
    loadUserProfile('user_1')
      .then(profile => {
        console.log('[profile]', profile ? JSON.stringify(profile) : 'null - first time');
        const langNote = `The child speaks ${lang.name}. Always respond in ${lang.name} unless they switch languages.`;
        const curriculum = profile?.class
          ? `You are teaching a Class ${profile.class} student. When answering questions, refer to NCERT Class ${profile.class} curriculum. Keep answers at Class ${profile.class} level.`
          : '';
        const context = profile
          ? `${langNote} ${curriculum} You are talking to ${profile.name}. They previously struggled with: ${profile.weak_topics ?? 'nothing noted yet'}.`
          : `${langNote} This is the child's first session. Once you learn their class, tailor your answers to that NCERT level.`;
        const greet = profile
          ? `${context} Greet ${profile.name} warmly by name and start the session. Tell them to press the mic button to speak.`
          : `${context} Greet the child warmly, ask their name and class, and tell them to press the mic button to speak.`;
        setGreetMsg(greet);
      })
      .catch(() => {
        setGreetMsg(`The child speaks ${lang.name}. This is the child's first session. Greet them warmly, ask their name and class, and tell them to press the mic button to speak.`);
      });
  }

  const { isConnected, needsCamera, turnComplete, isSpeaking, currentImage, sendExplain, sendAudio, sendImage, sendText, wsError } = useGeminiSession({ systemPrefix, language: language?.name });
  const { state, mouthOpen, startListening, startSpeaking, startSeeing, returnToIdle } = useAvatarState();
  const { startCamera, stopCamera, isActive, qualityTier, stream } = useCamera({ onFrame: sendImage });
  const { startListening: startMic, stopListening: stopMic, isListening } = useAudioCapture({ onAudioChunk: sendAudio });

  const greetedRef = useRef(false);

  useEffect(() => {
    if (isConnected && greetMsg && !greetedRef.current) {
      greetedRef.current = true;
      console.log('[greet] sending greeting');
      sendText(greetMsg);
    }
  }, [isConnected, greetMsg]);

  useEffect(() => {
    if (needsCamera) { startCamera(); startSeeing(); }
    else { stopCamera(); if (state === AVATAR_STATES.SEEING && !isSpeaking) returnToIdle(); }
  }, [needsCamera]);

  const pendingExplainRef = useRef(false);

  useEffect(() => {
    if (currentImage) { startSeeing(); pendingExplainRef.current = true; }
    else if (state === AVATAR_STATES.SEEING && !needsCamera) returnToIdle();
  }, [currentImage]);

  useEffect(() => {
    if (isSpeaking) startSpeaking();
    else if (state === AVATAR_STATES.SPEAKING) (needsCamera || currentImage) ? startSeeing() : returnToIdle();
  }, [isSpeaking]);

  useEffect(() => {
    if (pendingExplainRef.current) { pendingExplainRef.current = false; sendExplain(); return; }
    if (!needsCamera && !currentImage && !isSpeaking) returnToIdle();
  }, [turnComplete]);

  if (!language) return <LanguageSelector onSelect={handleLanguageSelect} />;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(/bg.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Avatar — fills full screen */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <Avatar state={state} mouthOpen={mouthOpen} />
      </div>

      {/* Camera — slides up from bottom over avatar */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: isActive ? 'auto' : 'none' }}>
        <CameraPreview isActive={isActive} stream={stream} />
      </div>

      {/* Generated image card — slides up above mic button */}
      <div style={{
        position: 'absolute', bottom: '8rem', left: '50%', transform: 'translateX(-50%)',
        zIndex: 3, width: '80%', maxWidth: 320,
        opacity: currentImage ? 1 : 0,
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        pointerEvents: 'none',
      }}>
        {currentImage && (
          <img
            src={`data:image/png;base64,${currentImage}`}
            alt="illustration"
            style={{
              width: '100%', borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              display: 'block',
            }}
          />
        )}
      </div>

      {/* Mic button — always on top */}
      <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
        <button
          onClick={() => isListening ? stopMic() : startMic()}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            fontSize: '2rem', border: 'none',
            background: isListening ? '#e53e3e' : isConnected ? '#3182ce' : '#a0aec0',
            color: '#fff', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          🎤
        </button>
        {!isListening && !isActive && (
          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#fff', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            Press 🎤 to speak
          </p>
        )}
      </div>

      {/* Status + errors */}
      <div style={{ position: 'absolute', top: '1rem', width: '100%', zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
        <StatusBar isConnected={isConnected} avatarState={state} qualityTier={qualityTier} />
        {wsError && <p style={{ color: '#e53e3e', fontSize: '0.7rem', margin: 0, textAlign: 'center' }}>{wsError}</p>}
      </div>

      {/* Debug log */}
      <div style={{ position: 'absolute', bottom: '7rem', width: '100%', maxHeight: '20vh', overflowY: 'auto', background: 'rgba(0,0,0,0.7)', zIndex: 4, padding: '4px 6px', fontFamily: 'monospace', fontSize: '0.55rem' }}>
        {logs.map((l, i) => <div key={i} style={{ color: l.startsWith('[ERR]') ? '#f66' : '#0f0' }}>{l}</div>)}
      </div>
    </div>
  );
}

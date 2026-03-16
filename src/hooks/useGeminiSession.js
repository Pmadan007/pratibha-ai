// useGeminiSession hook — opens and manages the Gemini Live WebSocket session
import { useState, useEffect, useRef, useCallback } from 'react';
import { createGeminiSession } from '../lib/geminiClient';
import { useAudioPlayer } from './useAudioPlayer';
import { saveUserProfile } from '../lib/firestore';
import { generateImage } from '../lib/imageGeneration';

export function useGeminiSession({ systemPrefix = '', language = null } = {}) {
  const sessionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [needsCamera, setNeedsCamera] = useState(false);
  const [wsError, setWsError] = useState('');
  const { playChunk, clearQueue, isSpeaking } = useAudioPlayer();
  const [turnComplete, setTurnComplete] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const cameraOpenedAtRef = useRef(null);
  const processingToolRef = useRef(false);
  const currentImageTopicRef = useRef(null);
  const imageExplainedRef = useRef(false);
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);

  useEffect(() => {
    let mounted = true;
    async function connect() {
      if (systemPrefix === null) return;
      try {
        const session = await createGeminiSession({
          systemPrefix,
          onMessage: (message) => {
            console.log('[msg]', JSON.stringify(message).slice(0, 120));
            const sc = message.serverContent;

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls ?? []) {
                console.log('[tool]', fc.name);
                if (fc.name === 'open_camera') {
                  cameraOpenedAtRef.current = Date.now();
                  setNeedsCamera(true);
                  sessionRef.current?.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: 'camera opened. Discard all previous visual observations. Only describe what you see in the frames arriving right now.' } }]);
                } else if (fc.name === 'close_camera') {
                  setNeedsCamera(false);
                  sessionRef.current?.sendToolResponse([{ id: fc.id, name: fc.name, response: { result: 'ok' } }]);
                } else if (fc.name === 'save_profile') {
                  const args = fc.args ?? fc.parameters ?? {};
                  const name = args.name;
                  const grade = args.grade ?? args.class;
                  console.log('[save_profile]', name, grade);
                  if (name && grade) saveUserProfile('user_1', { name, class: String(grade) })
                    .then(() => console.log('[save_profile] saved ok'))
                    .catch(e => console.error('[save_profile] error', e.message));
                  processingToolRef.current = true; clearQueue();
                  sessionRef.current?.sendToolResponse([{ id: fc.id, name: fc.name, response: { output: 'ok' } }]);
                } else if (fc.name === 'save_weak_topics') {
                  const { topics } = (fc.args ?? fc.parameters) ?? {};
                  if (topics) saveUserProfile('user_1', { weak_topics: topics });
                  processingToolRef.current = true; clearQueue();
                  sessionRef.current?.sendToolResponse([{ id: fc.id, name: fc.name, response: { output: 'ok' } }]);
                } else if (fc.name === 'show_image') {
                  const args = (fc.args ?? fc.parameters) ?? {};
                  const topic = args.topic;
                  const lang = languageRef.current;
                  const langLabel = lang === 'Hindi' ? 'Hindi labels' : lang ? `${lang} labels` : 'English labels';
                  const imagePrompt = args.prompt
                    ? `${args.prompt}, with ${langLabel}`
                    : `Simple flat illustration for Indian primary school children, ${topic}, bright colors, cartoon style, white background, educational, with ${langLabel}`;
                  if (topic) {
                    currentImageTopicRef.current = topic;
                    imageExplainedRef.current = false;
                    setCurrentImage(null);
                    generateImage(imagePrompt).then(img => {
                      if (!img) return;
                      setCurrentImage(img);
                    });
                  }
                  sessionRef.current?.sendToolResponse([{ id: fc.id, name: fc.name, response: { output: 'ok' } }]);
                  // Prompt Gemini to speak intro while image generates
                  if (topic) {
                    setTimeout(() => sessionRef.current?.sendClientContent([{
                      role: 'user',
                      parts: [{ text: `Image is being generated. While it loads, talk for about 10 seconds giving an engaging introduction about "${topic}" for the child — what it is, why it's interesting, and one fun fact.` }],
                    }]), 50);
                  }
                }
              }
              return;
            }

            if (message.toolCallCancellation) { processingToolRef.current = false; return; }
            if (!sc) return;

            const parts = sc.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data && !processingToolRef.current) playChunk(part.inlineData.data);
            }
            const text = sc.outputTranscription?.text ?? parts.map(p => p.text).filter(Boolean).join('');
            if (text) { console.log('[ai]', text); setLastResponse(text); }
            if (sc.turnComplete) { processingToolRef.current = false; setTurnComplete(t => !t); }
          },
          onClose: (e) => {
            if (mounted) { setIsConnected(false); setWsError(`WS closed ${e.code}: ${e.reason}`); }
          },
        });
        if (mounted) { sessionRef.current = session; setIsConnected(true); setWsError(''); }
      } catch (err) {
        if (mounted) setWsError(`Connect failed: ${err.message}`);
      }
    }
    connect();
    return () => { mounted = false; sessionRef.current?.close(); sessionRef.current = null; };
  }, [systemPrefix]);

  // Called from App.jsx useEffect when currentImage becomes non-null
  const sendExplain = useCallback(() => {
    const topic = currentImageTopicRef.current;
    if (!topic) return;
    console.log('[image] visible, explaining:', topic);
    sessionRef.current?.sendClientContent([{
      role: 'user',
      parts: [{ text: `The illustration of "${topic}" is now visible on screen. Now explain what the child can see in the image.` }],
    }]);
  }, []);

  const sendText = useCallback((text) => {
    sessionRef.current?.sendClientContent([{ role: 'user', parts: [{ text }] }]);
  }, []);

  const sendAudio = useCallback((base64Chunk) => {
    sessionRef.current?.sendRealtimeInput({ audio: { data: base64Chunk, mimeType: 'audio/pcm;rate=16000' } });
  }, []);

  const sendImage = useCallback((base64Image) => {
    sessionRef.current?.sendRealtimeInput({ video: { mimeType: 'image/jpeg', data: base64Image } });
  }, []);

  return { isConnected, lastResponse, currentImage, sendExplain, needsCamera, turnComplete, isSpeaking, sendAudio, sendImage, sendText, wsError };
}

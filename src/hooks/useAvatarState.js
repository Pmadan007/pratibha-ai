// useAvatarState hook — owns the IDLE→LISTENING→SPEAKING→SEEING state machine
import { useState, useEffect } from 'react';
import { AVATAR_STATES } from '../constants/avatarStates';

export function useAvatarState() {
  const [state, setState] = useState(AVATAR_STATES.IDLE);
  const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => {
    if (state !== AVATAR_STATES.SPEAKING) {
      setMouthOpen(false);
      return;
    }
    const id = setInterval(() => setMouthOpen(prev => !prev), 200);
    return () => clearInterval(id);
  }, [state]);

  return {
    state,
    mouthOpen,
    startListening: () => setState(AVATAR_STATES.LISTENING),
    startSpeaking:  () => setState(AVATAR_STATES.SPEAKING),
    startSeeing:    () => setState(AVATAR_STATES.SEEING),
    returnToIdle:   () => setState(AVATAR_STATES.IDLE),
  };
}

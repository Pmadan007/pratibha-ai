// Avatar component — renders face and animates mouth/eyes based on avatarState
import { useState, useEffect, useRef } from 'react';
import { AVATAR_STATES } from '../constants/avatarStates';

const IMGS = {
  idle:     '/avatars/avatar_idle.webp',
  slight:   '/avatars/avatar_mouth_slight.webp',
  open:     '/avatars/avatar_mouth_open.webp',
  lookDown: '/avatars/avatar_look_down.webp',
};

const TALK_CYCLE = ['idle', 'slight', 'open', 'slight'];

export default function Avatar({ state }) {
  const [allLoaded, setAllLoaded] = useState(false);
  const [activeKey, setActiveKey] = useState('idle');
  const frameRef = useRef(0);
  const loadedRef = useRef(0);

  // Preload all 4 images before showing anything
  useEffect(() => {
    loadedRef.current = 0;
    Object.values(IMGS).forEach(src => {
      const img = new Image();
      img.onload = () => {
        loadedRef.current += 1;
        if (loadedRef.current === 4) setAllLoaded(true);
      };
      img.src = src;
    });
  }, []);

  // Talking animation
  useEffect(() => {
    if (state !== AVATAR_STATES.SPEAKING) return;
    const id = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % TALK_CYCLE.length;
      setActiveKey(TALK_CYCLE[frameRef.current]);
    }, 200);
    return () => { clearInterval(id); frameRef.current = 0; };
  }, [state]);

  // Seeing / idle
  useEffect(() => {
    if (state === AVATAR_STATES.SEEING) setActiveKey('lookDown');
    else if (state !== AVATAR_STATES.SPEAKING) setActiveKey('idle');
  }, [state]);

  if (!allLoaded) return <div style={{ position: 'absolute', inset: 0 }} />;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {Object.entries(IMGS).map(([key, src]) => (
        <img
          key={key}
          src={src}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: activeKey === key ? 2 : 1,
          }}
        />
      ))}
    </div>
  );
}

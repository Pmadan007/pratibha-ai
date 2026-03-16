// firestore — reads and writes student profiles via the local proxy server (which uses service account)

const BASE = '/api/profile';

export async function loadUserProfile(userId) {
  const res = await fetch(`${BASE}?userId=${userId}`);
  return res.json();
}

export async function saveUserProfile(userId, data) {
  await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...data }),
  });
}

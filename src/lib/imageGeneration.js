export async function generateImage(prompt) {
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const { image } = await res.json();
    return image ?? null;
  } catch {
    return null;
  }
}

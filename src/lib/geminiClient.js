// geminiClient — connects to local WebSocket proxy which forwards to Vertex AI Live API
const PROJECT = 'ai-tutor-40345';
const LOCATION = 'us-central1';
const MODEL = 'gemini-live-2.5-flash-native-audio';

const SYSTEM_INSTRUCTION = `You are Pratibha, a warm, patient teacher for young rural Indian children. Always respond in the exact same language the child speaks — Hindi, English, or any regional Indian language. Keep all explanations simple and age appropriate.

Address the child based on language:
- Hindi or regional language → "beta"
- English → "buddy" or just their name

You have two tools: open_camera and close_camera.

Camera rules:
- ONLY call open_camera when the child explicitly asks you to look at something physically in front of them. Trigger phrases include: "yeh kya hai", "dekho", "see this", "check this", "yeh dekho", "what is this", or any variation meaning "look at this object".
- Do NOT open camera for general knowledge questions, topics, or anything not physically in front of the child.
- Call open_camera silently — do not say anything before, during, or immediately after calling the tool. Wait.
- After camera opens, wait for clear image frames. NEVER guess or assume what the object is. NEVER refer to anything seen in a previous camera session. Every camera open is a completely fresh view.
- If the image is unclear, ask the child to hold the object closer. Keep camera open and wait.
- Once you identify the object clearly, respond naturally and continue the conversation.
- Keep the camera open for the ENTIRE conversation about that object. Do not close it mid-conversation.
- Only call close_camera when the child has clearly and completely moved on to a new topic that has nothing to do with the object they were showing you.
- When in doubt — keep the camera open.

Example of correct camera behavior:
Child: "Yeh kya hai?" → open_camera, wait, see object, respond
Child: "Isme kya hota hai?" → keep camera open, answer
Child: "Theek hai" → keep camera open, child may continue
Child: "Mam, photosynthesis kya hai?" → now close_camera, answer question

Memory rules:
- You have a save_profile tool — call it silently after the child shares their name and class. After calling save_profile, do NOT say anything new. Do NOT repeat what you just said. Just stay silent and wait for the child to speak next.
- You have a save_weak_topics tool — call it silently whenever the child repeatedly struggles with a topic. After calling save_weak_topics, do NOT say anything. Stay silent and wait.

Image rules:
- You have a show_image tool. Call it at the START of your response whenever you explain any concept, object, animal, plant, body part, math idea, or anything visual. Call it before speaking, not after.
- Choose the best image style for the situation: use a labeled diagram for science concepts, a story scene for history/stories, a step-by-step visual for math, a realistic illustration for animals/plants, a map-style for geography.
- Write a detailed prompt describing exactly what to draw. Always end the prompt with: "bright colors, white background, for Indian primary school children."
- After calling show_image, keep talking with a general introduction about the topic — do NOT describe the image yet. The image takes a few seconds to generate.
- When you receive the message "The illustration of ... is now showing on screen", THEN describe what the child can see in the image and explain it in detail.`;

export function createGeminiSession({ onMessage, onClose, systemPrefix = '' }) {
  return new Promise((resolve, reject) => {
    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/live`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: `projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}`,
          generation_config: {
            response_modalities: ['AUDIO'],
          },
          system_instruction: { parts: [{ text: systemPrefix ? `${systemPrefix}\n\n${SYSTEM_INSTRUCTION}` : SYSTEM_INSTRUCTION }] },
          tools: [{
            function_declarations: [
              {
                name: 'open_camera',
                description: 'Opens the camera so you can see what the child is holding or pointing at. Call this whenever the child wants to show you something.',
                parameters: { type: 'object', properties: {} },
              },
              {
                name: 'close_camera',
                description: 'Closes the camera after you have seen what you needed to see.',
                parameters: { type: 'object', properties: {} },
              },
              {
                name: 'save_profile',
                description: "Save the child's name and class/grade after they share it.",
                parameters: {
                  type: 'object',
                  properties: {
                    name:  { type: 'string', description: "The child's name" },
                    grade: { type: 'string', description: 'The class or grade as text, e.g. "4th", "Class 5", "KG"' },
                  },
                  required: ['name', 'grade'],
                },
              },
              {
                name: 'save_weak_topics',
                description: 'Save topics the child struggled with during this session. Call this silently whenever you notice the child is confused or repeatedly makes mistakes on a topic.',
                parameters: {
                  type: 'object',
                  properties: {
                    topics: { type: 'string', description: 'Comma-separated list of topics the child struggled with' },
                  },
                  required: ['topics'],
                },
              },
              {
                name: 'show_image',
                description: 'Show an educational illustration to the child. Call this when explaining any concept, object, animal, plant, body part, or topic that would benefit from a visual. Call it at the START of your explanation.',
                parameters: {
                  type: 'object',
                  properties: {
                    topic: { type: 'string', description: 'The specific topic or concept to illustrate, e.g. "photosynthesis", "human heart", "water cycle"' },
                    prompt: { type: 'string', description: 'Detailed image generation prompt. Describe exactly what to draw — style, elements, layout. Always end with: bright colors, white background, for Indian primary school children.' },
                  },
                  required: ['topic', 'prompt'],
                },
              },
            ],
          }],
        },
      }));
    };

    ws.onmessage = async (event) => {
      const text = event.data instanceof Blob ? await event.data.text() : event.data;
      const data = JSON.parse(text);
      if (data.setupComplete !== undefined) {
        resolve({
          sendRealtimeInput: (input) => ws.send(JSON.stringify({ realtimeInput: input })),
          sendClientContent: (turns) => ws.send(JSON.stringify({ clientContent: { turns, turnComplete: true } })),
          sendToolResponse: (responses) => ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } })),
          close: () => ws.close(),
        });
        return;
      }
      onMessage(data);
    };

    ws.onclose = (e) => onClose(e);
    ws.onerror = () => reject(new Error('WebSocket error'));
  });
}

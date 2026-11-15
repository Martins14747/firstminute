// scripts/analyze-ui-reference.js — VLM analysis of the uploaded UI design.
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';

const IMG = '/tmp/ui_reference.png';
const PROMPT = `You are a senior UI/UX designer analyzing a mobile healthcare app UI design reference so a developer can recreate the EXACT look. Describe in exhaustive detail:

1. LAYOUT: screen composition, how screens are arranged, any phone mockup framing, spacing
2. COLOR PALETTE: name the background colors (top area, bottom area, any gradient direction and colors), accent colors, card colors, text colors. Give hex codes if you can estimate them.
3. GLASSMORPHISM: are cards translucent/blurred? describe the blur, opacity, border treatment
4. TYPOGRAPHY: font weight hierarchy, sizes (large titles, body), color of text
5. CARDS/PANELS: corner radius, shadow style (color, blur, offset), background
6. ICONS: style (line/solid/3D), color, where used
7. 3D ELEMENTS: any 3D illustrations, characters, objects — describe shapes and colors
8. BUTTONS: shape, color, text style, where placed
9. NAVIGATION: bottom bar? tabs? what icons/labels
10. MOOD: dark or light theme, medical/clinical or warm/friendly, modern
11. Any specific UI components visible (search bar, profile card, stats cards, list items)

Be extremely specific and concrete. This description will drive a CSS rewrite.`;

const zai = await ZAI.create();
const buf = fs.readFileSync(IMG);
const b64 = buf.toString('base64');

const resp = await zai.chat.completions.createVision({
  model: 'glm-4.6v',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: PROMPT },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    ],
  }],
  thinking: { type: 'disabled' },
});

const out = resp.choices?.[0]?.message?.content || '(no content)';
console.log(out);

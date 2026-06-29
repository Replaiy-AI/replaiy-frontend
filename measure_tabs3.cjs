// Per-segment widths. font 13.5 absolute. pad each side = pad*scale.
// Each segment on-screen width = text + 2*padScreen + extra breathing.
const widths = { All: 15.78, Posts: 34.06, Comments: 69.25, Reactions: 61.53 };
const scale = 0.72;
const pad = 12; // unscaled inner pad per side (keep icon-mode 16 default; choose for text)
// We define per-segment UNSCALED widths. on-screen = ow*scale. Want ow*scale ~= text + 2*pad*scale + breathing
const breathing = 10; // on-screen px total slack beyond text+pad
function owFor(text){
  const need = text + 2*pad*scale + breathing; // on-screen
  return Math.round(need/scale);
}
const segOW = {};
let trackInner = 0;
for (const [k,t] of Object.entries(widths)){
  segOW[k] = owFor(t);
  trackInner += segOW[k];
}
const gap = 8, count=4, padLeft=12;
const trackUnscaled = padLeft*2 + trackInner + gap*(count-1);
console.log('per-seg unscaled widths:', segOW);
console.log('track on-screen:', (trackUnscaled*scale).toFixed(1));
for (const [k,ow] of Object.entries(segOW)){
  console.log(`${k}: onScreen=${(ow*scale).toFixed(1)} textArea=${(ow*scale-2*pad*scale).toFixed(1)} text=${widths[k]} margin=${(ow*scale-2*pad*scale-widths[k]).toFixed(1)}`);
}

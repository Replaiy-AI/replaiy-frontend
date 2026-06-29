// font-size 13.5 is ABSOLUTE (not scaled). Solve for option on-screen width.
// textArea = optionWidth*scale - 2*pad*scale ; we want textArea >= widest + breathing.
// track = (24 + ow*4 + 24) * scale ; must fit ~308 desktop content & ~358 mobile.
const widths = { All: 15.78, Posts: 34.06, Comments: 69.25, Reactions: 61.53 };
const widest = 69.25;
// Try keeping scale around 0.72 (matches lead panel feel ~0.7) and choose pad + ow.
for (const scale of [0.72, 0.7]) {
  for (const pad of [10, 9, 8]) {
    // need ow*scale - 2*pad*scale >= widest + breathing(say 7)
    const needOptOnScreen = widest + 7 + 2*pad*scale;
    const owNeeded = needOptOnScreen / scale;
    const ow = Math.ceil(owNeeded);
    const track = (24 + ow*4 + 24) * scale;
    const textArea = ow*scale - 2*pad*scale;
    // "All" option on-screen width (over-wide check): how much empty space around All
    const allEmpty = ow*scale - widths.All;
    console.log(`scale=${scale} pad=${pad} ow=${ow} -> track=${track.toFixed(1)} optOnScreen=${(ow*scale).toFixed(1)} textArea(Comments margin)=${(textArea-widest).toFixed(1)} All-empty=${allEmpty.toFixed(1)}`);
  }
}

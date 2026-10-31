// Marble Dash v2 — 30 authored courses in 3 worlds. A course is a string of pieces, space-separated: kind[:param][/flags].
// Pieces: s straight (:dx drifts sideways) · n narrow · d railed downhill · j jump (:gap) · b boost slope · z zig (:dir) ·
//   l slider block (:speed) · w sweeper arm (:side) · p spinner (:dir) · r bridge planks · C checkpoint pad ·
//   i ice (slippery) · c conveyor (:dir pushes sideways) · k crumble tiles · x blinking tiles · q twin sliders
// Flags: g gem line centre · l / r gem line left / right · a gems in the air (jump) ·
//   G / L / R golden star centre / left edge / right edge · A golden star in the air (apex of a jump)
// Groups: (l w)*2 repeats. Every course has exactly 3 golden stars. par = seconds for the third star (set from the QA bot).
export const WORLDS = [
  { name: 'Sunny Deck', tint: '#2f80ff', bg: ['#7fd0ff', '#e6f7ff'], track: 'wood', from: 1 },
  { name: 'Candy Sky', tint: '#ff4f9a', bg: ['#ffb3d1', '#fff0d6'], track: 'candy', from: 7 },
  { name: 'Storm Peak', tint: '#7b5cff', bg: ['#6d5bd0', '#e7b6ff'], track: 'storm', from: 21 },
];
export const L = (name, note, code, par, boss) => ({ name, note, code, par, boss: !!boss });
export const LEVELS = [
  // ---- World 1: Sunny Deck (rolling, steering, jumping, then sliders and sweepers)
  L('First Roll', 'cannot lose: railed slopes, boosts, one jump, 3 golds in the path', 'd/gG b/g d/g b/g s/g j/aA s/g d/g b/g d/g s/g b/g d/g j/a s/G', 18),
  L('Wobble Walk', 'introduce narrow planks; gems pull you along the thin part', 'd/g s/g n/gG s/g n/g s/g d/g b/g n/gl s/g s/g n/g d/g n/g s/g b/g s/g n/G s/g d/g j/aA s/g', 23),
  L('Slide Show', 'introduce the slider block: the first thing that can knock you off', 's/g d/g l/gG s/g l/g s/g d/g l:1.2/g s/g b/g l/g C s/g s/g l:1.3/G d/g n/g l/g s/g b/g j/aA s/g l/g s/g', 30),
  L('Gap Year', 'jump gaps in a row: air gems reward a clean arc', 's/g j/a s/g j/a s/g b/g j:3/aA s/g d/g j/a s/g n/g j/a C s/g b/g j:3/a s/g d/g j:3/aA s/g j/a s/L', 32),
  L('Zig and Zag', 'introduce the zig: gems on the diagonals, golden on the far side', 's/g z:1/g z:-1/g s/g d/g z:-1/gR z:1/g s/g b/g z:1/g z:-1/g n/g s/g z:-1/g z:1/g C d/g z:1/R z:-1/g s/g b/g n/g z:1/g z:-1/g j/aA s/g z:-1/g s/g', 36),
  L('Sweep Stakes', 'introduce the sweeper arm: wait or slip past, gems along the safe side', 's/g w/g s/g d/g w:-1/gL s/g w:1/g s/g b/g w/g s/g n/g w:-1/g d/g w/g s/g w:1/g s/g C w/g w:-1/g s/g b/g n/g w/g s/g j/aA s/g w:-1/g s/R s/g', 38),
  L('Plank Party', 'introduce the bridge: one narrow plank run, golden at the end of the second', 's/g r/g s/g d/g r/gL s/g n/g r:1/g s/g b/g r/g s/g C d/g r/g n/g r:1/g s/g j/aA s/g r/g s/g b/g r:1/R s/g r/g s/g', 38),
  L('Cheap Thrills', 'breather: boosts and gems everywhere, almost impossible to fail', 'd/g b/g d/gL b/g j/a b/g d/g s/g b/g j:3/a d/g b/g C d/g b/gl j/a b/g d/g b/R d/g s/g b/g j:3/aA s/g', 30),
  L('Combo Meal', 'twist: slider into sweeper into jump with checkpoints', 's/g l/g w/g C j/a s/g l:1.3/gL w:-1/g d/g n/g l/g j/a s/g w/g l:1.2/g s/g C b/g w:-1/g l/g n/g j:3/aA s/g l/g w/g d/g l:1.4/g w:-1/g s/g C j/a l/g n/g w/g s/g b/g s/g w/g l/R s/g', 46),
  L('Deck Master', 'BOSS: every deck piece in one long run, goldens on the risky lines', 's/g n/gL l/g w/g s/g C j/a s/g r/g l:1.4/g d/g w:-1/g n/g s/g C j:3/aA z:1/g z:-1/g w/g l/g s/g b/g w:-1/g w/g n/g C r/g s/g l:1.3/g j/a s/g d/g n/gR l/g w:-1/g s/g C b/g j:3/a r/g w/g l/g n/g s/g z:1/g z:-1/g b/g s/g', 62, true),
  // ---- World 2: Candy Sky (spinners, ice, conveyors)
  L('Candy Cane Lane', 'breather opener: wide candy deck, the spinner introduced alone', 's/g s/g p/gR s/g d/g s/g p:-1/g s/g b/g j/aA s/g d/g p/g s/g b/g p:-1/g s/g n/g j/a s/g d/g p/g s/g s/L b/g s/g', 38),
  L('Spin Cycle', 'practise the spinner: time the gap between arms, gems through the middle', 's/g p/g s/g p:-1/gR s/g d/g p/g s/g p:1/g C n/g p/g s/g j/a p:-1/g s/g l/g p/g s/g b/g p/g p:-1/g s/g d/g n/gL p/g s/g C j:3/aA s/g p:1/g s/g p/g s/g', 46),
  L('Slip Slide', 'introduce ice: steering is loose, gems on a gentle line', 's/g i/gL s/g i/g d/g i/g s/g j/aA i/g s/g b/g i/g s/g i/g d/g i/g s/g n/g i/g s/R b/g i/g s/g j/a s/g i/g s/g', 40),
  L('Frosting', 'ice with a narrow lane: ease off and drift', 's/g i/g n/gL i/g s/g d/g i:n/g s/g j/a i/g s/g i:n/g s/g C b/g i/g n/g i:n/R s/g d/g i/g j:3/aA i/g s/g i:n/g s/g n/g i/g s/g b/g s/g', 44),
  L('Belt Up', 'introduce the conveyor: the belt pushes you sideways, read it', 's/g c:1/g s/g c:-1/gR s/g d/g c:1/g s/g c:-1/g b/g s/g c:1/g j/aA s/g c:-1/g c:1/g s/g n/g c:-1/g s/g d/g c:1/g s/g C c:-1/g s/g c:1/g j/a s/g b/g c:-1/L s/g', 44),
  L('Cross Current', 'conveyors beside edges: goldens hug the drop', 's/g c:1/g n/gR s/g c:-1/g n/gL d/g c:1/g w/g s/g C c:-1/g p/g s/g j/a c:1/g s/g c:-1/g w:-1/g s/g C c:1/g n/g c:-1/g p:-1/g s/g b/g j/aA s/g c:1/g s/g c:-1/g s/g', 52),
  L('Sugar Rush', 'breather: boosts and slow spinners, big air', 'd/g b/g p/gR d/g b/g j:3/a b/g s/g d/g p:-1/g b/g j:3/aA b/g d/g b/g p/g b/g j:3/a d/g b/g s/g d/g b/g s/L', 34),
  L('Ice Spinner', 'twist: spinner on ice, push through the loose steering', 's/g i/g p/gR s/g i/g p:-1/g d/g C i/g p/g s/g n/g i/g j/a i/g p:1/g s/g i/g w/g s/g C b/g i:n/g p/g s/g i/g n/gL j:3/aA i/g p:-1/g s/g b/g s/g', 54),
  L('Belt and Blades', 'twist: the conveyor feeds you into the sweeper', 's/g c:1/g w/gL s/g c:-1/g w:-1/g d/g c:1/g w/g C s/g c:-1/g w:-1/g p/g s/g j/a s/g c:1/g w/g p:-1/g s/g C c:-1/g l/g c:1/g w:-1/g s/g j:3/aA s/g c:-1/g p/g s/g c:1/g s/R', 56),
  L('Candy Crush', 'BOSS: ice, belts, spinners and sweepers in one run', 's/g i/g p/gL c:1/g w/g C d/g i/g p:-1/g c:-1/g j/a s/g i:n/g n/g c:1/g p/g C w:-1/g i/g c:-1/g p:1/g d/g b/g j:3/aA i/g s/g n/g c:1/g w/g s/g C i/g p/g c:-1/g l/g w:-1/g i:n/g s/g b/g j/a c:1/g p:-1/g n/g i/g s/g C c:-1/g p/g w/g i/g n/gR s/g b/g s/g', 74, true),
  // ---- World 3: Storm Peak (crumbling and blinking floors, twin doors)
  L('Thin Ice Tiles', 'breather opener: crumble tiles introduced alone, keep rolling', 's/g k/gR s/g k/g s/g d/g k/g s/g b/g j/aA s/g k/g s/g n/g k/g s/g d/g k/g s/g b/g k/g j/a s/g k/g s/L s/g', 40),
  L('Do Not Stop', 'practise crumble: tiles drop where you stood, long runs', 's/g k/g k/gR s/g d/g k/g s/g n/g k/g C s/g k/g j/aA k/g s/g l/g k/g s/g b/g k/g k/g s/g C w/g k/g s/g n/g k/g j:3/a s/g k/g s/L s/g', 48),
  L('Now You See It', 'introduce blinking tiles: wait for the light, go on the beat', 's/g x/gG s/g x/g d/g x/g s/g b/g x/g s/g j/aA x/g s/g n/g x/g s/g C d/g x/g x/g s/g b/g x/g j/a s/g x/g s/g x/G s/g', 48),
  L('Blink Twice', 'blinking bridges: tiles plus narrow planks', 's/g x/g r/gG s/g x/g r/g C d/g x/g n/g j/aA x/g r/g s/g x/g w/g s/g C b/g x/g r:1/g n/g x/g s/g j:3/a x/g r/g s/g x/G b/g s/g', 52),
  L('Twin Peaks', 'introduce twin doors: they close like a gate, find the open beat', 's/g q/gR s/g q/g d/g q/g s/g C q/g n/g q/g j/aA s/g q/g s/g b/g q/g s/g w/g q/g C d/g q/g q/g s/g j/a q/g s/g n/g q/L s/g b/g s/g', 50),
  L('Wind Tunnel', 'twist: twin doors on conveyors', 's/g c:1/g q/gR s/g c:-1/g q/g C d/g c:1/g q/g s/g w/g c:-1/g q/g j/aA c:1/g s/g q/g C s/g c:-1/g p/g q/g c:1/g s/g n/g c:-1/g q/g j/a s/g c:1/g q/g b/g s/g q/L s/g', 58),
  L('Zip Line', 'breather: huge boosts, blinking tiles only on a safe line', 'd/g b/g x/gR b/g d/g b/g j:3/aA b/g x/g d/g b/g j:3/a b/g d/g b/g x/g b/g d/g j:3/a b/g d/g b/g x/L b/g s/g', 36),
  L('Crumble Zig', 'twist: crumble + zig + ice, never stand still', 's/g z:1/g k/gR z:-1/g k/g i/g C z:-1/g k/g z:1/g i/g n/g k/gL j/aA z:1/g k/g z:-1/g s/g C b/g k/g x/g z:1/g k/g i/g z:-1/g n/g k/g j:3/a z:1/g x/g s/g k/g b/g s/g', 62),
  L('Storm Gate', 'all W3 pieces, twin doors then blinking then crumble', 's/g q/gL x/g k/g C d/g q/g r/g x/g s/g c:1/g q/g k/g C p/g x/g j/aA k/g q/g n/g x/gR s/g b/g s/g C w/g q/g k/g i/g x/g c:-1/g q/g j:3/a s/g k/g x/g q/g s/g b/g s/g', 68),
  L('Peak Master', 'BOSS FINALE: everything, four checkpoints, goldens on the knife edges', 's/g q/gR k/g x/g w/g C d/g i/g p/g c:1/g q/g r/g C j:3/aA k/g x/g n/g c:-1/g w:-1/g p/g C x/g k/g i/g q/g j/a b/g r/g x/g n/g q/g k/g s/g C p/g c:1/g w/g x/g q/g k/g n/gR i/g b/g j:3/a s/g C d/g q/g x/g k/g c:-1/g p:-1/g w/g r/g n/g x/g s/g b/g s/g', 88, true),
];
export const SKINS = [
  { n: 'Beach Ball', c: ['#ff4f6d', '#ffffff', '#2f80ff', '#ffffff', '#ffd21f', '#ffffff', '#22c55e', '#ffffff'], t: 'stripe' },
  { n: 'Cherry', c: ['#e11d48', '#fb7185'], t: 'stripe' },
  { n: 'Minty', c: ['#34d399', '#d1fae5', '#10b981', '#ecfdf5'], t: 'stripe' },
  { n: 'Sunset', c: ['#fb923c', '#fde047', '#f472b6', '#c084fc'], t: 'stripe' },
  { n: 'Chequers', c: ['#111827', '#f9fafb'], t: 'check' },
  { n: 'Polka', c: ['#fde68a', '#ef4444'], t: 'dots' },
  { n: 'Blueberry', c: ['#3b82f6', '#1e3a8a'], t: 'dots' },
  { n: 'Bubblegum', c: ['#f9a8d4', '#fbcfe8', '#ec4899'], t: 'dots' },
  { n: 'Tiger', c: ['#fb923c', '#111827'], t: 'stripe' },
  { n: 'Galaxy', c: ['#1e1b4b', '#6d28d9', '#a78bfa', '#f0abfc'], t: 'stars' },
  { n: 'Glacier', c: ['#bae6fd', '#e0f2fe', '#7dd3fc', '#ffffff'], t: 'check' },
  { n: 'Gold Rush', c: ['#facc15', '#fef08a', '#eab308'], t: 'gold' },
];
// piece lengths, widths per kind (shared by the game and the QA solver)
export function parse(code) {
  const out = [];
  const grp = (s) => {   // expand (a b)*n
    let m; while ((m = /\(([^()]*)\)\*(\d+)/.exec(s))) s = s.replace(m[0], Array(+m[2]).fill(m[1]).join(' '));
    return s;
  };
  for (const tok of grp(code).trim().split(/\s+/)) {
    const [head, flags = ''] = tok.split('/'), [k, p] = head.split(':');
    out.push({ k, p: p === undefined ? null : (isNaN(+p) ? p : +p), f: flags });
  }
  return out;
}

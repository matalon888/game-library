// levels.js — 30 authored Snip Snack levels in 3 worlds. Each is a hand-placed setup (candy, pins, hazards, bubble, cushion) with
// the author's own solution (cuts: [step at 120/s, string]); resolve.js simulates it to find where Pip sleeps and where the stars
// float. Every level is re-solved by qa/check.mjs (the cuts win; wrong orders do not). 'why' is the purpose line.
// Mechanics in order: strings+stars (1-4) · bubble (5-6, 9) · speed (8) · puff cushion (11-12) · spikes (13-14) · sliding pins (21-).
export const WORLDS = [
  { name: 'Pantry Shelf', line: 'strings, stars and bubbles', from: 1, to: 10 },
  { name: 'Toy Box', line: 'puffs and spikes', from: 11, to: 20 },
  { name: 'The Attic', line: 'sliding pins', from: 21, to: 30 },
];
export const LEVELS = [
  {n:1, w:1, name:"First Snip", why:"one string, one snip, cannot fail: the candy swings, you cut, Pip eats", candy:[0,3], pins:[[2.6,5.2]], mr:2.4, cuts:[[210,0]]},
  {n:2, w:1, name:"Swing Time", why:"introduce timing: wait for the swing, stars sit on the arc", candy:[-1.8,2.6], pins:[[1.8,6.4]], mr:1.8, cuts:[[250,0]]},
  {n:3, w:1, name:"Two Strings", why:"introduce two ropes: either order feeds Pip, the second snip decides where it lands", candy:[0,3], pins:[[-2.2,5.5],[2.4,5.7]], mr:1.5, cuts:[[125,0],[155,1]]},
  {n:4, w:1, name:"Right Order", why:"order matters: cut the wrong string first and the candy swings away", candy:[0,3], pins:[[-3.4,4.6],[2.4,6.8]], mr:1.3, cuts:[[35,0],[85,1]]},
  {n:5, w:1, name:"Bubble Float", why:"introduce the bubble: it lifts the candy, tap it to pop and drop", candy:[0,4], pins:[[2.5,6.5]], bubble:[22,55], mr:1.7, cuts:[[255,0]]},
  {n:6, w:1, name:"Bubble Pair", why:"practise the bubble with two strings: cut, ride up, pop where it drops into Pip", candy:[0,3.5], pins:[[-2.4,6],[2.4,5.2]], bubble:[28,50], mr:1.3, cuts:[[90,0],[120,1]]},
  {n:7, w:1, name:"Triple Hang", why:"three strings: the first two are free, the last one aims the drop", candy:[0,2.6], pins:[[-3.4,5],[3.4,5.6],[0,7.2]], mr:1.15, cuts:[[50,0],[75,1],[100,2]]},
  {n:8, w:1, name:"Quick Hands", why:"speed: two strings a heartbeat apart, one swipe or two fast taps", candy:[0,3.2], pins:[[-2,6],[2.2,6.4]], cuts:[[80,0],[94,1]]},
  {n:9, w:1, name:"Bubble Triple", why:"twist: three strings and a bubble, order decides the landing", candy:[0,3], pins:[[-3.5,5.5],[3.5,5],[0.5,7.2]], bubble:[18,45], cuts:[[50,2],[75,0],[100,1]]},
  {n:10, w:1, hard:1, name:"Jam Jar", why:"HARD: three strings and a bubble, one order reaches Pip and the window is short", candy:[0,2], pins:[[-3.8,4.6],[3.8,5],[-1.2,7]], bubble:[15,40], cuts:[[55,0],[75,1],[95,2]]},
  {n:11, w:2, name:"First Puff", why:"introduce the air cushion: tap it to blow the candy sideways into Pip", candy:[0,3.5], pins:[[2.4,6]], cush:[0,28], mr:1.6, cuts:[[320,0]]},
  {n:12, w:2, name:"Puff and Snip", why:"practise: two strings, then a puff to steer the fall", candy:[0,3.5], pins:[[-3,5.5],[3,6]], cush:[0.5,24], mr:1.3, cuts:[[115,0],[170,1]]},
  {n:13, w:2, name:"Spike Strip", why:"introduce spikes: the wrong string sends the candy onto them", candy:[0,3], pins:[[-3.4,4.8],[2.4,6.8]], decoy:1, mr:1.2, cuts:[[35,0],[85,1]]},
  {n:14, w:2, name:"Spike Alley", why:"practise: spikes in the swing zone, wait for the gap", candy:[0,3], pins:[[-2.2,5.6],[2.4,5.6]], spikes:[[-3.6,0.6],[3.6,0.6]], decoy:1, mr:1.2, cuts:[[30,0],[60,1]]},
  {n:15, w:2, name:"Bubble Puff", why:"twist: ride the bubble up, pop it, then puff the fall home", candy:[0,4], pins:[[-2.5,6.6]], bubble:[25,50], cush:[0,30], cuts:[[205,0]]},
  {n:16, w:2, name:"Puff Gauntlet", why:"two strings, one puff and spikes where the wrong order lands", candy:[0,3.2], pins:[[-3.2,5],[3.2,6.2]], cush:[0,22], decoy:1, mr:1.1, cuts:[[115,0],[160,1]]},
  {n:17, w:2, name:"Easy Breezy", why:"breather: one string, one soft bubble, three stars in a row", candy:[-2,5], pins:[[2,7]], bubble:[10,60], mr:1.5, cuts:[[240,0]]},
  {n:18, w:2, name:"Spike Triple", why:"three strings with spike traps under the wrong orders", candy:[0,2.8], pins:[[-3.4,5],[3.4,5.4],[0,7.2]], decoy:1, cuts:[[40,0],[65,1],[90,2]]},
  {n:19, w:2, name:"Pop and Puff", why:"bubble, puff and spikes together: the full toy box", candy:[0,3.4], pins:[[-3,5.8],[3,5.2]], bubble:[20,45], cush:[0.3,22], decoy:1, mr:1.1, cuts:[[75,0],[125,1]]},
  {n:20, w:2, hard:1, name:"Toy Chest Boss", why:"HARD: three strings, bubble, puff and spikes, tight timing", candy:[0,2.4], pins:[[-3.6,4.6],[3.6,5.2],[0,7.2]], bubble:[16,40], cush:[0,20], decoy:1, cuts:[[50,0],[70,1],[90,2]]},
  {n:21, w:3, name:"Slider", why:"introduce the sliding pin: the swing changes with it, cut when it lines up", candy:[0,3], pins:[[0,6.4,[2.2,0,360,0]]], mr:1.7, cuts:[[40,0]]},
  {n:22, w:3, name:"Slide and Stand", why:"practise: one sliding pin, one fixed, cut the slider at the right moment", candy:[0,3], pins:[[-1,6.4,[2,0,330,0.25]],[3.4,5.4]], mr:1.35, cuts:[[290,1],[340,0]]},
  {n:23, w:3, name:"Slide Spikes", why:"twist: spikes under the slider, the order and timing both matter", candy:[0,3], pins:[[0,6.6,[1.6,0,340,0.1]],[-3,4.8]], decoy:1, mr:1.2, cuts:[[295,0],[345,1]]},
  {n:24, w:3, name:"Two Sliders", why:"two pins moving against each other: wait for them to cross", candy:[0,3], pins:[[-1.2,6.2,[2,0,300,0]],[1.2,6.6,[2,0,300,0.5]]], cuts:[[45,0],[90,1]]},
  {n:25, w:3, name:"Floating Slider", why:"a sliding pin and a bubble: the float hides where the drop will land", candy:[0,3.6], pins:[[0,6.6,[2.2,0,360,0.3]]], bubble:[20,50], mr:1.3, cuts:[[35,0]]},
  {n:26, w:3, name:"Lazy Swing", why:"breather: a slow slider, a wide window, a big satisfying drop", candy:[-1,4.4], pins:[[1,7,[1.6,0,480,0]]], mr:1.5, cuts:[[315,0]]},
  {n:27, w:3, name:"Slide and Puff", why:"a slider, a cushion: steer the drop twice", candy:[0,3.2], pins:[[0,6.4,[2.2,0,340,0.15]]], cush:[0.4,26], cuts:[[35,0]]},
  {n:28, w:3, name:"Three Sliders", why:"three moving strings with spike traps for the wrong order", candy:[0,2.8], pins:[[-2.4,6,[1.6,0,320,0]],[2.4,6.4,[1.6,0,320,0.5]],[0,7.4]], decoy:1, cuts:[[185,0],[210,1],[235,2]]},
  {n:29, w:3, name:"Attic Mix", why:"slider, bubble, puff and spikes: everything you have learned", candy:[0,3.2], pins:[[-1,6.4,[2,0,330,0.2]],[3.4,5.2]], bubble:[18,45], cush:[0.3,22], decoy:1, mr:1.1, cuts:[[80,0],[125,1]]},
  {n:30, w:3, hard:1, name:"Attic Boss", why:"HARD: sliders, bubble, puff and spikes, tight windows: the last room", candy:[0,2.4], pins:[[-2.2,6.2,[1.8,0,320,0]],[2.2,6.6,[1.8,0,320,0.5]],[0,7.4]], bubble:[16,40], cush:[0,20], decoy:1, cuts:[[245,0],[265,1],[285,2]]},
];

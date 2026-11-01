# Bellhop Boss — design (studio lane 21)

deep v2: shipped 2026-11-01 (Verdict TEST)

## What it is
An original 3D idle hotel tycoon. Drag / tap to walk the bellhop: check guests in at the desk, clean the rooms they leave,
scoop the cash pile, stand on dashed pads to pour cash into new rooms, a receptionist, a housekeeper, faster shoes.
Clear a hotel = every pad bought. Three bad reviews (guests who walk out) lose it.

## The numbers (diag_events type 'game', 2026-10-22..29, 49 visits, 48 players)
- Median time per visit 29 s; 27 of 49 closed the tab; 22 left by "next".
- 31 runs still playing when they left, 11 ended "lost" (three walkouts). Levels reached: almost all at 1-3.
- 0 back another day (10 distinct days of data, no returners).
- v1 level N is the same hotel with rooms = N+1 and bigger prices: no new idea after the 3rd level, no stars, nothing saved but a number.

## The five layers today (0-3)
| Layer | Score | Why |
|---|---|---|
| Core verb | 2 | walking to be at the right spot is simple but has routing skill (desk vs cash vs dirty room) |
| Core loop | 1 | same loop in every hotel; only prices grow; losing is just "be at the desk" |
| Level design | 0 | rooms = level + 1, same guests, same pads |
| Meta | 0 | level number only |
| Feel | 2 | bills fly, ring fills, confetti on pad; no streak, no tips, no escalation |

## Verb and skill ceiling
Walk. The skill is PRIORITY: what to do next with limited hands. Serve the desk, clean, repair, fetch a tray, grab cash,
spend it on the pad that pays back the most, in an order that keeps patience bars from running out. Stars measure it:
no walkouts and a par time.

## Round loop (v2)
Goal by picture: the progress bar of pads bought (n/m) and the next pad lit. Pressure: guest patience, coaches that drop a
crowd, rooms that break. A decision every 2-4 s (desk, room, tray, cash, which pad). Win = ★ clear, ★★ no walkouts,
★★★ no walkouts and under par. Near-miss lose line: "1 pad from done" / "2 walkouts, one more".

## Mechanic plan (in order)
World 1 · Seaside Inns (1-10)
1. Check in + cash + room pad (L1, cannot lose)
2. Cleaning + housekeeper (L2)
3. Walkouts become real (L3) + faster shoes
4. Rushers ⚡ pay double if checked in fast (L4)
5. Room service 🍽️: kitchen pad, tray at the kitchen, carry to a room that asks (L6)
6. Tour coach 🚌: a crowd at once (L8); cook staff pad (L9)
World 2 · Mountain Lodges (11-20)
7. Suites + VIPs 👑 (only arrive when a suite is free; 4x pay) (L11)
8. Repairs 🔧 after checkout (L15)
9. Bigger coaches, VIP coaches (L14, 17, 19)
World 3 · Grand City (21-30)
10. Critics 🧐: pay 3x, a walkout costs 2 bad reviews (L21)
11. Critic coaches, towers of 9-10 rooms (L24, 28, 29)
Hard: 9, 19, 29 (red HARD badge). Breathers: 10, 20, 30 (big tips).
After 30: bonus hotels, same rules, a bit busier.

## Meta
- Hotel map: 3 worlds × 10, stars per hotel, next pulsing, replay any for more stars.
- Stars → chests: every 7 stars a chest with a random uniform (jacket + hat colours, 12 to collect); stars bar always in sight.
- Service streak: consecutive happy guests raise the tip (x2..x5), shown loud.

## Feel list
Streak pops + rising pitch, rusher lightning when served fast, tip coins fly, room pop + camera punch on new room, hit-stop
on coach arrival banner, 🍽️ tray carried above the head, star reveal on the win card one by one, chest bar fills.

## Changes
v1 kept as v1.js; game.js switches (READY false until v2 passes the fun gate); deep.js + levels.js.

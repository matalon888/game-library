/* The Black Meridian: local, planar spacecraft trials; metres and seconds. */
(function (root) {
    'use strict';
    const PI = Math.PI;
    const berth = (x, y, a = 0, extra = {}) => ({ x, y, a, l: 48, w: 28, speed: .24, angle: 8, ...extra });
    const rock = (id, x, y, radius, extra = {}) => ({ id, x, y, radius, ...extra });
    const courier = { name: 'CS KESTRELLET', vessel: 'space', length: 22, beam: 11, mass: 1, draft: 0 };
    const tug = { ...courier, name: 'UT LANTERNMOTH', length: 20, beam: 12, mass: 1 };
    const warship = { ...courier, name: 'RS RESOLVANT', length: 38, beam: 15, mass: 1.8 };
    const levels = [
        {
            id: 'vacuum', name: 'Nothing to Push Against', kind: 'Burn · coast · counterburn',
            world: [900, 560], start: [120, 370, 0], berth: berth(760, 180),
            brief: 'Welcome to the Black Meridian. Meridian Station is above your departure line. Combine a forward burn with lateral jets, let two outbound rocks pass, then remove both components of your velocity. There is no water, no drag and no automatic stabilization.',
            tip: 'Use the thrust telegraph for fore/aft thrust, rotation buttons to turn, and lateral jets to translate sideways. Counterfire to stop spinning. Cut thrust stops the engine, not your velocity.',
            pace: [145, 210, 300], space: {
                mission: 'arrival', fuel: 90, acceleration: .36,
                asteroids: [
                    rock('outbound-01', 390, 130, 30, { motion: { vx: .65, vy: 1.1 } }),
                    rock('outbound-02', 600, 410, 38, { motion: { vx: .9, vy: -.65 } })
                ]
            }
        },
        {
            id: 'wandering-stone', name: 'A Stone with a Schedule', kind: 'Moving asteroid landing',
            world: [960, 560], start: [125, 210, 0], berth: berth(745, 205),
            brief: 'Land at the survey cradle on asteroid Hildara. The rock drifts slowly north and south. Match the moving cradle’s velocity, not merely its position, and hold with thrust cut.',
            tip: 'The dashed landing box rides with Hildara. REL speed measures motion against the cradle. Granite is still solid; land beside it, not through it.',
            pace: [130, 195, 280], space: {
                mission: 'landing', fuel: 100, acceleration: .34,
                asteroids: [rock('hilda', 745, 300, 65, { label:'HILDARA', motion: { ay: 38, period: 240 } }), rock('shard', 460, 375, 48)],
                landing: { asteroid: 'hilda', offset: [0, -95] }
            }
        },
        {
            id: 'last-fill', name: 'The Last Fill Before Dark', kind: 'Rendezvous · refuel · intercept',
            world: [5200, 650], start: [110, 330, 0], berth: berth(780, 330, 0, { motion: { vx: 4.2 } }),
            brief: 'Your tank contains only 4 m/s of impulse. Faraday Port is already receding at 4.2 m/s: you cannot catch it on that reserve. Rendezvous with the slower tanker, hold for refuelling, then intercept the port.',
            tip: 'The amber tanker moves at 1.1 m/s. Match its velocity with less than 0.24 m/s relative drift. Refuelling takes six uninterrupted seconds with every jet cut. You keep moving together.',
            pace: [285, 400, 570], space: {
                mission: 'refuel', fuel: 4, capacity: 85, acceleration: .34,
                depot: berth(320, 330, 0, { motion: { vx: 1.1 }, label: 'LAST FILL', hold: 6 })
            }
        },
        {
            id: 'family-reunion', name: 'Some Assembly Required', kind: 'Two tenders · one mothership',
            world: [1000, 650], start: [120, 225, 0], berth: berth(850, 320, 0, { l: 118, w: 106 }),
            brief: 'Dock Kestrellet on the upper cradle of the mothership, then fly Wrenlet into the lower cradle. Control transfers automatically after each capture. Finally bring the assembled, heavier Waywarden to the spaceport.',
            tip: 'The active cradle is amber. Match its arrow and cut every jet for the two-second capture. Docked tenders become part of Waywarden’s mass and collision envelope.',
            pace: [265, 380, 550], space: {
                mission: 'assembly', fuel: 200, acceleration: .36,
                mother: { x: 460, y: 320, a: 0, length: 72, beam: 28, mass: 2.7, name: 'MS WAYWARDEN' },
                second: { x: 120, y: 415, a: 0, name: 'CS WRENLET' }
            }
        },
        {
            id: 'newtons-broadside', name: 'Newton’s Broadside', kind: 'Steady · fire · recover',
            world: [1000, 650], start: [150, 450, 0], spec: warship, berth: berth(150, 450, 0, { l: 64, w: 32 }),
            brief: 'Move Resolvant into the marked firing box. Rotate toward the practice target, stop drifting and spinning, and hold the firing solution for three seconds. The cannon fires automatically. Recover from recoil and return home.',
            tip: 'Follow the lead diamond. All jets must be cut to charge the cannon. A miss can be corrected and retried; a hit unlocks the home capture cradle. Recoil changes velocity, not just the screen.',
            pace: [230, 350, 500], space: {
                mission: 'gunnery', fuel: 240, acceleration: .5,
                firing: berth(555, 440, -PI / 2, { l: 78, w: 70 }),
                target: { x: 555, y: 130, a: 0, length: 44, beam: 21, radius: 14, name: 'PRACTICE HULK' }
            }
        },
        {
            id: 'moving-argument', name: 'A Moving Argument', kind: 'Lead the target',
            world: [1050, 680], start: [140, 470, 0], spec: warship, berth: berth(140, 470, 0, { l: 64, w: 32 }),
            brief: 'The target this time is an enemy corvette moving across your field of fire. Reach the firing box, hold a steady lead solution, and let the cannon speak. Then recover and bring Resolvant home.',
            tip: 'Aim at the hollow lead diamond, not the hull. The intercept marker includes projectile travel time. The three-second lock resets when the aim or attitude drifts out of tolerance.',
            pace: [240, 370, 520], space: {
                mission: 'gunnery', fuel: 260, acceleration: .5,
                firing: berth(580, 455, -PI / 2, { l: 90, w: 80 }),
                target: { x: 580, y: 130, a: 0, length: 42, beam: 18, radius: 12, name: 'HOSTILE CORVETTE', motion: { ax: 70, period: 260 } }
            }
        },
        {
            id: 'equal-and-opposite', name: 'Equal and Opposite', kind: 'Attractor / repulsor rescue',
            world: [1100, 640], start: [190, 355, 0], spec: tug, berth: berth(920, 220),
            brief: 'The survey launch has lost propulsion. Use Lock beam, then hold Attract or Repel. Both vessels feel equal and opposite forces. Settle the launch in the green rescue cradle, release the beam, and dock Moth.',
            tip: 'Beam range is 170 m; rock blocks the line of sight. Attraction is not a brake on the pair’s centre of mass. Reverse the beam or reposition to remove the launch’s velocity before capture.',
            pace: [280, 440, 650], space: {
                mission: 'rescue', fuel: 220, acceleration: .65,
                friendly: { x: 330, y: 355, a: 0, length: 32, beam: 15, mass: 1.7, name: 'SURVEY LAUNCH' },
                rescue: berth(790, 355, 0, { l: 66, w: 40, angle: 16, speed: .3 }),
                asteroids: [rock('black-pearl', 550, 165, 60)]
            }
        },
        {
            id: 'umbra', name: 'The Safe Side of a Stone', kind: 'Ride a migrating shadow',
            world: [1050, 620], start: [350, 375, 0], berth: berth(900, 215),
            brief: 'The star does not let up. Haven drifts slowly north, sweeping its shadow over the survey instrument and then the station. Travel inside that moving cover. Arriving early is as dangerous as arriving late.',
            tip: 'Light arrives from the left. Match the shadow’s slow northward drift while making your approach. The station’s safe capture window is roughly 05:25–13:30 IGT; watch the projected shelter times rather than racing sunlight.',
            pace: [470, 620, 780], space: {
                mission: 'flare', fuel: 180, acceleration: .36, flare: { continuous: true },
                survey: { x: 650, y: 290, r: 28, hold: 8, name: 'Shadow survey' },
                asteroids: [
                    rock('haven', 235, 385, 78, { motion: { vy: -.30 } }),
                    rock('terminus', 500, 530, 50, { motion: { vx: .08, vy: -.20 } })
                ]
            }
        },
        {
            id: 'borrowed-sun', name: 'Borrowed Sunlight', kind: 'Solar-only thrust',
            world: [1000, 620], start: [125, 370, 0], berth: berth(850, 270),
            brief: 'No battery, no reactor. Your solar cells power all thrusters directly, and nothing fires in complete shadow. Pass the sunlit survey marker, then coast very gently into the dark-side observatory.',
            tip: 'Sunlight powers rotation and translation alike. Coasting with thrust cut still works in the dark. Brake in the light before entering the final shadow; escape to sunlight to correct a missed approach.',
            pace: [280, 420, 640], space: {
                mission: 'solar', fuel: 180, acceleration: .36, solar: true,
                survey: { x: 600, y: 175, r: 38, hold: 1, name: 'Solar survey' },
                asteroids: [rock('eclipse', 465, 315, 72)]
            }
        },
        {
            id: 'yesterday', name: 'Yesterday Has Right of Way', kind: 'Two gates · three competing timelines',
            world: [1440, 960], start: [220, 260, 0], berth: berth(1190, 560),
            brief: 'Janara Station has two chronogates inside a winding freight concourse. Capture A, then B, then reach the experimental terminal. Each insertion adds your last flight as a repeating, solid history. The final leg shares the station with two past selves.',
            tip: 'A → A′ and B → B′ destinations are marked. Use the passing bays, not the walls: copying your old line exactly can cause a paradox. Both histories keep replaying until you escape; waiting for them to disappear will not work.',
            pace: [700, 1050, 1500], space: {
                mission: 'time', fuel: 360, acceleration: .36, maxLoop: 900,
                chronogates: [
                    { ...berth(1190, 710), id: 'A', destination: [1170, 230], replayLead: 18 },
                    { ...berth(220, 710), id: 'B', destination: [240, 360], replayLead: 32 }
                ],
                station: {
                    name: 'JANARA / TEMPORAL FREIGHT TERMINAL',
                    blocks: [
                        { id: 'north-spine', x: 80, y: 80, w: 1280, h: 40 },
                        { id: 'south-spine', x: 80, y: 840, w: 1280, h: 40 },
                        { id: 'west-upper', x: 80, y: 120, w: 40, h: 490 },
                        { id: 'west-lower', x: 80, y: 760, w: 40, h: 80 },
                        { id: 'east-spine', x: 1320, y: 120, w: 40, h: 720 },
                        { id: 'archive-stack', x: 430, y: 120, w: 90, h: 480 },
                        { id: 'reactor-stack', x: 850, y: 360, w: 90, h: 480 },
                        { id: 'west-machinery', x: 120, y: 440, w: 90, h: 85 },
                        { id: 'east-machinery', x: 1230, y: 400, w: 90, h: 85 }
                    ],
                    bays: [{ x: 320, y: 690, label: 'PASSING BAY 1' }, { x: 690, y: 260, label: 'PASSING BAY 2' }, { x: 1120, y: 340, label: 'PASSING BAY 3' }]
                }
            }
        },
        {
            id: 'cold-transit', name: 'Cold Transit', kind: 'An unpowered corridor',
            world: [1100, 650], start: [120, 325, 0], berth: berth(950, 325),
            brief: 'A superconducting freight scanner blocks all thruster power inside its field. Enter the corridor on a stable coast, dodge the moving maintenance drones, and brake only after clearing the far coil.',
            tip: 'The violet field disables attitude jets as well as main engines. Set rotation to zero before entry. The drones repeat their schedules, so retries preserve the same openings.',
            pace: [180, 270, 390], space: {
                mission: 'cold', fuel: 140, acceleration: .36,
                blackout: { x: 390, y: 120, w: 240, h: 400 },
                survey: { x: 525, y: 325, r: 46, hold: .1, name: 'Scanner transit' },
                asteroids: [rock('drone-a', 470, 325, 19, { motion: { ay: 155, period: 98, phase: 1.2 }, drone: true }), rock('drone-b', 575, 325, 19, { motion: { ay: 140, period: 125, phase: 3.1 }, drone: true })]
            }
        },
        {
            id: 'perihelion-dispatch', name: 'Perihelion Dispatch', kind: 'Fuel · rescue · flare shelter',
            world: [1300, 700], start: [280, 480, 0], spec: tug, berth: berth(1130, 290),
            brief: 'Take fuel at the shielded depot, then use the beam to recover a disabled tender before docking at Perihelion Station. Unrelenting radiation sweeps the sector. Slowly migrating asteroid shadows shelter the work; the tender is radiation-hardened, but your tug is not.',
            tip: 'Secure fuel before moving the tender. Do the rescue inside the depot’s migrating shadow, then follow its overlap with the station’s shadow. Use the broad overlap to change latitude; the station’s cover gradually leaves the cradle after about eight minutes. Cargo must be captured and the beam released before the final docking hold.',
            pace: [480, 680, 960], space: {
                mission: 'dispatch', fuel: 18, capacity: 220, acceleration: .65,
                depot: berth(410, 480, 0, { hold: 6, label: 'SHIELDED DEPOT' }),
                friendly: { x: 670, y: 480, a: 0, length: 34, beam: 16, mass: 1.9, name: 'TENDER NAVREN' },
                rescue: berth(1040, 480, 0, { l: 70, w: 44, angle: 16, speed: .3 }),
                flare: { continuous: true },
                asteroids: [
                    rock('depot-shield', 175, 480, 94, { motion: { vy: -.085 } }),
                    rock('station-shield', 710, 300, 96, { motion: { vy: .16 } })
                ]
            }
        },
        {
            id: 'century-ship', name: 'The Century Ship', kind: 'BONUS · detour past a rogue planet', bonus: true,
            world: [111500, 18000], start: [128, 9000, 0], berth: berth(110720, 9000, 0, { l: 84, w: 44, speed: .24 }),
            spec: { ...courier, name: 'IS LONGCENTURY', length: 48, beam: 18, mass: 1 },
            brief: 'A compressed interstellar voyage, outside every marathon. The next system is 110.592 km away on this navigation chart. With a 0.12 m/s² main drive and weak lateral jets, even the best possible rest-to-rest flight takes more than thirty minutes of in-game time. A rogue planet blocks the direct line. Clear its dark limb before turning your velocity back toward the destination; it is a solid obstruction, not a gravity assist.',
            tip: 'This is a distance-and-acceleration bound, not a waiting timer. Plan a two-dimensional counterburn. Lateral jets are weak but useful: build clearance well before the planet, then remove lateral velocity as well as forward speed. The console can accelerate practice; assisted voyages never enter the records. Z cycles between sector overview and local tracking.',
            pace: [2100, 2460, 3000], space: {
                mission: 'century', fuel: 340, acceleration: .12, lateral: .04, century: true,
                asteroids: [rock('EREBUNE / ROGUE PLANET', 55424, 9000, 3800, { planet: true })]
            }
        }
    ];
    for (const l of levels) {
        l.spec = { ...courier, ...l.spec };
        l.space.asteroids = l.space.asteroids || [];
        l.space.capacity = l.space.capacity ?? l.space.fuel;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = levels;
    root.HarborSpaceLevels = levels;
})(typeof globalThis !== 'undefined' ? globalThis : this);

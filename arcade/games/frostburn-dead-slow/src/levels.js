(function (root) {
    'use strict';
    const D = Math.PI / 180;
    const levels = [
        {
            id: 'dead-slow', name: 'Dead Slow', tag: '01 / THE BRAKING DISTANCE', kind: 'Open-water approach', world: [360, 240], start: [53, 121, 0], berth: {
                x: 289, y: 121, a: 0, l: 49, w: 23
            },
            brief: 'Bring the freighter alongside Pier 01. The berth arrow marks the bow direction. Neutral removes thrust — it does not stop the ship.',
            tip: 'Build speed, then order astern well before the berth. Set neutral again as you settle. Hold still inside the outline for two seconds.',
            pace: [80, 115, 170], obstacles: [
                {
                    x: 254, y: 134, w: 86, h: 16, label: 'PIER 01'
                }
            ]
        },
        {
            id: 'dogleg', name: 'The Long Way Round', tag: '02 / TURNING ROOM', kind: 'Breakwater & course buoys', world: [360, 240], start: [49, 181, 0], berth: {
                x: 292, y: 67, a: -90 * D, l: 47, w: 23
            },
            brief: 'Round the southern end of the breakwater, pass the two numbered course buoys, then turn north into the basin.',
            tip: 'A loaded ship turns in an arc, not on a point. Slow before the turn; use the bow thruster at low speed.',
            pace: [150, 210, 300], obstacles: [
                {
                    x: 170, y: 20, w: 17, h: 112, label: 'BREAKWATER'
                }, {
                    x: 305, y: 36, w: 17, h: 83, label: 'NORTH QUAY'
                }
            ],
            buoys: [
                { x: 214, y: 177, r: 26, name: 'Round the head' }, { x: 283, y: 133, r: 28, name: 'Enter the basin' }
            ]
        },
        {
            id: 'crosscurrent', name: 'A Sideways Kind of Day', tag: '03 / WIND & CURRENT', kind: 'Cross-current docking', world: [360, 240], start: [49, 86, 0], berth: {
                x: 289, y: 87, a: 0, l: 47, w: 22
            },
            brief: 'A steady southerly set pushes across the berth. Dock against the current without rubbing the quay.',
            tip: 'The white vector shows motion over ground. Point a little into the set, and use short bow-thruster inputs near the pier.',
            pace: [100, 155, 230], current: [0, .43], wind: [.002, .004], obstacles: [
                {
                    x: 239, y: 100, w: 101, h: 17, label: 'LEE QUAY'
                }, {
                    x: 137, y: 168, w: 87, h: 16, label: 'OLD MOLE'
                }
            ]
        },
        {
            id: 'signal', name: 'Catch the Green', tag: '04 / SIGNAL WINDOW', kind: 'Timed boom gate', world: [360, 240], start: [51, 122, 0], berth: {
                x: 299, y: 122, a: 0, l: 48, w: 23
            },
            brief: 'The signal boom opens for 14 seconds in every 34. Read the countdown and time your approach through the central channel.',
            tip: 'A closing boom waits while a hull occupies its safety strip. A red boom is solid. Do not arrive at full speed without an exit plan.',
            pace: [94, 135, 200], obstacles: [
                {
                    x: 178, y: 20, w: 16, h: 59, label: 'WEST MOLE'
                }, { x: 178, y: 164, w: 16, h: 56 }, {
                    x: 267, y: 135, w: 73, h: 16, label: 'BERTH 04'
                }
            ],
            gates: [
                {
                    id: 'boom', x: 182, y: 79, w: 8, h: 85, kind: 'timed', period: 34, open: 14
                }
            ], buoys: [
                { x: 239, y: 122, r: 22, name: 'Clear the boom' }
            ]
        },
        {
            id: 'traffic', name: 'Right of Weight', tag: '05 / CROSSING TRAFFIC', kind: 'Moving vessels', world: [360, 240], start: [49, 126, 0], berth: {
                x: 304, y: 126, a: 0, l: 48, w: 23
            },
            brief: 'Two harbor ferries cross your track on a fixed timetable. Pass the channel buoy and find a gap; the ferries will not stop for you.',
            tip: 'The dotted tracks show their routes. Their phase resets on every retry, making a clean line repeatable.',
            pace: [96, 145, 210], obstacles: [
                {
                    x: 272, y: 139, w: 68, h: 17, label: 'FERRY WHARF'
                }
            ], buoys: [
                { x: 236, y: 126, r: 22, name: 'Cross the fairway' }
            ],
            traffic: [
                {
                    id: 'ferry-a', from: [155, 47], to: [155, 195], speed: 1.7, offset: 14, length: 23, beam: 8
                }, {
                    id: 'ferry-b', from: [226, 195], to: [226, 46], speed: 1.45, offset: 37, length: 19, beam: 7
                }
            ]
        },
        {
            id: 'radio', name: 'Permission to Enter', tag: '06 / PILOT-BUOY PUZZLE', kind: 'Ordered radio clearance', world: [360, 240], start: [62, 179, -90 * D], berth: {
                x: 295, y: 126, a: 0, l: 47, w: 23
            },
            brief: 'Collect clearance from pilot buoy A, then B. Stay inside each circle below 2.7 knots for one second. Both clearances release the boom.',
            tip: 'The next active buoy glows amber. Completed buoys turn green. Clearance is automatic; there is no hidden interaction key.',
            pace: [160, 235, 330], obstacles: [
                {
                    x: 211, y: 20, w: 17, h: 61, label: 'CUSTOMS'
                }, { x: 211, y: 170, w: 17, h: 50 }, {
                    x: 264, y: 139, w: 76, h: 17, label: 'BONDED QUAY'
                }
            ],
            gates: [
                {
                    id: 'customs', x: 216, y: 81, w: 7, h: 89, kind: 'key', keys: 2
                }
            ],
            buoys: [
                {
                    x: 63, y: 72, r: 27, name: 'Pilot buoy A', hold: 1, speed: 1.4
                }, {
                    x: 153, y: 74, r: 27, name: 'Pilot buoy B', hold: 1, speed: 1.4
                }
            ]
        },
        {
            id: 'lock', name: 'The Lockkeeper', tag: '07 / STOP · CYCLE · GO', kind: 'Interlocked chamber', world: [360, 240], start: [51, 122, 0], berth: {
                x: 300, y: 122, a: 0, l: 46, w: 22
            },
            brief: 'Enter the lock, stop inside the marked chamber and set neutral for three seconds. Both gates then close for a six-second equalization cycle.',
            tip: 'Only the landward gate opens after the cycle. Come in gently: the chamber is just 90 metres long.',
            pace: [135, 200, 290], obstacles: [
                {
                    x: 117, y: 20, w: 121, h: 65, label: 'NORTH LOCK WALL'
                }, {
                    x: 117, y: 160, w: 121, h: 60, label: 'SOUTH LOCK WALL'
                }, {
                    x: 272, y: 135, w: 68, h: 17, label: 'UPPER REACH'
                }
            ],
            gates: [
                {
                    id: 'entry', x: 122, y: 85, w: 7, h: 75, kind: 'lock-in'
                }, {
                    id: 'exit', x: 224, y: 85, w: 7, h: 75, kind: 'lock-out'
                }
            ], lock: {
                x: 150, y: 93, w: 53, h: 59, hold: 3, cycle: 6
            }
        },
        {
            id: 'astern', name: 'Stern First', tag: '08 / REVERSE PARKING', kind: 'Bow-out finger berth', world: [360, 240], start: [74, 121, 180 * D], berth: {
                x: 290, y: 121, a: 180 * D, l: 43, w: 20
            },
            brief: 'Back into the finger berth with the bow facing out to the west. The ship starts in the right orientation; keep it that way.',
            tip: 'Astern thrust is weaker, and the rudder acts the other way around. Ahead thrust is your brake when reversing.',
            pace: [110, 165, 240], obstacles: [
                {
                    x: 245, y: 86, w: 89, h: 14, label: 'NORTH FINGER'
                }, {
                    x: 245, y: 151, w: 89, h: 14, label: 'SOUTH FINGER'
                }, { x: 311, y: 86, w: 15, h: 79 }
            ], buoys: [
                { x: 223, y: 121, r: 21, name: 'Reverse approach' }
            ]
        },
        {
            id: 'ballast', name: 'The Heavy Lift', tag: '09 / A CHANGE OF MASS', kind: 'Stop, load, deliver', world: [360, 240], start: [49, 116, 0], berth: {
                x: 296, y: 119, a: 0, l: 47, w: 22
            },
            brief: 'Stop at the floating loading station below one knot for two seconds. Taking on cargo almost doubles your mass. Then deliver to the eastern quay.',
            tip: 'Your propeller has not become stronger. The loaded ship accelerates, turns and stops more slowly.',
            pace: [145, 210, 300], current: [0, .12], spec: { mass: .95 }, obstacles: [
                {
                    x: 263, y: 132, w: 77, h: 17, label: 'HEAVY-LIFT QUAY'
                }, {
                    x: 137, y: 176, w: 51, h: 15, label: 'PONTOON'
                }
            ],
            buoys: [
                {
                    x: 151, y: 116, r: 27, name: 'Load cargo', hold: 2, speed: .50, cargo: true
                }
            ]
        },
        {
            id: 'tidal', name: 'Water Under the Keel', tag: '10 / TIDAL WINDOW', kind: 'A rising and falling sandbar', world: [360, 240], start: [50, 121, 0], berth: {
                x: 300, y: 121, a: 0, l: 47, w: 22
            },
            brief: 'The sandbar crosses the whole harbor. Your draft is 4.6 metres; wait for enough water, then clear the bar before the tide falls.',
            tip: 'The depth gauge reads the bar, not the whole harbor. Grounding kills propulsion until the water returns and makes the run unclean.',
            pace: [110, 170, 250], obstacles: [
                {
                    x: 267, y: 134, w: 73, h: 17, label: 'TIDAL QUAY'
                }
            ],
            tide: {
                mean: 4.4, amplitude: 1.7, period: 76, phase: -1.8, areas: [
                    { x: 164, y: 20, w: 54, h: 200 }
                ]
            }, buoys: [
                { x: 248, y: 121, r: 23, name: 'Clear the sandbar' }
            ]
        },
        {
            id: 'quiet', name: 'Keep the Water Quiet', tag: '11 / CLEAN-RUN CHALLENGE', kind: 'No-wake precision approach', world: [360, 240], start: [49, 122, 0], berth: {
                x: 302, y: 122, a: 0, l: 40, w: 18, angle: 10, speed: .45
            },
            brief: 'Pass through the yellow no-wake zone below 3.1 knots, then settle into a tighter berth. A wake violation counts against the clean leaderboard.',
            tip: 'Overall times allow wake violations; clean times do not. The clocks never hide a penalty inside your actual elapsed time.',
            pace: [120, 180, 265], obstacles: [
                {
                    x: 103, y: 20, w: 137, h: 52, label: 'MARINA'
                }, { x: 103, y: 175, w: 137, h: 45 }, {
                    x: 276, y: 133, w: 64, h: 17, label: 'VISITOR BERTH'
                }
            ],
            speedZones: [
                {
                    x: 103, y: 72, w: 137, h: 103, limit: 1.6
                }
            ], buoys: [
                { x: 246, y: 122, r: 20, name: 'Leave the no-wake zone' }
            ]
        },
        {
            id: 'last-berth', name: 'The Last Berth', tag: '12 / THE HARBOR EXAM', kind: 'Clearance, timing, traffic & precision', world: [420, 260], start: [49, 205, 0], berth: {
                x: 345, y: 68, a: -90 * D, l: 41, w: 19, angle: 10, speed: .50
            },
            brief: 'Get pilot clearance at the amber buoy. Catch the boom window, round the next buoy, cross the ferry lane and finish bow-north at the tight final berth.',
            tip: 'Watch the traffic and tide on your first attempt, then plan a faster route.',
            pace: [210, 295, 410], current: [.13, -.09], obstacles: [
                {
                    x: 205, y: 20, w: 17, h: 131, label: 'OUTER MOLE'
                }, { x: 205, y: 235, w: 17, h: 5 }, {
                    x: 357, y: 38, w: 16, h: 72, label: 'LAST BERTH'
                }
            ],
            buoys: [
                {
                    x: 145, y: 204, r: 26, name: 'Pilot clearance', hold: 1, speed: 1.4
                }, { x: 284, y: 194, r: 25, name: 'Round the east buoy' }
            ],
            gates: [
                {
                    id: 'exam', x: 212, y: 151, w: 7, h: 84, kind: 'timed', keys: 1, period: 38, open: 18, offset: 5
                }
            ],
            traffic: [
                {
                    id: 'exam-ferry', from: [251, 137], to: [373, 137], speed: 1.35, offset: 25, length: 22, beam: 7
                }
            ]
        }
    ];
    // Keep the original exposed layouts intact. Their IDs also preserve v1 records.
    const exposed = ['crosscurrent', 'ballast', 'last-berth'].map(id => JSON.parse(JSON.stringify(levels.find(l => l.id === id))));
    const cross = levels[2];
    cross.id = 'crosscurrent-sheltered';
    cross.kind = 'Cross-current to a sheltered basin';
    cross.brief = 'Cross the southerly set, then enter the lee of the breakwater. The shaded inner basin protects the final approach from current and wind.';
    cross.tip = 'Steer into the set on the crossing. Arrows fade in the lee; LOCAL SET confirms the shelter. Your sideways momentum still takes time to fade.';
    cross.obstacles.push({
        x: 225, y: 43, w: 115, h: 10, label: 'WAVEBREAK'
    }, { x: 328, y: 53, w: 12, h: 47 });
    cross.shelters = [
        {
            x: 199, y: 50, w: 141, h: 76, feather: 24, label: 'LEE WATER'
        }
    ];
    const heavy = levels[8];
    heavy.id = 'ballast-sheltered';
    heavy.brief = 'Stop at the floating station below one knot for two seconds to load cargo. Deliver the heavier ship to the new sheltered heavy-lift basin.';
    heavy.tip = 'Mass still lengthens your stop. Enter the lee at low speed: the breakwater reduces the set, but cannot brake the freighter for you.';
    heavy.obstacles.push({
        x: 246, y: 69, w: 94, h: 10, label: 'WAVEBREAK'
    }, { x: 328, y: 79, w: 12, h: 53 });
    heavy.shelters = [
        {
            x: 219, y: 76, w: 121, h: 86, feather: 22, label: 'LEE WATER'
        }
    ];
    const exam = levels[11];
    exam.id = 'last-berth-sheltered';
    exam.brief = 'Collect pilot clearance, catch the boom, round the buoy and cross the ferry lane. Finish bow-north inside the protected final basin.';
    exam.tip = 'Enter the basin from the south. The breakwater takes the current out of the final turn; keep clear of its head before turning north.';
    exam.obstacles.push({
        x: 300, y: 25, w: 12, h: 95, label: 'WAVEBREAK'
    }, { x: 312, y: 25, w: 61, h: 10 });
    exam.shelters = [
        {
            x: 309, y: 33, w: 65, h: 111, feather: 20, label: 'LEE WATER'
        }
    ];
    Object.assign(exposed[0], {
        name: 'No Lee Shore', kind: 'Exposed cross-current berth',
        brief: 'A southerly set crosses the exposed quay. Arrive already aligned, with room to drift during the two-second neutral hold.',
        tip: 'Ahead/astern is measured over ground, not from the telegraph. Approach from upstream. The 1.2-knot mooring limit allows a little drift; perfect station-keeping is not required.'
    });
    Object.assign(exposed[1], {
        name: 'Loaded Against the Set', kind: 'Exposed heavy-lift delivery',
        brief: 'Stop to load cargo, then bring the heavier ship to an unprotected berth in a gentle cross-set.',
        tip: 'Load in the upstream half of the circle. Start the final approach upstream too; mass makes last-second corrections particularly expensive.'
    });
    Object.assign(exposed[2], {
        name: 'The Exposed Berth', kind: 'Harbor exam without shelter',
        brief: 'The night watch ends at an exposed quay. Pilot clearance, a timed boom and a crossing ferry lead to the tight, unprotected north-facing berth.',
        tip: 'Two seconds in neutral is enough. Approach slightly up-current and already parallel to the quay; chase alignment before position, not after.'
    });
    const night = [
        ...exposed,
        {
            id: 'two-greens', name: 'Between Two Greens', kind: 'Two clocks, one waiting pocket', world: [420, 260], start: [50, 131, 0], berth: {
                x: 360, y: 131, a: 0, l: 45, w: 21
            },
            brief: 'Two booms have different signal cycles. Cross the first, hold in the middle pocket, then time the second. Collect both channel marks in order.',
            tip: 'There is enough room to stop between the gates, but not enough for full-speed optimism. Safety strips still protect an occupying hull.',
            pace: [160, 225, 315], obstacles: [
                {
                    x: 140, y: 20, w: 14, h: 68, label: 'OUTER MOLE'
                }, { x: 140, y: 174, w: 14, h: 66 }, {
                    x: 270, y: 20, w: 14, h: 68, label: 'INNER MOLE'
                }, { x: 270, y: 174, w: 14, h: 66 }, {
                    x: 333, y: 143, w: 67, h: 15, label: 'NIGHT FREIGHT'
                }
            ],
            gates: [
                {
                    id: 'outer', x: 144, y: 88, w: 6, h: 86, kind: 'timed', period: 37, open: 13, offset: 9
                }, {
                    id: 'inner', x: 274, y: 88, w: 6, h: 86, kind: 'timed', period: 43, open: 12, offset: 28
                }
            ],
            buoys: [
                {
                    x: 203, y: 131, r: 23, name: 'Waiting pocket', hold: 1, speed: 1.0
                }, { x: 319, y: 131, r: 18, name: 'Clear the inner boom' }
            ]
        },
        {
            id: 'tidal-race', name: 'The Sluice', kind: 'A pulsing cross-channel jet', world: [420, 280], start: [51, 188, 0], berth: {
                x: 357, y: 87, a: 0, l: 44, w: 21
            },
            brief: 'A sluice sends a pulsing jet south through the central fairway. Cross the marked race, then turn northeast into the quieter terminal basin.',
            tip: 'The current arrows show the local flow and the pulse resets on retry. Cross with steerageway; do not try to park in the race.',
            pace: [155, 225, 325], current: [0, .10], wind: [.001, .002],
            currentZones: [
                {
                    x: 142, y: 20, w: 83, h: 240, feather: 19, current: [0, .95], pulse: { period: 46, min: .3, phase: .5 }, label: 'SLUICE RACE'
                }
            ],
            obstacles: [
                {
                    x: 131, y: 20, w: 20, h: 100, label: 'SLUICE WALL'
                }, {
                    x: 293, y: 101, w: 107, h: 15, label: 'NORTH TERMINAL'
                }
            ],
            buoys: [
                { x: 254, y: 181, r: 25, name: 'Clear the sluice' }, { x: 298, y: 87, r: 24, name: 'Terminal approach' }
            ]
        },
        {
            id: 'night-convoy', name: 'Night Convoy', kind: 'Three ferries & a radio checkpoint', world: [420, 280], start: [52, 142, 0], berth: {
                x: 356, y: 142, a: 0, l: 43, w: 21
            },
            brief: 'Get traffic clearance, then pass three staggered ferry tracks. The final ferry is longer and slower. Reach the dispatch mark before mooring.',
            tip: 'A gap is not safe unless your stern will clear it too. Wait upstream of a track, never on it.',
            pace: [160, 235, 335], obstacles: [
                {
                    x: 326, y: 155, w: 74, h: 15, label: 'CONVOY DISPATCH'
                }
            ],
            buoys: [
                {
                    x: 98, y: 142, r: 24, name: 'Traffic clearance', hold: 2, speed: 1.0
                }, { x: 302, y: 142, r: 18, name: 'Dispatch mark' }
            ],
            traffic: [
                {
                    id: 'convoy-a', from: [170, 48], to: [170, 233], speed: 1.8, offset: 12, length: 27, beam: 9
                }, {
                    id: 'convoy-b', from: [224, 231], to: [224, 47], speed: 1.55, offset: 49, length: 25, beam: 8
                }, {
                    id: 'convoy-c', from: [275, 50], to: [275, 232], speed: 1.2, offset: 88, length: 34, beam: 10
                }
            ]
        },
        {
            id: 'dogwatch-lock', name: 'The Dogwatch Lock', kind: 'Narrow lock, timed exit & cross-set', world: [420, 280], start: [49, 142, 0], berth: {
                x: 358, y: 94, a: 0, l: 44, w: 21
            },
            brief: 'Stop fully inside the narrow chamber. Equalization takes nine seconds. Beyond the lock a cross-set carries you south; turn into the northern terminal.',
            tip: 'You cannot turn around inside this chamber. Center the ship before entering. The lock itself is calm; the exit apron is not.',
            pace: [195, 275, 390], current: [0, .20],
            obstacles: [
                {
                    x: 119, y: 20, w: 133, h: 98, label: 'NORTH LOCK WALL'
                }, {
                    x: 119, y: 166, w: 133, h: 94, label: 'SOUTH LOCK WALL'
                }, {
                    x: 324, y: 108, w: 76, h: 15, label: 'UPPER TERMINAL'
                }
            ],
            shelters: [
                {
                    x: 113, y: 112, w: 145, h: 60, feather: 12, label: 'LOCK WATER'
                }
            ],
            gates: [
                {
                    id: 'night-entry', x: 124, y: 118, w: 7, h: 48, kind: 'lock-in'
                }, {
                    id: 'night-exit', x: 239, y: 118, w: 7, h: 48, kind: 'lock-out'
                }
            ], lock: {
                x: 153, y: 121, w: 67, h: 42, hold: 3, cycle: 9
            },
            buoys: [
                { x: 298, y: 141, r: 21, name: 'Leave the lock apron' }
            ]
        },
        {
            id: 'backwater', name: 'Backwater', kind: 'Reverse dogleg into an offset finger berth', world: [420, 280], start: [63, 217, 180 * D], berth: {
                x: 353, y: 144, a: 180 * D, l: 41, w: 19, angle: 11, speed: .5
            },
            brief: 'Back through the southern approach, round the old mole and turn your stern north toward the finger basin. Straighten onto the west-facing berth before entering the fingers; a northerly set keeps pushing throughout the maneuver.',
            tip: 'This is not a straight backing exercise. Leave room east of the mole for the dogleg, countersteer to stop the swing, and use ahead thrust to brake when the speed reads ASTERN.',
            pace: [245, 340, 475], current: [0, -.13], obstacles: [
                { x: 175, y: 20, w: 17, h: 143, label: 'OLD MOLE' },
                {
                    x: 305, y: 109, w: 84, h: 13, label: 'NORTH FINGER'
                }, {
                    x: 305, y: 174, w: 84, h: 13, label: 'SOUTH FINGER'
                }, { x: 374, y: 109, w: 15, h: 78 }
            ],
            buoys: [
                { x: 235, y: 215, r: 23, name: 'Round the mole astern' },
                { x: 285, y: 144, r: 20, name: 'Straighten for the fingers' }
            ]
        },
        {
            id: 'sounding-line', name: 'The Sounding Line', kind: 'Two sandbars & a mid-channel stop', world: [440, 280], start: [51, 141, 0], berth: {
                x: 381, y: 141, a: 0, l: 44, w: 21
            },
            brief: 'Two sandbars share a tide. Receive a two-second sounding report in the deep pocket between them. Decide whether the second crossing belongs to this tide or the next.',
            tip: 'The central pocket is deep at every phase. Get the whole hull off a bar before waiting. Missing a window costs time, not necessarily the ship.',
            pace: [215, 305, 430], obstacles: [
                {
                    x: 350, y: 154, w: 70, h: 15, label: 'HYDROGRAPHIC QUAY'
                }
            ],
            tide: {
                mean: 4.45, amplitude: 1.6, period: 104, phase: -1.3, areas: [
                    { x: 131, y: 20, w: 43, h: 240 }, { x: 278, y: 20, w: 43, h: 240 }
                ]
            },
            buoys: [
                {
                    x: 224, y: 141, r: 24, name: 'Sounding report', hold: 2, speed: .6
                }, { x: 346, y: 141, r: 16, name: 'Clear the second bar' }
            ]
        },
        {
            id: 'deadweight', name: 'Deadweight', kind: 'Long hull, heavy cargo & a quiet approach', world: [440, 300], start: [52, 211, 0], spec: { length: 34, beam: 10, mass: 1.2 }, berth: {
                x: 365, y: 77, a: -90 * D, l: 45, w: 21, angle: 10, speed: .45
            },
            brief: 'Take on a heavy project load, obey the no-wake limit and turn a longer hull into a north-facing pocket berth. The final turn has very little room for a late brake.',
            tip: 'This ship is 34 metres long. Load low and slow, clear the eastern course mark, then line up south of the berth before heading north.',
            pace: [240, 335, 470], obstacles: [
                {
                    x: 144, y: 241, w: 61, h: 16, label: 'PROJECT CARGO'
                }, {
                    x: 379, y: 39, w: 16, h: 82, label: 'HEAVY WORKS'
                }, { x: 313, y: 30, w: 66, h: 13 }
            ],
            buoys: [
                {
                    x: 154, y: 210, r: 28, name: 'Project load', hold: 3, speed: .45, cargo: true, mass: 2.25
                }, { x: 338, y: 198, r: 23, name: 'Clear the turn' }
            ], speedZones: [
                {
                    x: 233, y: 144, w: 174, h: 96, limit: 1.35
                }
            ]
        },
        {
            id: 'switchback', name: 'The Switchback', kind: 'Opposite breakwater heads & final clearance', world: [460, 320], start: [50, 244, 0], berth: {
                x: 399, y: 215, a: 90 * D, l: 43, w: 21, angle: 11, speed: .5
            },
            brief: 'Round the first wall to the south, the second to the north, then receive clearance for the southern delivery pocket. Each buoy enforces the intended S-shaped route.',
            tip: 'Plan three separate turns. The spaces between walls are turning basins, not an invitation to keep full ahead.',
            pace: [275, 385, 540], obstacles: [
                {
                    x: 143, y: 20, w: 16, h: 164, label: 'WEST WALL'
                }, {
                    x: 283, y: 139, w: 16, h: 161, label: 'EAST WALL'
                }, {
                    x: 412, y: 182, w: 15, h: 76, label: 'SOUTH DELIVERY'
                }, { x: 349, y: 270, w: 78, h: 13 }
            ],
            buoys: [
                { x: 201, y: 239, r: 25, name: 'Round the south head' }, { x: 230, y: 87, r: 24, name: 'Turn in the middle basin' }, { x: 356, y: 81, r: 25, name: 'Round the north head' }, {
                    x: 391, y: 147, r: 24, name: 'Delivery clearance', hold: 1.5, speed: 1.0
                }
            ]
        },
        {
            id: 'last-light', name: 'Last Light', kind: 'The night-shift master trial', world: [480, 320], start: [50, 247, 0], berth: {
                x: 414, y: 67, a: -90 * D, l: 42, w: 20, angle: 10, speed: .48
            },
            brief: 'Take pilot clearance, cross the tidal shoal, catch the inspection boom, clear the ferry and approach the final quay through a pulsing set. Finish bow-north under the lighthouse.',
            tip: 'The last berth is sheltered, but the approach is not. Use the deep waiting pocket beyond the shoal. Brake before the final turn and carry as little sideways drift as possible into the lee.',
            pace: [310, 425, 590], current: [.08, 0], wind: [.002, -.001],
            tide: {
                mean: 4.45, amplitude: 1.65, period: 112, phase: -1.4, areas: [
                    { x: 174, y: 20, w: 46, h: 280 }
                ]
            },
            currentZones: [
                {
                    x: 318, y: 123, w: 130, h: 155, feather: 24, current: [-.30, .40], pulse: { period: 59, min: .35, phase: 1.2 }, label: 'OUTFALL SET'
                }
            ],
            shelters: [
                {
                    x: 372, y: 28, w: 73, h: 106, feather: 19, label: 'LIGHTHOUSE LEE'
                }
            ],
            obstacles: [
                {
                    x: 281, y: 20, w: 16, h: 153, label: 'INSPECTION MOLE'
                }, { x: 281, y: 276, w: 16, h: 24 }, {
                    x: 428, y: 31, w: 16, h: 76, label: 'LAST LIGHT'
                }, {
                    x: 365, y: 20, w: 14, h: 90, label: 'WAVEBREAK'
                }
            ],
            gates: [
                {
                    id: 'inspection', x: 286, y: 173, w: 6, h: 103, kind: 'timed', period: 47, open: 16, keys: 2, offset: 17
                }
            ],
            buoys: [
                {
                    x: 116, y: 247, r: 25, name: 'Night pilot', hold: 2, speed: .9
                }, {
                    x: 247, y: 236, r: 19, name: 'Inspection clearance', hold: 1, speed: .8
                }, { x: 361, y: 229, r: 23, name: 'Clear the outfall' }
            ],
            traffic: [
                {
                    id: 'last-ferry', from: [324, 152], to: [445, 152], speed: 1.55, offset: 34, length: 29, beam: 9
                }
            ]
        }
    ];
    // Campaign identity is stable; presentation order is not an array-index formula.
    const islandLevels = typeof module !== 'undefined' && module.exports ? require('./archipelago.js') : root.HarborArchipelago;
    const spaceLevels = typeof module !== 'undefined' && module.exports ? require('./space-levels.js') : root.HarborSpaceLevels;
    const rampageLevels = typeof module !== 'undefined' && module.exports ? require('./rampage.js').levels : root.GerboRampage.levels;
    const railLevels = typeof module !== 'undefined' && module.exports ? require('./rail-levels.js') : root.RailLevels;
    const polarLevels = typeof module !== 'undefined' && module.exports ? require('./polar-levels.js').levels : root.PaleReachLevels.levels;
    const sources = { coast: levels.slice(), northwatch: night, archipelago: islandLevels,
        gerbozilla: rampageLevels, 'long-grade': railLevels, meridian: spaceLevels, 'pale-reach': polarLevels };
    const worlds = [
        { id:'coast', number:1, name:'The Sheltered Coast', subtitle:'DAY WATCH · ROOM TO LEARN', theme:'coast', description:'Twelve working harbors. Wavebreak basins protect the current-heavy moorings without taking the weight out of the ship.' },
        { id:'northwatch', number:2, name:'Northwatch', subtitle:'NIGHT SHIFT · NO EASY WATER', theme:'night', description:'Twelve exposed night-shift trials: sluice jets, double booms, convoys, tight locks and the final lighthouse run.' },
        { id:'archipelago', number:3, name:'The Archipelago', subtitle:'SUMMER SERVICE · EVERY ISLAND COUNTS', theme:'archipelago', description:'A long-light island service. Carry cars between village ramps, tow stranded vessels past granite skerries and relocate a floating sauna.' },
        { id:'gerbozilla', number:4, name:'Gerbozilla’s Rampage', subtitle:'GIANT PET · TWELVE FIELD COURSES', theme:'rampage', description:'Twelve championship field courses: momentum, forest orienteering, volcanic crossings, giant pets and Lady Whiskerdoom’s journey home. Green slows rolling; black boulders are impassable.' },
        { id:'long-grade', number:5, name:'The Long Grade', subtitle:'HEAVY RAIL · TWELVE ASSIGNMENTS', theme:'rail', description:'A freight network from upland quarries to the coastal terminal. Work the yards, share the line, manage a mountain helper and bring every wagon home.' },
        { id:'meridian', number:6, name:'The Black Meridian', subtitle:'DEEP SPACE · NO FREE BRAKES', theme:'space', description:'Twelve spacecraft assignments: moving cradles, refuelling, assembly, recoil, beam rescue, stellar shadows and your own history. The Century Ship is a separate bonus, excluded from every circuit.' },
        { id:'pale-reach', number:7, name:'Race for the Pale Reach', subtitle:'SURFACE & UNDERWATER WATCH · TWELVE ASSIGNMENTS', theme:'polar', description:'Open passages, defend the Council’s supply routes, and take Petrel beneath the ice. Recover the stranded crews from every side, then change bridges during the final relief convoy. The Free Anchorage Council, Narrows Compact and Shelf League disagree over a changing polar basin. All twelve assignments and the complete campaign circuit are playable.' },
        { id:'megastructures', number:8, name:'Tow the Impossible', subtitle:'BUILD SOMETHING BIGGER · COMING SOON', theme:'platform', comingSoon:true, description:'Coming soon: floating hospitals, bridge spans and entire terminals. End the journey by placing the harbor itself.' }
    ];
    const planned = {
        'long-grade': ['The Last Wagon Counts','Head at the Wrong End','Stone Runs Downhill','Meet at Rook’s Hollow','Three Wagons Going Somewhere','Leaves on the Line','One Bridge, Two Loads','The Corners Are the Cargo','A Push from Behind','The Railway Ends Here','The Last Working Line','The Long Grade'],
        'pale-reach': ['The First Fracture','Borrowed Water','Deliveries Beyond the Map','Buoys, Not Borders','Home Ice','The Other Shore','What the Ice Heard','Under the Listening Post','Three Echoes Too Many','Bring Them Back','No Flag on the Lifeboats','The Passage Must Stay Open'],
        'megastructures': ['A Building Changes Address','The L-Shaped Problem','Too Tall, Too Deep','The Far End Is Still Turning','A Permanent Decision','The Sail Nobody Ordered','Three Corners Working','The Cargo Keeps Moving','One Platform, Two Pieces','A Harbor You Can Move','Keep It Afloat','A Port for Everyone']
    };
    // Placeholders belong to the catalog, never to the simulation's playable list.
    // This keeps loads, records, replays and circuits from entering an empty mission.
    const catalog = [];
    levels.length = 0;
    for (const w of worlds) {
        if (w.comingSoon) {
            w.stages = planned[w.id].map((name, i) => Object.freeze({ id:`${w.id}-${i+1}`, name,
                campaign:w.id, worldNumber:w.number, stageNumber:i+1, comingSoon:true, theme:w.theme, kind:'Coming soon' }));
            catalog.push(...w.stages);
            continue;
        }
        sources[w.id].forEach((l, i) => {
            l.campaign = w.id; l.worldNumber = w.number; l.stageNumber = i + 1; l.theme = w.theme;
            l.simulation ??= l.rail ? 'rail' : l.rampage ? 'rolling' : l.space ? 'space' : 'marine';
            l.courseRevision ??= 1;
            l.rulesRevision ??= 1;
            l.openSides = l.openSides || (w.number >= 3 ? ['n','e','s','w'] : ['w']);
            const oldTag = l.tag?.split(' / ')[1] || l.kind.toUpperCase();
            l.tag = `W${w.number} · ${l.bonus ? 'BONUS' : String(l.stageNumber).padStart(2,'0')} / ${oldTag}`;
            l.current = l.current || [0,0]; l.wind = l.wind || [0,0];
            for (const key of ['obstacles','buoys','gates','traffic','speedZones','shelters','currentZones','islands','jobs','towables']) l[key] = l[key] || [];
            levels.push(l); catalog.push(l);
        });
        if (w.partial) {
            w.stages = [...sources[w.id], ...planned[w.id].slice(sources[w.id].length).map((name, j) => Object.freeze({
                id:`${w.id}-${j+sources[w.id].length+1}`, name, campaign:w.id, worldNumber:w.number,
                stageNumber:j+sources[w.id].length+1, comingSoon:true, theme:w.theme, kind:'Coming soon' }))];
            catalog.push(...w.stages.filter(l=>l.comingSoon));
        }
    }
    levels.worlds = worlds;
    levels.catalog = catalog;
    if (typeof module !== 'undefined' && module.exports) module.exports = levels;
    root.HarborLevels = levels;
    root.HarborWorlds = worlds;
})(typeof globalThis !== 'undefined' ? globalThis : this);

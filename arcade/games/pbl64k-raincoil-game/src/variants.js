export const VARIANTS = {
  wild: { name: 'WILD', tag: 'THE ORIGINAL STORM', icon: '∴', description: 'Unpredictable rain. Immediate escapes. The first RAINCOIL rules.', hint: 'React to the weather. Every catch is an opportunity.' },
  cadence: { name: 'CADENCE', tag: 'READ THE RAIN', icon: '↘', description: 'Three-drop phrases. Read the forecast, find a route, catch the returning color.', hint: 'Sweep crosses three columns. Echo repeats. Fork returns.' },
  afterimage: { name: 'AFTERIMAGE', tag: 'LEAVE SOMETHING BEHIND', icon: '◌', description: 'Patterned rain, plus shed skins that stay behind. Paint a skin into a burst—or navigate around it.', hint: 'Shed skins catch rain. Match three links to reclaim them.' }
};

export function recordKey(variant, mode, relaxed = false) {
  return `${variant}:${mode}${relaxed ? ':relaxed' : ''}`;
}

export function migrateRecords(saved) {
  const records = saved.records && typeof saved.records === 'object' ? { ...saved.records } : {};
  for (const type of Object.keys(VARIANTS)) for (const duration of ['storm','endless']) {
    const key = `${type}:${duration}`, old = type === 'wild' ? saved.best?.[duration] : 0;
    records[key] = Math.max(0, Number.isFinite(records[key]) ? records[key] : 0, Number.isFinite(old) ? old : 0);
    const relaxedKey = recordKey(type, duration, true);
    records[relaxedKey] = Math.max(0, Number.isFinite(records[relaxedKey]) ? records[relaxedKey] : 0);
  }
  return records;
}

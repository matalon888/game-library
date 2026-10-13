# Language files

One file per language. Each is a flat list of `"key": "text"` pairs.

## Fixing a wrong translation

Find the key in `en.json` to see what the English says, then edit the same key in
your language's file. Save, and restart the game. Nothing else needs changing.

```json
"toast.lifted": "You found: {name}. {era}."
```

**The words in `{curly braces}` are slots** the game fills in — a find's name, a
number, a direction. Keep every slot that appears in the English. You may move
them anywhere in the sentence, which is the point: word order is not the same in
Hindi as it is in English.

If a key is missing from your file, the game shows the English instead. It never
shows a blank.

## Files

| File | Language | Font |
| --- | --- | --- |
| `en.json` | English | Baloo 2 |
| `hi.json` | हिन्दी Hindi | Baloo 2 |
| `bn.json` | বাংলা Bengali | Baloo Da 2 |
| `te.json` | తెలుగు Telugu | Baloo Tammudu 2 |
| `mr.json` | मराठी Marathi | Baloo 2 |
| `ta.json` | தமிழ் Tamil | Baloo Thambi 2 |

## Status

`"_meta.status"` at the top of each file is either `complete` or `draft`. The
five Indian languages ship as **draft**: they were machine-assisted and have not
been checked by a teacher. The language picker shows a "draft translation" note
while a file says `draft`. Change it to `complete` once someone who speaks the
language has read it through.

Place names and period names are the things most worth checking — Rakhigarhi,
Harappan, Vijayanagara, Mauryan.

## Writing style

The English is written for ages 11 to 14. One idea per sentence, about 7 words
on average, never more than 18. Please keep translations at the same level. If a
sentence needs a hard word, the game should explain it on screen.

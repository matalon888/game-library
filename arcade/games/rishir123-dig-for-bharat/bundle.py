#!/usr/bin/env python3
"""Recombine the section view into one self-contained page.

The local project is split (index.html / styles.css / src/*.js) because that is
easier to work on. A published Artifact wants a single file. Run this after
local edits, then publish dist/dig-for-bharat.html to keep the two in step.

    python3 bundle.py
"""
import os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
read = lambda p: open(os.path.join(ROOT, p)).read()

html = read("section.html")

# body markup only — the artifact host supplies doctype/html/head/body
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r'<script src="[^"]*"></script>\s*', "", body).strip()
# the local cross-link has nowhere to go once this is a single page
body = re.sub(r'<a class="xlink"[^>]*>.*?</a><br>', "", body, flags=re.S)

fonts = "\n".join(re.findall(r'<link rel="pre[^>]*>|<link rel="stylesheet" href="https://[^>]*>', html))

# flatten the two-module graph into one inline module: drop the export
# keywords and the import statement, then concatenate in load order
data = re.sub(r"^export ", "", read("src/data.js").strip(), flags=re.M)
game = re.sub(r'^import \{[^}]*\} from "\./data\.js";\n+', "", read("src/game.js").strip())

out = "\n".join([
    "<title>Dig for Bharat</title>",
    fonts,
    "<style>\n" + read("styles.css").strip() + "\n</style>",
    "",
    body,
    "",
    "<script type=\"module\">\n" + data + "\n\n" + game + "\n</script>",
    "",
])

os.makedirs(os.path.join(ROOT, "artifact"), exist_ok=True)
dest = os.path.join(ROOT, "artifact", "dig-for-bharat.html")
open(dest, "w").write(out)
print("wrote artifact/dig-for-bharat.html  (%d bytes)" % len(out))

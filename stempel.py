#!/usr/bin/env python3
"""Haengt an style.css und app.js eine Kennung aus dem Dateiinhalt an.
Aendert sich die Datei, aendert sich die Kennung - und Browser laden
die neue Fassung, statt eine alte aus dem Zwischenspeicher zu zeigen."""
import hashlib, pathlib, re

SITE = pathlib.Path("site")
kennung = {}
for name in ("assets/style.css", "assets/app.js", "assets/fonts.css"):
    kennung[name] = hashlib.sha1((SITE / name).read_bytes()).hexdigest()[:8]

for f in SITE.glob("*.html"):
    h = f.read_text(); vorher = h
    for name, k in kennung.items():
        h = re.sub(rf'(?:href|src)="{re.escape(name)}(?:\?v=[0-9a-f]+)?"',
                   lambda m, n=name, kk=k: m.group(0).split('=')[0] + f'="{n}?v={kk}"', h)
    if h != vorher:
        f.write_text(h)

for name, k in kennung.items():
    print(f"{name}  ?v={k}")

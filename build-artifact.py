#!/usr/bin/env python3
"""Macht aus der Einzeldatei die Fassung fuer die Artifact-Vorschau:
Dokumentgeruest raus, Termindaten eingebettet."""
import pathlib, re

quelle = pathlib.Path("vorschau/tcm-grohe.html")
ziel   = pathlib.Path("vorschau/artifact.html")
h = quelle.read_text()

# Freie Termine einbetten - in der Einzeldatei gibt es nichts zum Nachladen
slots = pathlib.Path("site/freie-termine.json").read_text()
h = h.replace('<script type="application/json" id="termine-fallback">',
              f'<script type="application/json" id="slots-fallback">{slots}</script>\n'
              '<script type="application/json" id="termine-fallback">')

for muster in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</html>\s*',
               r'<head>\s*', r'</head>\s*', r'<body>\s*', r'</body>\s*']:
    h = re.sub(muster, '', h, flags=re.I)

h = h.replace("<title>", "<!-- Vorschau der neuen Website tcm-grohe.at -->\n<title>", 1)
ziel.write_text(h)
print(f"{ziel}  {ziel.stat().st_size // 1024} KB")
print("Unterseiten eingebettet:", h.count('class="unterseite"'))

#!/usr/bin/env python3
"""Erzeugt die beiden Umgebungsvariablen fuer den Verwaltungsbereich.

    python3 zugang-einrichten.py

Das Skript fragt nach einem Passwort und gibt zwei Werte aus, die bei
Netlify unter  Site configuration -> Environment variables  eingetragen
werden:

    VERWALTUNG_PASSWORT    der scrypt-Hash des Passworts
    VERWALTUNG_GEHEIMNIS   ein Zufallswert, mit dem die Sitzung
                           unterschrieben wird

Das Passwort selbst wird nirgends gespeichert - auch nicht bei Netlify.
Aus dem Hash laesst es sich nicht zurueckrechnen. Geht es verloren, wird
hier einfach ein neues erzeugt und der Hash ersetzt.

Ohne diese beiden Variablen verweigert der Verwaltungsbereich jede
Anfrage. Er ist dann zu, nicht offen.
"""

import base64
import getpass
import hashlib
import secrets
import sys
import unicodedata

# Dieselben Werte prueft die Serverfunktion in
# site/netlify/functions/verwaltung.mjs. Wer sie hier aendert, muss sie
# dort mitaendern.
N, R, P, LAENGE = 16384, 8, 1, 32


def hash_bauen(passwort: str) -> str:
    salz = secrets.token_bytes(16)
    roh = hashlib.scrypt(
        passwort.encode("utf-8"),
        salt=salz,
        n=N, r=R, p=P, dklen=LAENGE,
        maxmem=64 * 1024 * 1024,
    )
    return "scrypt${}${}${}${}${}".format(
        N, R, P,
        base64.b64encode(salz).decode(),
        base64.b64encode(roh).decode(),
    )


def pruefen(passwort: str) -> list:
    einwaende = []
    if len(passwort) < 12:
        einwaende.append("kürzer als 12 Zeichen")
    if passwort.lower() in ("passwort", "password", "geheim", "12345678", "tcmgrohe"):
        einwaende.append("steht in jeder Wortliste")
    if len(set(passwort)) < 6:
        einwaende.append("zu wenig verschiedene Zeichen")
    return einwaende


def main() -> int:
    print(__doc__.split("\n\n")[0])
    print()

    passwort = getpass.getpass("Passwort für den Verwaltungsbereich: ")
    if not passwort:
        print("Abgebrochen.", file=sys.stderr)
        return 1
    if passwort != getpass.getpass("Noch einmal zur Sicherheit:        "):
        print("Die beiden Eingaben sind nicht gleich.", file=sys.stderr)
        return 1

    # Gleiche Normalform wie im Browser, sonst passt ein Passwort mit
    # Umlauten je nach Tastatur einmal und einmal nicht.
    passwort = unicodedata.normalize("NFC", passwort)

    einwaende = pruefen(passwort)
    if einwaende:
        print()
        print("Hinweis: Das Passwort ist " + ", ".join(einwaende) + ".")
        print("Es schützt den einzigen Schreibzugang zur Website.")
        if input("Trotzdem verwenden? [j/N] ").strip().lower() not in ("j", "ja"):
            return 1

    print()
    print("Diese beiden Zeilen bei Netlify eintragen:")
    print("  Site configuration -> Environment variables -> Add a variable")
    print()
    print("VERWALTUNG_PASSWORT")
    print(hash_bauen(passwort))
    print()
    print("VERWALTUNG_GEHEIMNIS")
    print(base64.b64encode(secrets.token_bytes(32)).decode())
    print()
    print("Danach einmal neu veröffentlichen, damit die Funktionen die")
    print("Variablen sehen. Das Passwort selbst gehört in einen")
    print("Passwortspeicher, nicht in diese Ausgabe.")
    print()
    print("Zum lokalen Ausprobieren beide Werte auch in die Umgebung legen:")
    print("  export VERWALTUNG_PASSWORT='...'")
    print("  export VERWALTUNG_GEHEIMNIS='...'")
    print("  python3 dev-server.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

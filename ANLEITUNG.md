# Rezeptfang einrichten

## 1. Auf GitHub Pages hochladen (am PC, ca. 5 Minuten)

1. Auf github.com einloggen, oben rechts **+ > New repository**.
2. Name: `rezeptfang`, Sichtbarkeit **Public** (GitHub Pages ist im Gratis-Konto nur für öffentliche Repositories verfügbar). Im Code steht nichts Geheimes, dein Schlüssel bleibt am Handy.
3. **Create repository**, dann auf **uploading an existing file** klicken.
4. Alle Dateien aus dem ZIP hineinziehen: `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. Unten **Commit changes**.
5. Im Repository **Settings > Pages**: bei *Source* „Deploy from a branch“, Branch `main`, Ordner `/ (root)`, **Save**.
6. Nach ein bis zwei Minuten ist die App erreichbar unter `https://DEIN-GITHUB-NAME.github.io/rezeptfang/`.

## 2. Am Handy installieren

1. Die Adresse in **Chrome** öffnen.
2. Menü (drei Punkte) > **App installieren** (oder „Zum Startbildschirm hinzufügen“ > Installieren).
3. Wichtig: Nur als installierte App erscheint Rezeptfang im Teilen-Menü.

## 3. OpenRouter-Schlüssel

1. Auf openrouter.ai einen eigenen Schlüssel nur für diese App anlegen.
2. Guardrail anlegen (Workspaces > Guardrails): Modell nur `google/gemini-3.8-flash`, Anbieter nur Google AI Studio, Budget z. B. 1 $ pro Tag, dem Schlüssel zuweisen.
3. In Rezeptfang unter **Einstellungen** den Schlüssel einfügen, **Speichern**, dann **Schlüssel prüfen**.

## Benutzen

- **YouTube:** YouTube-App > Video > **Teilen** > **Rezeptfang**.
- **Screenshots und Fotos:** Bilder in der Galerie auswählen > **Teilen** > **Rezeptfang**. Bis zu 6 Bilder pro Rezept, z. B. zwei Kochbuchseiten oder mehrere Screenshots aus der NYT-App.
- **Text:** In der App auf **+ Rezept holen** > **Text einfügen**.
- Der Import dauert je nach Länge 20 Sekunden bis einige Minuten. In der über Chrome installierten App läuft er im Hintergrund weiter, du kannst also zurück zu YouTube wechseln. Unter **Einstellungen > Hintergrund-Import** kannst du Benachrichtigungen erlauben, dann meldet sich Rezeptfang, wenn ein Rezept fertig ist. In Hermit muss die App offen bleiben.
- **Kacheln anpassen:** Lange auf eine Kachel drücken, dann Bild oder Titelkachel wählen und den Bildausschnitt verschieben. Feiner geht der Ausschnitt unter **Bearbeiten**.
- **Vorschaubild aus Screenshot:** Bei Rezepten aus Screenshots oder Fotos über das Kachel-Menü oder unter **Bearbeiten** „Vorschaubild aus Screenshot wählen“. Den Screenshot mit dem Finger verschieben und mit zwei Fingern zoomen, bis das Gericht im Quadrat sitzt.
- **Filtern:** „Nach Tags filtern“ öffnet die Tags. Innerhalb einer Kategorie gilt „oder“, zwischen Kategorien „und“.
- In den Schritten sind die Zutaten mit Mengen markiert und skalieren mit der Personenzahl. Tippen auf einen Schritt hakt ihn ab.
- Fehlende Mengen sind markiert und lassen sich unter **Bearbeiten** ergänzen.

## Sicherung

Die Rezepte liegen nur im Browser deines Handys. Wenn du die Browserdaten von Chrome löschst, sind sie weg. Unter **Einstellungen > Sicherung speichern** ab und zu eine Datei sichern, etwa in Google Drive.

## Updates

Neue Version einer Datei im Repository hochladen und ersetzen. Die App holt sich die neue Version beim nächsten Öffnen mit Internetverbindung, eventuell erst beim zweiten Öffnen.

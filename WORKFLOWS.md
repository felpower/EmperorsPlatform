# Vereinsverwaltung: Dashboard, Games und Tryout

## Admin-Dashboard

Das Dashboard zeigt neue Tryout-Anmeldungen, offene Beitragszeilen über alle Quartale,
Spielerpässe mit Handlungsbedarf und fällige Sponsoren-Follow-ups. Die Kacheln öffnen
die passenden gefilterten Listen. „Refresh overview“ lädt die Übersicht erneut.
Ladefehler werden angezeigt, statt unvollständige Daten als zuverlässig darzustellen.

## Games

Unter „Manage games · Admin“ lassen sich Saison, Gameday, Teams, Datum, Kickoff,
Spielort, Spielstatus, Ergebnis, Stream und Ticketlink pflegen. Neue Saisonen entstehen
mit ihrem ersten Spiel. Beim erneuten Öffnen von Games ist die neueste Saison ausgewählt.
2025/26 bleibt als Archiv erhalten. Eine Spieländerung erfordert kein neues Website-Deployment.

Kickoffs werden in Wiener Ortszeit erfasst. Ein leerer Kickoff bleibt „TBA“ und wird
im Kalender als ganztägiger Termin exportiert. Bestätigte Uhrzeiten werden korrekt
in UTC exportiert; die Sommer-/Winterzeit wird berücksichtigt. Der Export einer Saison
enthält nur Emperors-Spiele. Kalenderdownloads sind einmalige `.ics`-Dateien, kein
automatisch aktualisiertes Kalender-Abo. Für Termine mit Kickoff wird eine Dauer von
drei Stunden verwendet. Abgesagte Spiele werden nicht exportiert.

Die Tabelle neuer Saisonen wird aus eingetragenen Regular-Season-Ergebnissen berechnet:
Siegquote, danach Punktedifferenz. Das ist keine Umsetzung sämtlicher offizieller
ACSL-Tiebreak-Regeln. Die bisherige Archiv-Tabelle bleibt erhalten.

## Tryout

Standardfilter bleibt „New“. Zusätzliche Status: „Attended“, „Did not attend“ und
„Became a member“. „Attendance list“ zeigt eingeladene, anwesende und ausgebliebene
Teilnehmer. Anwesenheit kann einzeln oder für markierte Teilnehmer gespeichert werden.

Admins können anwesende Teilnehmer über „Create / link member“ übernehmen. Dabei
wird nach bestehenden Mitgliedern mit derselben E-Mail gesucht. Neue Einträge starten
als „Pending“. Inaktive oder ausgetretene Mitglieder müssen explizit reaktiviert werden.
Die Registrierung wird anschließend mit dem Mitglied verknüpft. Eine Wiederholung
nach einem Teilfehler erzeugt keinen zweiten Mitgliedereintrag. Eine Übernahme verschickt
keine Account-Einladung; diese erfolgt separat über Members.

Beim E-Mail-Versand werden Versand und Statusspeicherung getrennt ausgewertet.
„Retry status updates“ speichert nur die fehlgeschlagenen Statusänderungen.
„Retry failed emails“ sendet die ursprüngliche Nachricht nur an die ausdrücklich
fehlgeschlagenen Empfänger. Der letzte Versandbericht bleibt im Browser-Tab auch
nach einem Refresh verfügbar. Bei einem Verbindungsabbruch ohne Versandbericht
zuerst den Mailprovider prüfen; es erfolgt keine automatische erneute Aussendung.

## Einheitliche Bedienung

Normalbeiträge werden bis Q3 2026 mit 82,50 € und ab Q4 2026 mit 90 € angelegt.
„Paid Rookie fee“ setzt Beitrag und bezahlten Betrag auf 50 €, auch bei der Sammeländerung.
Beim Wechsel zurück auf „Paid“ wird der Normalbeitrag des jeweiligen Quartals eingesetzt.

Feldbezogene Optionen stehen in `src/modules/club-workflows.js`. Mitgliedschaft,
Beiträge, Spielerpässe, Rollen, Sponsoren, Tryout und Spiele haben jeweils eigene Werte.
Speicheraktionen sperren den betreffenden Button während des Vorgangs. Fehler bleiben
sichtbar und können geschlossen werden. Größere Vorgänge zeigen eine blockierende
Fortschrittsanzeige. Auf schmalen Bildschirmen werden Verwaltungstabellen als Karten
mit Feldbeschriftungen dargestellt; Filter bieten einen gemeinsamen Reset.

## Einrichtung und Prüfung

```sh
npm run setup:workflows -- --dry-run
npm run setup:workflows
npm run test:workflows
npm run functions:check-shared
```

Die additive Migration nutzt den vorhandenen `APPWRITE_API_KEY` aus `.env`. Sie legt
`league_games` mit öffentlichem Leserecht und Schreibrechten für das bestehende
Appwrite-Label `admin` sowie `tryout_registrations.linked_member_id` an. Anschließend
werden die 36 vorhandenen Spiele übernommen. Bestehende Spielzeilen werden bei
erneuter Ausführung nicht überschrieben. Neue Umgebungsvariablen sind nicht nötig.

Die Function `emperors-admin` muss mit den neuen Tasks aktualisiert werden. Bei der
bestehenden Git-Anbindung geschieht dies über Änderungen in `appwrite/functions/admin`
auf `main`. Die Website lädt die neuen Module über `index.html`.

Im anonymen lokalen Vorschaumodus bleiben Änderungen an Games, Tryout-Registrierungen
und Tryout-Übernahmen lokal. Mit einem echten Login arbeitet die App mit Appwrite.
Die Tests simulieren Mailgun und Datenbankfehler und versenden keine echten E-Mails.

# Emperors ⇄ Clubee (Chrome-Erweiterung)

Gleicht die Clubee-Mitgliederliste mit emperors.page ab – in beide Richtungen.

## Installieren (einmalig)
1. Chrome → `chrome://extensions` öffnen, rechts oben **Entwicklermodus** einschalten.
2. **Entpackte Erweiterung laden** → diesen Ordner `tools/clubee-extension` auswählen.

## Clubee → Website
1. In Clubee als Admin einloggen, Mitgliederverwaltung der Gruppe öffnen.
2. Rechts unten **„⇄ Mit emperors.page abgleichen“** klicken: liest alle Mitglieder (alle Seiten) + Lizenzen.
3. emperors.page öffnet sich (als Admin eingeloggt sein) und zeigt den Abgleich:
   - Änderungen (Clubee-Verknüpfung, E-Mail/Telefon nur wo leer, Geburtstag, Lizenz → Spielerpass) ankreuzen → **Übernehmen**.
   - „Nur in Clubee“: optional auf der Website als „pending“ anlegen.

In Clubee wird dabei nichts geändert. Die Daten gehen direkt vom Browser zur Website (kein Server dazwischen); in der Erweiterung bleiben sie höchstens 15 Minuten gespeichert.

## Website → Clubee
Im Abgleich unter „Nur auf der Website“ Personen auswählen → **„Ausgewählte in Clubee anlegen“**. Clubee öffnet „Mitglied hinzufügen“ mit einem Panel: **Einfügen** füllt Vorname/Nachname/E-Mail aus, DSGVO-Bestätigung prüfen, **Speichern** (selbst), dann **Nächste Person**.

Gespeichert wird auf der Website in `member_private` (clubee_id, birthday, phone, clubee_synced_at – nur Admin/Finance lesbar) und `player_passes` (Lizenz).

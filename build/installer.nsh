; Benutzerdefinierter NSIS-Deinstallations-Hook für Loona
; Wird nach dem Haupt-Deinstallationsabschnitt ausgeführt und bietet das Löschen der Benutzerkonfigurationsdateien an.

!macro customUnInstall
  ; Nachfrage, ob die Datei loona-settings.json gelöscht werden soll
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Möchten Sie auch die Konfigurationsdatei löschen?$\r$\n$\r$\nDies entfernt Ihre gespeicherten Einstellungen (loona-settings.json).$\r$\nIhre Zeiterfassungsdaten (loona-data.json) bleiben unberührt, sofern sie an einem anderen Ort gespeichert sind." \
    IDNO loona_skip_config_delete

    Delete "$APPDATA\Loona\loona-settings.json"
    Delete "$APPDATA\Loona\loona.key"
    ; Entfernt das AppData-Verzeichnis nur, wenn es jetzt leer ist
    RMDir "$APPDATA\Loona"

  loona_skip_config_delete:
!macroend

; Custom NSIS uninstall hook for Loona
; Runs after the main uninstall section and offers to delete user config files.

!macro customUnInstall
  ; Ask whether to delete loona-settings.json
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Möchten Sie auch die Konfigurationsdatei löschen?$\r$\n$\r$\nDies entfernt Ihre gespeicherten Einstellungen (loona-settings.json).$\r$\nIhre Zeiterfassungsdaten (loona-data.json) bleiben unberührt, sofern sie an einem anderen Ort gespeichert sind." \
    IDNO loona_skip_config_delete

    Delete "$APPDATA\Loona\loona-settings.json"
    Delete "$APPDATA\Loona\loona.key"
    ; Remove the AppData directory only if it is now empty
    RMDir "$APPDATA\Loona"

  loona_skip_config_delete:
!macroend

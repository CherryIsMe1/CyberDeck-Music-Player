!macro NSIS_HOOK_PREUNINSTALL
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders" "My Music"
  StrCmp $0 "" 0 +2
    StrCpy $0 "$PROFILE\Music"
  ExpandEnvStrings $0 "$0"
  IfFileExists "$0\SNDeck" 0 sndeck_uninstall_done
  MessageBox MB_YESNO|MB_ICONQUESTION "Delete the downloaded music folder and all its contents?$
$
$
$
$0\SNDeck" IDNO sndeck_uninstall_done
  RMDir /r "$0\SNDeck"
  sndeck_uninstall_done:
!macroend

; Uninstalling Pebble (not an update): close it, then take it out of every agent and shell it was added to, so no hook
; is left pointing at a program that is gone. Runs before the files are removed.
!macro customUnInit
  ${ifNot} ${isUpdated}
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quit'
    Sleep 1500
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --remove-hooks'
  ${endIf}
!macroend

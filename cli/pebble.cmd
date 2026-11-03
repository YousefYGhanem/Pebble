@echo off
rem Pebble CLI for cmd, PowerShell and Git Bash: put this folder on your PATH, then `pebble notify "Build done"`.
rem   pebble notify "text" [--kind done^|error^|running] [--title T]
rem   pebble ask "question" [--options A,B] [--title T]
set "EXE=%~dp0pebble-native.exe"
if not exist "%EXE%" set "EXE=%~dp0..\native\out\pebble-native.exe"
"%EXE%" cli %*
exit /b %ERRORLEVEL%

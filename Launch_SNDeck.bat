@echo off
title SNDECK MUSIC PLAYER
chcp 65001 >nul
cls

echo ======================================================================
echo           SNDECK // MUSIC PLAYER
echo ======================================================================
echo.
echo [!] Launching SNDeck...
echo.

cd /d "%~dp0"

:: Check for Firefox or Edge and use clean app window if possible
if exist "C:\Program Files\Mozilla Firefox\firefox.exe" (
    start "" "C:\Program Files\Mozilla Firefox\firefox.exe" "%~dp0index.html"
    exit /b
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%~dp0index.html"
    exit /b
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%~dp0index.html"
    exit /b
)

:: Default Windows browser
start "" "%~dp0index.html"
exit /b

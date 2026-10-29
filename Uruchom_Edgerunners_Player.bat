@echo off
title EDGERUNNERS NEURAL AUDIO DECK 2077
chcp 65001 >nul
cls

echo ======================================================================
echo           CYBERPUNK EDGERUNNERS // NEURAL AUDIO DECK 2077
echo ======================================================================
echo.
echo [!] Uruchamianie odtwarzacza muzyki w interfejsie Night City...
echo.

cd /d "%~dp0"

:: Sprawdz czy Firefox lub Edge jest zainstalowany i uzyj czystego okna app jezeli mozliwe
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

:: Domyslna przegladarka systemu Windows
start "" "%~dp0index.html"
exit /b

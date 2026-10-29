@echo off
title EDGERUNNERS NEURAL AUDIO DECK 2077
chcp 65001 >nul
cls

echo ======================================================================
echo           CYBERPUNK EDGERUNNERS // NEURAL AUDIO DECK 2077
echo ======================================================================
echo.
echo [!] Launching the music player in Night City interface...
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

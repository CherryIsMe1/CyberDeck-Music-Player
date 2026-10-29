@echo off
title CYBERDECK // SPOTIFY & YOUTUBE 320K MP3 RIPPER
chcp 65001 >nul
cls

echo ======================================================================
echo       CYBERDECK // NETRUNNER MP3 RIPPER (SPOTIFY, YT, SOUNDCLOUD)
echo ======================================================================
echo.
echo [!] This script downloads full tracks at 320 kbps with cover art and ID3 tags.
echo.

set "BIN_DIR=%~dp0bin"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
set "OUTPUT_DIR=%~dp0Downloaded_Music"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

set "YTDLP=%BIN_DIR%\yt-dlp.exe"

if not exist "%YTDLP%" (
    echo [i] Downloading yt-dlp.exe engine from the official GitHub repository...
    curl -L -o "%YTDLP%" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    if not exist "%YTDLP%" (
        echo [ERROR] Failed to download yt-dlp.exe. Check your internet connection.
        pause
        exit /b 1
    )
    echo [OK] yt-dlp engine installed successfully!
    echo.
)

:prompt_url
echo ----------------------------------------------------------------------
echo Paste a song / playlist link (Spotify, YouTube, SoundCloud):
echo (Right-click in the console window to paste)
echo ----------------------------------------------------------------------
set /p TARGET_URL=">> "

if "%TARGET_URL%"=="" (
    echo [!] No link provided. Please try again.
    goto prompt_url
)

echo.
echo [!] Starting download and conversion to 320 kbps MP3 with cover art...
echo.

"%YTDLP%" -x --audio-format mp3 --audio-quality 320K --add-metadata --embed-thumbnail -o "%OUTPUT_DIR%\%%(title)s.%%(ext)s" "%TARGET_URL%"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo [SUCCESS] Track downloaded to folder:
    echo "%OUTPUT_DIR%"
    echo.
    echo You can now drag the downloaded MP3 file into the player!
    echo ======================================================================
    start "" "%OUTPUT_DIR%"
) else (
    echo.
    echo [WARNING] If the download failed, check that the link is public.
)

echo.
echo Press any key to download another track, or close this window.
pause >nul
cls
goto prompt_url

@echo off
title CYBERDECK // SPOTIFY & YOUTUBE 320K MP3 RIPPER
chcp 65001 >nul
cls

echo ======================================================================
echo       CYBERDECK // NETRUNNER MP3 RIPPER (SPOTIFY, YT, SOUNDCLOUD)
echo ======================================================================
echo.
echo [!] Ten skrypt pobiera PEŁNE utwory w jakości 320 kbps z okładkami i tagami ID3.
echo.

set "BIN_DIR=%~dp0bin"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
set "OUTPUT_DIR=%~dp0Downloaded_Music"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

set "YTDLP=%BIN_DIR%\yt-dlp.exe"

if not exist "%YTDLP%" (
    echo [i] Pobieranie silnika yt-dlp.exe z oficjalnego repozytorium GitHub...
    curl -L -o "%YTDLP%" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    if not exist "%YTDLP%" (
        echo [BLAD] Nie udalo sie pobrac yt-dlp.exe. Sprawdz polaczenie z internetem.
        pause
        exit /b 1
    )
    echo [OK] Silnik yt-dlp pomyslnie zainstalowany!
    echo.
)

:prompt_url
echo ----------------------------------------------------------------------
echo Wklej link do piosenki / playlisty (Spotify, YouTube, SoundCloud):
echo (Kliknij prawym przyciskiem myszy w konsoli, aby wkleic)
echo ----------------------------------------------------------------------
set /p TARGET_URL=">> "

if "%TARGET_URL%"=="" (
    echo [!] Nie podano linku. Sprobuj ponownie.
    goto prompt_url
)

echo.
echo [!] Rozpoczynanie pobierania i konwersji do 320 kbps MP3 z okladka...
echo.

"%YTDLP%" -x --audio-format mp3 --audio-quality 320K --add-metadata --embed-thumbnail -o "%OUTPUT_DIR%\%%(title)s.%%(ext)s" "%TARGET_URL%"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo [SUKCES] Utwor pobrany do folderu:
    echo "%OUTPUT_DIR%"
    echo.
    echo Mozesz teraz przeciagnac pobrany plik MP3 do odtwarzacza w przegladarce!
    echo ======================================================================
    start "" "%OUTPUT_DIR%"
) else (
    echo.
    echo [UWAGA] Jezeli pobieranie nie powiodlo sie, sprawdz czy link jest publiczny.
)

echo.
echo Wcisnij dowolny klawisz, aby pobrac kolejny utwor, lub zamknij to okno.
pause >nul
cls
goto prompt_url

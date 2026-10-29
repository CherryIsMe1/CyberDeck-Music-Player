// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;

#[derive(Debug, Serialize, Deserialize)]
pub struct RippedTrackResult {
    pub success: bool,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub year: String,
    pub duration: u32,
    #[serde(rename = "coverArt")]
    pub cover_art: String,
}

/// Finds or downloads yt-dlp, returning the path to the executable.
async fn get_or_download_ytdlp() -> Result<PathBuf, String> {
    // 1. Check if yt-dlp is on PATH
    let in_path = tokio::task::spawn_blocking(|| {
        std::process::Command::new("yt-dlp")
            .arg("--version")
            .output()
            .is_ok()
    })
    .await
    .unwrap_or(false);

    if in_path {
        return Ok(PathBuf::from("yt-dlp"));
    }

    // 2. Check app-local dir
    let local_dir = dirs::data_local_dir()
        .ok_or_else(|| "Cannot determine local data directory".to_string())?
        .join("Cyberdeck")
        .join("bin");

    #[cfg(target_os = "windows")]
    let ytdlp_path = local_dir.join("yt-dlp.exe");
    #[cfg(not(target_os = "windows"))]
    let ytdlp_path = local_dir.join("yt-dlp");

    if ytdlp_path.exists() {
        return Ok(ytdlp_path);
    }

    // 3. Download yt-dlp
    println!("[Cyberdeck] yt-dlp not found — downloading to {:?}", ytdlp_path);
    std::fs::create_dir_all(&local_dir)
        .map_err(|e| format!("Cannot create bin dir: {}", e))?;

    #[cfg(target_os = "windows")]
    let download_url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
    #[cfg(not(target_os = "windows"))]
    let download_url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

    let dest_str = ytdlp_path.to_string_lossy().to_string();
    let status = tokio::task::spawn_blocking(move || {
        std::process::Command::new("curl")
            .args(["-L", "-o", &dest_str, download_url])
            .status()
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))?
    .map_err(|e| format!("curl error: {}", e))?;

    if !status.success() {
        return Err("Failed to download yt-dlp via curl".to_string());
    }

    // chmod +x on Linux/Mac
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&ytdlp_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&ytdlp_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(ytdlp_path)
}

/// Native command invoked from frontend: window.__TAURI__.core.invoke('rip_audio_stream', { url, quality })
#[tauri::command]
async fn rip_audio_stream(url: String, quality: String) -> Result<RippedTrackResult, String> {
    println!("[Cyberdeck Native Ripper] Target URL: {}, Quality: {}", url, quality);

    // Warn about ffmpeg (yt-dlp needs it for audio conversion)
    let ffmpeg_ok = tokio::task::spawn_blocking(|| {
        std::process::Command::new("ffmpeg")
            .arg("-version")
            .output()
            .is_ok()
    })
    .await
    .unwrap_or(false);

    if !ffmpeg_ok {
        println!("[Cyberdeck] WARNING: ffmpeg not found in PATH. yt-dlp may not be able to convert audio.");
    }

    // Resolve yt-dlp
    let ytdlp_path = get_or_download_ytdlp().await?;

    // Resolve music directory
    let mut music_dir = dirs::audio_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .map(|h| h.join("Music"))
            .unwrap_or_else(|| PathBuf::from("./Music"))
    });
    music_dir.push("Cyberdeck");
    std::fs::create_dir_all(&music_dir)
        .map_err(|e| format!("Cannot create music dir: {}", e))?;

    let output_template = music_dir.join("%(title)s.%(ext)s");
    let bit_rate = match quality.as_str() {
        "192k" => "192K",
        "256k" => "256K",
        _ => "320K",
    };

    // Record timestamp BEFORE running yt-dlp so we can find the new file
    let before_time = SystemTime::now();

    // Run yt-dlp
    let ytdlp_str = ytdlp_path.to_string_lossy().to_string();
    let output_str = output_template.to_string_lossy().to_string();
    let url_clone = url.clone();

    let status = tokio::task::spawn_blocking(move || {
        std::process::Command::new(&ytdlp_str)
            .arg("-x")                           // Extract audio
            .arg("--audio-format").arg("mp3")    // Convert to MP3
            .arg("--audio-quality").arg(bit_rate)
            .arg("--add-metadata")               // Embed ID3 tags
            .arg("--embed-thumbnail")            // Embed cover art (needs ffmpeg)
            .arg("--no-playlist")                // Never download whole playlists
            .arg("-o").arg(&output_str)
            .arg(&url_clone)
            .status()
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))?
    .map_err(|e| {
        format!(
            "yt-dlp is not installed or not in PATH. Please install yt-dlp{} Error: {}",
            if !ffmpeg_ok { " and ffmpeg." } else { "." },
            e
        )
    })?;

    if !status.success() {
        return Err(format!(
            "yt-dlp process returned non-zero exit status.{}",
            if !ffmpeg_ok { " Note: ffmpeg was not found — it is required for audio conversion." } else { "" }
        ));
    }

    // Scan music_dir for MP3 files newer than before_time
    let new_file = std::fs::read_dir(&music_dir)
        .map_err(|e| format!("Cannot read music dir: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let name = entry.file_name();
            let name_str = name.to_string_lossy().to_lowercase();
            name_str.ends_with(".mp3")
        })
        .filter(|entry| {
            entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|modified| modified > before_time)
                .unwrap_or(false)
        })
        .max_by_key(|entry| {
            entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(SystemTime::UNIX_EPOCH)
        });

    match new_file {
        Some(entry) => {
            let path = entry.path();
            let title = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let file_path_str = path.to_string_lossy().to_string();

            Ok(RippedTrackResult {
                success: true,
                file_path: file_path_str,
                title,
                artist: "Snake Nation Ripper".to_string(),
                album: "Nomad Deck".to_string(),
                year: "2077".to_string(),
                duration: 0,
                cover_art: String::new(),
            })
        }
        None => Err(format!(
            "yt-dlp reported success but no new MP3 was found in {:?}. {}",
            music_dir,
            if !ffmpeg_ok { "ffmpeg is required to convert to MP3 and was not found." } else { "" }
        )),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![rip_audio_stream])
        .run(tauri::generate_context!())
        .expect("error while running Cyberdeck player");
}

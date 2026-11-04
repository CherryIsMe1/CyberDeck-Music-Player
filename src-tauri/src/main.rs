// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
        .join("SNDeck")
        .join("bin");

    #[cfg(target_os = "windows")]
    let ytdlp_path = local_dir.join("yt-dlp.exe");
    #[cfg(not(target_os = "windows"))]
    let ytdlp_path = local_dir.join("yt-dlp");

    if ytdlp_path.exists() {
        return Ok(ytdlp_path);
    }

    // 3. Download yt-dlp
    println!("[SNDeck] yt-dlp not found — downloading to {:?}", ytdlp_path);
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

/// Native command invoked from frontend: window.__TAURI__.core.invoke('read_audio_files_in_dir', { dirPath: folder })
#[tauri::command]
async fn read_audio_files_in_dir(dir_path: String) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let mut audio_paths = Vec::new();
        fn scan_dir(dir: &std::path::Path, paths: &mut Vec<String>) {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        scan_dir(&path, paths);
                    } else if path.is_file() {
                        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                            let ext_lower = ext.to_lowercase();
                            if matches!(
                                ext_lower.as_str(),
                                "mp3" | "m4a" | "flac" | "wav" | "ogg" | "aac" | "webm" | "opus"
                            ) {
                                paths.push(path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
        scan_dir(std::path::Path::new(&dir_path), &mut audio_paths);
        audio_paths.sort();
        Ok(audio_paths)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Native command invoked from frontend: window.__TAURI__.core.invoke('rip_audio_stream', { url, quality })
#[tauri::command]
async fn rip_audio_stream(url: String, quality: String) -> Result<Vec<RippedTrackResult>, String> {
    println!("[SNDeck Native Ripper] Target URL: {}, Quality: {}", url, quality);

    // 1. Check for ffmpeg in PATH or in local SNDeck bin
    let local_bin = dirs::data_local_dir().map(|d| d.join("SNDeck").join("bin"));
    let local_ffmpeg = local_bin.as_ref().map(|b| {
        #[cfg(target_os = "windows")]
        { b.join("ffmpeg.exe") }
        #[cfg(not(target_os = "windows"))]
        { b.join("ffmpeg") }
    });
    let ffmpeg_in_local = local_ffmpeg.as_ref().map(|p| p.exists()).unwrap_or(false);

    let ffmpeg_in_path = tokio::task::spawn_blocking(|| {
        std::process::Command::new("ffmpeg")
            .arg("-version")
            .output()
            .is_ok()
    })
    .await
    .unwrap_or(false);

    let ffmpeg_ok = ffmpeg_in_path || ffmpeg_in_local;
    if !ffmpeg_ok {
        println!("[SNDeck] ffmpeg not found — downloading native audio format without transcoding.");
    }

    // 2. Resolve yt-dlp executable
    let ytdlp_path = get_or_download_ytdlp().await?;

    // 3. Resolve music directory
    let mut music_dir = dirs::audio_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .map(|h| h.join("Music"))
            .unwrap_or_else(|| PathBuf::from("./Music"))
    });
    music_dir.push("SNDeck");
    std::fs::create_dir_all(&music_dir)
        .map_err(|e| format!("Cannot create music dir: {}", e))?;

    let output_template = music_dir.join("%(title)s [%(id)s].%(ext)s");
    let bit_rate = match quality.as_str() {
        "192k" => "192K",
        "256k" => "256K",
        _ => "320K",
    };

    // 4. Run yt-dlp
    let ytdlp_str = ytdlp_path.to_string_lossy().to_string();
    let output_str = output_template.to_string_lossy().to_string();
    let url_clone = url.clone();
    let local_bin_clone = local_bin.clone();

    let output_res = tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new(&ytdlp_str);

        if ffmpeg_in_local {
            if let Some(ref bin_dir) = local_bin_clone {
                cmd.arg("--ffmpeg-location").arg(bin_dir);
            }
        }

        if ffmpeg_ok {
            // Full MP3 conversion + metadata + cover art
            cmd.arg("-x")
                .arg("--audio-format").arg("mp3")
                .arg("--audio-quality").arg(bit_rate)
                .arg("--add-metadata")
                .arg("--embed-thumbnail");
        } else {
            // Native audio stream (m4a/webm) without requiring ffmpeg
            cmd.arg("-f").arg("ba[ext=m4a]/ba/b");
        }

        cmd.arg("--yes-playlist")
            .arg("--print").arg("after_move:filepath")
            .arg("-o").arg(&output_str)
            .arg(&url_clone)
            .output()
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))?
    .map_err(|e| format!("Failed to launch yt-dlp: {}", e))?;

    if !output_res.status.success() {
        let stderr = String::from_utf8_lossy(&output_res.stderr);
        let last_err_line = stderr
            .lines()
            .rev()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("yt-dlp process returned non-zero exit status");
        return Err(format!("yt-dlp error: {}", last_err_line));
    }

    // yt-dlp prints each finalized path, supporting single videos and playlists.
    let printed_paths = String::from_utf8_lossy(&output_res.stdout);
    let mut results = Vec::new();
    for printed_path in printed_paths.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let path = PathBuf::from(printed_path);
        if !path.is_file() { continue; }
        let title = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
        results.push(RippedTrackResult {
            success: true, file_path: path.to_string_lossy().to_string(), title,
            artist: "Snake Nation".to_string(), album: "SNDeck".to_string(),
            year: String::new(), duration: 0, cover_art: String::new(),
        });
    }
    if results.is_empty() { return Err("yt-dlp completed but did not report any downloaded audio files".to_string()); }
    Ok(results)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            rip_audio_stream,
            read_audio_files_in_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running SNDeck player");
}

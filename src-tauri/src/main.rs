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

fn deno_version_supported(executable: &std::path::Path) -> bool {
    let output = match std::process::Command::new(executable).arg("--version").output() {
        Ok(output) if output.status.success() => output,
        _ => return false,
    };
    let version_line = String::from_utf8_lossy(&output.stdout);
    let version = match version_line.split_whitespace().nth(1) {
        Some(version) => version,
        None => return false,
    };
    let mut parts = version.split('.');
    let major = parts.next().and_then(|part| part.parse::<u32>().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|part| part.parse::<u32>().ok()).unwrap_or(0);
    major > 2 || (major == 2 && minor >= 3)
}

/// Finds or downloads a supported JavaScript runtime for YouTube extraction.
#[cfg(target_os = "windows")]
async fn get_or_download_deno() -> Result<PathBuf, String> {
    let local_dir = dirs::data_local_dir()
        .ok_or_else(|| "Cannot determine local data directory".to_string())?
        .join("SNDeck")
        .join("bin");

    let in_path = tokio::task::spawn_blocking(|| deno_version_supported(std::path::Path::new("deno")))
        .await
        .unwrap_or(false);
    if in_path {
        return Ok(PathBuf::from("deno"));
    }

    let deno_path = local_dir.join("deno.exe");
    if deno_version_supported(&deno_path) {
        return Ok(deno_path);
    }

    std::fs::create_dir_all(&local_dir)
        .map_err(|e| format!("Cannot create SNDeck bin directory: {}", e))?;
    #[cfg(target_arch = "x86_64")]
    let download_url = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";
    #[cfg(target_arch = "aarch64")]
    let download_url = "https://github.com/denoland/deno/releases/latest/download/deno-aarch64-pc-windows-msvc.zip";
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    let download_url = return Err("SNDeck cannot provision Deno for this Windows architecture. Install Deno 2.3+ and retry.".to_string());

    let zip_path = local_dir.join("deno-runtime.zip");
    let zip_string = zip_path.to_string_lossy().to_string();
    let url = download_url.to_string();
    let download_status = tokio::task::spawn_blocking(move || {
        std::process::Command::new("curl")
            .args(["-fL", "--retry", "2", "-o", &zip_string, &url])
            .status()
    })
    .await
    .map_err(|e| format!("Deno download task failed: {}", e))?
    .map_err(|e| format!("Cannot start curl to download Deno: {}", e))?;
    if !download_status.success() {
        return Err("Could not download Deno. Install Deno 2.3+ and retry the YouTube rip.".to_string());
    }

    let zip_escaped = zip_path.to_string_lossy().replace("'", "''");
    let dir_escaped = local_dir.to_string_lossy().replace("'", "''");
    let extract_script = format!(
        "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath '{}' -DestinationPath '{}' -Force",
        zip_escaped, dir_escaped
    );
    let extract_status = tokio::task::spawn_blocking(move || {
        std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &extract_script])
            .status()
    })
    .await
    .map_err(|e| format!("Deno extraction task failed: {}", e))?
    .map_err(|e| format!("Cannot start PowerShell to extract Deno: {}", e))?;
    let _ = std::fs::remove_file(&zip_path);
    if !extract_status.success() || !deno_path.exists() {
        return Err("Deno downloaded but could not be installed. Install Deno 2.3+ manually and retry.".to_string());
    }
    Ok(deno_path)
}

#[cfg(not(target_os = "windows"))]
async fn get_or_download_deno() -> Result<PathBuf, String> {
    let in_path = tokio::task::spawn_blocking(|| deno_version_supported(std::path::Path::new("deno")))
        .await
        .unwrap_or(false);
    if in_path {
        Ok(PathBuf::from("deno"))
    } else {
        Err("Install Deno 2.3+ to enable full YouTube support, then retry.".to_string())
    }
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

    // YouTube now requires an external JavaScript runtime for full extraction.
    let youtube_url = url.contains("youtube.com") || url.contains("youtu.be");
    let js_runtime = if youtube_url { Some(get_or_download_deno().await?) } else { None };

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
    let before_time = SystemTime::now();

    let output_res = tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new(&ytdlp_str);
        if let Some(ref runtime) = js_runtime {
            cmd.arg("--js-runtimes")
                .arg(format!("deno:{}", runtime.to_string_lossy()));
        }

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
        let details = stderr
            .lines()
            .filter(|line| !line.trim().is_empty())
            .rev()
            .take(6)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        return Err(format!("yt-dlp failed: {}", if details.is_empty() { "process returned a non-zero exit status" } else { &details }));
    }

    // Use both yt-dlp's finalized-path output and the filesystem timestamp scan.
    // The scan preserves the previously working Windows behavior and finds every
    // newly downloaded playlist item even if yt-dlp emits no --print line.
    let mut results = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();
    let printed_paths = String::from_utf8_lossy(&output_res.stdout);
    for printed_path in printed_paths.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let path = PathBuf::from(printed_path);
        if path.is_file() && seen_paths.insert(path.to_string_lossy().to_lowercase()) {
            let title = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            results.push(RippedTrackResult {
                success: true, file_path: path.to_string_lossy().to_string(), title,
                artist: "Snake Nation".to_string(), album: "SNDeck".to_string(),
                year: String::new(), duration: 0, cover_art: String::new(),
            });
        }
    }

    let recent_files = std::fs::read_dir(&music_dir)
        .map_err(|e| format!("Cannot scan SNDeck music folder: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            [".mp3", ".m4a", ".webm", ".opus", ".ogg", ".wav", ".flac", ".aac"]
                .iter().any(|ext| name.ends_with(ext))
        })
        .filter(|entry| entry.metadata().ok().and_then(|meta| meta.modified().ok())
            .map(|modified| modified >= before_time).unwrap_or(false));
    for entry in recent_files {
        let path = entry.path();
        if seen_paths.insert(path.to_string_lossy().to_lowercase()) {
            let title = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            results.push(RippedTrackResult {
                success: true, file_path: path.to_string_lossy().to_string(), title,
                artist: "Snake Nation".to_string(), album: "SNDeck".to_string(),
                year: String::new(), duration: 0, cover_art: String::new(),
            });
        }
    }

    results.sort_by(|a, b| a.file_path.to_lowercase().cmp(&b.file_path.to_lowercase()));
    if results.is_empty() {
        return Err("yt-dlp finished but no new audio files were found. Check its output and try again.".to_string());
    }
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

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::SystemTime;
use tauri::Emitter;

static DENO_RUNTIME_PATH: OnceLock<PathBuf> = OnceLock::new();
static YTDLP_EXECUTABLE_PATH: OnceLock<PathBuf> = OnceLock::new();

fn emit_ripper_status(app: &tauri::AppHandle, message: &str, kind: &str, progress: u8) {
    let _ = app.emit(
        "sndeck-ripper-status",
        serde_json::json!({ "message": message, "kind": kind, "progress": progress }),
    );
}

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
    if let Some(path) = DENO_RUNTIME_PATH.get() {
        return Ok(path.clone());
    }

    let local_dir = dirs::data_local_dir()
        .ok_or_else(|| "Cannot determine local data directory".to_string())?
        .join("SNDeck")
        .join("bin");

    let in_path = tokio::task::spawn_blocking(|| deno_version_supported(std::path::Path::new("deno")))
        .await
        .unwrap_or(false);
    if in_path {
        let path = PathBuf::from("deno");
        let _ = DENO_RUNTIME_PATH.set(path.clone());
        return Ok(path);
    }

    let deno_path = local_dir.join("deno.exe");
    if deno_version_supported(&deno_path) {
        let _ = DENO_RUNTIME_PATH.set(deno_path.clone());
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
    let _ = DENO_RUNTIME_PATH.set(deno_path.clone());
    Ok(deno_path)
}

#[cfg(not(target_os = "windows"))]
async fn get_or_download_deno() -> Result<PathBuf, String> {
    if let Some(path) = DENO_RUNTIME_PATH.get() {
        return Ok(path.clone());
    }

    let in_path = tokio::task::spawn_blocking(|| deno_version_supported(std::path::Path::new("deno")))
        .await
        .unwrap_or(false);
    if in_path {
        let path = PathBuf::from("deno");
        let _ = DENO_RUNTIME_PATH.set(path.clone());
        Ok(path)
    } else {
        Err("Install Deno 2.3+ to enable full YouTube support, then retry.".to_string())
    }
}

/// Finds or downloads yt-dlp, returning the path to the executable.
async fn get_or_download_ytdlp() -> Result<PathBuf, String> {
    if let Some(path) = YTDLP_EXECUTABLE_PATH.get() {
        return Ok(path.clone());
    }

    // 1. Check if yt-dlp is on PATH
    let in_path = tokio::task::spawn_blocking(|| {
        std::process::Command::new("yt-dlp")
            .arg("--version")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false);

    if in_path {
        let path = PathBuf::from("yt-dlp");
        let _ = YTDLP_EXECUTABLE_PATH.set(path.clone());
        return Ok(path);
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

    let local_works = tokio::task::spawn_blocking({
        let path = ytdlp_path.clone();
        move || std::process::Command::new(path).arg("--version").output()
            .map(|output| output.status.success()).unwrap_or(false)
    })
    .await
    .unwrap_or(false);
    if local_works {
        let _ = YTDLP_EXECUTABLE_PATH.set(ytdlp_path.clone());
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
            .args(["-fL", "--retry", "2", "-o", &dest_str, download_url])
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

    let _ = YTDLP_EXECUTABLE_PATH.set(ytdlp_path.clone());
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
                    // Do not follow directory symlinks: a selected folder may
                    // contain links back to a parent (or to unrelated folders).
                    let file_type = match entry.file_type() {
                        Ok(file_type) => file_type,
                        Err(_) => continue,
                    };
                    if file_type.is_dir() {
                        scan_dir(&path, paths);
                    } else if file_type.is_file() {
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
async fn rip_audio_stream(app: tauri::AppHandle, url: String, quality: String) -> Result<Vec<RippedTrackResult>, String> {
    println!("[SNDeck Native Ripper] Target URL: {}, Quality: {}", url, quality);
    emit_ripper_status(&app, "Checking audio tools...", "info", 8);

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
            .map(|output| output.status.success())
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false);

    let ffmpeg_ok = ffmpeg_in_path || ffmpeg_in_local;
    if !ffmpeg_ok {
        println!("[SNDeck] ffmpeg not found — downloading native audio format without transcoding.");
    }

    // YouTube now requires an external JavaScript runtime for full extraction.
    let normalized_url = url.to_ascii_lowercase();
    let youtube_url = normalized_url.contains("youtube.com") || normalized_url.contains("youtu.be");
    let js_runtime = if youtube_url {
        emit_ripper_status(&app, "Checking YouTube JavaScript runtime...", "info", 15);
        let runtime = get_or_download_deno().await?;
        emit_ripper_status(&app, "JavaScript runtime ready.", "success", 25);
        Some(runtime)
    } else {
        None
    };

    // 2. Resolve yt-dlp executable
    emit_ripper_status(&app, "Preparing yt-dlp...", "info", 30);
    let ytdlp_path = get_or_download_ytdlp().await?;
    emit_ripper_status(&app, "yt-dlp is resolving and downloading now. Large playlists can take several minutes.", "system", 40);

    // 3. Resolve music directory
    let mut music_dir = dirs::audio_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .map(|h| h.join("Music"))
            .unwrap_or_else(|| PathBuf::from("./Music"))
    });
    music_dir.push("SNDeck");
    std::fs::create_dir_all(&music_dir)
        .map_err(|e| format!("Cannot create music dir: {}", e))?;

    let run_id = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let rip_dir = music_dir.join(format!(".rip-{}-{}", std::process::id(), run_id));
    std::fs::create_dir_all(&rip_dir)
        .map_err(|e| format!("Cannot create temporary rip folder: {}", e))?;
    let output_template = rip_dir.join("%(title)s [%(id)s].%(ext)s");
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
            .arg("--write-info-json")
            .arg("-o").arg(&output_str)
            .arg(&url_clone)
            .output()
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))?
    .map_err(|e| format!("Failed to launch yt-dlp: {}", e))?;

    if !output_res.status.success() {
        let _ = std::fs::remove_dir_all(&rip_dir);
        let stderr = String::from_utf8_lossy(&output_res.stderr);
        let stdout = String::from_utf8_lossy(&output_res.stdout);
        let details = stderr.lines().chain(stdout.lines())
            .filter(|line| !line.trim().is_empty())
            .rev().take(8).collect::<Vec<_>>()
            .into_iter().rev().collect::<Vec<_>>().join("\n");
        return Err(format!("yt-dlp failed: {}", if details.is_empty() { "process returned a non-zero exit status" } else { &details }));
    }

    emit_ripper_status(&app, "yt-dlp finished. Adding downloaded tracks to the library...", "info", 90);

    // Each rip uses a fresh output folder. This reliably collects every item,
    // including a single track and playlist entries even when yt-dlp skips its
    // --print output or the same title/ID already exists in the library folder.
    let audio_extensions = ["mp3", "m4a", "webm", "opus", "ogg", "wav", "flac", "aac"];
    let mut downloaded = std::fs::read_dir(&rip_dir)
        .map_err(|e| format!("Cannot read temporary rip folder: {}", e))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && path.extension().and_then(|ext| ext.to_str())
            .map(|ext| audio_extensions.iter().any(|audio_ext| ext.eq_ignore_ascii_case(audio_ext)))
            .unwrap_or(false))
        .collect::<Vec<_>>();
    downloaded.sort();

    let mut results = Vec::new();
    for source_path in downloaded {
        let file_name = source_path.file_name().ok_or_else(|| "Downloaded audio file has no filename".to_string())?;
        let info_path = source_path.with_extension("info.json");
        let destination = music_dir.join(file_name);
        if destination.exists() {
            std::fs::remove_file(&source_path)
                .map_err(|e| format!("Cannot clean duplicate temporary download: {}", e))?;
        } else {
            std::fs::rename(&source_path, &destination)
                .map_err(|e| format!("Cannot move downloaded audio into SNDeck library: {}", e))?;
        }
        let path = if destination.exists() { destination } else { source_path.clone() };
        let info = std::fs::read(&info_path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
            .unwrap_or_else(|| serde_json::json!({}));
        let file_title = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let fallback_title = file_title
            .rsplit_once(" [")
            .filter(|(_, suffix)| suffix.ends_with(']'))
            .map(|(title, _)| title)
            .unwrap_or(&file_title);
        let title = info.get("title").and_then(|value| value.as_str())
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(fallback_title)
            .to_string();
        let listed_artists = info.get("artists").and_then(|value| value.as_array())
            .map(|artists| artists.iter().filter_map(|artist| artist.as_str()).collect::<Vec<_>>().join(", "))
            .filter(|artists| !artists.trim().is_empty());
        let artist = info.get("artist").and_then(|value| value.as_str())
            .filter(|value| !value.trim().is_empty())
            .or_else(|| listed_artists.as_deref())
            .or_else(|| info.get("creator").and_then(|value| value.as_str()))
            .or_else(|| info.get("uploader").and_then(|value| value.as_str()))
            .unwrap_or("Unknown Artist")
            .to_string();
        let album = info.get("album").and_then(|value| value.as_str())
            .filter(|value| !value.trim().is_empty())
            .or_else(|| info.get("playlist_title").and_then(|value| value.as_str()))
            .unwrap_or("Unknown Album")
            .to_string();
        let year = info.get("release_year").and_then(|value| value.as_i64())
            .map(|year| year.to_string())
            .or_else(|| info.get("upload_date").and_then(|value| value.as_str())
                .filter(|date| date.len() >= 4)
                .map(|date| date[..4].to_string()))
            .unwrap_or_default();
        let duration = info.get("duration").and_then(|value| value.as_f64())
            .map(|seconds| seconds.max(0.0) as u32)
            .unwrap_or(0);
        let cover_art = info.get("thumbnail").and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string();
        results.push(RippedTrackResult {
            success: true,
            file_path: path.to_string_lossy().to_string(),
            title,
            artist,
            album,
            year,
            duration,
            cover_art,
        });
    }
    let _ = std::fs::remove_dir_all(&rip_dir);
    if results.is_empty() {
        let stderr = String::from_utf8_lossy(&output_res.stderr);
        let stdout = String::from_utf8_lossy(&output_res.stdout);
        let details = stderr.lines().chain(stdout.lines())
            .filter(|line| !line.trim().is_empty())
            .rev().take(8).collect::<Vec<_>>()
            .into_iter().rev().collect::<Vec<_>>().join("\n");
        return Err(format!("yt-dlp finished without audio files. {}", if details.is_empty() { "No audio output was reported." } else { &details }));
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

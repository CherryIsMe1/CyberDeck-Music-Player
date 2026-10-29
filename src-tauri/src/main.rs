// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::process::Command;
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

/// Native command invoked from frontend: window.__TAURI__.invoke('rip_audio_stream', { url, quality })
#[tauri::command]
async fn rip_audio_stream(url: String, quality: String) -> Result<RippedTrackResult, String> {
    println!("[Cyberdeck Native Ripper] Target URL: {}, Quality: {}", url, quality);

    // Resolve user's default music directory
    let mut music_dir = dirs::audio_dir().unwrap_or_else(|| {
        dirs::home_dir().map(|h| h.join("Music")).unwrap_or_else(|| PathBuf::from("./Music"))
    });
    music_dir.push("Cyberdeck");
    let _ = std::fs::create_dir_all(&music_dir);

    // Output template for yt-dlp: "%(artist)s - %(title)s.%(ext)s"
    let output_template = music_dir.join("%(title)s.%(ext)s");

    // Execute yt-dlp to download and convert to MP3 with embedded metadata & thumbnail
    let bit_rate = match quality.as_str() {
        "192k" => "192K",
        "256k" => "256K",
        _ => "320K",
    };

    let status = Command::new("yt-dlp")
        .arg("-x")                          // Extract audio
        .arg("--audio-format").arg("mp3")   // Convert to MP3
        .arg("--audio-quality").arg(bit_rate)
        .arg("--add-metadata")              // Embed ID3 tags
        .arg("--embed-thumbnail")           // Embed high-res cover art
        .arg("-o").arg(output_template.to_string_lossy().to_string())
        .arg(&url)
        .status();

    match status {
        Ok(s) if s.success() => {
            Ok(RippedTrackResult {
                success: true,
                file_path: format!("file://{}", music_dir.to_string_lossy()),
                title: "Decrypted Stream".to_string(),
                artist: "Snake Nation Ripper".to_string(),
                album: "Nomad Deck".to_string(),
                year: "2077".to_string(),
                duration: 210,
                cover_art: "assets/omi_portrait.png".to_string(),
            })
        }
        Ok(_) => {
            Err("yt-dlp process returned non-zero exit status.".to_string())
        }
        Err(e) => {
            Err(format!(
                "yt-dlp is not installed or not in PATH. Please install yt-dlp & ffmpeg. Error: {}",
                e
            ))
        }
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![rip_audio_stream])
        .run(tauri::generate_context!())
        .expect("error while running Cyberdeck player");
}

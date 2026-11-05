use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

/// Streams local audio through loopback HTTP. WebKitGTK can fetch and range-seek
/// these URLs, while its media loader rejects Tauri's custom asset protocol.
pub struct LocalAudioServer {
    port: u16,
    token: String,
    files: Arc<Mutex<HashMap<u64, PathBuf>>>,
    next_id: AtomicU64,
}

impl LocalAudioServer {
    pub fn start() -> std::io::Result<Self> {
        let listener = TcpListener::bind(("127.0.0.1", 0))?;
        let port = listener.local_addr()?.port();
        let token = format!("{}-{}", std::process::id(), SystemTime::now()
            .duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos());
        let files = Arc::new(Mutex::new(HashMap::new()));
        let server_files = Arc::clone(&files);
        let server_token = token.clone();

        std::thread::Builder::new()
            .name("sndeck-local-audio".into())
            .spawn(move || {
                for connection in listener.incoming() {
                    if let Ok(stream) = connection {
                        let files = Arc::clone(&server_files);
                        let token = server_token.clone();
                        let _ = std::thread::Builder::new().name("sndeck-audio-client".into())
                            .spawn(move || serve_audio_request(stream, files, &token));
                    }
                }
            })?;

        Ok(Self { port, token, files, next_id: AtomicU64::new(1) })
    }

    fn url_for(&self, path: &str) -> Result<String, String> {
        let canonical = std::fs::canonicalize(path)
            .map_err(|e| format!("Cannot open audio file: {e}"))?;
        if !canonical.is_file() {
            return Err("Selected audio path is not a file".into());
        }
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        self.files.lock().map_err(|_| "Audio server is unavailable".to_string())?
            .insert(id, canonical);
        Ok(format!("http://127.0.0.1:{}/media/{}?key={}", self.port, id, self.token))
    }
}

#[tauri::command]
pub fn local_audio_url(app: AppHandle, file_path: String) -> Result<String, String> {
    let server = app.try_state::<LocalAudioServer>()
        .ok_or_else(|| "Local audio server is not running".to_string())?;
    server.url_for(&file_path)
}

fn serve_audio_request(mut stream: TcpStream, files: Arc<Mutex<HashMap<u64, PathBuf>>>, token: &str) {
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(5)));
    let mut request = Vec::with_capacity(2048);
    let mut chunk = [0u8; 1024];
    while request.len() < 16 * 1024 {
        let count = match stream.read(&mut chunk) { Ok(0) | Err(_) => return, Ok(n) => n };
        request.extend_from_slice(&chunk[..count]);
        if request.windows(4).any(|w| w == b"\r\n\r\n") { break; }
    }
    let text = String::from_utf8_lossy(&request);
    let mut lines = text.lines();
    let mut first = lines.next().unwrap_or("").split_whitespace();
    let method = first.next().unwrap_or("");
    let target = first.next().unwrap_or("");
    let is_head = method == "HEAD";
    if method != "GET" && !is_head {
        let _ = write_response(&mut stream, 405, "text/plain", "Allow: GET, HEAD\r\n", &[]);
        return;
    }
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    if query != format!("key={token}") {
        let _ = write_response(&mut stream, 404, "text/plain", "", &[]);
        return;
    }
    let id = match path.strip_prefix("/media/").and_then(|s| s.parse::<u64>().ok()) {
        Some(id) => id,
        None => { let _ = write_response(&mut stream, 404, "text/plain", "", &[]); return; }
    };
    let file_path = match files.lock().ok().and_then(|map| map.get(&id).cloned()) {
        Some(path) => path,
        None => { let _ = write_response(&mut stream, 404, "text/plain", "", &[]); return; }
    };
    let mut file = match File::open(&file_path) {
        Ok(file) => file,
        Err(_) => { let _ = write_response(&mut stream, 404, "text/plain", "", &[]); return; }
    };
    let length = match file.metadata() { Ok(meta) => meta.len(), Err(_) => return };
    let range_header = lines.find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("range").then(|| value.trim().to_string())
    });
    let (status, start, end) = match range_header.as_deref().and_then(|r| parse_range(r, length)) {
        Some((start, end)) => (206, start, end),
        None if range_header.is_some() => {
            let _ = write_response(&mut stream, 416, "text/plain", &format!("Content-Range: bytes */{length}\r\n"), &[]);
            return;
        }
        None => (200, 0, length.saturating_sub(1)),
    };
    let content_length = if length == 0 { 0 } else { end - start + 1 };
    let mime = audio_mime(&file_path);
    let mut extra = format!("Accept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-store\r\n");
    if status == 206 { extra.push_str(&format!("Content-Range: bytes {start}-{end}/{length}\r\n")); }
    let header = format!("HTTP/1.1 {status} {}\r\nContent-Type: {mime}\r\nContent-Length: {content_length}\r\nConnection: close\r\n{extra}\r\n", if status == 206 { "Partial Content" } else { "OK" });
    if stream.write_all(header.as_bytes()).is_err() || is_head || content_length == 0 { return; }
    if file.seek(SeekFrom::Start(start)).is_err() { return; }
    let mut remaining = content_length;
    let mut buffer = [0u8; 64 * 1024];
    while remaining > 0 {
        let wanted = usize::try_from(remaining.min(buffer.len() as u64)).unwrap_or(buffer.len());
        let count = match file.read(&mut buffer[..wanted]) { Ok(0) | Err(_) => break, Ok(n) => n };
        if stream.write_all(&buffer[..count]).is_err() { break; }
        remaining -= count as u64;
    }
}

fn parse_range(header: &str, length: u64) -> Option<(u64, u64)> {
    let range = header.strip_prefix("bytes=")?;
    let (start, end) = range.split_once('-')?;
    if start.is_empty() {
        let suffix = end.parse::<u64>().ok()?;
        if suffix == 0 || length == 0 { return None; }
        return Some((length.saturating_sub(suffix), length - 1));
    }
    let start = start.parse::<u64>().ok()?;
    if start >= length { return None; }
    let end = if end.is_empty() { length - 1 } else { end.parse::<u64>().ok()?.min(length - 1) };
    (end >= start).then_some((start, end))
}

fn audio_mime(path: &std::path::Path) -> &'static str {
    match path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "mp3" => "audio/mpeg", "m4a" | "mp4" => "audio/mp4", "aac" => "audio/aac",
        "ogg" | "opus" => "audio/ogg", "wav" => "audio/wav", "flac" => "audio/flac",
        "webm" => "audio/webm", _ => "application/octet-stream",
    }
}

fn write_response(stream: &mut TcpStream, status: u16, mime: &str, extra: &str, body: &[u8]) -> std::io::Result<()> {
    let reason = match status { 404 => "Not Found", 405 => "Method Not Allowed", 416 => "Range Not Satisfiable", _ => "OK" };
    write!(stream, "HTTP/1.1 {status} {reason}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n", body.len())?;
    stream.write_all(body)
}

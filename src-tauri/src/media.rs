use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String, pub title: String, pub artist: String, pub album: String,
    #[serde(default)] pub artwork: String,
    pub duration: f64, pub position: f64, pub playing: bool,
    pub can_play: bool, pub can_pause: bool, pub can_next: bool, pub can_previous: bool, pub can_stop: bool,
}

#[cfg(windows)]
mod platform {
    use super::Session;
    use base64::Engine;
    use windows::Storage::Streams::DataReader;
    use windows::Media::Control::{GlobalSystemMediaTransportControlsSessionManager as Manager, GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status};
    pub fn sessions() -> Result<Vec<Session>, String> {
        (|| -> windows::core::Result<Vec<Session>> {
            let manager = Manager::RequestAsync()?.join()?;
            let all = manager.GetSessions()?;
            let mut result = Vec::new();
            for s in all {
                let props = match s.TryGetMediaPropertiesAsync()?.join() { Ok(p) => p, Err(_) => continue };
                let info = s.GetPlaybackInfo()?;
                let controls = info.Controls()?;
                let timeline = s.GetTimelineProperties()?;
                let duration = (timeline.EndTime()?.Duration - timeline.StartTime()?.Duration).max(0) as f64 / 10_000_000.0;
                let playing = info.PlaybackStatus()? == Status::Playing;
                let mut position = (timeline.Position()?.Duration - timeline.StartTime()?.Duration).max(0) as f64 / 10_000_000.0;
                if playing {
                    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs_f64() + 11_644_473_600.0;
                    let updated = timeline.LastUpdatedTime()?.UniversalTime as f64 / 10_000_000.0;
                    let rate = info.PlaybackRate().and_then(|r|r.Value()).unwrap_or(1.0);
                    if updated > 0.0 { position += (now - updated).max(0.0) * rate; }
                    if duration > 0.0 { position=position.min(duration); }
                }
                let artwork=(||->windows::core::Result<String>{
                    let stream=props.Thumbnail()?.OpenReadAsync()?.join()?;
                    let len=stream.Size()?;
                    if len==0||len>1_048_576{return Ok(String::new());}
                    let mime=stream.ContentType()?.to_string();
                    if !["image/png","image/jpeg","image/webp"].contains(&mime.as_str()){return Ok(String::new());}
                    let input=stream.GetInputStreamAt(0)?;let reader=DataReader::CreateDataReader(&input)?;
                    let read=reader.LoadAsync(len as u32)?.join()?;let mut bytes=vec![0;read as usize];reader.ReadBytes(&mut bytes)?;
                    Ok(format!("data:{};base64,{}",mime,base64::engine::general_purpose::STANDARD.encode(bytes)))
                })().unwrap_or_default();
                result.push(Session {
                    id: s.SourceAppUserModelId()?.to_string(), title: props.Title()?.to_string(),
                    artist: props.Artist()?.to_string(), album: props.AlbumTitle()?.to_string(),
                    artwork, duration, position, playing,
                    can_play: controls.IsPlayEnabled()?, can_pause: controls.IsPauseEnabled()?,
                    can_next: controls.IsNextEnabled()?, can_previous: controls.IsPreviousEnabled()?, can_stop: controls.IsStopEnabled()?,
                });
            }
            Ok(result)
        })().map_err(|e|e.to_string())
    }
    pub fn command(id: &str, title: &str, action: &str) -> Result<bool, String> {
        (|| -> windows::core::Result<bool> {
            let manager = Manager::RequestAsync()?.join()?;
            for s in manager.GetSessions()? {
                if s.SourceAppUserModelId()?.to_string() != id { continue; }
                if s.TryGetMediaPropertiesAsync()?.join()?.Title()?.to_string() != title { return Ok(false); }
                return match action {
                    "play" => s.TryPlayAsync()?.join(), "pause" => s.TryPauseAsync()?.join(),
                    "next" => s.TrySkipNextAsync()?.join(), "previous" => s.TrySkipPreviousAsync()?.join(),
                    "stop" => s.TryStopAsync()?.join(), _ => Ok(false),
                };
            }
            Ok(false)
        })().map_err(|e|e.to_string())
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::Session;
    use std::process::Command;
    fn jxa(code: &str) -> Result<String, String> {
        let output = Command::new("/usr/bin/osascript").args(["-l", "JavaScript", "-e", code]).output().map_err(|e|e.to_string())?;
        if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_string()); }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }
    pub fn sessions() -> Result<Vec<Session>, String> {
        let json = jxa(r#"
            const result=[];
            for (const name of ['Spotify','Music']) {
                const app=Application(name);
                if(!app.running()) continue;
                const track=app.currentTrack();
                if(!track) continue;
                result.push({id:name,title:track.name(),artist:track.artist(),album:track.album(),artwork:name==='Spotify'?track.artworkUrl():'',
                    duration:track.duration()/(name==='Spotify'?1000:1),position:app.playerPosition(),
                    playing:app.playerState()==='playing',canPlay:true,canPause:true,canNext:true,canPrevious:true,canStop:name==='Music'});
            }
            JSON.stringify(result);
        "#)?;
        serde_json::from_str(&json).map_err(|e|e.to_string())
    }
    pub fn command(id: &str, title: &str, action: &str) -> Result<bool, String> {
        if !["Spotify", "Music"].contains(&id) { return Ok(false); }
        let verb = match action { "play" => "play", "pause" => "pause", "next" => "nextTrack", "previous" => "previousTrack", "stop" if id == "Music" => "stop", _ => return Ok(false) };
        // Strings are JSON encoded into JXA, never interpolated into a shell command.
        let code = format!("const app=Application({}); if (!app.running() || app.currentTrack().name() !== {}) false; else {{ app.{}(); true; }}", serde_json::to_string(id).unwrap(), serde_json::to_string(title).unwrap(), verb);
        Ok(jxa(&code)? == "true")
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod platform {
    use super::Session;
    pub fn sessions() -> Result<Vec<Session>, String> { Err("Desktop media integration supports Windows and macOS.".into()) }
    pub fn command(_: &str, _: &str, _: &str) -> Result<bool, String> { Ok(false) }
}
pub use platform::{command, sessions};

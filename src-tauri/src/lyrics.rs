use serde_json::{json, Value};
use std::time::Duration;

fn has_text(value: &Value, key: &str) -> bool {
    value.get(key).and_then(Value::as_str).is_some_and(|s| !s.trim().is_empty())
}

fn has_synced(value: &Value) -> bool { has_text(value, "syncedLyrics") }
fn has_lyrics(value: &Value) -> bool { has_synced(value) || has_text(value, "plainLyrics") }

fn match_metadata(value: &Value, title: &str, artist: &str, duration: f64) -> bool {
    let same = |key: &str, expected: &str| value.get(key).and_then(Value::as_str)
        .is_some_and(|actual| actual.trim().to_lowercase() == expected.trim().to_lowercase());
    same("trackName", title) && same("artistName", artist)
        && (!duration.is_finite() || duration <= 0.0 || value.get("duration").and_then(Value::as_f64)
            .is_some_and(|actual| (actual - duration).abs() <= 3.0))
}

fn tag(mut value: Value, source: &str) -> Value {
    value["source"] = Value::String(source.into());
    value
}

async fn lrclib(client: &reqwest::Client, path: &str, params: &[(&str, String)]) -> Result<Vec<Value>, String> {
    let response = client.get(format!("https://lrclib.net/api/{path}"))
        .query(params).send().await.map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::NOT_FOUND { return Ok(Vec::new()); }
    if !response.status().is_success() { return Err(format!("LRCLIB returned {}", response.status())); }
    if path == "get" {
        let value: Value = response.json().await.map_err(|e| e.to_string())?;
        Ok(vec![tag(value, "LRCLIB")])
    } else {
        let values: Vec<Value> = response.json().await.map_err(|e| e.to_string())?;
        Ok(values.into_iter().take(20).map(|v| tag(v, "LRCLIB")).collect())
    }
}

fn lrcmux_result(body: &Value, title: &str, artist: &str, album: &str, duration: f64) -> Option<Value> {
    let instrumental = body.pointer("/meta/instrumental").and_then(Value::as_bool).unwrap_or(false);
    if instrumental {
        return Some(json!({"id": -1, "trackName": title, "artistName": artist, "albumName": album,
            "duration": duration, "syncedLyrics": null, "plainLyrics": null,
            "instrumental": true, "source": "lrcmux"}));
    }
    let level = body.pointer("/meta/level").and_then(Value::as_str).unwrap_or("none");
    let lines = body.get("lines").and_then(Value::as_array).cloned().unwrap_or_default();
    let plain = lines.iter().filter_map(|line| line.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>().join("\n");
    let synced = if level == "line" || level == "word" {
        lines.iter().filter_map(|line| {
            let ms = line.get("start")?.as_i64()?;
            let text = line.get("text")?.as_str()?;
            if ms < 0 { return None; }
            Some(format!("[{:02}:{:02}.{:03}] {}", ms / 60_000, (ms / 1_000) % 60, ms % 1_000, text))
        }).collect::<Vec<_>>().join("\n")
    } else { String::new() };
    if synced.is_empty() && plain.trim().is_empty() { return None; }
    Some(json!({"id": -1, "trackName": title, "artistName": artist, "albumName": album,
        "duration": duration, "syncedLyrics": if synced.is_empty() { None } else { Some(synced) },
        "plainLyrics": if plain.trim().is_empty() { None } else { Some(plain) },
        "instrumental": false, "source": "lrcmux"}))
}

async fn lrcmux(client: &reqwest::Client, title: &str, artist: &str, album: &str, duration: f64) -> Result<Option<Value>, String> {
    let mut params = vec![("title", title.to_string()), ("artist", artist.to_string())];
    if !album.trim().is_empty() { params.push(("album", album.to_string())); }
    if duration.is_finite() && duration > 0.0 { params.push(("duration", duration.round().to_string())); }
    let response = client.get("https://api.lrcmux.dev/get").query(&params)
        .send().await.map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::NOT_FOUND { return Ok(None); }
    if !response.status().is_success() { return Err(format!("lrcmux returned {}", response.status())); }
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(lrcmux_result(&body, title, artist, album, duration))
}

async fn lyrics_ovh(client: &reqwest::Client, title: &str, artist: &str, album: &str, duration: f64) -> Result<Option<Value>, String> {
    let mut url = reqwest::Url::parse("https://api.lyrics.ovh").map_err(|e| e.to_string())?;
    url.path_segments_mut().map_err(|_| "Invalid lyrics.ovh URL".to_string())?
        .extend(["v1", artist, title]);
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::NOT_FOUND { return Ok(None); }
    if !response.status().is_success() { return Err(format!("lyrics.ovh returned {}", response.status())); }
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    let lyrics = body.get("lyrics").and_then(Value::as_str).unwrap_or("").trim();
    if lyrics.is_empty() { return Ok(None); }
    Ok(Some(json!({"id": -2, "trackName": title, "artistName": artist, "albumName": album,
        "duration": duration, "syncedLyrics": null, "plainLyrics": lyrics,
        "instrumental": false, "source": "lyrics.ovh"})))
}

pub async fn find(title: String, artist: String, album: String, duration: f64) -> Result<Vec<Value>, String> {
    if title.len() > 1024 || artist.len() > 1024 || album.len() > 1024 { return Err("Track metadata too long".into()); }
    if title.trim().is_empty() || artist.trim().is_empty() { return Ok(Vec::new()); }
    let client = reqwest::Client::builder().timeout(Duration::from_secs(7))
        .user_agent("FloatingLyrics/0.1.0 (+https://github.com/mahrus-rohisyam/floating-lyrics-desktop)")
        .build().map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    let mut errors = Vec::new();
    if duration.is_finite() && duration > 0.0 {
        let params = [("track_name", title.clone()), ("artist_name", artist.clone()),
            ("album_name", album.clone()), ("duration", duration.round().to_string())];
        match lrclib(&client, "get", &params).await {
            Ok(found) => results.extend(found),
            Err(error) => errors.push(error),
        }
    }
    if results.iter().any(|r| has_synced(r) && match_metadata(r, &title, &artist, duration)) { return Ok(results); }
    let params = [("track_name", title.clone()), ("artist_name", artist.clone())];
    match lrclib(&client, "search", &params).await {
        Ok(found) => for value in found {
            if !results.iter().any(|r| r["source"] == "LRCLIB" && r["id"] == value["id"]) { results.push(value); }
        },
        Err(error) => errors.push(error),
    }
    if !results.iter().any(|r| has_synced(r) && match_metadata(r, &title, &artist, duration)) {
        match lrcmux(&client, &title, &artist, &album, duration).await {
            Ok(Some(found)) => results.push(found),
            Ok(None) => {},
            Err(error) => errors.push(error),
        }
    }
    if !results.iter().any(|r| has_lyrics(r) && match_metadata(r, &title, &artist, duration)) {
        match lyrics_ovh(&client, &title, &artist, &album, duration).await {
            Ok(Some(found)) => results.push(found),
            Ok(None) => {},
            Err(error) => errors.push(error),
        }
    }
    if results.is_empty() && !errors.is_empty() { return Err(errors.join("; ")); }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_lrcmux_milliseconds_to_lrc() {
        let body = json!({"meta":{"level":"line","instrumental":false},"lines":[
            {"text":"first","start":12500}, {"text":"next","start":62234}]});
        let result = lrcmux_result(&body,"Song","Artist","Album",180.0).unwrap();
        assert_eq!(result["syncedLyrics"], "[00:12.500] first\n[01:02.234] next");
    }

    #[test]
    fn rejects_wrong_duration_for_exact_match() {
        let value = json!({"trackName":"Song","artistName":"Artist","duration":240.0});
        assert!(!match_metadata(&value,"Song","Artist",180.0));
    }

    #[test]
    fn preserves_instrumental_without_inventing_text() {
        let body = json!({"meta":{"level":"none","instrumental":true}});
        let result = lrcmux_result(&body,"Song","Artist","Album",180.0).unwrap();
        assert_eq!(result["instrumental"], true);
        assert!(result["syncedLyrics"].is_null());
    }
}

mod media;
mod bridge;
mod spectrum;
mod lyrics;
use std::{sync::Arc,time::Duration};
use tauri::{Emitter, Manager, menu::{Menu,MenuItem}, tray::TrayIconBuilder, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
async fn media_sessions(bridge:tauri::State<'_,Arc<bridge::Bridge>>)->Result<Vec<media::Session>,String>{
    let browser=bridge.sessions();
    let mut sessions=match tauri::async_runtime::spawn_blocking(media::sessions).await.map_err(|e|e.to_string())? {
        Ok(sessions)=>sessions,
        Err(_) if !browser.is_empty()=>Vec::new(),
        Err(error)=>return Err(error),
    };
    sessions.extend(browser);Ok(sessions)
}
#[tauri::command]
async fn media_command(id:String,title:String,action:String,bridge:tauri::State<'_,Arc<bridge::Bridge>>)->Result<bool,String>{
    let companion=bridge.inner().clone();
    tauri::async_runtime::spawn_blocking(move||if id.starts_with("browser:"){companion.command(&id,&title,&action)}else{media::command(&id,&title,&action)}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
fn browser_pairing(bridge:tauri::State<'_,Arc<bridge::Bridge>>)->bridge::BridgeInfo{bridge.info()}
#[tauri::command]
fn set_spectrum_enabled(app:tauri::AppHandle,state:tauri::State<'_,spectrum::Spectrum>,enabled:bool)->Result<(),String>{state.set(app,enabled)}

#[tauri::command]
async fn find_lyrics(title:String,artist:String,album:String,duration:f64)->Result<Vec<serde_json::Value>,String>{
    lyrics::find(title,artist,album,duration).await
}
#[tauri::command]
async fn open_overlay(app:tauri::AppHandle)->Result<(),String>{
    create_overlay(app,None)
}
#[tauri::command]
fn show_settings(app:tauri::AppHandle){
    if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.unminimize();let _=w.set_focus();}
}
/// A brand-new overlay has no listener yet, so the requested action rides along in the URL.
fn create_overlay(app:tauri::AppHandle,start:Option<&str>)->Result<(),String>{
    if let Some(w)=app.get_webview_window("overlay"){w.show().map_err(|e|e.to_string())?;return Ok(());}
    let url=match start{Some(action)=>format!("index.html?overlay=1&start={action}"),None=>"index.html?overlay=1".into()};
    WebviewWindowBuilder::new(&app,"overlay",WebviewUrl::App(url.into()))
        .title("Floating Lyrics overlay").inner_size(560.0,220.0).min_inner_size(160.0,48.0)
        .decorations(false).transparent(true).shadow(false).always_on_top(true).visible_on_all_workspaces(true).skip_taskbar(true).resizable(true).focused(false).build().map_err(|e|e.to_string())?;
    Ok(())
}
fn route_shortcut(app:&tauri::AppHandle,action:&'static str){
    if let Some(w)=app.get_webview_window("overlay"){let _=w.show();let _=app.emit_to("overlay",&format!("shortcut:{action}"),());return;}
    let handle=app.clone();
    // Windows deadlocks when a webview is built on the event-loop thread.
    tauri::async_runtime::spawn(async move{let _=create_overlay(handle,Some(action));});
}
/// The overlay ignores the cursor so clicks reach the apps below; hover is therefore tracked here.
fn watch_overlay_hover(app:tauri::AppHandle){
    std::thread::spawn(move||{
        let mut last=false;
        loop{
            std::thread::sleep(Duration::from_millis(80));
            let inside=app.get_webview_window("overlay").filter(|w|w.is_visible().unwrap_or(false)).and_then(|w|{
                let cursor=app.cursor_position().ok()?;let pos=w.outer_position().ok()?;let size=w.outer_size().ok()?;
                Some(cursor.x>=pos.x as f64&&cursor.y>=pos.y as f64&&cursor.x<pos.x as f64+size.width as f64&&cursor.y<pos.y as f64+size.height as f64)
            }).unwrap_or(false);
            if inside!=last{last=inside;let _=app.emit_to("overlay","overlay:hover",inside);}
        }
    });
}
pub fn run(){
    tauri::Builder::default().manage(Arc::new(bridge::Bridge::new())).manage(spectrum::Spectrum::default())
        .invoke_handler(tauri::generate_handler![media_sessions,media_command,browser_pairing,set_spectrum_enabled,find_lyrics,open_overlay,show_settings])
        .setup(|app|{
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code,Modifiers,ShortcutState};
                // Requested as plain Alt+Shift+C / Alt+Shift+F; while the app runs these keys are taken system-wide.
                app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().with_shortcuts(["alt+shift+KeyC","alt+shift+KeyF"])?
                    .with_handler(|app,shortcut,event|{
                        if event.state!=ShortcutState::Pressed{return;}
                        if shortcut.matches(Modifiers::ALT | Modifiers::SHIFT,Code::KeyC){route_shortcut(app,"config");}
                        else if shortcut.matches(Modifiers::ALT | Modifiers::SHIFT,Code::KeyF){route_shortcut(app,"focus");}
                    }).build())?;
            }
            watch_overlay_hover(app.handle().clone());
            let show=MenuItem::with_id(app,"settings","Settings",true,None::<&str>)?;
            let overlay=MenuItem::with_id(app,"overlay","Show overlay",true,None::<&str>)?;
            let unlock=MenuItem::with_id(app,"unlock","Customize overlay (Alt+Shift+C)",true,None::<&str>)?;
            let hide=MenuItem::with_id(app,"hide","Hide overlay",true,None::<&str>)?;
            let quit=MenuItem::with_id(app,"quit","Quit",true,None::<&str>)?;
            let menu=Menu::with_items(app,&[&show,&overlay,&unlock,&hide,&quit])?;
            let mut rgba=vec![0u8;32*32*4];
            for y in 0..32{for x in 0..32{let i=(y*32+x)*4;let bar=x>=7&&x<=25&&(x-7)%6<3&&y>=7+(x%5)&&y<25-(x%5);rgba[i..i+4].copy_from_slice(if bar{&[208,237,172,255]}else{&[38,59,48,255]});}}
            TrayIconBuilder::new().icon(tauri::image::Image::new_owned(rgba,32,32)).tooltip("Floating Lyrics").menu(&menu).on_menu_event(|app,event|match event.id.as_ref(){
                "settings"=>{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}},
                "overlay"=>{let handle=app.clone();tauri::async_runtime::spawn(async move{let _=create_overlay(handle,None);});},
                "unlock"=>{if let Some(w)=app.get_webview_window("overlay"){let _=w.set_ignore_cursor_events(false);let _=w.center();let _=w.show();}let _=app.emit_to("overlay","overlay:unlock",());},
                "hide"=>{if let Some(w)=app.get_webview_window("overlay"){let _=w.hide();}},
                "quit"=>app.exit(0),_=>{}
            }).build(app)?;
            Ok(())
        })
        .on_window_event(|window,event|if let tauri::WindowEvent::CloseRequested{api,..}=event{api.prevent_close();let _=window.hide();})
        .run(tauri::generate_context!()).expect("Unable to start Floating Lyrics");
}

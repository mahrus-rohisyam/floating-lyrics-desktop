//! Opt-in YouTube Music companion. Loopback only, ephemeral 256-bit pairing token.
use crate::media::Session;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, io::Read, sync::{Arc, Mutex}, time::{Duration, Instant}};
use tiny_http::{Header, Method, Response, Server};

#[derive(Clone, Serialize)]
#[serde(rename_all="camelCase")]
pub struct BridgeInfo { pub endpoint:String, pub token:String, pub error:Option<String> }
#[derive(Clone, Serialize)]
#[serde(rename_all="camelCase")]
struct Pending { request_id:String, id:String, title:String, action:String }
struct Data { sessions:HashMap<String,(Session,Instant)>, commands:Vec<Pending>, results:HashMap<String,Option<bool>> }
pub struct Bridge { info:BridgeInfo, data:Arc<Mutex<Data>> }
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
struct ResultMessage { request_id:String, accepted:bool }
impl Bridge {
    pub fn new() -> Self {
        let data=Arc::new(Mutex::new(Data{sessions:HashMap::new(),commands:vec![],results:HashMap::new()}));
        let token=format!("{}{}",uuid::Uuid::new_v4().simple(),uuid::Uuid::new_v4().simple());
        let mut info=BridgeInfo{endpoint:"http://127.0.0.1:49271".into(),token,error:None};
        match Server::http("127.0.0.1:49271") {
            Err(e)=>info.error=Some(format!("Browser companion unavailable: {}",e)),
            Ok(server)=>{
                let shared=data.clone();let secret=info.token.clone();
                std::thread::spawn(move||for mut request in server.incoming_requests(){
                    let origin=request.headers().iter().find(|h|h.field.equiv("Origin")).map(|h|h.value.as_str().to_string());
                    let allowed_origin=origin.as_ref().map(|o|o.starts_with("chrome-extension://")&&o.len()<100).unwrap_or(true);
                    let cors=origin.filter(|_|allowed_origin).unwrap_or_default();
                    let answer=|status:u16,text:String|{
                        let mut response=Response::from_string(text).with_status_code(status).with_header(Header::from_bytes("Content-Type","application/json").unwrap());
                        if !cors.is_empty(){response=response.with_header(Header::from_bytes("Access-Control-Allow-Origin",cors.as_bytes()).unwrap()).with_header(Header::from_bytes("Vary","Origin").unwrap());}
                        response
                    };
                    if !allowed_origin {let _=request.respond(answer(403,"{}".into()));continue;}
                    if request.method()==&Method::Options {
                        let _=request.respond(answer(204,String::new()).with_header(Header::from_bytes("Access-Control-Allow-Headers","authorization, content-type").unwrap()).with_header(Header::from_bytes("Access-Control-Allow-Methods","GET, POST, OPTIONS").unwrap()));continue;
                    }
                    let auth=request.headers().iter().find(|h|h.field.equiv("Authorization")).map(|h|h.value.as_str()).unwrap_or("");
                    if auth!=format!("Bearer {}",secret){let _=request.respond(answer(401,"{}".into()));continue;}
                    if request.body_length().unwrap_or(0)>32_768{let _=request.respond(answer(413,"{}".into()));continue;}
                    let method=request.method().clone();let url=request.url().to_string();
                    let mut body=String::new();
                    if method==Method::Post {
                        if request.as_reader().take(32_769).read_to_string(&mut body).is_err()||body.len()>32_768 {let _=request.respond(answer(400,"{}".into()));continue;}
                    }
                    let mut d=shared.lock().unwrap();
                    let response=if method==Method::Post&&url=="/session" {
                        match serde_json::from_str::<Session>(&body) {
                            Ok(s) if s.id.starts_with("browser:")&&s.id.len()<80&&s.title.len()<1024&&s.artist.len()<1024&&s.duration.is_finite()&&s.position.is_finite()&&s.duration>=0.0&&s.position>=0.0=>{
                                d.sessions.retain(|_,(_,t)|t.elapsed()<Duration::from_secs(10));
                                if d.sessions.len()<20||d.sessions.contains_key(&s.id){d.sessions.insert(s.id.clone(),(s,Instant::now()));answer(200,"{}".into())}else{answer(429,"{}".into())}
                            },_=>answer(400,"{}".into())
                        }
                    }else if method==Method::Get&&url.starts_with("/commands?id="){
                        let id=url.trim_start_matches("/commands?id=");
                        let commands:Vec<_>=d.commands.iter().filter(|c|c.id==id).cloned().collect();d.commands.retain(|c|c.id!=id);
                        answer(200,serde_json::to_string(&commands).unwrap())
                    }else if method==Method::Post&&url=="/result"{
                        if let Ok(r)=serde_json::from_str::<ResultMessage>(&body){if let Some(result)=d.results.get_mut(&r.request_id){*result=Some(r.accepted);}}
                        answer(200,"{}".into())
                    }else{answer(404,"{}".into())};
                    drop(d);let _=request.respond(response);
                });
            }
        }
        Self{info,data}
    }
    pub fn info(&self)->BridgeInfo{self.info.clone()}
    pub fn sessions(&self)->Vec<Session>{self.data.lock().unwrap().sessions.values().filter(|(_,t)|t.elapsed()<Duration::from_secs(5)).map(|(s,_)|s.clone()).collect()}
    pub fn command(&self,id:&str,title:&str,action:&str)->Result<bool,String>{
        if !["play","pause","next","previous"].contains(&action){return Ok(false);}
        let request_id=uuid::Uuid::new_v4().to_string();
        {let mut d=self.data.lock().unwrap();
         if !d.sessions.get(id).map(|(s,t)|s.title==title&&t.elapsed()<Duration::from_secs(5)).unwrap_or(false){return Ok(false);}
         d.results.insert(request_id.clone(),None);d.commands.push(Pending{request_id:request_id.clone(),id:id.into(),title:title.into(),action:action.into()});}
        let start=Instant::now();
        while start.elapsed()<Duration::from_secs(4){
            let completed={self.data.lock().unwrap().results.get(&request_id).copied()};
            if let Some(Some(result))=completed{self.cleanup(&request_id);return Ok(result);}
            std::thread::sleep(Duration::from_millis(40));
        }
        self.cleanup(&request_id);Err("Browser player did not respond. Keep the YouTube Music tab open.".into())
    }
    fn cleanup(&self,id:&str){let mut d=self.data.lock().unwrap();d.results.remove(id);d.commands.retain(|c|c.request_id!=id);}
}

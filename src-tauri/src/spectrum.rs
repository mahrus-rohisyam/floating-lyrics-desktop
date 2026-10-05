use std::sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}};
use tauri::{AppHandle,Emitter};
use rustfft::{num_complex::Complex,FftPlanner};

pub struct Spectrum { stop:Mutex<Option<Arc<AtomicBool>>> }
impl Default for Spectrum {fn default()->Self{Self{stop:Mutex::new(None)}}}
impl Spectrum {
    pub fn set(&self,app:AppHandle,enabled:bool)->Result<(),String>{
        let mut state=self.stop.lock().unwrap();
        if let Some(stop)=state.take(){stop.store(true,Ordering::Relaxed);}
        if !enabled{let _=app.emit("spectrum:bands",[0.0f32;7]);return Ok(());}
        #[cfg(not(windows))]
        {let _=app;return Err("System spectrum is not available on macOS yet. Demo audio visualization remains available.".into());}
        #[cfg(windows)]
        {
            let stop=Arc::new(AtomicBool::new(false));*state=Some(stop.clone());
            std::thread::spawn(move||{
                if let Err(e)=capture(&app,&stop){let _=app.emit("spectrum:error",e);}
                let _=app.emit("spectrum:bands",[0.0f32;7]);
            });
            Ok(())
        }
    }
}

pub fn frequency_bands(samples:&[f32],sample_rate:f32)->[f32;7]{
    if samples.is_empty(){return [0.0;7];}
    let n=samples.len();
    let mut buffer:Vec<Complex<f32>>=samples.iter().enumerate().map(|(i,&value)|{
        let hann=0.5-0.5*(2.0*std::f32::consts::PI*i as f32/(n-1).max(1) as f32).cos();
        Complex::new(if value.is_finite(){value*hann}else{0.0},0.0)
    }).collect();
    FftPlanner::new().plan_fft_forward(n).process(&mut buffer);
    let edges=[40.0,120.0,250.0,500.0,1000.0,2000.0,4000.0,12000.0];
    let mut bands=[0.0f32;7];
    for band in 0..7{
        let lo=(edges[band]*n as f32/sample_rate).ceil() as usize;
        let hi=((edges[band+1]*n as f32/sample_rate).ceil() as usize).min(n/2);
        let energy:f32=buffer[lo.min(hi)..hi].iter().map(|v|v.norm_sqr()).sum();
        bands[band]=(energy.sqrt()/n as f32*8.0).clamp(0.0,1.0);
    }
    bands
}

#[cfg(windows)]
fn capture(app:&AppHandle,stop:&AtomicBool)->Result<(),String>{
    use wasapi::*;
    use std::{collections::VecDeque,time::{Duration,Instant}};
    (||->Result<(),Box<dyn std::error::Error>>{
        initialize_mta().ok()?;
        let enumerator=DeviceEnumerator::new()?;
        let device=enumerator.get_default_device(&Direction::Render)?;
        let mut client=device.get_iaudioclient()?;
        let format=WaveFormat::new(32,32,&SampleType::Float,44100,2,None);
        let (_,period)=client.get_device_period()?;
        client.initialize_client(&format,&Direction::Capture,&StreamMode::EventsShared{autoconvert:true,buffer_duration_hns:period})?;
        let signal=client.set_get_eventhandle()?;
        let reader=client.get_audiocaptureclient()?;
        let mut queue=VecDeque::new();
        let mut last=Instant::now();let mut silent=Instant::now();let mut previous=[0.0f32;7];
        client.start_stream()?;
        while !stop.load(Ordering::Relaxed){
            if signal.wait_for_event(100).is_err(){
                if silent.elapsed()>Duration::from_millis(250){let _=app.emit("spectrum:bands",[0.0f32;7]);silent=Instant::now();}
                continue;
            }
            reader.read_from_device_to_deque(&mut queue)?;
            while queue.len()>=1024*8{
                let bytes:Vec<u8>=queue.drain(..1024*8).collect();
                if last.elapsed()<Duration::from_millis(45){continue;}
                let samples:Vec<f32>=bytes.chunks_exact(8).map(|frame|(f32::from_le_bytes(frame[0..4].try_into().unwrap())+f32::from_le_bytes(frame[4..8].try_into().unwrap()))*0.5).collect();
                let fresh=frequency_bands(&samples,44100.0);
                for i in 0..7{previous[i]=fresh[i]*0.65+previous[i]*0.35;}
                if stop.load(Ordering::Relaxed){break;}
                let _=app.emit("spectrum:bands",previous);last=Instant::now();silent=Instant::now();
            }
            if queue.len()>44100*8{queue.clear();}
        }
        client.stop_stream()?;
        Ok(())
    })().map_err(|e|format!("System audio unavailable: {}. Try enabling it again after checking the output device.",e))
}

#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn silence_has_no_energy(){assert_eq!(frequency_bands(&vec![0.0;1024],44100.0),[0.0;7]);}
    #[test]fn a_700_hz_tone_appears_in_500_to_1000_band(){
        let samples:Vec<f32>=(0..4096).map(|i|(i as f32*700.0/44100.0*std::f32::consts::TAU).sin()*0.2).collect();
        let bands=frequency_bands(&samples,44100.0);let peak=bands.iter().enumerate().max_by(|a,b|a.1.partial_cmp(b.1).unwrap()).unwrap().0;assert_eq!(peak,3);
    }
}

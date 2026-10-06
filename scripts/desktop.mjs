import { existsSync } from 'node:fs';
import { resolve,delimiter } from 'node:path';
import { spawn } from 'node:child_process';
const env={...process.env};
if(existsSync('.tools/cargo/bin')){
  env.CARGO_HOME=resolve('.tools/cargo');env.RUSTUP_HOME=resolve('.tools/rustup');env.PATH=resolve('.tools/cargo/bin')+delimiter+env.PATH;
}
const args=process.argv.slice(2);
if(process.platform==='win32'&&args[0]==='build'&&!env.CARGO_TARGET_DIR){
  // Keep new builds away from a release executable that Windows may still be running.
  env.CARGO_TARGET_DIR=resolve('.tools/release-target');
}
if(args[0]==='build'&&!args.some(a=>['--bundles','-b','--no-bundle'].includes(a))){
  args.push('--bundles',process.platform==='win32'?'nsis':process.platform==='darwin'?'dmg':'all');
}
if(process.platform==='win32'&&args[0]==='build'){
  const thumbprint=env.FL_WINDOWS_SIGN_THUMBPRINT?.replace(/\s/g,'');
  const timestampUrl=env.FL_WINDOWS_SIGN_TIMESTAMP_URL;
  const signCommand=env.FL_WINDOWS_SIGN_COMMAND;
  if(env.FL_REQUIRE_WINDOWS_SIGNING==='1'&&!signCommand&&(!thumbprint||!timestampUrl)){
    throw new Error('Windows release signing is required: configure FL_WINDOWS_SIGN_COMMAND or a certificate thumbprint and timestamp URL.');
  }
  if(env.FL_REQUIRE_WINDOWS_SIGNING==='1'&&args.includes('--no-sign')) throw new Error('A required signed release cannot use --no-sign.');
  if(signCommand){
    if(thumbprint||timestampUrl) throw new Error('Choose either FL_WINDOWS_SIGN_COMMAND or certificate thumbprint signing.');
    if(!signCommand.includes('%1')) throw new Error('FL_WINDOWS_SIGN_COMMAND must contain the Tauri %1 file placeholder.');
    args.push('--config',JSON.stringify({bundle:{windows:{signCommand}}}));
  } else if(thumbprint||timestampUrl){
    if(!/^[a-f0-9]{40}$/i.test(thumbprint||'')) throw new Error('FL_WINDOWS_SIGN_THUMBPRINT must be a 40-character SHA-1 certificate thumbprint.');
    if(!/^https?:\/\//i.test(timestampUrl||'')) throw new Error('FL_WINDOWS_SIGN_TIMESTAMP_URL must be an HTTP(S) URL from the certificate provider.');
    args.push('--config',JSON.stringify({bundle:{windows:{certificateThumbprint:thumbprint,digestAlgorithm:'sha256',timestampUrl}}}));
  }
}
const child=spawn(process.execPath,[resolve('node_modules/@tauri-apps/cli/tauri.js'),...args],{env,stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));

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
const child=spawn(process.execPath,[resolve('node_modules/@tauri-apps/cli/tauri.js'),...args],{env,stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));

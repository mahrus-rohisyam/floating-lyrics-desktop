import { existsSync } from 'node:fs';
import { resolve,delimiter } from 'node:path';
import { spawn } from 'node:child_process';
const env={...process.env};
if(existsSync('.tools/cargo/bin')){
  env.CARGO_HOME=resolve('.tools/cargo');env.RUSTUP_HOME=resolve('.tools/rustup');env.PATH=resolve('.tools/cargo/bin')+delimiter+env.PATH;
}
const child=spawn(process.execPath,[resolve('node_modules/@tauri-apps/cli/tauri.js'),...process.argv.slice(2)],{env,stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));

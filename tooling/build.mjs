import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import path from 'node:path';
export async function buildNative({release=false,target}={}) {
  await import('./build-plugin.mjs');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const args=['build','--manifest-path','native/Cargo.toml','--locked'];
  if(release) args.push('--release');
  if(target) args.push('--target',target);
  const env={...process.env};
  const flags=env.CARGO_ENCODED_RUSTFLAGS?.split('\x1f')??env.RUSTFLAGS?.trim().split(/\s+/).filter(Boolean)??[];
  flags.push(`--remap-path-prefix=${homedir()}=/build-user`,`--remap-path-prefix=${root}=/workspace/`);
  env.CARGO_ENCODED_RUSTFLAGS=flags.join('\x1f'); delete env.RUSTFLAGS;
  execFileSync('cargo',args,{cwd:root,env,stdio:'inherit'});
  const binary=path.join(root,'native/target',...(target?[target]:[]),release?'release':'debug',process.platform==='win32'?'chatgpt-usage.exe':'chatgpt-usage');
  if(process.platform==='darwin') execFileSync('codesign',['--force','--sign','-',binary],{stdio:'inherit'});
  return binary;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) await buildNative({release:process.argv.includes('--release')});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import pkg from './package.json' with {type:'json'};
export default defineConfig({root:fileURLToPath(new URL('./ui',import.meta.url)),
  plugins:[react()],define:{__PLUGIN_VERSION__:JSON.stringify(pkg.version)},
  server:{host:'127.0.0.1',port:5188,strictPort:true}});

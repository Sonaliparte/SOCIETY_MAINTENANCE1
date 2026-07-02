import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import fs from 'fs';
import path from 'path';

function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    buildStart() {
      const srcDir = path.resolve(process.cwd(), '../SGS/Frontend/public');
      const assetsDest = path.resolve(process.cwd(), 'src/landing/assets');
      const publicDest = path.resolve(process.cwd(), 'public');
      
      if (!fs.existsSync(assetsDest)) fs.mkdirSync(assetsDest, { recursive: true });
      if (!fs.existsSync(publicDest)) fs.mkdirSync(publicDest, { recursive: true });
      
      try {
        if (fs.existsSync(path.join(srcDir, 'webimg.webp'))) {
          fs.copyFileSync(path.join(srcDir, 'webimg.webp'), path.join(assetsDest, 'webimg.webp'));
        }
        if (fs.existsSync(path.join(srcDir, 'sgslogo.jpg'))) {
          fs.copyFileSync(path.join(srcDir, 'sgslogo.jpg'), path.join(publicDest, 'sgslogo.jpg'));
        }
      } catch (err) {}
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyAssetsPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})

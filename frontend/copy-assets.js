import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, '../SGS/Frontend/public');
const destAssetsDir = path.resolve(__dirname, 'src/landing/assets');
const destPublicDir = path.resolve(__dirname, 'public');

// Create destination directories if they don't exist
if (!fs.existsSync(destAssetsDir)) {
  fs.mkdirSync(destAssetsDir, { recursive: true });
}
if (!fs.existsSync(destPublicDir)) {
  fs.mkdirSync(destPublicDir, { recursive: true });
}

// Copy webimg.webp
const webimgSrc = path.join(sourceDir, 'webimg.webp');
const webimgDest = path.join(destAssetsDir, 'webimg.webp');
if (fs.existsSync(webimgSrc)) {
  fs.copyFileSync(webimgSrc, webimgDest);
  console.log('✅ Copied webimg.webp to src/landing/assets/');
} else {
  console.error('❌ Could not find webimg.webp at', webimgSrc);
}

// Copy sgslogo.jpg
const logoSrc = path.join(sourceDir, 'sgslogo.jpg');
const logoDest = path.join(destPublicDir, 'sgslogo.jpg');
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, logoDest);
  console.log('✅ Copied sgslogo.jpg to public/');
} else {
  console.error('❌ Could not find sgslogo.jpg at', logoSrc);
}

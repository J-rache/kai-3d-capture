import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#111315',
    title: 'Kai 3D Capture',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  await win.loadFile(path.join(root, 'app', 'index.html'));
}

ipcMain.handle('kai3d:save-bundle', async (_event, payload) => {
  const safeName = String(payload.defaultName || 'kai-capture')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'kai-capture';
  const result = await dialog.showOpenDialog({
    title: 'Choose export folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
  const targetDir = path.join(result.filePaths[0], safeName);
  await fs.mkdir(targetDir, { recursive: true });
  const files = payload.files || {};
  for (const [fileName, content] of Object.entries(files)) {
    await fs.writeFile(path.join(targetDir, fileName), String(content), 'utf8');
  }
  return { ok: true, targetDir };
});

ipcMain.handle('kai3d:open-path', async (_event, targetPath) => {
  if (!targetPath) return { ok: false };
  await shell.openPath(targetPath);
  return { ok: true };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});


import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('kai3d', {
  saveBundle(payload) {
    return ipcRenderer.invoke('kai3d:save-bundle', payload);
  },
  openPath(targetPath) {
    return ipcRenderer.invoke('kai3d:open-path', targetPath);
  },
  platform: process.platform
});


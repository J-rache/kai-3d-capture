# Installer

Build:

```powershell
.\scripts\Build-Installer.ps1
```

The script runs:

1. `npm install` when needed.
2. Vendor preparation for Three.js.
3. Syntax checks.
4. Node tests.
5. Smoke reconstruction.
6. Electron Builder for Windows NSIS and portable outputs.

Expected installer output:

```text
dist\installer\Kai 3D Capture Setup 0.1.0.exe
```

Expected portable output:

```text
dist\installer\Kai 3D Capture 0.1.0.exe
```


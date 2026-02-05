# Assets Directory

## Window / Taskbar Icon (Impulse IDE)

The app uses **wave-square-solid.svg** as the Impulse IDE symbol. On **Windows**, the taskbar and title bar often require a `.ico` or `.png` file:

- Add **icon.ico** (or **icon.png**) to this folder, exported from **wave-square-solid.svg**.
- The app will automatically use `icon.ico` first, then `icon.png`, then the SVG.
- Use an online SVG→ICO converter (e.g. convertio.co, cloudconvert.com) or Inkscape to export the wave-square symbol to ICO (recommended size: 256×256).

Without `icon.ico`/`icon.png`, Windows may show the default Electron icon; adding either file will show the Impulse IDE symbol in the taskbar and window.


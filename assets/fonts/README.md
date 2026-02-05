# Custom UI Fonts

Place your UI font file here to use it across the IDE (sidebar titles, AI Assistant, buttons, labels).

- **Expected file:** `ui-font.woff2`  
  The app loads this via `src/renderer/styles.css` (`@font-face` for `ArduinoUI`).

- If your file has a different name, edit `src/renderer/styles.css` and update the `url()` in the `ArduinoUI` `@font-face` to match (e.g. `url('../../assets/fonts/YourFont.woff2')`).

Code editor and file names in the explorer keep the monospace font.

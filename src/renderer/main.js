/**
 * Vite entry point for the renderer process.
 * Bundles CodeMirror locally (no CDN), imports all CSS and scripts.
 */

// --- CodeMirror CSS (bundled locally, no CDN) ---
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/hint/show-hint.css';

// --- App CSS ---
import './styles.css';

// --- CodeMirror JS (bundled locally, no CDN) ---
import CodeMirror from 'codemirror';
import 'codemirror/mode/clike/clike';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/anyword-hint';
import { setCodeMirror } from './codemirror-ref.js';

setCodeMirror(CodeMirror);
window.CodeMirror = CodeMirror;

// --- Application scripts (side-effect imports) ---
import './notifications.js';
import './tooltips.js';
import './validation.js';
import './onboarding.js';
import './accessibility.js';
import './renderer.js';

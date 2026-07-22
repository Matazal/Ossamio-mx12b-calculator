# Code Review — OssamIO Scientific Calculator

**Reviewed:** 2026-07-22
**Scope:** Full repository (calculator.js, main.js, index.html, styles.css, package.json; package-lock.json skimmed for dependency risk)
**Commit reviewed:** c532262f8eb7794741c0777464cb80f9b5e23649

## Summary

The app is a clean, dependency-light static calculator that offloads all parsing/evaluation to the CortexJS Compute Engine, so there is no `eval()`/`innerHTML` injection surface in the browser build — good. However, the feature added in the reviewed HEAD commit ("add DEG/RAD mode support") is **completely non-functional**: the degree-to-radian conversion runs after the code that removes the exact tokens it tries to match, so every trig calculation is silently evaluated in radians regardless of mode — a serious correctness regression in the default configuration. The Electron packaging is also insecurely configured (`nodeIntegration: true`, `contextIsolation: false`, no CSP) while loading its math engines from an **unpinned** third-party CDN, which is both a supply-chain/RCE risk and means the "portable executable" silently requires internet. Remaining issues are input-guard correctness, accessibility gaps, and dead code.

## Findings

### [HIGH] DEG/RAD mode is inoperative — trig always computed in radians
**Location:** `calculator.js:283-305` (specifically the order of `289` vs `299-302`)
**Issue:** In `preprocessLatex`, line 289 normalizes every `\left(`/`\right)` to plain `(`/`)`:
```js
latex = latex.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
```
Then lines 299-302 attempt the degree conversion by matching `\left(`:
```js
if (this.angleMode === 'DEG') {
  latex = latex.replace(/\\(sin|cos|tan)\s*\\left\(/g, '\\$1\\left(\\frac{\\pi}{180}\\times(');
  latex = latex.replace(/\\(arcsin|arccos|arctan)\s*\\left\(/g, '\\frac{180}{\\pi}\\times\\$1\\left(');
}
```
By the time these run, no `\left(` remains in the string (it was inserted as `\sin\left(#?\right)` at line 219 but rewritten to `\sin(` on line 289), so **neither replacement ever matches**. The `\frac{\pi}{180}` factor is never injected. Separately, even if the ordering were fixed, the `\sin/\cos/\tan` replacement is malformed: it appends a stray `\times(` open-paren with no matching close, so it would produce an unbalanced expression.
**Impact:** DEG is the default mode (`angleMode = 'DEG'`, line 50; the `D` indicator is shown by default). A user types `sin(90) =` expecting `1` and gets `sin(90 rad) ≈ 0.894`. `cos(60)` returns `-0.952` instead of `0.5`. Every trig result in the app's default mode is wrong, and toggling to RAD changes nothing observable because RAD is already what's being computed. This defeats the entire feature the HEAD commit claims to add.
**Remediation:**
Match the already-normalized `(` (keeping the existing statement order) and drop the stray paren. The `\arc*` factor sits outside the call, so its parentheses stay balanced:
```js
// Angle mode conversions (run AFTER \left( normalization on line 289)
if (this.angleMode === 'DEG') {
  // deg -> rad for forward trig: sin(x) -> sin( (pi/180) * x )
  latex = latex.replace(/\\(sin|cos|tan)\s*\(/g, '\\$1(\\frac{\\pi}{180}\\times ');
  // rad -> deg for inverse trig: asin(x) -> (180/pi) * asin(x)
  latex = latex.replace(/\\(arcsin|arccos|arctan)\s*\(/g, '\\frac{180}{\\pi}\\times\\$1(');
}
```
(Order the `arc*` replacement is unaffected by the `sin` one because `\arcsin(` has no backslash immediately before `sin`.) Also apply the same conversion inside `handleMemory` — it calls `preprocessLatex` too, so this fix covers both paths.
**Validation:**
With mode = DEG, type `sin(30)` then `S⇔D` (or `=`) → expect `0.5`. Type `cos(60)` → `0.5`. Type `tan(45)` → `1`. Then press DEG/RAD to switch to RAD and evaluate `sin(π ÷ 2)` → expect `1`. Add an inverse check: DEG `sin⁻¹(0.5)` → `30`. Before the fix, `sin(30)` returns ≈ `-0.988`.

### [HIGH] Electron: remote CDN scripts run with Node integration enabled and no CSP
**Location:** `main.js:11-14`; `index.html:9-12`
**Issue:** The BrowserWindow is created with `nodeIntegration: true` and `contextIsolation: false` (main.js:12-13), the most privileged/least-isolated renderer configuration. The loaded page pulls both of its executable engines from a third-party CDN at runtime:
```html
<script defer src="https://unpkg.com/mathlive"></script>
<script type="module">
  import { ComputeEngine } from 'https://unpkg.com/@cortex-js/compute-engine?module';
```
There is no `Content-Security-Policy` (no meta CSP in index.html, no `onHeadersReceived` in main.js). With `nodeIntegration` on and no isolation, any script the renderer loads has full access to Node built-ins (`require('child_process')`, `fs`, etc.).
**Impact:** Because the packaged desktop app executes remote code from `unpkg.com`, a compromised/hijacked CDN account, a malicious published version, or a network MITM on the CDN fetch yields **arbitrary code execution on the user's machine** (spawn processes, read/write files), not just a broken calculator. This is the canonical Electron anti-pattern.
**Remediation:**
1. Bundle the dependencies locally instead of loading from CDN (they are already declared in `package.json` — reference `node_modules/mathlive/...` / `@cortex-js/compute-engine/...` via relative `<script src>` and copy them into the build). This removes remote code execution entirely and fixes offline use (see next finding).
2. Set `contextIsolation: true` and `nodeIntegration: false`; this app needs no Node APIs in the renderer.
3. Add a restrictive CSP (e.g. `default-src 'self'; script-src 'self'`) via a `<meta http-equiv="Content-Security-Policy">` or `session.defaultSession.webRequest.onHeadersReceived`.
**Validation:**
After bundling, disconnect from the network and launch `npm start` — the calculator must still load and compute. Inspect the packaged app to confirm no `unpkg.com` requests are made (DevTools Network tab shows only local file loads). Confirm `require` is `undefined` in the renderer console once `nodeIntegration` is off.

### [MEDIUM] Unpinned CDN dependencies — offline breakage and future silent breakage
**Location:** `index.html:9-11`; `README.md:58-59`
**Issue:** The page loads `https://unpkg.com/mathlive` and `https://unpkg.com/@cortex-js/compute-engine?module` with **no version pin**, so unpkg serves whatever is "latest". `package.json` pins `mathlive ^0.110.0` and `@cortex-js/compute-engine ^0.92.0`, but those pins are never used by the running app — the CDN URLs bypass them. The README claims the app "functions perfectly as a static webpage" and can "bypass Electron entirely," and `package.json` targets a `portable` executable, implying an offline-capable deliverable.
**Impact:** (1) With no network the app is fully dead — `window.ce` never initializes, `customElements.whenDefined('math-field')` never resolves, and no buttons work; the "portable" claim is false. (2) A future breaking release of MathLive or Compute Engine on `latest` will silently break production with no code change on your side (e.g. a serialization change to placeholders — see next finding — or an API rename).
**Remediation:** Pin explicit versions in the URLs (`https://unpkg.com/mathlive@0.110.0/...`, `https://unpkg.com/@cortex-js/compute-engine@0.92.0/...`) as a minimum, and preferably self-host/bundle from `node_modules` (also resolves the Electron finding above). Update the README to state the network requirement if CDN loading is retained.
**Validation:** Load `index.html` with the network throttled to offline in DevTools — after bundling/pinning + local hosting it should work; today it shows an empty non-functional field.

### [MEDIUM] Empty-placeholder guard checks the wrong sentinel tokens
**Location:** `calculator.js:311` and `calculator.js:340`
**Issue:** Templates are inserted with MathLive's `#?` placeholder marker (e.g. `\sqrt{#?}` at line 178, `\frac{#?}{#?}` at line 172). The "did the user leave a blank?" guard checks for the literal template tokens:
```js
if (latex.includes('\\blacksquare') || latex.includes('#?')) { this.triggerError(); return; }
```
But `#?` is only the *insertion-time* template syntax; once inserted, MathLive serializes an unfilled slot in `mathfield.value` as `\placeholder{}`, not `#?` and not `\blacksquare`. So the guard's two conditions do not match what an unfilled field actually contains.
**Impact:** Pressing `√` (or fraction/power/log/etc.) and then `=` without filling the slot is not caught by this guard. Evaluation instead depends on how Compute Engine happens to treat `\placeholder{}` — either an unhelpful thrown error routed through the generic `catch` (line 373), or a silently-wrong result if the placeholder is coerced (e.g. treated as an empty/zero argument). The explicit, user-friendly guard is effectively dead code. Severity is MEDIUM and marked PLAUSIBLE because the exact serialization is MathLive-version-dependent and the code loads an unpinned CDN version (see above), so behavior can't be pinned down by static reading alone.
**Remediation:** Guard on the token MathLive actually emits:
```js
if (!latex || latex.includes('\\placeholder')) { this.triggerError(); return; }
```
Verify the emitted token against the pinned MathLive version and keep both checks if older builds still emit `\blacksquare`.
**Validation:** Press `√` then `=` with nothing typed → expect the `E` indicator to light and no garbage answer. Repeat for `■/□` (fraction) with only the numerator filled.

### [MEDIUM] Accessibility: no accessible names/roles on controls; low-contrast shift labels
**Location:** `index.html:73-137` (buttons); `styles.css:304-312` (`.shift-label` color)
**Issue:** Buttons carry only glyph/symbol text content (`▲`, `√□`, `■/□`, `x²`, `×10ˣ`) or CSS-styled labels, with no `aria-label`. A screen reader announces "square root box", "black-square slash white-square", or nothing meaningful for the d-pad arrows. There are no `role`/`aria` annotations on the math-field beyond MathLive defaults, and no live region announcing the computed answer. The Casio-gold secondary labels use `--shift-label` color `#D3A744` on a near-white keypad (`styles.css:305` over `.calculator-body` `#ffffff`), a contrast ratio of roughly 2.3:1, below the WCAG AA 4.5:1 threshold for text.
**Impact:** The calculator is largely unusable with a screen reader and the secondary (SHIFT) function labels are hard to read for low-vision users. Note the physical-keyboard path is partially fine — native `<button>`s are focusable and Enter/Space fire `click` — but `=` has no keyboard equivalent since typing goes into the math-field, so a keyboard-only user cannot evaluate without mousing to the `=` button (or is unaware Enter does nothing).
**Remediation:** Add `aria-label` to every button (`aria-label="square root"`, `"up"`, `"multiply"`, `"equals"`, etc.), mark the answer field with `aria-live="polite"`, darken `--shift-label` to meet 4.5:1 (e.g. `#8a6d1f`), and bind the physical Enter key to `evaluateExpression(false)`.
**Validation:** Tab through the UI with VoiceOver/NVDA and confirm each control announces a meaningful name; run the shift-label color through a contrast checker for ≥4.5:1; press Enter after typing `2+2` and confirm it evaluates.

### [LOW] fitToScreen uses hardcoded natural dimensions decoupled from actual layout, with `overflow:hidden` and no scroll fallback
**Location:** `index.html:15-31` (`targetWidth = 420`, `targetHeight = 700`); `styles.css:33` (`body { overflow: hidden }`), `styles.css:44-54`
**Issue:** The mobile auto-scaler computes `scale = min(1, innerWidth/420, innerHeight/700)` from constants, but the calculator body's height is content-driven (not a fixed 680px), and its width constant (400 in CSS at `styles.css:46`, 420 assumed here) is duplicated in two files. If font loading, the `rotateX(5deg)` screen perspective (`styles.css:64`), or a taller viewport chrome makes the real rendered height exceed 680, the scale is under-corrected; combined with `body { overflow: hidden }` the bottom row (`0 . ×10ˣ Ans =`) is clipped with no way to scroll to it.
**Impact:** On some phones/orientations the equals row or bottom padding can be cut off — exactly the class of bug the recent commit churn (`2ca1f5d`, `aa7b9d2`, `1184f54`) was chasing; the fix relies on a guessed constant rather than the measured element, so it is fragile.
**Remediation:** Measure the element instead of hardcoding: use `calcBody.getBoundingClientRect()` (temporarily at `scale(1)`) for the true natural size, or set an explicit fixed body height so the constant is authoritative. At minimum, derive both constants from one source of truth shared with the CSS.
**Validation:** Load on a 360×640 and a 375×667 viewport (DevTools device toolbar) in both orientations and confirm the entire keypad including the `=` row is visible and tappable, with no clipping.

### [LOW] `M` memory indicator not cleared when memory returns to exactly zero
**Location:** `calculator.js:322-324`
**Issue:** `handleMemory` always shows the `M` indicator after any `m+`/`m-` (`this.indM.classList.remove('hidden')`), and only `MC` hides it (line 261). If a user does `M+ 5` then `M- 5`, `this.memory` is `0` but the indicator stays lit.
**Impact:** Minor UI inaccuracy versus a real Casio, where `M` reflects a non-zero stored value. No calculation impact.
**Remediation:** After updating memory, toggle by value: `this.indM.classList.toggle('hidden', this.memory === 0);` (guard for floating-point residue if desired).
**Validation:** `5 M+`, then `5 M-` → `M` indicator should turn off.

### [LOW] Dead code and leftover template files
**Location:** `styles.css:116-131` (`.solar-panel`, `.cell`), `styles.css:157-164` (`.lcd-value`), `styles.css:365-367` (`.span-2`); `index.html:74` + `calculator.js:41,121-124,280` (ALPHA); `requirements.txt` (empty); `.gitignore:3` (`venv/`); `calculator.js:358,365,376` (duplicated rounding)
**Issue:** `.solar-panel`/`.cell`, `.lcd-value`, and `.span-2` CSS rules have no matching elements in `index.html`. The ALPHA button is permanently `hidden-btn` (`index.html:74`) and `alphaActive`/`ind-alpha` are toggled but no key path uses ALPHA, so the whole ALPHA feature is inert. `requirements.txt` is empty and `.gitignore` ignores `venv/` — Python-template leftovers in a JS project. The decimal-rounding expression `Math.round(numValue * 1e10) / 1e10` is duplicated three times.
**Impact:** No runtime effect; adds maintenance noise and can mislead future contributors into thinking ALPHA/solar-panel are wired up.
**Remediation:** Delete the unused CSS blocks, the empty `requirements.txt`, and the `venv/` gitignore line; either implement or remove the ALPHA button and its state; extract the rounding into a small `roundDecimal(n)` helper. (Per repo conventions, flagging rather than deleting pre-existing dead code that isn't mine to touch.)
**Validation:** Grep confirms zero references (`grep -n "lcd-value\|solar-panel\|span-2\|alphaActive" index.html`); app behaves identically after removal.

## Non-issues considered and dismissed

- **`eval()` / injection:** None present. All user input goes through `ce.parse()` (CortexJS), and there is no `innerHTML`/`outerHTML`/`document.write`. Grep across calculator.js/main.js/index.html confirmed. This is the right architecture for expression evaluation.
- **Division by zero:** Handled adequately. `1 ÷ 0` yields a non-finite value; `Number(...)` produces `Infinity`, which fails the `isFinite(numValue)` check at `calculator.js:354`/`321` and routes to `triggerError()`. No crash, correct `E` state.
- **`Ans` precedence with negatives:** Correctly addressed — `preprocessLatex` wraps `Ans` in parentheses (`(${this.ans})`, line 286), so `Ans` after a negative result keeps correct precedence. The HEAD commit specifically fixed this (was bare `this.ans.toString()`).
- **AudioContext created at load (`calculator.js:3,32`):** Browsers start it suspended and `playClick()` resumes it on the first user gesture (line 7-9), so autoplay policy is respected. A harmless console warning at most; not worth changing.
- **`nPr`/`nCr` factorial regexes (`calculator.js:295-296`):** These run after `\left(`→`(` normalization (line 289), so matching plain `(` is correct here — unlike the angle block, this ordering is intentional and works. `P(5,2)`→`\frac{5!}{(5-2)!}` and `C(5,2)`→`\binom{5}{2}` are valid.
- **`package-lock.json` dependency risk:** Skimmed; standard Electron/MathLive/CortexJS transitive tree, no obviously abandoned or typosquatted packages. The real dependency risk is the *unpinned CDN* loading (flagged above), not the lockfile.

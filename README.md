# ALIO MX-12B Calculator

A fully functional, desktop-executable clone of the Casio MX-12B Desktop Calculator, styled with "ALIO" branding.

## Features
- **Visual Design**: Matte white body, angled 12-digit LCD screen, solar panel accent, and authentic key layout.
- **Arithmetic Logic**: Full 12-digit capacity, percentage edge cases (Addition mark-up, Discount, Standard multiplication), double-zero key.
- **Memory Operations**: Persistent M+, M-, MR, MC state memory.
- **Audio Feedback**: Synthesized mechanical switch click sound on valid button press using the Web Audio API.
- **Keyboard Support**: Fully mapped physical keyboard input (Numpad, Enter, Backspace, Escape, operators).

## Technologies
- **Core**: HTML, CSS, JavaScript (Vanilla).
- **Desktop Framework**: Electron.
- **Build System**: Electron Builder.

## Building from source
```bash
# Install dependencies
npm install

# Run locally
npm start

# Build for Windows
npm run build
```

## Executable
Check the `dist` directory or the releases section for the built executable.

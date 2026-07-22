# OssamIO MX-12B Scientific Calculator

A fully functional, desktop-executable clone of the Casio fx-500ES, styled with "OssamIO" branding and modern glassmorphic accents. Built for accurate scientific computing using MathLive for textbook-style rendering and CortexJS Compute Engine for flawless high-precision evaluation.

## Complete Function Guide

### Control & Navigation
- **D-Pad (▲ ▼ ◀ ▶)**: Navigate into and out of nested mathematical structures (like superscripts, subscripts, fractions, and root indices). Use this to move the cursor to precisely where you want to type.
- **SHIFT**: Toggles the secondary function mode. When pressed, an `S` indicator appears. The very next key pressed will execute its orange secondary function (indicated above the key).
- **ON / AC**: Clears the entire current equation and the answer screen.
- **DEL**: Deletes the character immediately to the left of the cursor.

### Primary Math Functions
- **Abs**: Inserts absolute value bars `| |`.
- **■/□ (Fraction)**: Inserts a clean vertical fraction template. Use the D-pad to jump between the numerator and denominator.
- **√□**: Inserts a standard square root.
- **x²**: Squares the current number or bracket.
- **x^□ (Power)**: Inserts an empty exponent placeholder.
- **log / ln**: Inserts base-10 logarithm and natural logarithm templates.
- **sin / cos / tan**: Inserts standard trigonometric functions.
- **x⁻¹**: Inserts the inverse exponent `⁻¹`.
- **S⇔D**: (Standard to Decimal) Forces the final answer to evaluate as a decimal point number rather than its exact fraction/root form.
- **( / )**: Standard parentheses for grouping.
- **MC**: (Memory Clear) Wipes the current saved memory value to `0`.
- **MR**: (Memory Recall) Inserts the saved memory value into your equation.
- **M- / M+**: Evaluates the *current equation on screen*, and then Subtracts or Adds that result to your saved memory. A tiny `M` indicator will appear when memory is actively holding a non-zero value.
- **Ans**: Inserts the numeric result of the *last* evaluated equation.
- **×10^x**: Inserts a scientific notation multiplier (`×10^`).

### Secondary Functions (SHIFT + Key)
*These functions are activated by pressing SHIFT first.*
- **SHIFT + √□ ➔ ³√□**: Inserts a Cube Root.
- **SHIFT + x² ➔ x³**: Inserts a Cube exponent.
- **SHIFT + x^□ ➔ ⁿ√□**: Inserts a customizable root template where you can type both the root index and the base.
- **SHIFT + log ➔ 10^□**: Inserts 10 to the power of your input.
- **SHIFT + ln ➔ e^□**: Inserts Euler's number `e` to the power of your input.
- **SHIFT + sin ➔ sin⁻¹**: Inserts Inverse Sine (Arcsine).
- **SHIFT + cos ➔ cos⁻¹**: Inserts Inverse Cosine (Arccosine).
- **SHIFT + tan ➔ tan⁻¹**: Inserts Inverse Tangent (Arctangent).
- **SHIFT + x⁻¹ ➔ x!**: Inserts a Factorial operator.
- **SHIFT + × ➔ nPr**: Inserts the Permutation function `P(n, r)`.
- **SHIFT + ÷ ➔ nCr**: Inserts the Combination function `C(n, r)`.
- **SHIFT + ×10^x ➔ π**: Inserts the mathematical constant Pi.

## Building from source
```bash
# Install dependencies
npm install

# Run locally
npm start

# Build for Windows
npm run build
```

## Running without Node
Since this calculator dynamically loads its mathematical engines via CDNs, it functions perfectly as a static webpage. You can bypass Electron entirely by simply opening the `index.html` file in any modern web browser (Chrome, Edge, Firefox).

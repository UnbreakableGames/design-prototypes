# Button icons

Transparent PNGs that replace the vector glyph on each HUD element. Missing
files fall back to the original vector — drop them in piecemeal.

| File              | Slot                                       | Currently supplied |
|-------------------|--------------------------------------------|--------------------|
| `SkillTree.png`   | Skill-tree button (top-left)               | ✓                  |
| `autoplay.png`    | Autoplay "AUTO" button (top-right)         |                    |
| `Rebirth.png`     | Rebirth button (top-right, below Autoplay) | ✓                  |
| `essence.png`     | Essence-tree button (left side)            |                    |
| `Dice.png`        | Spin die (top center)                      | ✓                  |
| `Luck.png`        | Luck badge clover (left side)              | ✓                  |

The renderer scales each PNG to fit, so larger source (80–256px square) is fine
and looks nicer on high-DPI displays. Filename casing matters — see
`src/ui/icons.ts` for the exact id → filename mapping.

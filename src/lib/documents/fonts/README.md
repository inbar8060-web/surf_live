# Fonts

`NotoSansHebrew-Regular.ttf` and `NotoSansHebrew-Bold.ttf` are embedded into the
signed PDFs.

They are here rather than using pdf-lib's built-in Helvetica because the
standard PDF fonts are WinAnsi-encoded: anything outside Latin-1 cannot be
drawn at all. A member called נעה would have had their name printed as `???` on
their own liability waiver.

Noto Sans Hebrew covers Latin and Hebrew in one face, so the English document
wording and a Hebrew name render from the same font. Licensed under the SIL
Open Font License 1.1 — see `OFL.txt`, which permits redistribution with the
software.

If the club needs another script (Arabic, Cyrillic), add the matching Noto face
and extend `pickFont` in `../render.ts`.

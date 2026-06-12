Design a nested enterprise data-grid color spec for a child table embedded inside a parent grid row.

**DESIGN SYSTEM (REQUIRED):**
- Platform: Web, Desktop-first
- Theme: Light, clinical enterprise, cool blue family, high density (7/10)
- Existing parent palette (DO NOT change):
  - Navy Anchor (#1e4a7a) — parent pinned/frozen column headers
  - Neutral Base (#eef1f5) — parent pinned column body
  - Sky Label (#dceaf7) — parent read-only column headers
- Child grid context: inset panel with left accent stripe, nested under Purchase Inquiry item rows
- Goal: child pinned columns must be instantly distinguishable from parent pinned navy columns while staying in the same brand family

**Deliver color roles for:**
1. Child pinned column header (IsFreezeReq)
2. Child pinned column body + alt row + hover + selected
3. Child read-only column header + body
4. Child lock-on-edit frozen header + body
5. Scroll-edge shadow for pinned columns

**Constraints:**
- No neon, no purple, no pure black
- Single accent family; saturation below 80%
- Darkest → lightest hierarchy: parent navy → child locked secondary → child pinned accent → child readonly sky → body wash

**Output:** Named roles with hex codes in a table, ready to map to CSS custom properties `--cg-*`.

# Design System: Horizon IMS — CollapsibleGrid Child Tier

## Context
Nested **CollapsibleGrid** renders inside **EntryGrid** (Purchase Inquiry indent details). Parent and child must share the same enterprise family but remain visually distinct at a glance.

## 1. Visual Theme & Atmosphere
Clinical enterprise density (7/10), restrained motion, cool blue family. Parent grid is the authoritative tier; child grid is an inset detail panel — lighter, brighter pinned anchors, never competing with parent navy.

## 2. Color Palette & Roles (Stitch-selected)

### Parent reference (EntryGrid — do not reuse for child pinned)
| Role | Name | Hex | Token |
|------|------|-----|-------|
| Pinned header | Navy Anchor | `#1e4a7a` | `--col-fixed-bg` |
| Pinned body | Neutral Base | `#eef1f5` | `--col-base-bg` |
| Read-only header | Sky Label | `#dceaf7` | `--col-readonly-bg` |

### Child tier (CollapsibleGrid — `--cg-*` tokens)
| Role | Name | Hex | Token |
|------|------|-----|-------|
| Pinned header | Bright Ocean Accent | `#0660a7` | `--cg-fixed-head-bg` |
| Pinned header text | Pure White | `#ffffff` | `--cg-fixed-head-text` |
| Pinned header border | Deep Ocean Rim | `#045091` | `--cg-fixed-head-border` |
| Pinned body | View Field Wash | `#e6f1fc` | `--cg-fixed-body-bg` |
| Pinned body (alt row) | View Field Tint | `#d9eaf8` | `--cg-fixed-body-alt` |
| Pinned hover | Pool Blue | `#c5dcf0` | `--cg-fixed-hover` |
| Pinned selected | Selected Pool | `#b5d2eb` | `--cg-fixed-selected` |
| Pinned cell text | Deep Readonly Ink | `#1a4572` | `--cg-fixed-text` |
| Pinned scroll shadow | Accent Glow | `rgba(6,96,167,0.22)` | `--cg-fixed-edge-shadow` |
| Regular header | Sky Label (child) | `#dceaf7` | `--cg-child-head-bg` |
| Regular body | Readonly Mist | `#e6f1fc` | `--cg-child-body-bg` |
| Lock-on-edit header | Steel Secondary | `#226db4` | `--cg-frozen-head-bg` |
| Lock-on-edit body | Steel Mist | `#ddeaf6` | `--cg-frozen-body-bg` |
| Panel stripe | Accent Stripe | `#0660a7` | `--cg-stripe` |

### Hierarchy rule
**Darkest → lightest:** Parent pinned navy → Child locked secondary → Child pinned accent → Child readonly sky → Child body wash.

## 3. Anti-patterns
- Never use parent `--col-fixed-bg` on child pinned headers
- Never use identical body grey (`--col-base-bg`) on child pinned cells
- No neon, no purple, no pure black

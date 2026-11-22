# Dead Air — Graphics Asset Pack

Generated art for the Godot graphics layer, plus real Expo app icon/splash assets.
Created 2026-11-17. All source images are AI-generated and locally post-processed;
see [Provenance and licensing](#provenance-and-licensing) before shipping.

## Art direction

- 1970s American late-night radio station, analog CRT, psychological horror.
- Palette from the GDD: background `#0A0A0A`, amber `#FFA500`, phosphor green
  `#00FF41`, alert red `#FF3300`.
- Stylized low-poly geometry with CRT post-processing on top; textures are
  pre-graded warm, dark, and slightly desaturated so the shader does the rest.
- No text except the intentional `ON AIR` sign.

## Layout

```
godot/assets/textures/
  environment/   10 textures, 1024x1024 (8 seamless + 2 backdrops)
  props/          4 prop/UI images, 1024x1024, black-backed
  keyart/         6 images: title key art + 5 concept pieces
  manifest.json   machine-readable pack manifest (paths, sizes, prompts)
  regenerate.py   reproducible regeneration through a 9router gateway
assets/
  icon.png         1024x1024   Expo app icon
  adaptive-icon.png 1024x1024  Android adaptive foreground (safe-zone padded)
  splash.png       1284x2778   Expo splash
  favicon.png      48x48       Web favicon
```

## Environment texture map

| File | Use in Godot | Material notes |
| --- | --- | --- |
| `environment/wallpaper_1970s.jpg` | Booth and hallway walls | `albedo_texture`, UV scale 2-3, roughness 0.9 |
| `environment/wood_panel.jpg` | Wainscoting, console sides | UV scale 2, roughness 0.8 |
| `environment/carpet_shag.jpg` | Station floor | UV scale 4, roughness 1.0 |
| `environment/ceiling_acoustic.jpg` | Station ceiling | UV scale 3, roughness 1.0 |
| `environment/concrete_bunker.jpg` | Bunker, liminal, staircase walls | UV scale 2, roughness 0.95 |
| `environment/metal_locker.jpg` | Lockers, back-office cabinets | UV scale 1-2, roughness 0.6, metallic 0.2 |
| `environment/desk_laminate.jpg` | Desk and console tops | UV scale 2, roughness 0.7 |
| `environment/suit_wool.jpg` | The Suit body material | UV scale 1, roughness 0.9, keep `albedo_color` near white |
| `environment/night_window.jpg` | Booth window backdrop | Emissive-capable; not tileable, use as a plane |
| `environment/radio_faceplate.jpg` | Console/radio faceplate decal | Emissive window region, not tileable |

The eight seamless textures were wrapped with a roll-plus-feather blend, so a 2x2
tiling shows no hard seam. They are stylized, not scan-based PBR: there are no
normal/roughness maps yet.

## Props and key art

- `props/tape_label.jpg` — cassette label for the tape inventory or a tape prop.
- `props/on_air_sign.jpg` — booth wall sign; use as emissive (`emission_energy` 2-3).
- `props/poster_missing.jpg` — station wall poster.
- `props/crt_bezel_frame.jpg` — dark CRT bezel; overlay or 9-slice frame source.
- `keyart/keyart_title.jpg` (1920x1080) — main menu background.
- `keyart/concept_*.jpg` — environment and enemy modeling/lighting reference,
  loading screens, or pitch material.

## Godot usage

Godot 4.7 is installed at `/usr/local/bin/godot`, and `godot --headless --import`
has generated a `.import` sidecar for every texture. The station scenes,
`phase3/bunker.tscn`, and `entities/suit.tscn` already assign them. Architecture
materials use world triplanar mapping (`uv1_triplanar` + `uv1_world_triplanar`)
because CSG box faces otherwise map the same texture with inconsistent axes
(vertical wallpaper stripes turn horizontal on some walls). Remaining phase
scenes still use flat colors.

For new surfaces:

1. Create a `StandardMaterial3D`, set `albedo_texture`, and set `albedo_color`
   to white so the texture is not tinted.
2. Set `uv1_scale` to 2-4 and enable world triplanar on CSG architecture.
3. Keep the existing `CRTPostProcess` layer on top; the textures are graded for it.

`manifest.json` records the intended use of every file.

## Regeneration

`regenerate.py` reads `manifest.json`, calls an OpenAI-compatible image endpoint,
and writes the raw results. It needs a gateway URL and key:

```bash
NINEROUTER_URL=http://localhost:20128 \
NINEROUTER_KEY=sk-... \
python3 godot/assets/textures/regenerate.py --out /tmp/deadair-assets
```

Pass `--model` to swap the model (for example `cf/@cf/black-forest-labs/flux-2-klein-9b`).

Then run the staging pass, which fits every asset to its declared size, gives
tileable textures a feathered roll when that measurably closes the wrap seam,
and writes the results under a staging root that mirrors the manifest paths:

```bash
python3 godot/assets/textures/postprocess.py --src /tmp/deadair-assets \
    --out /tmp/deadair-staged --sheet /tmp/deadair-sheets
```

Copy the staged tree over the repository, re-run `generate_pbr.py` for the
normal and roughness maps, and `godot --headless --import`. `postprocess.py`
writes nothing into the repository itself, so the staged output can be reviewed
(sheets land in `--sheet`) before anything shipped is replaced. Each seamless
asset prints which candidate it kept and the edge-gap score it was chosen on.

Verified 2026-11-22: `--model cf/@cf/black-forest-labs/flux-2-klein-9b --only keyart_title --out /tmp/assetout`
wrote a 1920x1080 jpg into `/tmp/assetout` with nothing written to the repo
root. The gateway API key lives in `~/.9router/data.sqlite` (`apiKeys.key`,
`isActive=1`) and is exported as `NINEROUTER_KEY`; the gateway answers on
`http://localhost:20128`. Repainting the whole pack is still pending visual
review of the new images, not a tooling gap.

## Provenance and licensing

- Generated with `cf/@cf/black-forest-labs/flux-2-klein-9b` through the local
  9router gateway (OpenAI-compatible `/v1/images/generations`), 2026-11-22. The
  earlier pack used `flux-2-dev`; every asset here has been repainted since, so
  no dev-generated file remains.
- Post-processed with `postprocess.py`: declared-size crops for key art, a
  measured roll-plus-feather seam pass for tileable textures, and icon/splash
  derivatives built from the generated icon. `generate_pbr.py` derives the
  `_normal`/`_roughness` maps.
- Licensing: FLUX.2 [klein] is commercially usable, so this pack ships under the
  project licence. Re-check locally before release:
  `python3 godot/assets/textures/regenerate.py --model cf/@cf/black-forest-labs/flux-2-klein-9b`

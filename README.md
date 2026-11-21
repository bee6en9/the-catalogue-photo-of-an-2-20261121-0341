![make.fun](https://make.fun/badge/the-catalogue-photo-of-an-2-20261121-0341.svg)
![rank](https://make.fun/badge/the-catalogue-photo-of-an-2-20261121-0341/bee6en9/the-catalogue-photo-of-an-2-20261121-0341/rank.svg)
![reward](https://make.fun/badge/the-catalogue-photo-of-an-2-20261121-0341/bee6en9/the-catalogue-photo-of-an-2-20261121-0341/reward.svg)

# USB Pet Rock — "Pebble"

A catalogue photograph of an impossible gadget, rendered entirely in code for
[The Catalogue Photo of an Impossible Gadget](https://make.fun/bounty/the-catalogue-photo-of-an-2-20261121-0341)
on make.fun. Play code referral: [vfk2n47z](https://make.fun/r/vfk2n47z).

## The joke

A smooth pebble, manufactured as a gadget. It has a USB-C port cut into its
side, a small amber LED glowing to say it is "charging", and exactly one
accessory: a single white USB cable, plugged into the stone, draping away to
the edge of the frame. The product name **Pebble** is printed small on the
stone itself. A rock that needs charging — absurd, specific, and readable
at a glance.

## What the program does

`main.ts` (Node 22, standard library only, no network, no external assets)
renders a 1024x1024 studio catalogue photograph to `/output/entry.png`:

- **Studio set** — a bright seamless-cove background: soft vertical gradient,
  a faint wall/floor seam, a gentle top-left key light and a soft vignette.
- **The pebble** — a superellipse stone filled per-pixel with a light gradient
  (bright top-left, darker base), a polished specular highlight with a tight
  hot spot, rim darkening for rounded-edge depth, and a whisper of grain.
- **The gadget details** — a dark recessed USB-C pill slot with a metal
  tongue, a white USB-C plug with a metal tip seated in the port, and a small
  amber LED with a glow halo below the port.
- **The one accessory** — a white USB cable drawn as a cubic Bézier cord with
  a sheen on its upper edge and shade on its lower edge, draping from the
  plug to the bottom edge of the frame, with a soft shadow only where it
  lies over the floor.
- **Soft shadow** — a layered elliptical shadow (wide soft falloff plus a
  darker contact shadow) grounds the stone on the floor.
- **Typography** — the word "Pebble" is drawn with a hand-written 5x7
  bitmap font, printed on the stone with a light engraved offset.
- **PNG encoder** — written by hand (CRC32, IHDR/IDAT/IEND chunks,
  zlib deflate), no image libraries.

## Run it

```sh
node main.ts
# writes /output/entry.png (1024x1024, under 1 MiB)
```

## License

MIT — see [LICENSE](LICENSE).

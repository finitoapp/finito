#!/usr/bin/env bash
# Generates X (Twitter) profile images: twitter-header-<lang>.png and twitter-avatar.png.
# Usage: bin/generate-twitter-profile.sh [cs|en]
# Requires: curl, rsvg-convert (librsvg), magick (ImageMagick), python3 with Pillow built with libimagequant.
#
# X specs (2026): header 1500x500 (3:1), avatar 400x400 shown as a circle, JPG/PNG,
# keep under 2 MB. X re-encodes a truecolor PNG over ~900 px as lossy JPEG, which
# blurs text and edges, but keeps a palette PNG (<= 256 colors) losslessly — so
# both images go out as dithered PNG8.
# Header safe zone: mobile crops up to 60 px top and bottom, and on desktop the
# avatar is a circle centred at (207, 500) with r ~167 (to x ~375), which the
# copy clears: it starts at x 300, the bottom line (the one level with the
# circle) at x 380, and it stays inside y 66-420, while the phones are
# decoration that mobile may trim at the top and that run off the bottom edge.
# x.com on a 1x screen shows the 600x200 variant, so everything is drawn to stay
# legible at 40 % — the slogan ends up ~25 px on screen.
set -euo pipefail
cd "$(dirname "$0")/.."

lang=${1:-cs}
[[ $lang == cs || $lang == en ]] || { echo "usage: $0 [cs|en]" >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export XDG_DATA_HOME="$work/fontroot"
mkdir -p "$XDG_DATA_HOME/fonts"

# Inter is the app's UI font.
curl -sfL "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf" \
  -o "$XDG_DATA_HOME/fonts/Inter.ttf"
fc-cache -f >/dev/null

for screen in payment paid; do
  magick "apps/web-app/docs/mockup/$lang/$screen.webp" -trim +repage -resize x700 "$work/$screen.png"
done
paid="data:image/png;base64,$(base64 -w0 "$work/paid.png")"
payment="data:image/png;base64,$(base64 -w0 "$work/payment.png")"
# The haze logo lies flat behind the phones: a perspective tilt pulls its top
# corners in and squashes it, and the blur grows from its near (bottom) edge to
# its far one. SVG has neither perspective nor a variable blur, hence magick.
# The 100 px margin gives the blur room; the crop drops the empty top half.
rsvg-convert -w 900 apps/web-app/public/pwa-icon.svg -o "$work/logo-flat.png"
magick "$work/logo-flat.png" -background none -gravity center -extent 1100x1100 \
  -virtual-pixel transparent \
  -distort Perspective '100,100 300,700  1000,100 800,700  100,1000 100,1000  1000,1000 1000,1000' \
  -gravity NorthWest -crop 1100x600+0+500 +repage "$work/logo-tilted.png"
# At half size: the variable blur is slow, and a blur hides the upscale anyway.
magick "$work/logo-tilted.png" -resize 50% \( -size 550x300 gradient:white-black -level 18%,67% \) \
  -compose blur -define compose:args=10 -composite "$work/logo.png"
logo="data:image/png;base64,$(base64 -w0 "$work/logo.png")"

case $lang in
  cs) line1="Tvůj byznys."; line2="Tvoje platby."; line3="Tvoje pravidla." ;;
  en) line1="Your business."; line2="Your payments."; line3="Your rules." ;;
esac

cat >"$work/header.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1500" height="500">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#F8D96A"/>
      <stop offset="1" stop-color="#D99A22"/>
    </linearGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="#FFFFFF" fill-opacity="0.07"/>
    </pattern>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.35" stop-color="#FFF" stop-opacity="0"/>
      <stop offset="1" stop-color="#FFF" stop-opacity="1"/>
    </linearGradient>
    <mask id="dotsMask"><rect width="1500" height="500" fill="url(#fade)"/></mask>
    <!-- Not feDropShadow: rsvg runs it through linearRGB at 8 bits, which tints the
         screens' dark greys teal. Merging the untouched SourceGraphic back keeps
         the screenshots' colours exact. -->
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="28"/>
      <feOffset dy="24" result="blur"/>
      <feFlood flood-color="#000" flood-opacity="0.6"/>
      <feComposite in2="blur" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <!-- Same hand-built shadow as the phones', to keep the copy's colours exact. -->
    <filter id="textShadow" x="-20%" y="-50%" width="140%" height="200%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
      <feOffset dy="4" result="blur"/>
      <feFlood flood-color="#000" flood-opacity="0.9"/>
      <feComposite in2="blur" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Pure black: X's dark page is #000, and anything lighter reads as grey beside it. -->
  <rect width="1500" height="500" fill="#000000"/>
  <rect width="1500" height="500" fill="url(#dots)" mask="url(#dotsMask)"/>
  <image x="520" y="-30" width="1300" height="709" opacity="0.4" xlink:href="$logo"/>
  <g filter="url(#shadow)">
    <g transform="translate(881 32) rotate(-2)"><image x="0" y="0" width="265" height="546" xlink:href="$payment"/></g>
    <g transform="translate(1185 48) rotate(2)"><image x="0" y="0" width="265" height="546" xlink:href="$paid"/></g>
  </g>
  <g font-family="Inter" font-weight="800" filter="url(#textShadow)">
    <!-- Each line indented a step further, so the three read as a building sequence. -->
    <!-- ...and a size larger, so the sequence also builds in weight. -->
    <text x="300" y="196" font-size="54" letter-spacing="-1.9" fill="#8A9099">$line1</text>
    <text x="340" y="272" font-size="62" letter-spacing="-2.2" fill="#F4F5F6">$line2</text>
    <text x="380" y="350" font-size="67" letter-spacing="-2.4" fill="url(#gold)">$line3</text>
  </g>
</svg>
SVG

rsvg-convert "$work/header.svg" -o "$work/header.png"
# libimagequant (pngquant's engine): ImageMagick's own quantizer bands the glow into rings.
png8() {
  python3 -c 'import sys; from PIL import Image
im = Image.open(sys.argv[1]).convert("RGBA")
# An opaque image goes out without a tRNS chunk; only the avatar needs alpha.
im = im if im.getchannel("A").getextrema()[0] < 255 else im.convert("RGB")
im.quantize(256, method=Image.Quantize.LIBIMAGEQUANT,
  dither=Image.Dither.FLOYDSTEINBERG).save(sys.argv[2], optimize=True)' "$1" "$2"
}
png8 "$work/header.png" "twitter-header-$lang.png"

# Just the coin, edge to edge on a transparent canvas: it is round already, so
# X's circular crop takes nothing from it and no backdrop shows around it.
rsvg-convert -w 400 -h 400 apps/web-app/public/pwa-icon.svg -o "$work/avatar.png"
png8 "$work/avatar.png" twitter-avatar.png

identify "twitter-header-$lang.png" twitter-avatar.png

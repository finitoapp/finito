#!/usr/bin/env bash
# Generates an A3 conference flyer: flyer-<lang>.svg (text as paths) and flyer-<lang>.png (300 DPI).
# Copy mirrors the landing page in apps/landing/src/i18n. Usage: bin/generate-flyer.sh [cs|en]
# Requires: curl, qrencode, rsvg-convert (librsvg), magick (ImageMagick), inkscape.
set -euo pipefail
cd "$(dirname "$0")/.."

lang=${1:-cs}
[[ $lang == cs || $lang == en ]] || { echo "usage: $0 [cs|en]" >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export XDG_DATA_HOME="$work/fontroot"
mkdir -p "$XDG_DATA_HOME/fonts"

for weight in Bold Medium Regular; do
  curl -sfL "https://github.com/google/fonts/raw/main/ofl/firasans/FiraSans-$weight.ttf" \
    -o "$XDG_DATA_HOME/fonts/FiraSans-$weight.ttf"
done
fc-cache -f >/dev/null

qrencode -t SVG -m 2 -o "$work/qr.svg" "https://payky.me"
rsvg-convert -w 900 apps/web-app/public/pwa-icon.svg -o "$work/logo.png"
magick "apps/web-app/docs/mockup/$lang/payment.webp" -trim +repage -bordercolor none -border 30 \
  -resize 1200x "$work/phone.png"

python3 - "$work" "$lang" $(identify -format "%w %h" "$work/phone.png") <<'PY'
import base64, pathlib, re, sys, textwrap

work, lang = sys.argv[1], sys.argv[2]
phone_w, phone_h = int(sys.argv[3]), int(sys.argv[4])

W, H, M = 2970, 4200, 190  # A3 in 0.1 mm units
CARD_H = 770
CARD_Y = H - 200 - CARD_H  # price card is anchored to the page bottom
BG, CARD, GOLD, GOLD_DIM, FG, DIM = "#101214", "#22262B", "#F2C94C", "#D99A22", "#EFF0F1", "#AEB4BC"
LEAD = "#C9CED5"

PHONE_Y, PHONE_H = 1300, 1820  # the phone spans the text column, from the lead down to the card
PHONE_W = round(PHONE_H * phone_w / phone_h)
PHONE_X = W - M - PHONE_W
COL = PHONE_X - M - 120  # text column; the phone owns the right side all the way down
GAP = 165  # space between sections

COPY = {
    "cs": dict(
        badge="Platební aplikace pro Česko a Slovensko",
        head=["Platební terminál,", "který je opravdu váš."],
        head_gold="Bez smluv, pronájmu a procent z tržby.",
        head_gold_size=125,
        lead="Payky udělá z telefonu nebo tabletu jednoduchý platební terminál. Zákazník"
             " zaplatí převodem, hotově nebo bitcoinem — a peníze jsou rovnou vaše.",
        methods_title="Platba tak, jak je zrovna potřeba",
        methods=[
            ("Bankovní převod", "Zobrazíte QR kód, zákazník ho načte ve své bance a zaplatí přímo na váš účet. Funguje v Česku i na Slovensku."),
            ("Hotovost", "Hotovostní platbu si jednoduše odškrtnete. Všechny tržby pak vidíte na jednom místě."),
            ("Bitcoin", "Lightning platby chodí rovnou do vaší vlastní peněženky. Vaše klíče, vaše bitcoiny."),
        ],
        data_title="Uložená data nikam samovolně neputují",
        data_body="Položky, účtenky i historie plateb zůstávají ve vašem telefonu nebo tabletu."
                  " Payky funguje i bez internetu. Zálohu a synchronizaci mezi svými zařízeními"
                  " si zapnete jen tehdy, když je chcete používat.",
        price="Bez poplatků. Z principu.",
        price_body="Žádné předplatné ani provize. Zdrojový kód Payky je veřejný a projekt stojí na"
                   " jednoduché myšlence: platby mají zůstat co nejvíc ve vašich rukou.",
        chips=["Bez provizí", "Bez smluv", "Bez registrace", "Jen telefon nebo tablet"],
        roadmap=("EET 2.0", "Počítáme s podporou od roku 2027."),
        footer="Zdarma · open source (MIT) · pro malé podnikání · github.com/finitoapp/payky",
    ),
    "en": dict(
        badge="A payment app for Czechia & Slovakia",
        head=["Take payments", "your way."],
        head_gold="No fees. No paperwork.",
        head_gold_size=180,
        lead="Payky turns your phone or tablet into a simple payment terminal. Your customer pays"
             " by bank transfer, cash, or bitcoin — and the money goes straight to you.",
        methods_title="Whatever way your customer wants to pay",
        methods=[
            ("Bank transfer", "Show a QR code, your customer scans it in their banking app, and the money lands directly in your account. Works in Czechia and Slovakia."),
            ("Cash", "Mark a cash payment as paid in a tap. All your takings stay together in one place."),
            ("Bitcoin", "Lightning payments go directly to your own wallet. Your keys, your bitcoin."),
        ],
        data_title="Your data stays in your hands",
        data_body="Items, receipts, and payment history stay on your phone or tablet. Payky works"
                  " without an internet connection, too. Backups and syncing between your own devices"
                  " are there if you want them.",
        price="$0. And it stays that way.",
        price_body="No subscription and no cut of your sales. A phone or tablet is enough — no rented"
                   " terminal, no bank contract, and no waiting to be paid.",
        chips=["No fees", "No contracts", "No sign-up", "Phone or tablet is enough"],
        roadmap=("EET 2.0", "Support is planned from 2027."),
        footer="Free · open source (MIT) · made for small businesses · github.com/finitoapp/payky",
    ),
}[lang]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def wrap(text, size, width, bold=False):
    # Fira Sans averages ~0.5 em per character; enough to break lines without measuring.
    return textwrap.wrap(text, max(8, int(width / (size * (0.52 if bold else 0.50)))))

def block(text, x, y, size, width, fill=FG, weight="500", leading=1.35):
    lines = wrap(text, size, width, bold=weight == "bold")
    out = "".join(
        f'<text x="{x}" y="{y + round(i * size * leading)}" font-size="{size}" '
        f'font-weight="{weight}" fill="{fill}">{esc(line)}</text>\n'
    for i, line in enumerate(lines))
    return out, y + round((len(lines) - 1) * size * leading)

def png(path, x, y, w, h):
    data = base64.b64encode(pathlib.Path(path).read_bytes()).decode()
    return (f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet"'
            f' xlink:href="data:image/png;base64,{data}"/>\n')

def qr(x, y, size):
    svg = pathlib.Path(f"{work}/qr.svg").read_text()
    modules = int(re.search(r'viewBox="0 0 (\d+)', svg).group(1))
    inner = re.search(r'<g id="QRcode">(.*)</g>', svg, re.S).group(1)
    return f'<g transform="translate({x},{y}) scale({size / modules:.6f})">{inner}</g>\n'

body = []
add = body.append

# Header: icon, wordmark, region badge.
add(png(f"{work}/logo.png", M, 140, 330, 330))
add(f'<text x="{M + 400}" y="410" font-size="230" font-weight="bold" letter-spacing="-4" fill="{FG}">Payky</text>\n')
add(f'<text x="{W - M}" y="360" font-size="62" font-weight="500" text-anchor="end" fill="{GOLD}">{esc(COPY["badge"])}</text>\n')
add(f'<rect x="{M}" y="560" width="{W - 2 * M}" height="4" fill="#2E3238"/>\n')

# Headline.
y = 780
for line in COPY["head"]:
    add(f'<text x="{M}" y="{y}" font-size="168" font-weight="bold" letter-spacing="-3" fill="{FG}">{esc(line)}</text>\n')
    y += 200
add(f'<text x="{M}" y="{y}" font-size="{COPY["head_gold_size"] - 10}" font-weight="bold" letter-spacing="-3" fill="{GOLD}">{esc(COPY["head_gold"])}</text>\n')

add(png(f"{work}/phone.png", PHONE_X, PHONE_Y, PHONE_W, PHONE_H))

svg, y = block(COPY["lead"], M, y + 150, 60, COL, fill=LEAD, leading=1.32)
add(svg)

y += GAP
add(f'<text x="{M}" y="{y}" font-size="82" font-weight="bold" fill="{FG}">{esc(COPY["methods_title"])}</text>\n')
y += 118
for title, text in COPY["methods"]:
    svg, end = block(text, M + 60, y + 82, 50, COL - 60, fill=DIM, leading=1.30)
    add(f'<rect x="{M}" y="{y - 56}" width="10" height="{end + 18 - (y - 56)}" fill="{GOLD_DIM}"/>\n')
    add(f'<text x="{M + 60}" y="{y}" font-size="70" font-weight="bold" fill="{GOLD}">{esc(title)}</text>\n')
    add(svg)
    y = end + 105

# Data ownership.
y += GAP - 105
add(f'<text x="{M}" y="{y}" font-size="82" font-weight="bold" fill="{FG}">{esc(COPY["data_title"])}</text>\n')
svg, y = block(COPY["data_body"], M, y + 95, 50, COL, fill=DIM, leading=1.30)
add(svg)

# EET 2.0 is a separate roadmap note rather than a current-product claim.
y += 105
label, note = COPY["roadmap"]
add(f'<rect x="{M}" y="{y - 52}" width="10" height="74" fill="{GOLD_DIM}"/>\n')
add(f'<text x="{M + 60}" y="{y}" font-size="56" font-weight="bold" fill="{GOLD}">{esc(label)}</text>\n')
add(f'<text x="{M + 320}" y="{y}" font-size="52" font-weight="500" fill="{DIM}">{esc(note)}</text>\n')
assert y < CARD_Y - 60, f"flowed copy overlaps the price card ({y} vs {CARD_Y}) — shorten it"

# Price card with the QR code.
card_y, card_h = CARD_Y, CARD_H
add(f'<rect x="{M}" y="{card_y}" width="{W - 2 * M}" height="{card_h}" rx="48" fill="{CARD}"/>\n')
add(f'<rect x="2180" y="{card_y + 90}" width="4" height="{card_h - 180}" fill="#353A41"/>\n')
add(f'<text x="{M + 90}" y="{card_y + 195}" font-size="150" font-weight="bold" fill="{GOLD}">{esc(COPY["price"])}</text>\n')
svg, _ = block(COPY["price_body"], M + 90, card_y + 310, 58, 1790, fill=DIM, leading=1.34)
add(svg)
add(f'<text x="{M + 90}" y="{card_y + 640}" font-size="58" font-weight="500" fill="{FG}">{esc(" · ".join(COPY["chips"]))}</text>\n')

qr_size = 400
qr_x = 2180 + (W - M - 2180 - qr_size) / 2  # centered in the card's right column
add(qr(qr_x, card_y + 120, qr_size))
add(f'<text x="{qr_x + qr_size / 2}" y="{card_y + 650}" font-size="68" font-weight="bold" text-anchor="middle" fill="{FG}">payky.me</text>\n')

add(f'<text x="{W / 2}" y="{H - 90}" font-size="52" font-weight="500" text-anchor="middle" fill="{DIM}">{esc(COPY["footer"])}</text>\n')

pathlib.Path(f"{work}/flyer.svg").write_text(
    f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="297mm" height="420mm" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" fill="{BG}"/>
  <g font-family="Fira Sans" font-variant-ligatures="none">
{"".join(body)}  </g>
</svg>''')
PY

# Fonts to paths so any printer renders the type identically.
inkscape "$work/flyer.svg" --export-type=svg --export-plain-svg --export-filename="flyer-$lang.svg" \
  --actions="select-all:all;object-to-path;export-do" >/dev/null
rsvg-convert -w 3508 -h 4961 -o "flyer-$lang.png" "flyer-$lang.svg"

identify "flyer-$lang.png"

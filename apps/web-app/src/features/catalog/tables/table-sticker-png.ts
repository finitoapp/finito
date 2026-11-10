const qrSize = 896
const padding = 64
const captionHeight = 96
const captionFontSize = 56
const pngDataUrlPrefix = "data:image/png;base64,"

export async function renderTableStickerPng({
  qr,
  name,
  code,
}: {
  readonly qr: SVGSVGElement
  readonly name: string
  readonly code: string
}): Promise<string> {
  const qrUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(qr)], {
      type: "image/svg+xml",
    })
  )
  try {
    const qrImage = new Image()
    qrImage.src = qrUrl
    await qrImage.decode()

    const canvas = document.createElement("canvas")
    canvas.width = qrSize + 2 * padding
    canvas.height = qrSize + 2 * padding + captionHeight
    const context = canvas.getContext("2d")
    if (context === null) {
      throw new Error("The sticker needs a 2D canvas.")
    }

    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(qrImage, padding, padding, qrSize, qrSize)

    const captionY = padding + qrSize + captionHeight / 2
    const captionWidth = qrSize / 2 - padding / 2
    context.fillStyle = "#000000"
    context.textBaseline = "middle"
    context.font = `600 ${captionFontSize}px system-ui, sans-serif`
    context.textAlign = "left"
    context.fillText(name, padding, captionY, captionWidth)
    context.font = `600 ${captionFontSize}px ui-monospace, monospace`
    context.textAlign = "right"
    context.fillText(code, padding + qrSize, captionY, captionWidth)

    return canvas.toDataURL("image/png").slice(pngDataUrlPrefix.length)
  } finally {
    URL.revokeObjectURL(qrUrl)
  }
}

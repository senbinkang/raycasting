export const log = console.info.bind(console)

export const e = (sel) => document.querySelector(sel)

export const drawLine = (context, color, x, y, endX, endY) => {
    context.strokeStyle = color.stringColor()
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(endX, endY)
    context.stroke()
}

export const drawRect = (context, color, x, y, width, height) => {
    context.fillStyle = color.stringColor()
    context.fillRect(x, y, width, height)
}

export const drawText = (context, fontSize, textColor, text, x, y) => {
    context.font = `${fontSize}px Georgia`
    context.fillStyle = textColor.stringColor()
    context.fillText(text, x, y)
}

export const drawArc = (context, color, x, y, r) => {
    context.beginPath()
    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fillStyle = color.stringColor()
    context.fill()
}

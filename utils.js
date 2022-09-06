const log = console.log.bind(console)
const e = sel => document.querySelector(sel)

const clone = (obj) => JSON.parse(JSON.stringify(obj))

const drawLine = (context, color, x, y, endX, endY) => {
    context.save()
    context.strokeStyle = color
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(endX, endY)
    context.stroke()
    context.restore()
}

const drawRect = (context, color, x, y, width, height) => {
    context.save()
    context.fillStyle = color
    context.fillRect(x, y, width, height)
    context.restore()
}

const drawText = (context, fontSize, textColor, text, x, y) => {
    context.save()
    context.font=`${fontSize}px Georgia`
    context.fillStyle = textColor
    context.fillText(text, x, y)
    context.restore()
}

const drawArc = (context, color, x, y, r) => {
    context.save()
    context.strokeStyle = color
    context.beginPath()
    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fillStyle = color
    context.fill()
    context.stroke()
    context.restore()
}
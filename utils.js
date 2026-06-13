// 一些工具方法
const log = console.log.bind(console)
const e = sel => document.querySelector(sel)

// 画线段（不带 save/restore，减少每帧 Canvas 状态切换开销）
const drawLine = (context, color, x, y, endX, endY) => {
    context.strokeStyle = color.stringColor()
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(endX, endY)
    context.stroke()
}

// 画矩形
const drawRect = (context, color, x, y, width, height) => {
    context.fillStyle = color.stringColor()
    context.fillRect(x, y, width, height)
}

// 画文本
const drawText = (context, fontSize, textColor, text, x, y) => {
    context.font = `${fontSize}px Georgia`
    context.fillStyle = textColor.stringColor()
    context.fillText(text, x, y)
}

// 画圆（填充圆）
const drawArc = (context, color, x, y, r) => {
    context.beginPath()
    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fillStyle = color.stringColor()
    context.fill()
}


// 一些工具类
class Vec {
    constructor(x, y) {
        this.x = x
        this.y = y
    }

    get len() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    add(v) {
        this.x += v.x
        this.y += v.y
        return this
    }

    sub(v) {
        this.x -= v.x
        this.y -= v.y
        return this
    }

    mult(v) {
        if (v instanceof Vec) {
            this.x *= v.x
            this.y *= v.y
            return this
        } else {
            this.x *= v
            this.y *= v
            return this
        }
    }

    clone() {
        return new Vec(this.x, this.y)
    }
}

class Color {
    constructor(r, g, b, a = 1) {
        this.r = r
        this.g = g
        this.b = b
        this.a = a
    }
    static get White() {
        return new Color(255,255,255)
    }
    static get Black() {
        return new Color(0,0,0)
    }
    static get Red() {
        return new Color(255,0,0)
    }
    static get Green() {
        return new Color(0,255,0)
    }
    static get Blue() {
        return new Color(0,0,255)
    }

    stringColor() {
        return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`
    }

    add(color) {
        let {r, g, b, a} = color
        r += this.r
        g += this.g
        b += this.b
        a += this.a
        return new Color(r, g, b, a)
    }
}

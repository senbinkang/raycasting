export class Color {
    constructor(r, g, b, a = 1) {
        this.r = r
        this.g = g
        this.b = b
        this.a = a
    }

    static get White() {
        return new Color(255, 255, 255)
    }

    static get Black() {
        return new Color(0, 0, 0)
    }

    static get Red() {
        return new Color(255, 0, 0)
    }

    static get Green() {
        return new Color(0, 255, 0)
    }

    static get Blue() {
        return new Color(0, 0, 255)
    }

    stringColor() {
        return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`
    }

    add(color) {
        let { r, g, b, a } = color
        r += this.r
        g += this.g
        b += this.b
        a += this.a
        return new Color(r, g, b, a)
    }
}

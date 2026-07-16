export class Vec {
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

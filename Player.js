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

class Player {
    constructor(game, bg) {
        this.game = game
        this.bg = bg
        this.unit = bg.unit
        this.lines = bg.lines
        this.columns = bg.columns
        this.wallData = bg.wallData

        this.digits = 0.0001
        this.width = game.canvas.width
        this.height = game.canvas.height
        let x = 4.5
        let y = 3.5
        this.position = new Vec(x, y)
        this.currentPoint = {x, y}
        this.r = 10
        this.degrees = 90
        this.includedAngle = 18
        this.offset = 5
        this.speed = 0.1
        this.isLog = false
        this.endPointArr = []

        this.init()
    }

    get radians() {
        return this.degrees * (Math.PI / 180)
    }

    get dir() {
        let sin = Math.sin(this.radians)
        let cos = Math.cos(this.radians)
        return new Vec(cos, sin)
    }

    getDir(rad) {
        let sin = Math.sin(rad)
        let cos = Math.cos(rad)
        return new Vec(cos, sin)
    }

    getRadians(deg) {
        return deg * (Math.PI / 180)
    }

    init() {
        this.registerAction()
    }

    checkLarge360(deg, offset, op) {
        if (op === '+') {
            deg += offset
        } else if (op === '-') {
            deg -= offset
        }

        if (deg >= 360) {
            deg -= 360
        } else if (deg < 0) {
            deg += 360
        }
        return deg
    }

    setInArea() {
        let {x, y} = this.position
        let r = this.r
        let unit = this.unit
        let minX = r / unit
        let minY = r / unit
        let maxX = (this.width - r) / unit
        let maxY = (this.height - r) / unit

        if (x > maxX) {
            this.position.x = maxX
        }
        if (x < minX) {
            this.position.x = minX
        }
        if (y > maxY) {
            this.position.y = maxY
        }
        if (y < minY) {
            this.position.y = minY
        }

        // 遇到障碍物
        // this.setOutWall()
    }

    setOutWall() {
        let {x, y} = this.position
        let unit = this.unit
        let r = this.r / unit

        x = Number(x.toFixed(4))
        y = Number(y.toFixed(4))

        for (let o of this.wallData) {
            let minX = o.x - r
            let minY = o.y - r
            let maxX = o.x + unit + r
            let maxY = o.y + unit + r

            // if (!this.isLog) {
            //     log('x, y', o.x, o.y, 'r', r, '| min', minX, minY, 'max', maxX, maxY)
            // }

            if ((x > minX && y > minY) && (x < maxX && y < maxY)) {
                log('--', x, y, '|', 'min', minX, minY, 'max', maxX, maxY)
                // this.position.y = minY
                // this.position.x = minX
                this.position.x = minX
                //  this.position.y = minY

            }
        }
    }

    registerAction() {
        let g = this.game

        // 向左
        g.registerAction('a', () => {
            this.degrees = this.degrees -= this.offset
            // this.degrees = this.checkLarge360(this.degrees, this.offset, '-')
        })
        // 向右
        g.registerAction('d', () => {
            this.degrees = this.degrees += this.offset
            // this.degrees = this.checkLarge360(this.degrees, this.offset, '+')
        })

        // 前进
        g.registerAction('w', () => {
            this.position.add(this.dir.mult(this.speed))
            this.setInArea()
        })
        // 后退
        g.registerAction('s', () => {
            this.position.add(this.dir.mult(-this.speed))
            this.setInArea()
        })
    }

    getEndPoint(px, py, rad) {
        let tan = Math.tan(rad)
        let minX = Math.floor(px)
        let minY = Math.floor(py)
        let maxX = minX + 1
        let maxY = minY + 1

        let dir1 = this.getDir(rad)
        let x1 = dir1.x < 0 ? minX : maxX
        let w1 = Math.abs(px - x1)
        let h1 = Math.abs(w1 * tan)
        let y1 = dir1.y < 0 ? (py - h1) : py + h1

        let dir2 = this.getDir(rad)
        let y2 = dir2.y < 0 ? minY : maxY
        let h2 = Math.abs(py - y2)
        let w2 = Math.abs(h2 / tan)
        let x2 = dir2.x < 0 ? px - w2 : px + w2

        x1 = Number(x1.toFixed(4))
        y1 = Number(y1.toFixed(4))
        x2 = Number(x2.toFixed(4))
        y2 = Number(y2.toFixed(4))

        // 最终输出的点
        let x, y
        let dig = this?.digits || 0.0001
        let v1 = new Vec(x1 - px, y1 - py)
        let v2 = new Vec(x2 - px, y2 - py)
        if (v1.len < v2.len) {
            if (x1 < px) {
                x = x1 - dig
            } else {
                x = x1 + dig
            }

            if (y1 < py) {
                y = y1 - dig
            } else {
                y = y1 + dig
            }
            // log('v1 >>>>', this.degrees, x.toFixed(3), y.toFixed(3))
        } else {
            if (x2 < px) {
                x = x2 + dig
            } else {
                x = x2 - dig
            }

            if (y2 < py) {
                y = y2 - dig
            } else {
                y = y2 + dig
            }
            // log('v2 >>>>', this.degrees, x.toFixed(3), y.toFixed(3))
        }

        return {
            x: x,
            y: y,
        }
    }

    isStop(x, y) {
        return ((x >= this.columns || x < 0) || (y >= this.lines || y < 0))
    }

    isWall(x, y) {
        for (let o of this.wallData) {
            let minX = o.x
            let minY = o.y
            let maxX = o.x + 1
            let maxY = o.y + 1
            if ((x >= minX && x <= maxX) && (y >= minY && y <= maxY)) {
                return true
            }
        }
        return false
    }

    drawPlayer() {
        let color = 'rgb(88,221,253)'
        let {x, y} = this.position
        x = x * this.unit
        y = y * this.unit
        drawArc(this.game.context, color, x, y, this.r)
    }

    drawRay(color = 'red', rad = this.radians) {
        let unit = this.unit
        this.currentPoint = this.position.clone()

        // 获取终点
        for (let i = 0; i < this.lines * 2; i++) {
            let {x, y} = this.currentPoint
            let {x: endX, y: endY} = this.getEndPoint(x, y, rad)
            drawLine(this.game.context, color, x * unit, y * unit, endX * unit, endY * unit)

            let bool = this.isWall(endX, endY) || this.isStop(endX, endY)
            if (!bool) {
                this.currentPoint = {x: endX, y: endY}
            } else {
                this.endPointArr.push({x: endX, y: endY})
                break
            }
        }
    }

    drawAllRay() {
        let min = this.degrees - this.includedAngle
        let max = this.degrees + this.includedAngle
        // log('min', min, 'max', max)
        // 夹角分成 100 份
        let offset = (max - min) / 100

        for (let i = min; i < max; i += offset) {
            let color = i === this.degrees ? 'red' : 'rgba(255,255,255,0.5)'
            let rad = this.getRadians(i)
            this.drawRay(color, rad)
        }
    }

    draw() {
        this.drawAllRay()
        this.drawRay()
        this.drawPlayer()
    }
    update() {
    }
}

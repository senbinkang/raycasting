class Vec {
    constructor(x, y) {
        // x = Math.abs(x)
        // y = Math.abs(y)
        let r = Math.sqrt(x * x + y * y)
        let cos = x / r
        let sin = y / r
        let tan = y / x
        let offset = 5

        this.x = cos * offset
        this.y = sin * offset
        // this.x = x
        // this.y = y
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
}

class Player {
    constructor(game, bg) {
        this.game = game
        this.bg = bg
        this.wallData = bg.wallData

        this.width = game.canvas.width
        this.height = game.canvas.height
        this.offset = 1
        this.player = {
            x: Math.floor(game.canvas.width / 2),
            y: Math.floor(game.canvas.height / 2),
            r: 8,
            degrees: 30,
            dir: new Vec(4, 3),
        }

        this.init()
    }

    setInArea() {
        let { x, y, r } = this.player
        r += 2

        if (x + r > this.width) {
            this.player.x = this.width - r
        }
        if (x - r < 0) {
            this.player.x = r
        }

        if (y + r > this.height) {
            this.player.y = this.height - r
        }
        if (y - r < 0) {
            this.player.y = r
        }
    }

    add(x, y) {
        this.player.x += x
        this.player.y += y

        this.setInArea()
    }

    get radians() {
        return this.player.degrees * (Math.PI / 180)
    }

    // get degrees() {
    //     return this.player.radians * (180 / Math.PI)
    // }

    init() {
        this.registerAction()
    }

    rotate(rad) {
        let {x, y} = this.player
        let x2 = x * Math.cos(rad)
        let y2 = y * Math.sin(rad)
        return new Vec(x2, y2)
    }

    check360(deg, offset, op) {
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
    registerAction() {
        let g = this.game

        // 向左
        g.registerAction('a', () => {
            this.player.degrees = this.check360(this.player.degrees, this.offset, '-')
            this.player.dir = this.rotate(this.radians)
        })
        // 向右
        g.registerAction('d', () => {
            this.player.degrees = this.check360(this.player.degrees, this.offset, '+')
            this.player.dir = this.rotate(this.radians)
        })

        // 前进
        g.registerAction('w', () => {
            let {x, y} = this.player.dir
            this.add(x, y)
        })
        // 后退
        g.registerAction('s', () => {
            let {x, y} = this.player.dir
            this.add(-x, -y)
        })
    }

    draw() {
        this.drawRay()
        this.drawPlayer()
    }

    drawPlayer() {
        let context = this.game.context
        context.save()
        context.strokeStyle = 'rgb(88,221,253)'
        let {x, y, r} = this.player
        context.beginPath()
        context.arc(x, y, r, 0, 2 * Math.PI)
        context.fillStyle = 'rgb(88,221,253)'
        context.fill()
        context.stroke()
        context.restore()
    }

    // 获取射线终点
    getEndPoint0() {
        let {x: px, y: py, degrees: pd} = this.player
        // 斜边长
        let r = px / Math.cos(this.radians)
        // 对边长
        let len = Math.sqrt(r * r - px * px)

        let x = 0
        let y = 0
        if ((pd % 360 >= 0) && (pd % 360 <= 90)) {
            y = py - len > this.width ? 400 : py - len
            x = 0
        } else if ((pd % 360 > 90) && (pd % 360 <= 180)) {
            y = py - len > this.width ? 400 : py - len
            x = 400
        } else if ((pd % 360 > 180) && (pd % 360 <= 270)) {
            y = (py + len) > this.height ? 400 : py + len
            x = 400
        } else if ((pd % 360 > 270) && (pd % 360 <= 360)) {
            y = (py + len) > this.height ? 400 : py + len
            x = 0
        }
        // else {
        //     y = (py + len) > this.height ? 400 : py + len
        //     x = 0
        // }
        log('len',len.toFixed(0), 'deg', this.player.degrees,
            '| x', x.toFixed(0), 'y', y.toFixed(0)
        )

        // let x = px
        // log('xx', x, 'yyy', y)
        return {
            x: x,
            y: y,
        }
    }
    getEndPointVec() {
        // let toBorder = true
        // let endP = new Vec(this.player.x, this.player.y)
        // let index = 0
        // while (toBorder) {
        //     index++
        //     endP.add(this.player.dir)
        //     if ((endP.x <= 0 || endP.x >= this.width) || (endP.y <= 0 || endP.y >= this.height)) {
        //         toBorder = false
        //     }
        // }
        // log('index', index)

        let deg = this.player.degrees

        let {x: px, y: py} = this.player
        let cos = Math.cos(this.radians)
        let sin = Math.sin(this.radians)
        let tan = Math.tan(this.radians)

        // let 临边 = px
        // let 斜边 = Math.abs(临边 / cos)
        // let 对边 = Math.abs(斜边 * sin)
        // let y0 = 对边
        // log('临边', 临边, '|  对边', 对边.toFixed(1))
        // let endX = px + px / cos
        // let endY = py + py / sin

        let endX
        let endY
        if (deg >= 0 && deg < 90) {
            let 临边 = px
            endX = px - 临边

            let 对边 = 临边 * tan
            endY = py - 对边
        } else if (deg >= 90 && deg < 180) {
            let rad = Math.PI - this.radians
            let cos2 = Math.cos(rad)
            let sin2 = Math.sin(rad)
            let tan2 = Math.tan(rad)
            // log('cos2', cos2.toFixed(1), '|  sin2', sin2.toFixed(1))

            if (cos2 >= sin2) {
                endX = py / tan2
                endY = 0
            } else {
                let 对边 = this.width - px
                endX = this.width
                endY = 对边 / tan2
            }
            // let 右边 = this.width - px
            //
            // let 临边 = cos2
            // endX = px + 临边
            //
            // let 对边 = sin2
            // endY = py - 对边
        }
        // let rad = this.radians
        // // let rad = Math.PI - this.radians
        // let cos2 = Math.cos(rad)
        // let sin2 = Math.sin(rad)
        // let tan2 = Math.tan(rad)
        // if (cos2 >= sin2) {
        //     endX = py / tan2
        //     endY = 0
        // } else {
        //     let 对边 = this.width - px
        //     endX = this.width
        //     endY = 对边 / tan2
        // }

        let w = px - endX
        let h = py - endY
        let borderH = py
        let borderX = w / h * borderH

        let 大斜边 = Math.sqrt((endY - py) * (endY - py) + (endX - px) * (endX - px))
        let 大临边 = Math.abs(endX - px)
        let 大对边 = Math.abs(endY - py)
        let tan0 = Math.tan(大对边 / 大临边)
        // log('大斜边', 大斜边.toFixed(1), '大临边', 大临边.toFixed(1), '大对边', 大对边.toFixed(1))

        // let 小对边 =
        if (endY < 0) {
            endY = 0

            let 小对边 = py
            let 小临边 = 小对边 / (大对边 / 大临边)
            endX = 小临边
        }

        // log('borderX', borderX.toFixed(1), 'borderH', borderH.toFixed(1), '| endX', endX.toFixed(1), 'endY', endY.toFixed(1))
        log('endX', endX.toFixed(1), 'endY', endY.toFixed(1))
        return new Vec(endX, endY)
    }
    getEndPoint1(px, py) {
        let deg = this.player.degrees
        let rad = this.radians
        let sin = Math.sin(rad)
        let cos = Math.cos(rad)
        let tan = Math.tan(rad)

        let 右边 = this.width - px
        let x = 右边
        let y = 200

        return {
            x,
            y,
        }
    }
    getY(px, py) {
        let deg = this.player.degrees
        let tan = Math.tan(this.radians)

        let 大临边 = this.width - px
        let 大对边 = 大临边 * tan

        let y
        if (deg >= 0 && deg < 180) {
            y = py + 大对边
        } else {
            y = py - 大对边
        }

        let x
        // 算出 与边界交点的 x 坐标
        if (y > this.height) {
            let 小对边 = this.height - py
            let 小临边 = 小对边 / tan
            x = px + 小临边
            log(`小对边 ${小对边}`)
        }

        return y
    }

    isInArea(x, y) {
        return (x >= 0 && x <= this.width) && (y >= 0 && y <= this.height)
    }

    getEndPoint(px, py) {
        let deg = this.player.degrees
        let tan = Math.tan(this.radians)

        let x1, y1, x2, y2, w1, h1, w2, h2
        if (deg <=90 || deg >= 270) {
            // x 在边缘，最大的三角形
            x1 = this.width
            w1 = Math.abs(this.width - px)
            h1 = Math.abs(w1 * tan)
            if (deg <= 90) {
                y1 = py + h1
            }
            if (deg >= 270) {
                y1 = py - h1
            }

            // y 在边缘，小三角形
            if (deg >= 270) {
                y2 = 0
            }
            if (deg <= 90) {
                y2 = this.height
            }
            h2 = Math.abs(y2 - py)
            w2 = Math.abs(h2 / tan)
            x2 = px + w2
        } else {
            // 方向在左边
            // x 在边缘，最大的三角形
            x1 = 0
            w1 = Math.abs(px)
            h1 = Math.abs(w1 * tan)
            if (deg > 90 && deg <= 180) {
                y1 = py + h1
            }
            if (deg > 180 && deg < 270) {
                y1 = py - h1
            }

            // y 在边缘，小三角形
            if (deg > 90 && deg <= 180) {
                y2 = this.height
            }
            if (deg > 180 && deg < 270) {
                y2 = 0
            }
            h2 = Math.abs(y2 - py)
            w2 = Math.abs(h2 / tan)
            x2 = px - w2
        }

        // 最终输出的点
        let x, y
        if (this.isInArea(x1, y1)) {
            x = x1
            y = y1
        }
        if (this.isInArea(x2, y2)) {
            x = x2
            y = y2
        }

        // log(`deg ${deg} |  x ${x.toFixed(0)}  y ${y.toFixed(0)}`)
        return {
            x,
            y,
        }
    }

    drawRay() {
        let context = this.game.context
        let color = 'red'
        let {x, y} = this.player
        let {x: endX, y: endY} = this.getEndPoint(x, y)

        drawLine(context, color, x, y, endX, endY)
    }

    update() {
    }

    // 边界检测
    checkBorder(cell) {
        let borderX = this.width - this.unit
        let borderY = this.height - this.unit

        if (cell.x > borderX) {
            cell.x = 0
        }
        if (cell.y > borderY) {
            cell.y = 0
        }
        if (cell.x < 0) {
            cell.x = borderX
        }
        if (cell.y < 0) {
            cell.y = borderY
        }
    }
}

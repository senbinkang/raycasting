class Player {
    constructor(game, bg) {
        this.game = game
        this.unit = bg.unit
        this.lines = bg.lines
        this.columns = bg.columns
        this.wallData = bg.wallData

        // 玩家初始位置
        let x = 4.5
        let y = 3.5
        this.position = new Vec(x, y)
        this.currentPoint = {x, y}
        // 玩家半径
        this.r = 10
        this.digits = 0.0001

        // 角度
        this.degrees = 90
        // 夹角
        this.includedAngle = 18
        this.degOffset = 5
        this.speed = 0.5
        this.isLog = false
        this.endPointArr = []
        this.defaultWallColor = new Color(255,162,162)

        this.init()
    }

    get radians() {
        return this.degrees * (Math.PI / 180)
    }

    get dir() {
        return new Vec(Math.cos(this.radians), Math.sin(this.radians))
    }

    getDir(rad) {
        return new Vec(Math.cos(rad), Math.sin(rad))
    }

    getRadians(deg) {
        return deg * (Math.PI / 180)
    }

    init() {
        this.registerAction()
    }
    registerAction() {
        let g = this.game

        // 向左
        g.registerAction('a', () => {
            this.degrees = this.degrees -= this.degOffset
        })
        // 向右
        g.registerAction('d', () => {
            this.degrees = this.degrees += this.degOffset
        })

        // 前进
        g.registerAction('w', () => {
            this.forward()
            this.setInArea('w')
        })
        // 后退
        g.registerAction('s', () => {
            this.goBack()
            this.setInArea('s')
        })
    }

    forward() {
        this.position.add(this.dir.mult(this.speed))
    }

    goBack() {
        this.position.sub(this.dir.mult(this.speed))
    }

    move(dir) {
        if (dir === 'w') {
            this.goBack()
        } else if (dir === 's') {
            this.forward()
        }
    }

    // 在框内，且遇到障碍物停止
    setInArea(dir) {
        let {x, y} = this.position
        let r = this.r / this.unit
        let borderMinX = r
        let borderMinY = r
        let borderMaxX = this.columns - r
        let borderMaxY = this.lines - r

        if (x > borderMaxX || x < borderMinX || y > borderMaxY || y < borderMinY) {
            this.move(dir)
        }

        // 遇到障碍物
        for (let o of this.wallData) {
            let minX = o.x - r
            let minY = o.y - r
            // 1 为格子坐标，乘以 单位(unit) 就是在 canvas 上的坐标
            let maxX = o.x + 1 + r
            let maxY = o.y + 1 + r

            // 进到障碍物里面
            if ((x > minX && y > minY) && (x < maxX && y < maxY)) {
                this.move(dir)
            }
        }
    }

    getWallInfo(x, y) {
        for (let o of this.wallData) {
            let minX = o.x
            let minY = o.y
            let maxX = o.x + 1
            let maxY = o.y + 1
            if ((x >= minX && x <= maxX) && (y >= minY && y <= maxY)) {
                return o.color
            }
        }
        return this.defaultWallColor
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
        let dig = this.digits || 0.0001
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
        }

        let color = this.getWallInfo(x, y) || this.defaultWallColor
        return {
            x,
            y,
            color,
        }
    }

    isStop(x, y) {
        // 判断是否遇到边界
        if ((x >= this.columns || x < 0) || (y >= this.lines || y < 0)) {
            return true
        }

        // 判断是否遇到障碍物
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

    drawAllRay() {
        let min = this.degrees - this.includedAngle
        let max = this.degrees + this.includedAngle
        // 两边夹角分成 100 份
        let degOffset = (max - min) / 100

        for (let i = min; i < max; i += degOffset) {
            let color = new Color(255,255,255,0.5)
            let rad = this.getRadians(i)
            this.drawRay(color, rad)
        }
    }

    drawRay(color = Color.Red, rad = this.radians) {
        let unit = this.unit
        this.currentPoint = this.position.clone()

        // 获取每个格子的终点
        for (let i = 0; i < this.lines * 2; i++) {
            let {x, y} = this.currentPoint
            let {x: endX, y: endY, color: pColor} = this.getEndPoint(x, y, rad)
            drawLine(this.game.context, color, x * unit, y * unit, endX * unit, endY * unit)

            // 判断实现是否被挡住
            let bool = this.isStop(endX, endY)
            if (!bool) {
                this.currentPoint = {x: endX, y: endY, color: pColor}
            } else {
                this.endPointArr.push({x: endX, y: endY, color: pColor})
                break
            }
        }
    }

    drawPlayer() {
        // 随便给一个玩家的颜色
        let color = new Color(88,221,253)
        let {x, y} = this.position
        x = x * this.unit
        y = y * this.unit
        drawArc(this.game.context, color, x, y, this.r)
    }

    draw() {
        this.drawAllRay()
        this.drawRay()
        this.drawPlayer()
        this.isLog = true
    }
}

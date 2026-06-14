// Player.js
// 玩家控制 + 分轴碰撞（墙 + 精灵阻挡精灵）+ 精灵捡取
//
// 使用: new Player(game, bg, spriteManager)
//   - spriteManager 可省略（若当前阶段不需要）
//
// 按键：
//   W/S = 前/后移动   A/D = 左/右旋转
//   Q/E = 左右平移（strafe）
//   Shift = 加速跑（game.update() 中调用 setSprinting）

class Player {
    constructor(game, bg, spriteManager) {
        this.game = game
        this.bg = bg
        this.spriteManager = spriteManager || null
        this.unit = bg.unit
        this.lines = bg.lines
        this.columns = bg.columns
        this.worldMap = bg.worldMap

        // 初始位置：第一行 / 第一列 的空地中心
        this.position = new Vec(1.5, 1.5)
        // 先在地图里找最近的空地（防止被墙堵）
        this._findStartPosition()

        // 玩家格坐标（作为备份，位置 = position）
        this.r = 10   // 小地图上绘制半径

        // 初始朝向：朝 +X 方向（向右）
        this.dirX = 1.0
        this.dirY = 0.0

        // 摄像机平面向量：垂直于 dir，长度决定 FOV
        // 这里 FOV ≈ 2 * atan(0.66) ≈ 66°
        this.planeX = 0.0
        this.planeY = 0.66

        // 速度（格 / 秒）
        this.moveSpeedBase = 2.5
        this.moveSpeedSprint = 4.5
        this.moveSpeed = this.moveSpeedBase
        this.rotSpeed = 1.5     // 键盘旋转速度（rad / s）

        // 碰撞半径（与墙/阻挡精灵的最小距离）
        this.collisionRadius = 0.2

        // 颜色
        this.playerColor = new Color(88, 221, 253)
        this.dirArrowColor = new Color(255, 200, 0)
        this.rayColor = new Color(255, 255, 255, 0.4)

        this.init()
    }

    _findStartPosition() {
        // 从 (1.5, 1.5) 出发，找最近的空地
        const candidates = [
            [1.5, 1.5], [2.5, 1.5], [1.5, 2.5],
            [2.5, 2.5], [3.5, 1.5], [1.5, 3.5]
        ]
        for (let [x, y] of candidates) {
                let mx = Math.floor(x)
                let my = Math.floor(y)
                if (mx >= 0 && my >= 0 && mx < this.columns && my < this.lines) {
                    if (this.worldMap[my][mx] === 0) {
                        this.position = new Vec(x, y)
                        return
                    }
                }
            }
        }

    // Screen.js 读取的便捷 getter
    get posX() { return this.position.x }
    get posY() { return this.position.y }

    init() {
        this.registerAction()
    }

    setSprinting(on) {
        this.moveSpeed = on ? this.moveSpeedSprint : this.moveSpeedBase
    }

    registerAction() {
        let g = this.game

        // 键盘旋转（A/D）
        g.registerAction('a', (dt) => this.rotate(-this.rotSpeed * dt))
        g.registerAction('d', (dt) => this.rotate(+this.rotSpeed * dt))

        // 前后移动
        g.registerAction('w', (dt) => this.tryMove(this.dirX, this.dirY, this.moveSpeed * dt))
        g.registerAction('s', (dt) => this.tryMove(-this.dirX, -this.dirY, this.moveSpeed * dt))

        // 左右平移（strafe）：沿 -plane 方向平移，垂直于朝向向量 dir
        g.registerAction('q', (dt) => this.tryMove(-this.planeX, -this.planeY, this.moveSpeed * dt))
        g.registerAction('e', (dt) => this.tryMove(this.planeX, this.planeY, this.moveSpeed * dt))

        // 方向键兼容（可选的）
        g.registerAction('ArrowUp', (dt) => this.tryMove(this.dirX, this.dirY, this.moveSpeed * dt))
        g.registerAction('ArrowDown', (dt) => this.tryMove(-this.dirX, -this.dirY, this.moveSpeed * dt))
        g.registerAction('ArrowLeft', (dt) => this.rotate(-this.rotSpeed * dt))
        g.registerAction('ArrowRight', (dt) => this.rotate(+this.rotSpeed * dt))
    }

    // 旋转（2D 旋转矩阵：同时旋转方向向量 & 平面向量
    rotate(theta) {
        const cos = Math.cos(theta)
        const sin = Math.sin(theta)

        const oldDirX = this.dirX
        this.dirX = this.dirX * cos - this.dirY * sin
        this.dirY = oldDirX * sin + this.dirY * cos

        const oldPlaneX = this.planeX
        this.planeX = this.planeX * cos - this.planeY * sin
        this.planeY = oldPlaneX * sin + this.planeY * cos
    }

    // ====== 移动：分轴碰撞检测（先尝试 X 轴，再尝试 Y 轴）
    tryMove(dx, dy, step) {
        // 归一化方向
        let len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.0001) return
        dx = dx / len
        dy = dy / len

        let r = this.collisionRadius

        // === X 轴方向
        let newX = this.position.x + dx * step
        let checkX = newX + Math.sign(dx) * r
        if (this.cellIsEmpty(checkX, this.position.y) &&
            !this._collidesBlockingSprite(newX, this.position.y)) {
            this.position.x = newX
        }

        // === Y 轴方向
        let newY = this.position.y + dy * step
        let checkY = newY + Math.sign(dy) * r
        if (this.cellIsEmpty(this.position.x, checkY) &&
            !this._collidesBlockingSprite(this.position.x, newY)) {
            this.position.y = newY
        }
    }

    cellIsEmpty(x, y) {
        let mx = Math.floor(x)
        let my = Math.floor(y)
        if (mx < 0 || my < 0 || mx >= this.columns || my >= this.lines) return false
        return this.worldMap[my][mx] === 0
    }

    _collidesBlockingSprite(x, y) {
        if (!this.spriteManager || !this.spriteManager.sprites || this.spriteManager.sprites.length === 0) return false
        for (let s of this.spriteManager.sprites) {
            if (!s.alive) continue
            if (!s.isBlocking) continue   // 只有阻挡型精灵才拦路（物品不阻挡）
            let dx = x - s.x
            let dy = y - s.y
            let minDist = this.collisionRadius + (s.radius || 0.2)
            if (dx * dx + dy * dy < minDist * minDist) return true
        }
        return false
    }

    // 捡取物品（每次更新：检测玩家与物品精灵的碰撞
    pickupItems() {
        if (!this.spriteManager) return
        for (let s of this.spriteManager.sprites) {
            if (!s.alive || s.type !== 'item') continue
            let dx = this.position.x - s.x
            let dy = this.position.y - s.y
            let pickRadius = 0.5
            if (dx * dx + dy * dy < pickRadius * pickRadius) {
                s.alive = false
                // 这里可以播放音效等（后续阶段 GL 再实现）
            }
        }
    }

    // ========== 绘制（小地图） ==========

    draw() {
        this.drawPlayer()
        this.drawDirArrow()
    }

    drawPlayer() {
        let unit = this.unit
        let px = this.position.x * unit
        let py = this.position.y * unit
        drawArc(this.game.context, this.playerColor, px, py, this.r)
    }

    drawDirArrow() {
        let unit = this.unit
        let startX = this.position.x * unit
        let startY = this.position.y * unit
        let ctx = this.game.context

        // 黄色朝向箭头
        drawLine(ctx, this.dirArrowColor, startX, startY,
            startX + this.dirX * unit * 1.5,
            startY + this.dirY * unit * 1.5)

        // FOV 扇形边界（虚线样式）
        let leftX = this.dirX - this.planeX
        let leftY = this.dirY - this.planeY
        let leftLen = Math.sqrt(leftX * leftX + leftY * leftY)
        leftX /= leftLen
        leftY /= leftLen
        drawLine(ctx, this.rayColor, startX, startY,
            startX + leftX * unit * 2.5,
            startY + leftY * unit * 2.5)

        let rightX = this.dirX + this.planeX
        let rightY = this.dirY + this.planeY
        let rightLen = Math.sqrt(rightX * rightX + rightY * rightY)
        rightX /= rightLen
        rightY /= rightLen
        drawLine(ctx, this.rayColor, startX, startY,
            startX + rightX * unit * 2.5,
            startY + rightY * unit * 2.5)
    }
}

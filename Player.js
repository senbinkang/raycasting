// Player.js
// 玩家控制 + 分轴碰撞（墙 + 精灵阻挡精灵）+ 精灵捡取 + 门交互
//
// 使用: new Player(game, bg, spriteManager)
//   - spriteManager 可省略（若当前阶段不需要）
//
// 按键：
//   W/S = 前/后移动   A/D = 左/右旋转
//   Q = 左平移        E = 开关门（面向的门）
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

        // 初始位置：地图中央
        let startX = Math.floor(this.columns / 2) + 0.5
        let startY = Math.floor(this.lines / 2) + 0.5
        this.position = new Vec(startX, startY)
        this._findStartPosition()

        // 玩家格坐标（作为备份，位置 = position）
        this.r = 10   // 小地图上绘制半径

        // 初始朝向：朝上（-Y）
        this.dirX = 0.0
        this.dirY = -1.0

        // 摄像机平面向量：垂直于 dir，长度决定 FOV
        this.planeX = 0.66
        this.planeY = 0.0

        // 速度（格 / 秒）
        this.moveSpeedBase = 2.5
        this.moveSpeedSprint = 4.5
        this.moveSpeed = this.moveSpeedBase
        this.rotSpeed = 1.5     // 键盘旋转速度（rad / s）

        // 碰撞半径（与墙/阻挡精灵的最小距离）
        this.collisionRadius = 0.4

        // HP
        this.hp = 100
        this.maxHp = 100
        this.invincibleTimer = 0

        // 颜色
        this.playerColor = new Color(88, 221, 253)
        this.dirArrowColor = new Color(255, 200, 0)
        this.rayColor = new Color(255, 255, 255, 0.4)

        this.init()
    }

    _findStartPosition() {
        let cx = Math.floor(this.columns / 2)
        let cy = Math.floor(this.lines / 2)
        if (this.worldMap[cy] && this.worldMap[cy][cx] === 0) return
        for (let r = 1; r < Math.max(this.columns, this.lines); r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    let mx = cx + dx, my = cy + dy
                    if (mx >= 0 && my >= 0 && mx < this.columns && my < this.lines) {
                        if (this.worldMap[my][mx] === 0) {
                            this.position = new Vec(mx + 0.5, my + 0.5)
                            return
                        }
                    }
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

    takeDamage(amount) {
        if (this.invincibleTimer > 0) return
        this.hp = Math.max(0, this.hp - amount)
        this.invincibleTimer = 0.5
    }

    registerAction() {
        let g = this.game

        // 前后移动
        g.registerAction('w', (dt) => this.tryMove(this.dirX, this.dirY, this.moveSpeed * dt))
        g.registerAction('s', (dt) => this.tryMove(-this.dirX, -this.dirY, this.moveSpeed * dt))

        // 左右平移（A/D 为主，Q 兼容）
        g.registerAction('a', (dt) => this.tryMove(-this.planeX, -this.planeY, this.moveSpeed * dt))
        g.registerAction('d', (dt) => this.tryMove(this.planeX, this.planeY, this.moveSpeed * dt))
        g.registerAction('q', (dt) => this.tryMove(-this.planeX, -this.planeY, this.moveSpeed * dt))

        // 方向键兼容
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

    // ====== 移动：分轴碰撞检测（原子化：先分别判定，再一起应用）
    tryMove(dx, dy, step) {
        let len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.0001) return
        dx = dx / len
        dy = dy / len

        let r = this.collisionRadius

        let newX = this.position.x + dx * step
        let newY = this.position.y + dy * step
        let checkX = newX + Math.sign(dx) * r
        let checkY = newY + Math.sign(dy) * r

        let canMoveX = true
        for (let offset of [0, 0.3, -0.3, 0.55, -0.55, 0.85, -0.85]) {
            let sy = this.position.y + offset * r
            if (!this.cellIsEmpty(checkX, sy)) { canMoveX = false; break }
        }
        if (canMoveX && dy !== 0) {
            let sy = this.position.y + Math.sign(dy) * r
            if (!this.cellIsEmpty(checkX, sy)) canMoveX = false
        }

        let canMoveY = true
        for (let offset of [0, 0.3, -0.3, 0.55, -0.55, 0.85, -0.85]) {
            let sx = this.position.x + offset * r
            if (!this.cellIsEmpty(sx, checkY)) { canMoveY = false; break }
        }
        if (canMoveY && dx !== 0) {
            let sx = this.position.x + Math.sign(dx) * r
            if (!this.cellIsEmpty(sx, checkY)) canMoveY = false
        }

        if (canMoveX) this.position.x = newX
        if (canMoveY) this.position.y = newY
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
            if (!s.isBlocking) continue
            if (s.type === 'enemy') continue
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
                this.hp = Math.min(this.maxHp, this.hp + 30)
            }
        }
    }

    // ========== 绘制（小地图） ==========

    draw() {
        this.drawPlayer()
        this.drawDirArrow()
        this.drawRays()
    }

    drawRays() {
        let ctx = this.game.context
        let unit = this.unit
        let startX = this.position.x * unit
        let startY = this.position.y * unit
        let rayColor = new Color(255, 255, 100, 0.3)
        let centerRayColor = new Color(255, 255, 255, 0.8)

        let centerAngle = Math.atan2(this.dirY, this.dirX)
        let halfFov = Math.atan2(0.66, 1.0)
        let totalSteps = Math.round(2 * halfFov / (5 * Math.PI / 180))
        if (totalSteps < 1) totalSteps = 1
        let centerStep = Math.round(totalSteps / 2)

        for (let i = 0; i <= totalSteps; i++) {
            let angle = centerAngle - halfFov + (2 * halfFov * i / totalSteps)
            let rx = Math.cos(angle), ry = Math.sin(angle)
            let dist = 0.1, maxDist = 20
            while (dist < maxDist) {
                let cx = Math.floor(this.position.x + rx * dist)
                let cy = Math.floor(this.position.y + ry * dist)
                if (cx < 0 || cy < 0 || cx >= this.columns || cy >= this.lines) break
                if (this.worldMap[cy][cx] > 0 && this.worldMap[cy][cx] < 101) break
                dist += 0.05
            }
            let color = (i === centerStep) ? centerRayColor : rayColor
            drawLine(ctx, color, startX, startY,
                startX + rx * dist * unit, startY + ry * dist * unit)
        }
    }

    drawPlayer() {
        let unit = this.unit
        let px = this.position.x * unit
        let py = this.position.y * unit
        drawArc(this.game.context, this.playerColor, px, py, this.r)
    }

    drawDirArrow() {
        // 朝向已由 drawRays 中白色中心射线表示，此处不再绘制黄线
    }
}

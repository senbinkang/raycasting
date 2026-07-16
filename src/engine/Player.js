import { Vec } from './utils/Vec.js'
import { Color } from './utils/Color.js'
import { drawLine, drawArc } from './utils/Canvas.js'

export class Player {
    constructor(game, bg, spriteManager) {
        this.game = game
        this.bg = bg
        this.spriteManager = spriteManager || null
        this.unit = bg.unit
        this.lines = bg.lines
        this.columns = bg.columns
        this.worldMap = bg.worldMap

        const startX = Math.floor(this.columns / 2) + 0.5
        const startY = Math.floor(this.lines / 2) + 0.5
        this.position = new Vec(startX, startY)
        this._findStartPosition()

        this.r = 10

        this.dirX = 0.0
        this.dirY = -1.0

        this.planeX = 0.66
        this.planeY = 0.0

        this.moveSpeedBase = 2.5
        this.moveSpeedSprint = 4.5
        this.moveSpeed = this.moveSpeedBase
        this.rotSpeed = 1.5

        this.collisionRadius = 0.4

        this.hp = 100
        this.maxHp = 100
        this.invincibleTimer = 0
        this.playerColor = new Color(88, 221, 253)
        this.dirArrowColor = new Color(255, 200, 0)
        this.rayColor = new Color(255, 255, 255, 0.4)

        this.init()
    }

    _findStartPosition() {
        const cx = Math.floor(this.columns / 2)
        const cy = Math.floor(this.lines / 2)
        if (this.worldMap[cy] && this.worldMap[cy][cx] === 0) { return }
        for (let r = 1; r < Math.max(this.columns, this.lines); r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    const mx = cx + dx,
                        my = cy + dy
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

    get posX() {
        return this.position.x
    }

    get posY() {
        return this.position.y
    }

    init() {
        this.registerAction()
    }

    setSprinting(on) {
        this.moveSpeed = on ? this.moveSpeedSprint : this.moveSpeedBase
    }

    takeDamage(amount) {
        if (this.invincibleTimer > 0) { return }
        this.hp = Math.max(0, this.hp - amount)
        this.invincibleTimer = 2
        if (window.audioManager) { window.audioManager.playPlayerHurt() }
        if (window.commentaryService) {
            window.commentaryService.queue('player_hurt', {
                damage: amount,
                hp: Math.ceil(this.hp),
                maxHp: this.maxHp,
            })
        }
    }

    registerAction() {
        const g = this.game

        g.registerAction('w', (dt) => this.tryMove(this.dirX, this.dirY, this.moveSpeed * dt))
        g.registerAction('s', (dt) => this.tryMove(-this.dirX, -this.dirY, this.moveSpeed * dt))

        g.registerAction('a', (dt) => this.tryMove(-this.planeX, -this.planeY, this.moveSpeed * dt))
        g.registerAction('d', (dt) => this.tryMove(this.planeX, this.planeY, this.moveSpeed * dt))

        g.registerAction('ArrowUp', (dt) => this.tryMove(this.dirX, this.dirY, this.moveSpeed * dt))
        g.registerAction('ArrowDown', (dt) => this.tryMove(-this.dirX, -this.dirY, this.moveSpeed * dt))
        g.registerAction('ArrowLeft', (dt) => this.rotate(-this.rotSpeed * dt))
        g.registerAction('ArrowRight', (dt) => this.rotate(+this.rotSpeed * dt))
    }

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

    tryMove(dx, dy, step) {
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.0001) { return }
        dx = dx / len
        dy = dy / len

        const r = this.collisionRadius

        const newX = this.position.x + dx * step
        const newY = this.position.y + dy * step
        const checkX = newX + Math.sign(dx) * r
        const checkY = newY + Math.sign(dy) * r

        let canMoveX = true
        for (const offset of [0, 0.3, -0.3, 0.55, -0.55, 0.85, -0.85]) {
            const sy = this.position.y + offset * r
            if (!this.cellIsEmpty(checkX, sy)) {
                canMoveX = false
                break
            }
        }
        if (canMoveX && dy !== 0) {
            const sy = this.position.y + Math.sign(dy) * r
            if (!this.cellIsEmpty(checkX, sy)) { canMoveX = false }
        }

        let canMoveY = true
        for (const offset of [0, 0.3, -0.3, 0.55, -0.55, 0.85, -0.85]) {
            const sx = this.position.x + offset * r
            if (!this.cellIsEmpty(sx, checkY)) {
                canMoveY = false
                break
            }
        }
        if (canMoveY && dx !== 0) {
            const sx = this.position.x + Math.sign(dx) * r
            if (!this.cellIsEmpty(sx, checkY)) { canMoveY = false }
        }

        if (canMoveX) { this.position.x = newX }
        if (canMoveY) { this.position.y = newY }
    }

    cellIsEmpty(x, y) {
        const mx = Math.floor(x)
        const my = Math.floor(y)
        if (mx < 0 || my < 0 || mx >= this.columns || my >= this.lines) { return false }
        return this.worldMap[my][mx] === 0
    }

    pickupItems() {
        if (!this.spriteManager) { return }
        for (const s of this.spriteManager.sprites) {
            if (!s.alive || s.type !== 'item') { continue }
            const dx = this.position.x - s.x
            const dy = this.position.y - s.y
            const pickRadius = 0.5
            if (dx * dx + dy * dy < pickRadius * pickRadius) {
                if (this.hp >= this.maxHp) { continue }
                s.alive = false
                this.hp = Math.min(this.maxHp, this.hp + 30)
                if (window.commentaryService) {
                    window.commentaryService.queue('health_pickup', {
                        hp: Math.ceil(this.hp),
                        maxHp: this.maxHp,
                    })
                }
            }
        }
    }

    draw() {
        this.drawPlayer()
        this.drawRays()
    }

    drawRays() {
        const ctx = this.game.context
        const unit = this.unit
        const startX = this.position.x * unit
        const startY = this.position.y * unit
        const rayColor = new Color(255, 255, 100, 0.3)
        const centerRayColor = new Color(255, 255, 255, 0.8)

        const centerAngle = Math.atan2(this.dirY, this.dirX)
        const halfFov = Math.atan2(0.66, 1.0)
        let totalSteps = Math.round((2 * halfFov) / (5 * Math.PI / 180))
        if (totalSteps < 1) { totalSteps = 1 }
        const centerStep = Math.round(totalSteps / 2)

        for (let i = 0; i <= totalSteps; i++) {
            const angle = centerAngle - halfFov + (2 * halfFov * i) / totalSteps
            const rx = Math.cos(angle),
                ry = Math.sin(angle)
            let dist = 0.1
            const maxDist = 20
            while (dist < maxDist) {
                const cx = Math.floor(this.position.x + rx * dist)
                const cy = Math.floor(this.position.y + ry * dist)
                if (cx < 0 || cy < 0 || cx >= this.columns || cy >= this.lines) { break }
                if (this.worldMap[cy][cx] > 0 && this.worldMap[cy][cx] < 101) { break }
                dist += 0.05
            }
            const color = i === centerStep ? centerRayColor : rayColor
            drawLine(ctx, color, startX, startY, startX + rx * dist * unit, startY + ry * dist * unit)
        }
    }

    drawPlayer() {
        const unit = this.unit
        const px = this.position.x * unit
        const py = this.position.y * unit
        drawArc(this.game.context, this.playerColor, px, py, this.r)
    }
}

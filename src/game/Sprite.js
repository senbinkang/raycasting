export class Sprite {
    constructor(x, y, textureIndex, options = {}) {
        this.x = x
        this.y = y
        this.textureIndex = textureIndex
        this.type = options.type || 'decor'
        this.radius = options.radius || 0.2
        this.isPickable = !!options.isPickable
        this.speed = options.speed || 0
        this.hp = options.hp || 100
        this.maxHp = this.hp
        this.damage = options.damage || 20
        this.score = options.score || 100
        this.contactTimer = 0
        this.alive = true
        this.patrolAngle = Math.random() * Math.PI * 2
        this.patrolTimer = 2 + Math.random() * 2
        this.hitFlashTimer = 0
        this.ranged = options.ranged || false
        this.shootInterval = options.shootInterval || 2
        this.shootTimer = this.shootInterval

        if (this.type === 'item') {
            this.isBlocking = false
        } else {
            this.isBlocking = options.isBlocking !== false
        }
    }

    takeDamage(amount) {
        if (!this.alive) {return false}
        this.hp = Math.max(0, this.hp - amount)
        this.hitFlashTimer = 0.1
        if (this.hp <= 0) {
            this.alive = false
            return true
        }
        return false
    }

    update(dt, player, bg) {
        if (!this.alive || this.type !== 'enemy' || this.speed === 0) {return}
        if (this.hitFlashTimer > 0) {this.hitFlashTimer -= dt}

        const dx = player.position.x - this.x
        const dy = player.position.y - this.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 20) {
            this._doPatrol(dt, bg)
            return
        }

        if (dist < 0.8) {
            if (this.contactTimer <= 0) {
                player.takeDamage(this.damage || 20)
                this.contactTimer = 3
            }
        } else {
            this.contactTimer = 0
        }
        if (this.contactTimer > 0) {this.contactTimer -= dt}

        if (dist < 0.8) {return}

        const ndx = dx / dist
        const ndy = dy / dist

        let canSee = true
        const steps = Math.max(2, Math.floor(dist * 4))
        for (let i = 1; i <= steps; i++) {
            const t = i / steps
            const cx = Math.floor(this.x + ndx * (dist * t))
            const cy = Math.floor(this.y + ndy * (dist * t))
            if (cx < 0 || cy < 0 || cx >= bg.columns || cy >= bg.lines) {
                canSee = false
                break
            }
            if (bg.worldMap[cy][cx] !== 0) {
                canSee = false
                break
            }
        }
        if (this.ranged) {
            if (canSee) {
                if (dist > 4) {
                    this.shootTimer -= dt
                    if (this.shootTimer <= 0) {
                        this.shootTimer = this.shootInterval
                        return {
                            projectile: {
                                x: this.x,
                                y: this.y,
                                ndx,
                                ndy,
                                speed: 4,
                                damage: 15,
                                originX: this.x,
                                originY: this.y,
                            },
                        }
                    }
                } else if (dist < 3) {
                    this._moveToward(-ndx, -ndy, this.speed * dt, bg)
                }
            } else {
                this._doPatrol(dt, bg)
            }
            return null
        }

        if (!canSee) {
            this._doPatrol(dt, bg)
            return null
        }

        this._moveToward(ndx, ndy, this.speed * dt, bg)
        return null
    }

    _doPatrol(dt, bg) {
        this.patrolTimer -= dt
        if (this.patrolTimer <= 0) {
            this.patrolAngle = Math.random() * Math.PI * 2
            this.patrolTimer = 2 + Math.random() * 2
        }
        const ndx = Math.cos(this.patrolAngle)
        const ndy = Math.sin(this.patrolAngle)
        this._moveToward(ndx, ndy, this.speed * 0.4 * dt, bg)
    }

    _moveToward(ndx, ndy, step, bg) {
        const r = this.radius || 0.2
        const moveX = this.x + ndx * step
        const moveY = this.y + ndy * step

        const checkX = moveX + Math.sign(ndx) * r
        let canMoveX = true
        for (const offset of [0, 0.4, -0.4, 0.75, -0.75]) {
            const sy = this.y + offset * r
            const cx = Math.floor(checkX),
                cy = Math.floor(sy)
            if (cx >= 0 && cy >= 0 && cx < bg.columns && cy < bg.lines) {
                if (bg.worldMap[cy][cx] !== 0) {
                    canMoveX = false
                    break
                }
            }
        }
        if (canMoveX && ndy !== 0) {
            const sy = this.y + Math.sign(ndy) * r
            const cx = Math.floor(checkX),
                cy = Math.floor(sy)
            if (cx >= 0 && cy >= 0 && cx < bg.columns && cy < bg.lines) {
                if (bg.worldMap[cy][cx] !== 0) {canMoveX = false}
            }
        }
        if (canMoveX) {this.x = moveX}

        const checkY = moveY + Math.sign(ndy) * r
        let canMoveY = true
        for (const offset of [0, 0.4, -0.4, 0.75, -0.75]) {
            const sx = this.x + offset * r
            const cx = Math.floor(sx),
                cy = Math.floor(checkY)
            if (cx >= 0 && cy >= 0 && cx < bg.columns && cy < bg.lines) {
                if (bg.worldMap[cy][cx] !== 0) {
                    canMoveY = false
                    break
                }
            }
        }
        if (canMoveY && ndx !== 0) {
            const sx = this.x + Math.sign(ndx) * r
            const cx = Math.floor(sx),
                cy = Math.floor(checkY)
            if (cx >= 0 && cy >= 0 && cx < bg.columns && cy < bg.lines) {
                if (bg.worldMap[cy][cx] !== 0) {canMoveY = false}
            }
        }
        if (canMoveY) {this.y = moveY}
    }
}

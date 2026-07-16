export class Weapon {
    constructor(player, bg, spriteManager) {
        this.player = player
        this.bg = bg
        this.spriteManager = spriteManager || null

        this.recoil = 0
        this.recoilDecay = 4

        this.cooldown = 0
        this.cooldownTime = 0.18

        this.triggerDown = false
    }

    update(dt) {
        if (this.recoil > 0) {
            this.recoil = Math.max(0, this.recoil - this.recoilDecay * dt)
        }
        if (this.cooldown > 0) {
            this.cooldown = Math.max(0, this.cooldown - dt)
        }
    }

    _hasLineOfSight(sprite) {
        const player = this.player
        const dx = sprite.x - player.position.x
        const dy = sprite.y - player.position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const ndx = dx / dist
        const ndy = dy / dist
        const steps = Math.max(2, Math.floor(dist * 4))
        for (let i = 1; i <= steps; i++) {
            const t = i / steps
            const cx = Math.floor(player.position.x + ndx * (dist * t))
            const cy = Math.floor(player.position.y + ndy * (dist * t))
            if (cx < 0 || cy < 0 || cx >= this.bg.columns || cy >= this.bg.lines) {return false}
            if (this.bg.worldMap[cy][cx] !== 0) {return false}
        }
        return true
    }

    fire() {
        if (this.cooldown > 0) {return null}

        const player = this.player
        const width = 640
        const maxRange = 10

        if (window.audioManager) {window.audioManager.playShoot()}
        this.recoil = 1
        this.cooldown = this.cooldownTime

        if (!this.spriteManager) {return null}

        let bestHit = null
        let bestDist = Infinity

        for (const s of this.spriteManager.sprites) {
            if (!s.alive || s.type !== 'enemy') {continue}

            const spriteX = s.x - player.position.x
            const spriteY = s.y - player.position.y

            const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY)
            const transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY)
            const transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY)

            if (transformY <= 0.05) {continue}
            if (transformY > maxRange) {continue}

            const spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY))
            const spriteWidth = Math.abs(Math.floor(width / transformY))

            const hitRange = Math.max(spriteWidth * 0.35, 8)
            const centerX = width / 2
            if (
                Math.abs(spriteScreenX - centerX) < hitRange &&
                transformY < bestDist &&
                this._hasLineOfSight(s)
            ) {
                bestDist = transformY
                bestHit = s
            }
        }

        return bestHit
    }

    draw(ctx, canvasWidth, canvasHeight) {
        ctx.fillStyle = 'rgba(255,220,80,0.9)'
        const cx = canvasWidth / 2
        const cy = canvasHeight / 2
        ctx.fillRect(cx - 1, cy - 10, 2, 20)
        ctx.fillRect(cx - 10, cy - 1, 20, 2)

        const gunW = 160
        const gunH = 90
        const baseX = canvasWidth - gunW - 30
        const baseY = canvasHeight - gunH - 10

        const recoilOffset = this.recoil * 30

        ctx.save()
        ctx.translate(baseX + gunW / 2, baseY + gunH + recoilOffset)

        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(-gunW / 2, -gunH, gunW, gunH)

        ctx.fillStyle = '#2a2a2a'
        ctx.fillRect(-gunW / 2 + 10, -gunH, 40, gunH)

        ctx.fillStyle = '#111'
        ctx.fillRect(-gunW / 2 + 10, -gunH - 12, gunW - 20, 14)

        ctx.fillStyle = '#5a3a1a'
        ctx.fillRect(-gunW / 2 + 15, 0, 50, 55)

        ctx.strokeStyle = '#333'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(-gunW / 2 + 40, -10, 18, 0, Math.PI)
        ctx.stroke()

        ctx.restore()
    }
}

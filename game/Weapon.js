// Weapon.js
// 2D 手枪渲染 + DDA 射击射线检测
// 绘制在游戏最上层，后坐力动画，左键按住连射

class Weapon {
    constructor(player, bg, spriteManager) {
        this.player = player
        this.bg = bg
        this.spriteManager = spriteManager || null

        // 后坐力状态
        this.recoil = 0           // 0~1，1 = 最大后坐力
        this.recoilDecay = 4     // 每秒衰减量

        // 射击冷却（防止一帧多次射击）
        this.cooldown = 0
        this.cooldownTime = 0.18  // 秒

        // 射击状态
        this.triggerDown = false
    }

    // 每帧调用：更新后坐力 + 射击冷却
    update(dt) {
        if (this.recoil > 0) {
            this.recoil = Math.max(0, this.recoil - this.recoilDecay * dt)
        }
        if (this.cooldown > 0) {
            this.cooldown = Math.max(0, this.cooldown - dt)
        }
    }

    // 射击：屏幕空间命中检测 + 准星范围判定
    fire() {
        if (this.cooldown > 0) return null

        const player = this.player
        const width = 640
        const maxRange = 10

        if (window.audioManager) window.audioManager.playShoot()
        this.recoil = 1
        this.cooldown = this.cooldownTime

        if (!this.spriteManager) return null

        let bestHit = null
        let bestDist = Infinity

        for (let s of this.spriteManager.sprites) {
            if (!s.alive || s.type !== 'enemy') continue

            let spriteX = s.x - player.position.x
            let spriteY = s.y - player.position.y

            let invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY)
            let transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY)
            let transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY)

            if (transformY <= 0.05) continue
            if (transformY > maxRange) continue

            let spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY))
            let spriteWidth = Math.abs(Math.floor(width / transformY))

            let hitRange = Math.max(spriteWidth * 0.35, 8)
            let centerX = width / 2
            if (Math.abs(spriteScreenX - centerX) < hitRange && transformY < bestDist) {
                bestDist = transformY
                bestHit = s
            }
        }

        return bestHit
    }

    // 在游戏 Canvas 最上层绘制手枪
    draw(ctx, canvasWidth, canvasHeight) {
        // 准星颜色
        ctx.fillStyle = 'rgba(255,220,80,0.9)'
        const cx = canvasWidth / 2
        const cy = canvasHeight / 2
        ctx.fillRect(cx - 1, cy - 10, 2, 20)
        ctx.fillRect(cx - 10, cy - 1, 20, 2)

        // 手枪（Canvas 右侧下半部分）
        const gunW = 160
        const gunH = 90
        const baseX = canvasWidth - gunW - 30
        const baseY = canvasHeight - gunH - 10

        // 后坐力偏移（向上）
        const recoilOffset = this.recoil * 30

        ctx.save()
        ctx.translate(baseX + gunW / 2, baseY + gunH + recoilOffset)

        // 枪身（黑色矩形）
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(-gunW / 2, -gunH, gunW, gunH)

        // 枪口（深灰）
        ctx.fillStyle = '#2a2a2a'
        ctx.fillRect(-gunW / 2 + 10, -gunH, 40, gunH)

        // 枪管（横向突出）
        ctx.fillStyle = '#111'
        ctx.fillRect(-gunW / 2 + 10, -gunH - 12, gunW - 20, 14)

        // 握把（棕色）
        ctx.fillStyle = '#5a3a1a'
        ctx.fillRect(-gunW / 2 + 15, 0, 50, 55)

        // 扳机护圈
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(-gunW / 2 + 40, -10, 18, 0, Math.PI)
        ctx.stroke()

        ctx.restore()
    }
}

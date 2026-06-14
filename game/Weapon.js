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
        this.triggerDown = false  // 鼠标左键是否按住
        this.lastFireTime = 0
        this.fireRate = 0.18     // 秒 / 发
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

    // 射击：沿玩家视线方向做 DDA 检测，返回命中的第一个敌人 Sprite
    fire() {
        if (this.cooldown > 0) return null

        const player = this.player
        const bg = this.bg
        const worldMap = bg.worldMap

        // 射线方向
        const rayDirX = player.dirX
        const rayDirY = player.dirY

        let mapX = Math.floor(player.position.x)
        let mapY = Math.floor(player.position.y)

        let deltaDistX = Math.abs(1 / rayDirX)
        let deltaDistY = Math.abs(1 / rayDirY)

        let sideDistX, sideDistY, stepX, stepY
        if (rayDirX < 0) { stepX = -1; sideDistX = (player.position.x - mapX) * deltaDistX }
        else { stepX = 1; sideDistX = (mapX + 1 - player.position.x) * deltaDistX }
        if (rayDirY < 0) { stepY = -1; sideDistY = (player.position.y - mapY) * deltaDistY }
        else { stepY = 1; sideDistY = (mapY + 1 - player.position.y) * deltaDistY }

        let hit = 0, safety = 0
        while (hit === 0 && safety < 200) {
            if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX }
            else { sideDistY += deltaDistY; mapY += stepY }
            if (mapX < 0 || mapY < 0 || mapX >= bg.columns || mapY >= bg.lines) break
            let cell = worldMap[mapY][mapX]
            // 射线击中墙或完全打开的门（>= 101 门格，且完全打开 > 0.9）则停止
            if (cell > 0) {
                if (cell >= 101 && cell <= 199) {
                    let door = bg.doors[mapX + ',' + mapY]
                    if (!door || door.openProgress < 0.9) hit = 1
                } else {
                    hit = 1
                }
            }
            safety++
        }

        // 命中墙或门，无敌人命中
        if (hit === 1) return null

        // 检查是否命中精灵（敌人）
        if (this.spriteManager) {
            let entries = this.spriteManager.sprites.filter(s => s.alive && s.type === 'enemy')
            // 按距离由近到远排序
            entries.sort((a, b) => {
                let da = (a.x - player.position.x) ** 2 + (a.y - player.position.y) ** 2
                let db = (b.x - player.position.x) ** 2 + (b.y - player.position.y) ** 2
                return da - db
            })

            for (let s of entries) {
                let sx = s.x - player.position.x
                let sy = s.y - player.position.y
                let invDet = 1 / (player.planeX * player.dirY - player.dirX * player.planeY)
                let tx = invDet * (player.dirY * sx - player.dirX * sy)
                let ty = invDet * (-player.planeY * sx + player.planeX * sy)
                if (ty <= 0) continue
                let spriteW = bg.columns / ty
                let spriteH = bg.lines / ty
                let screenX = (bg.columns / 2) * (1 + tx / ty)
                if (Math.abs(spriteW) < 0.01) continue
                let hitRange = spriteW * 0.3
                if (Math.abs(tx - ty * (screenX - player.position.x) / player.dirX) < hitRange) {
                    return s
                }
            }
        }
        return null
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

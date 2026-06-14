// game/SpriteManager.js
// 管理场景中所有精灵：每帧 update AI + 绘制（按距离从远到近 + zBuffer 遮挡）
//
// 使用：
//   let sm = new SpriteManager()
//   sm.add(new Sprite(...))
//   sm.update(dt, player, bg)
//   sm.draw(ctx, player, textureManager, zBuffer, width, height)
//   sm.drawOnMinimap(ctx, unit)

class SpriteManager {
    constructor() {
        this.sprites = []
    }

    add(sprite) { this.sprites.push(sprite) }

    // 每帧调用：驱动精灵 AI
    update(dt, player, bg) {
        for (let s of this.sprites) s.update(dt, player, bg)

        // 玩家捡取物品（统一在 SpriteManager 处理，Player 无需关心内部结构）
        if (player && typeof player.pickupItems === 'function') {
            player.pickupItems()
        }
    }

    // ====== 3D 视图绘制 ======
    draw(ctx, player, textureManager, zBuffer, width, height) {
        const texSize = textureManager.size

        // 1) 按距离从远到近排序（远的先画，近的覆盖远的）
        let entries = this.sprites
            .filter(s => s.alive)
            .map(s => ({
                s,
                d: (s.x - player.position.x) ** 2 + (s.y - player.position.y) ** 2
            }))
            .sort((a, b) => b.d - a.d)

        for (let entry of entries) {
            let s = entry.s

            // 2) 变换到相机空间
            // 把精灵从世界坐标转换到玩家相机坐标
            let spriteX = s.x - player.position.x
            let spriteY = s.y - player.position.y

            // 逆矩阵：invDet = 1 / (planeX * dirY - dirX * planeY)
            let invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY)

            // transformX: 水平偏移；transformY: 深度（必须 > 0）
            let transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY)
            let transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY)

            if (transformY <= 0.05) continue   // 在背后或太近，跳过

            // 3) 屏幕 x 坐标
            let spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY))

            // 4) 高度 / 宽度
            let spriteHeight = Math.abs(Math.floor(height / transformY))
            let spriteWidth = Math.abs(Math.floor(width / transformY))

            let drawStartY = Math.floor(-spriteHeight / 2 + height / 2)
            let drawEndY = drawStartY + spriteHeight
            let drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX)
            let drawEndX = drawStartX + spriteWidth

            // 5) 取精灵纹理（程序化生成 64×64）
            let img = textureManager.getPixels(s.textureIndex)

            // 6) 按列绘制：每列 stripe 判断是否被墙挡住
            for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
                if (stripe < 0 || stripe >= width) continue
                if (zBuffer[stripe] < transformY) continue   // 被更近的墙挡住

                let texX = Math.floor((stripe - (-spriteWidth / 2 + spriteScreenX)) * texSize / spriteWidth)
                if (texX < 0 || texX >= texSize) continue

                for (let y = drawStartY; y < drawEndY; y++) {
                    if (y < 0 || y >= height) continue
                    let d = (y - drawStartY) / spriteHeight
                    let texY = Math.floor(d * texSize)
                    if (texY < 0 || texY >= texSize) continue

                    let r, g, b, a
                    if (img) {
                        let idx = (texY * texSize + texX) * 4
                        r = img.data[idx]
                        g = img.data[idx + 1]
                        b = img.data[idx + 2]
                        a = img.data[idx + 3]
                    } else {
                        // 没纹理：按类型给默认色
                        if (s.type === 'enemy') { r = 220; g = 40; b = 40; a = 255 }
                        else if (s.type === 'item') { r = 230; g = 220; b = 80; a = 255 }
                        else { r = 200; g = 200; b = 200; a = 255 }
                    }

                    if (a < 32) continue   // 透明像素跳过

                    // 距离衰减（离得远越暗）
                    let distFactor = 1.0 / (1 + 0.015 * transformY * transformY)
                    r = Math.floor(r * distFactor)
                    g = Math.floor(g * distFactor)
                    b = Math.floor(b * distFactor)

                    ctx.fillStyle = `rgb(${r},${g},${b})`
                    ctx.fillRect(stripe, y, 1, 1)
                }
            }
        }
    }

    // ====== 小地图绘制：圆点 + 颜色区分类型 ======
    drawOnMinimap(ctx, unit) {
        for (let s of this.sprites) {
            if (!s.alive) continue
            let color
            if (s.type === 'enemy') color = new Color(255, 50, 50)
            else if (s.type === 'item') color = new Color(255, 230, 50)
            else color = new Color(220, 220, 220)
            drawArc(ctx, color, s.x * unit, s.y * unit, 5)
        }
    }
}

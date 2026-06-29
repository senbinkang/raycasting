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

    // 每帧调用：驱动精灵 AI + 分离力 + 捡取
    update(dt, player, bg) {
        for (let s of this.sprites) s.update(dt, player, bg)

        // 敌人间分离力，防止重叠
        let enemies = this.sprites.filter(s => s.alive && s.type === 'enemy')
        for (let i = 0; i < enemies.length; i++) {
            for (let j = i + 1; j < enemies.length; j++) {
                let dx = enemies[j].x - enemies[i].x
                let dy = enemies[j].y - enemies[i].y
                let dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < 0.6 && dist > 0.001) {
                    let push = (0.6 - dist) / 2
                    let nx = dx / dist, ny = dy / dist
                    enemies[i].x -= nx * push
                    enemies[i].y -= ny * push
                    enemies[j].x += nx * push
                    enemies[j].y += ny * push
                }
            }
        }

        if (player && typeof player.pickupItems === 'function') {
            player.pickupItems()
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

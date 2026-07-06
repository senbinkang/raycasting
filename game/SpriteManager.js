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

    // 每帧调用：驱动精灵 AI + 分离力 + 捡取，返回新子弹列表
    update(dt, player, bg) {
        let projectiles = []
        for (let s of this.sprites) {
            let result = s.update(dt, player, bg)
            if (result && result.projectile) projectiles.push(result.projectile)
        }

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

        return projectiles
    }

    // ====== 小地图绘制：圆点 + 按敌人类型着色 ======
    drawOnMinimap(ctx, unit) {
        const ENEMY_COLORS = {
            201: new Color(210, 50, 50),   // 普通：红
            203: new Color(230, 140, 40),  // 快速：橙
            204: new Color(140, 50, 200),  // 坦克：紫
            205: new Color(50, 200, 200),  // 幽灵：青
            206: new Color(60, 180, 80),   // 远程：绿
        }
        for (let s of this.sprites) {
            if (!s.alive) continue
            let color
            if (s.type === 'enemy') color = ENEMY_COLORS[s.textureIndex] || new Color(255, 50, 50)
            else if (s.type === 'item') color = new Color(255, 230, 50)
            else color = new Color(220, 220, 220)
            drawArc(ctx, color, s.x * unit, s.y * unit, 5)
        }
    }
}

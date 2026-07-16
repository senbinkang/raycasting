import { Color } from '../engine/utils/Color.js'
import { drawArc } from '../engine/utils/Canvas.js'

export class SpriteManager {
    constructor() {
        this.sprites = []
    }

    add(sprite) {
        this.sprites.push(sprite)
    }

    update(dt, player, bg) {
        const projectiles = []
        for (const s of this.sprites) {
            const result = s.update(dt, player, bg)
            if (result && result.projectile) {projectiles.push(result.projectile)}
        }

        const enemies = this.sprites.filter((s) => s.alive && s.type === 'enemy')
        for (let i = 0; i < enemies.length; i++) {
            for (let j = i + 1; j < enemies.length; j++) {
                const dx = enemies[j].x - enemies[i].x
                const dy = enemies[j].y - enemies[i].y
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < 0.6 && dist > 0.001) {
                    const push = (0.6 - dist) / 2
                    const nx = dx / dist,
                        ny = dy / dist
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

    drawOnMinimap(ctx, unit) {
        const ENEMY_COLORS = {
            201: new Color(210, 50, 50),
            203: new Color(230, 140, 40),
            204: new Color(140, 50, 200),
            205: new Color(50, 200, 200),
            206: new Color(60, 180, 80),
        }
        for (const s of this.sprites) {
            if (!s.alive) {continue}
            let color
            if (s.type === 'enemy') {color = ENEMY_COLORS[s.textureIndex] || new Color(255, 50, 50)}
            else if (s.type === 'item') {color = new Color(255, 230, 50)}
            else {color = new Color(220, 220, 220)}
            drawArc(ctx, color, s.x * unit, s.y * unit, 5)
        }
    }
}

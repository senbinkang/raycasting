// game/Sprite.js
// 精灵对象（敌人 / 物品 / 装饰物）
//
// 使用：
//   new Sprite(x, y, textureIndex, { type: 'enemy', speed: 1.2, hp: 100 })
//   new Sprite(x, y, textureIndex, { type: 'item', isPickable: true })
//
// 字段含义：
//   x, y        世界坐标（格）
//   textureIndex 纹理索引（由 TextureManager 提供）
//   type        'enemy' | 'item' | 'decor'
//   radius      碰撞半径（格，默认 0.2）
//   isPickable  是否可捡取
//   isBlocking  是否阻挡玩家移动（默认 true；物品自动设为 false）
//   speed       AI 移动速度（0 = 不动）
//   hp / maxHp 生命值

class Sprite {
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
        this.alive = true

        // 物品自动不阻挡；其它默认阻挡，除非显式说不阻挡
        if (this.type === 'item') {
            this.isBlocking = false
        } else {
            this.isBlocking = options.isBlocking !== false
        }
    }

    // 受到伤害，返回是否死亡
    takeDamage(amount) {
        if (!this.alive) return false
        this.hp = Math.max(0, this.hp - amount)
        if (this.hp <= 0) {
            this.alive = false
            return true
        }
        return false
    }

    // 简单 AI：朝玩家走，视线被墙挡住时不动；被门挡住也不走
    update(dt, player, bg) {
        if (!this.alive || this.type !== 'enemy' || this.speed === 0) return

        let dx = player.position.x - this.x
        let dy = player.position.y - this.y
        let dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 20) return   // 太远不处理

        // 归一化移动方向
        let ndx = dx / dist
        let ndy = dy / dist

        // 视线检查：沿玩家-敌人连线按格采样，遇到墙或门（未开）视为看不见
        let canSee = true
        let steps = Math.max(2, Math.floor(dist * 4))
        for (let i = 1; i <= steps; i++) {
            let t = i / steps
            let cx = Math.floor(this.x + ndx * (dist * t))
            let cy = Math.floor(this.y + ndy * (dist * t))
            if (cx < 0 || cy < 0 || cx >= bg.columns || cy >= bg.lines) { canSee = false; break }
            let cell = bg.worldMap[cy][cx]
            if (cell > 0 && !bg.isDoorPassable(cx, cy)) { canSee = false; break }
        }
        if (!canSee) return

        // 近距离阻挡：不穿过玩家
        if (dist < (this.radius + player.collisionRadius) * 1.01) return

        // 朝玩家方向移动（每轴独立检查碰撞，允许贴墙滑行）
        let moveX = this.x + ndx * this.speed * dt
        let moveY = this.y + ndy * this.speed * dt

        let cx1 = Math.floor(moveX)
        let cy1 = Math.floor(this.y)
        if (cx1 >= 0 && cy1 >= 0 && cx1 < bg.columns && cy1 < bg.lines) {
            let cell = bg.worldMap[cy1][cx1]
            if (cell === 0 || bg.isDoorPassable(cx1, cy1)) {
                this.x = moveX
            }
        }

        let cx2 = Math.floor(this.x)
        let cy2 = Math.floor(moveY)
        if (cx2 >= 0 && cy2 >= 0 && cx2 < bg.columns && cy2 < bg.lines) {
            let cell = bg.worldMap[cy2][cx2]
            if (cell === 0 || bg.isDoorPassable(cx2, cy2)) {
                this.y = moveY
            }
        }
    }
}

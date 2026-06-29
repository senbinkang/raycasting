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
        this.damage = options.damage || 20
        this.score = options.score || 100
        this.contactTimer = 0
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

    // 简单 AI：朝玩家走，视线被墙挡住时不动
    update(dt, player, bg) {
        if (!this.alive || this.type !== 'enemy' || this.speed === 0) return

        let dx = player.position.x - this.x
        let dy = player.position.y - this.y
        let dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 20) return

        // 接触伤害（在视线检测之前，贴着就该扣血）
        if (dist < 0.8) {
            if (this.contactTimer <= 0) {
                player.takeDamage(this.damage || 20)
                this.contactTimer = 3
            }
        } else {
            this.contactTimer = 0
        }
        if (this.contactTimer > 0) this.contactTimer -= dt

        // 保持安全距离
        if (dist < 0.8) return

        // 归一化移动方向
        let ndx = dx / dist
        let ndy = dy / dist

        // 视线检查（只影响移动，不影响扣血）
        let canSee = true
        let steps = Math.max(2, Math.floor(dist * 4))
        for (let i = 1; i <= steps; i++) {
            let t = i / steps
            let cx = Math.floor(this.x + ndx * (dist * t))
            let cy = Math.floor(this.y + ndy * (dist * t))
            if (cx < 0 || cy < 0 || cx >= bg.columns || cy >= bg.lines) { canSee = false; break }
            if (bg.worldMap[cy][cx] !== 0) { canSee = false; break }
        }
        if (!canSee) return

        // 朝玩家方向移动（多点采样 + 对角点 + 分轴碰撞）
        let r = this.radius || 0.2
        let moveX = this.x + ndx * this.speed * dt
        let moveY = this.y + ndy * this.speed * dt

        let checkX = moveX + Math.sign(ndx) * r
        let canMoveX = true
        for (let offset of [0, 0.4, -0.4, 0.75, -0.75]) {
            let sy = this.y + offset * r
            let cx = Math.floor(checkX), cy = Math.floor(sy)
            if (cx >= 0 && cy >= 0 && cx < bg.columns && cy < bg.lines) {
                if (bg.worldMap[cy][cx] !== 0) { canMoveX = false; break }
            }
        }
        if (canMoveX && ndy !== 0) {
            let sy = this.y + Math.sign(ndy) * r
            let cx = Math.floor(checkX), cy = Math.floor(sy)
            if (cx >= 0 && cy >= 0 && cx < bg.columns && cy < bg.lines) {
                if (bg.worldMap[cy][cx] !== 0) canMoveX = false
            }
        }
        if (canMoveX) this.x = moveX

        let checkY = moveY + Math.sign(ndy) * r
        let canMoveY = true
        for (let offset of [0, 0.4, -0.4, 0.75, -0.75]) {
            let sx = this.x + offset * r
            let cx = Math.floor(sx), cy = Math.floor(checkY)
            if (cx >= 0 && cy >= 0 && cx < bg.columns && cy < bg.lines) {
                if (bg.worldMap[cy][cx] !== 0) { canMoveY = false; break }
            }
        }
        if (canMoveY && ndx !== 0) {
            let sx = this.x + Math.sign(ndx) * r
            let cx = Math.floor(sx), cy = Math.floor(checkY)
            if (cx >= 0 && cy >= 0 && cx < bg.columns && cy < bg.lines) {
                if (bg.worldMap[cy][cx] !== 0) canMoveY = false
            }
        }
        if (canMoveY) this.y = moveY
    }
}

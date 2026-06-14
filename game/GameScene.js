// game/GameScene.js
// 组合 Background（地图）+ Player（玩家）+ Screen（3D 视图）+
//       TextureManager（程序化纹理）+ SpriteManager（精灵管理）
// 形成一个完整可玩的场景。

class GameScene {
    constructor(game) {
        this.game = game
        this.height = game.canvas.height
        this.width = game.canvas.width

        this.init()
    }

    init() {
        let g = this.game

        // 地图
        this.bg = new Background(g)

        // 纹理（给墙壁 / 地板 / 天花板 / 精灵使用）
        this.textureManager = new TextureManager()

        // 精灵：放在地图空地（确保 worldMap[y][x] === 0）
        this.spriteManager = new SpriteManager()
        this._placeSprites()

        // 玩家（传入 spriteManager 以便精灵碰撞/捡取）
        this.player = new Player(g, this.bg, this.spriteManager)

        // 3D 视图
        this.screen = new Screen(g, this.player, this.bg, this.textureManager, this.spriteManager)
    }

    // 根据现有地图自动选择几个有代表性的空地放置精灵
    _placeSprites() {
        // 候选位置（必须是 worldMap[y][x] === 0 的格）
        // 在 10×10 默认地图中外圈都是 1（红砖墙），内部 2/3/4 是蓝/绿/橙墙
        // 所以安全区域大致在行 1-8 之间
        const empties = this._findEmptyCells()

        // 选取几个分散的点：敌人（红圆脸）放远处，物品（红十字）放近处/路边
        let placed = 0
        let enemyCount = 0
        let itemCount = 0
        const playerStartX = 1.5
        const playerStartY = 1.5

        for (let [cx, cy] of empties) {
            // 不放在玩家出生点附近（防止一出生就撞敌人）
            let dx = cx + 0.5 - playerStartX
            let dy = cy + 0.5 - playerStartY
            let dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 1.5) continue

            // 交替放敌人 / 物品；限制数量避免性能问题
            if (placed % 3 === 0 && enemyCount < 2) {
                this.spriteManager.add(new Sprite(cx + 0.5, cy + 0.5, 201, {
                    type: 'enemy', speed: 1.2, hp: 100
                }))
                enemyCount++
            } else if (placed % 3 === 1 && itemCount < 3) {
                this.spriteManager.add(new Sprite(cx + 0.5, cy + 0.5, 202, {
                    type: 'item', isPickable: true
                }))
                itemCount++
            }
            placed++
            if (enemyCount >= 2 && itemCount >= 3) break
        }
    }

    _findEmptyCells() {
        const result = []
        const wm = this.bg.worldMap
        for (let y = 0; y < this.bg.lines; y++) {
            for (let x = 0; x < this.bg.columns; x++) {
                if (wm[y][x] === 0) result.push([x, y])
            }
        }
        return result
    }

    // 每帧：驱动精灵更新（AI / 捡取）
    update(dt) {
        if (this.spriteManager) {
            this.spriteManager.update(dt, this.player, this.bg)
        }
    }

    draw() {
        // 1) 左侧小地图
        this.bg.draw()
        // 2) 精灵在小地图上的圆点（在玩家之上显示）
        if (this.spriteManager) {
            this.spriteManager.drawOnMinimap(this.game.context, this.bg.unit)
        }
        // 3) 玩家位置 / 朝向
        this.player.draw()
        // 4) 右侧 3D 视图（含精灵 3D 绘制）
        this.screen.draw()
    }
}

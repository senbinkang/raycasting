// game/GameScene.js
// 组合 Background（地图）+ Player（玩家）+ Screen（3D 视图）+
//       TextureManager（程序化纹理）+ SpriteManager（精灵管理）+
//       AudioManager（音效）+ Weapon（武器射击）
// 形成一个完整可玩的场景。

const ENEMY_TYPES = [
    { tex: 201, speed: 1.2, hp: 100, damage: 20 },
    { tex: 203, speed: 2.5, hp: 60,  damage: 10 },
    { tex: 204, speed: 0.7, hp: 200, damage: 35 },
    { tex: 205, speed: 1.0, hp: 80,  damage: 25 },
]

class GameScene {
    constructor(game) {
        this.game = game
        this.height = game.canvas.height
        this.width = game.canvas.width
        this.state = 'menu'
        this.score = 0
        this.wave = 0

        this.overlay = new OverlayScreen()
        this.init()
        this.overlay.show()
        this.overlay.drawTitle()
    }

    init() {
        let g = this.game

        this.bg = new Background(g)
        this.textureManager = new TextureManager()
        this.spriteManager = new SpriteManager()
        this._placeSprites()

        this.player = new Player(g, this.bg, this.spriteManager)
        this.screen = new Screen(g, this.player, this.bg, this.textureManager, this.spriteManager)
        this.audioManager = window.audioManager
        this.weapon = new Weapon(this.player, this.bg, this.spriteManager)
    }

    startGame() {
        this.state = 'playing'
        this.overlay.hide()
        if (this.audioManager) this.audioManager.startBgm()
    }

    reset() {
        this.overlay.hide()
        this.state = 'playing'
        this.score = 0
        this.wave = 0
        this.init()
        if (this.audioManager) this.audioManager.startBgm()
    }

    _spawnEnemy(cx, cy) {
        let t = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]
        this.spriteManager.add(new Sprite(cx + 0.5, cy + 0.5, t.tex, {
            type: 'enemy', speed: t.speed, hp: t.hp, damage: t.damage
        }))
    }

    _placeSprites() {
        const empties = this._findEmptyCells()
        // Fisher-Yates 洗牌，避免敌人/物品并排
        for (let i = empties.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1))
            ;[empties[i], empties[j]] = [empties[j], empties[i]]
        }
        let enemyCount = 0
        let itemCount = 0
        const playerStartX = Math.floor(this.bg.columns / 2) + 0.5
        const playerStartY = Math.floor(this.bg.lines / 2) + 0.5

        for (let [cx, cy] of empties) {
            let dx = cx + 0.5 - playerStartX
            let dy = cy + 0.5 - playerStartY
            let dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 1.5) continue

            if (enemyCount < 4) {
                this._spawnEnemy(cx, cy)
                enemyCount++
            } else if (itemCount < 5) {
                this.spriteManager.add(new Sprite(cx + 0.5, cy + 0.5, 202, {
                    type: 'item', isPickable: true
                }))
                itemCount++
            }
            if (enemyCount >= 4 && itemCount >= 5) break
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

    _respawnEnemies() {
        this.wave++
        if (this.wave >= 5) {
            this.state = 'win'
            this.overlay.show()
            this.overlay.drawWin()
            return
        }
        let empties = this._findEmptyCells()
        let px = this.player.position.x, py = this.player.position.y
        empties = empties.filter(([cx, cy]) => {
            let dx = cx + 0.5 - px, dy = cy + 0.5 - py
            return Math.sqrt(dx * dx + dy * dy) > 2
        })
        for (let i = empties.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1))
            ;[empties[i], empties[j]] = [empties[j], empties[i]]
        }
        let count = Math.min(4 + this.wave, empties.length)
        for (let i = 0; i < count; i++) {
            let [cx, cy] = empties[i]
            this._spawnEnemy(cx, cy)
        }
    }

    addScore(pts) {
        this.score += pts
    }

    // 每帧：驱动精灵更新（AI / 捡取）+ 门动画 + 死亡/通关检测
    update(dt) {
        if (this.state !== 'playing') return

        if (this.spriteManager) {
            this.spriteManager.update(dt, this.player, this.bg)
        }
        if (this.weapon) {
            this.weapon.update(dt)
        }
        if (this.player.invincibleTimer > 0) {
            this.player.invincibleTimer = Math.max(0, this.player.invincibleTimer - dt)
        }
        if (this.audioManager) {
            let moving = !!(this.game.keysdown['w'] || this.game.keysdown['s'] ||
                          this.game.keysdown['a'] || this.game.keysdown['d'] ||
                          this.game.keysdown['q'])
            this.audioManager.updateStep(dt, moving)
        }

        // 死亡检测
        if (this.player.hp <= 0) {
            this.state = 'gameover'
            this.overlay.show()
            this.overlay.drawGameover()
            return
        }

        // 敌人全灭后重新生成
        let enemies = this.spriteManager.sprites.filter(s => s.type === 'enemy')
        let aliveEnemies = enemies.filter(s => s.alive)
        if (enemies.length > 0 && aliveEnemies.length === 0) {
            this._respawnEnemies()
        }
    }

    draw() {
        if (this.state !== 'playing') return

        this.bg.draw()
        if (this.spriteManager) {
            this.spriteManager.drawOnMinimap(this.game.context, this.bg.unit)
        }
        this.player.draw()
        this.screen.draw()
    }
}

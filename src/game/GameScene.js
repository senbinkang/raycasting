import { Background } from '../engine/Background.js'
import { TextureManager } from '../engine/TextureManager.js'
import { Player } from '../engine/Player.js'
import { Screen } from '../engine/Screen.js'
import { SpriteManager } from './SpriteManager.js'
import { Sprite } from './Sprite.js'
import { Weapon } from './Weapon.js'
import { OverlayScreen } from '../ui/OverlayScreen.js'

const ENEMY_TYPES = [
    { tex: 203, speed: 3.0, hp: 50, damage: 10, score: 50 },
    { tex: 201, speed: 1.5, hp: 100, damage: 10, score: 100 },
    { tex: 205, speed: 1.2, hp: 150, damage: 10, score: 150 },
    { tex: 204, speed: 0.6, hp: 200, damage: 10, score: 200 },
    { tex: 206, speed: 0.8, hp: 80, damage: 10, score: 175, ranged: true, shootInterval: 2.0 },
]

export class GameScene {
    constructor(game) {
        this.game = game
        this.height = game.canvas.height
        this.width = game.canvas.width
        this.state = 'menu'
        this.score = 0
        this.wave = 0
        this.waveNotifyTimer = 0
        this.paused = false
        this.projectiles = []
        this.highScore = this._loadHighScore()
        this.isNewRecord = false

        this.overlay = new OverlayScreen()
        this.init()
        this.overlay.show()
        this.overlay.drawTitle()
    }

    init() {
        const g = this.game

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
        if (this.audioManager) { this.audioManager.startBgm() }
        if (window.commentaryService) {
            window.commentaryService.queue('game_start', {})
        }
    }

    reset() {
        this.overlay.hide()
        this.state = 'playing'
        this.score = 0
        this.wave = 0
        this.waveNotifyTimer = 0
        this.projectiles = []
        this.highScore = this._loadHighScore()
        this.isNewRecord = false
        this.init()
        if (this.audioManager) { this.audioManager.startBgm() }
    }

    _spawnEnemy(cx, cy) {
        const t = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]
        this.spriteManager.add(
            new Sprite(cx + 0.5, cy + 0.5, t.tex, {
                type: 'enemy',
                speed: t.speed,
                hp: t.hp,
                damage: t.damage,
                score: t.score,
                ranged: t.ranged || false,
                shootInterval: t.shootInterval || 2,
            })
        )
    }

    _placeSprites() {
        const empties = this._findEmptyCells()
        for (let i = empties.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[empties[i], empties[j]] = [empties[j], empties[i]]
        }
        let enemyCount = 0
        let itemCount = 0
        const enemyPositions = []
        const playerStartX = Math.floor(this.bg.columns / 2) + 0.5
        const playerStartY = Math.floor(this.bg.lines / 2) + 0.5

        for (const [cx, cy] of empties) {
            const dx = cx + 0.5 - playerStartX
            const dy = cy + 0.5 - playerStartY
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 1.5) { continue }

            if (enemyCount < 4) {
                this._spawnEnemy(cx, cy)
                enemyPositions.push([cx, cy])
                enemyCount++
            } else if (itemCount < 5) {
                let tooClose = false
                for (const [ex, ey] of enemyPositions) {
                    if (Math.abs(cx - ex) <= 1 && Math.abs(cy - ey) <= 1) {
                        tooClose = true
                        break
                    }
                }
                if (tooClose) { continue }
                this.spriteManager.add(
                    new Sprite(cx + 0.5, cy + 0.5, 202, {
                        type: 'item',
                        isPickable: true,
                    })
                )
                itemCount++
            }
            if (enemyCount >= 4 && itemCount >= 5) { break }
        }
    }

    _findEmptyCells() {
        const result = []
        const wm = this.bg.worldMap
        for (let y = 0; y < this.bg.lines; y++) {
            for (let x = 0; x < this.bg.columns; x++) {
                if (wm[y][x] === 0) { result.push([x, y]) }
            }
        }
        return result
    }

    _respawnEnemies() {
        this.wave++
        this.waveNotifyTimer = 2.0
        if (this.wave >= 5) {
            this.state = 'win'
            this._checkHighScore()
            this.overlay.show()
            this.overlay.drawWin(this.score, this.highScore, this.isNewRecord)
            if (window.commentaryService) {
                window.commentaryService.queue('victory', {
                    score: this.score,
                    highScore: this.highScore,
                    isNewRecord: this.isNewRecord,
                })
            }
            return
        }
        let empties = this._findEmptyCells()
        const px = this.player.position.x,
            py = this.player.position.y
        empties = empties.filter(([cx, cy]) => {
            const dx = cx + 0.5 - px,
                dy = cy + 0.5 - py
            return Math.sqrt(dx * dx + dy * dy) > 2
        })
        for (let i = empties.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[empties[i], empties[j]] = [empties[j], empties[i]]
        }
        const enemyCount = Math.min(4 + this.wave, empties.length)
        const enemyPositions = []
        for (let i = 0; i < enemyCount; i++) {
            const [cx, cy] = empties[i]
            this._spawnEnemy(cx, cy)
            enemyPositions.push([cx, cy])
        }
        let itemCount = 0
        for (let i = enemyCount; i < empties.length && itemCount < 3; i++) {
            const [cx, cy] = empties[i]
            let tooClose = false
            for (const [ex, ey] of enemyPositions) {
                if (Math.abs(cx - ex) <= 1 && Math.abs(cy - ey) <= 1) {
                    tooClose = true
                    break
                }
            }
            if (tooClose) { continue }
            this.spriteManager.add(
                new Sprite(cx + 0.5, cy + 0.5, 202, {
                    type: 'item',
                    isPickable: true,
                })
            )
            itemCount++
        }
        if (window.commentaryService) {
            window.commentaryService.queue('wave_start', {
                wave: this.wave + 1,
                enemyCount: enemyCount,
                hp: Math.ceil(this.player.hp),
                maxHp: this.player.maxHp,
                score: this.score,
            })
        }
    }

    addScore(pts) {
        this.score += pts
    }

    _loadHighScore() {
        try {
            const v = localStorage.getItem('raycasting_highscore')
            return v ? parseInt(v, 10) : 0
        } catch (_) { /* ignore */
            return 0
        }
    }

    _saveHighScore() {
        try {
            localStorage.setItem('raycasting_highscore', String(this.highScore))
        } catch (_) { /* ignore */ }
    }

    _checkHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score
            this.isNewRecord = true
            this._saveHighScore()
            if (window.commentaryService) {
                window.commentaryService.queue('new_record', { score: this.score })
            }
        } else {
            this.isNewRecord = false
        }
    }

    update(dt) {
        if (this.state !== 'playing') { return }

        if (this.spriteManager) {
            const newProjectiles = this.spriteManager.update(dt, this.player, this.bg)
            for (const p of newProjectiles) { this.projectiles.push(p) }
        }
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i]
            p.x += p.ndx * p.speed * dt
            p.y += p.ndy * p.speed * dt
            const mx = Math.floor(p.x),
                my = Math.floor(p.y)
            if (
                mx < 0 ||
                my < 0 ||
                mx >= this.bg.columns ||
                my >= this.bg.lines ||
                this.bg.worldMap[my][mx] !== 0
            ) {
                this.projectiles.splice(i, 1)
                continue
            }
            const odx = p.x - (p.originX !== undefined ? p.originX : p.x)
            const ody = p.y - (p.originY !== undefined ? p.originY : p.y)
            if (Math.sqrt(odx * odx + ody * ody) > 10) {
                this.projectiles.splice(i, 1)
                continue
            }
            const pdx2 = p.x - this.player.position.x,
                pdy2 = p.y - this.player.position.y
            const pdist = Math.sqrt(pdx2 * pdx2 + pdy2 * pdy2)
            if (pdist < 0.5) {
                this.player.takeDamage(p.damage || 15)
                this.projectiles.splice(i, 1)
            }
        }
        if (this.weapon) {
            this.weapon.update(dt)
        }
        if (this.player.invincibleTimer > 0) {
            this.player.invincibleTimer = Math.max(0, this.player.invincibleTimer - dt)
        }
        if (this.waveNotifyTimer > 0) {
            this.waveNotifyTimer = Math.max(0, this.waveNotifyTimer - dt)
        }
        if (this.audioManager) {
            const moving = !!(
                this.game.keysdown['w'] ||
                this.game.keysdown['s'] ||
                this.game.keysdown['a'] ||
                this.game.keysdown['d']
            )
            this.audioManager.updateStep(dt, moving)
        }

        if (this.player.hp <= 0) {
            this.state = 'gameover'
            this._checkHighScore()
            this.overlay.show()
            this.overlay.drawGameover(this.score, this.highScore, this.isNewRecord)
            if (window.commentaryService) {
                window.commentaryService.queue('player_death', {
                    score: this.score,
                    wave: this.wave + 1,
                    highScore: this.highScore,
                    isNewRecord: this.isNewRecord,
                })
            }
            return
        }

        if (this.player.hp > 0 && this.player.hp <= 30 && this.player.hp < this.player.maxHp) {
            if (window.commentaryService) {
                const enemies = this.spriteManager.sprites.filter(
                    (s) => s.type === 'enemy' && s.alive
                )
                window.commentaryService.queue('low_hp', {
                    hp: Math.ceil(this.player.hp),
                    maxHp: this.player.maxHp,
                    enemyCount: enemies.length,
                })
            }
        }

        const enemies = this.spriteManager.sprites.filter((s) => s.type === 'enemy')
        const aliveEnemies = enemies.filter((s) => s.alive)
        if (enemies.length > 0 && aliveEnemies.length === 0) {
            if (window.commentaryService) {
                window.commentaryService.queue('wave_clear', {
                    wave: this.wave + 1,
                    hp: Math.ceil(this.player.hp),
                    maxHp: this.player.maxHp,
                    score: this.score,
                })
            }
            this._respawnEnemies()
        }

        if (window.commentaryService) {
            window.commentaryService.update(dt)
        }
    }

    draw() {
        if (this.state !== 'playing') { return }

        this.bg.draw()
        if (this.spriteManager) {
            this.spriteManager.drawOnMinimap(this.game.context, this.bg.unit)
        }
        this.player.draw()
        this.screen.projectiles = this.projectiles
        this.screen.draw()
    }
}

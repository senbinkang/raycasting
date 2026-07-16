export class Game {
    constructor() {
        this.canvas = document.getElementById('id-canvas')
        this.context = this.canvas.getContext('2d')
        this.canvasImage = document.getElementById('id-canvas-image')
        this.contextImage = this.canvasImage.getContext('2d')

        this.scene = null
        this.keysdown = {}
        this.actions = {}

        this.lastTime = performance.now()
        this.dt = 1 / 60

        this._fpsFrames = 0
        this._fpsTimer = 0
        this.fps = 60

        this.mouseDX = 0
        this.mouseSensitivity = 0.0025
        this.isPointerLocked = false

        window.addEventListener('keydown', (e) => {
            this.keysdown[e.key] = true
            if (e.key === 'p' || e.key === 'P') {
                if (this.scene && this.scene.state === 'playing') {
                    this.scene.paused = !this.scene.paused
                    if (window.commentaryService) {
                        window.commentaryService.queue(this.scene.paused ? 'pause' : 'unpause', {})
                    }
                }
            }
            if ((e.key === 'Enter' || e.key === ' ') && this.scene) {
                if (this.scene.state === 'menu') {
                    this.scene.startGame()
                } else if (this.scene.state === 'gameover' || this.scene.state === 'win') {
                    this.scene.reset()
                }
            }
        })
        window.addEventListener('keyup', (e) => {
            this.keysdown[e.key] = false
        })

        const overlayCanvas = document.getElementById('id-canvas-overlay')
        if (overlayCanvas) {
            overlayCanvas.addEventListener('click', () => {
                if (this.scene) {
                    if (this.scene.state === 'menu') {
                        this.scene.startGame()
                    } else if (this.scene.state === 'gameover' || this.scene.state === 'win') {
                        this.scene.reset()
                    }
                }
            })
        }

        const tryLock = () => {
            if (this.canvasImage.requestPointerLock) {
                this.canvasImage.requestPointerLock()
            } else if (this.canvas.requestPointerLock) {
                this.canvas.requestPointerLock()
            }
        }
        this.canvasImage.addEventListener('click', tryLock)
        this.canvas.addEventListener('click', tryLock)

        const updateLockState = () => {
            this.isPointerLocked =
                document.pointerLockElement === this.canvasImage ||
                document.pointerLockElement === this.canvas
        }
        document.addEventListener('pointerlockchange', updateLockState)
        document.addEventListener('mozpointerlockchange', updateLockState)
        document.addEventListener('webkitpointerlockchange', updateLockState)

        const onMouseMove = (e) => {
            if (!this.isPointerLocked) {return}
            this.mouseDX += e.movementX || e.mozMovementX || e.webkitMovementX || 0
        }
        document.addEventListener('mousemove', onMouseMove)

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
        this.canvasImage.addEventListener('contextmenu', (e) => e.preventDefault())

        this.canvasImage.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.scene && this.scene.weapon) {
                this.scene.weapon.triggerDown = true
            }
        })
        this.canvasImage.addEventListener('mouseup', (e) => {
            if (e.button === 0 && this.scene && this.scene.weapon) {
                this.scene.weapon.triggerDown = false
            }
        })
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.scene && this.scene.weapon) {
                this.scene.weapon.triggerDown = true
            }
        })
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0 && this.scene && this.scene.weapon) {
                this.scene.weapon.triggerDown = false
            }
        })
    }

    registerAction(key, callback) {
        this.actions[key] = callback
    }

    doAction() {
        const keys = Object.keys(this.actions)
        for (const k of keys) {
            if (this.keysdown[k]) {this.actions[k](this.dt)}
        }
    }

    update() {
        if (!this.scene) {return}

        if (this.scene.state !== 'playing') {
            this.mouseDX = 0
            if (typeof this.scene.update === 'function') {this.scene.update(this.dt)}
            return
        }

        if (this.scene.paused) {
            this.mouseDX = 0
            return
        }

        if (this.mouseDX !== 0 && this.scene.player) {
            this.scene.player.rotate(this.mouseDX * this.mouseSensitivity)
            this.mouseDX = 0
        }

        if (this.scene.player && typeof this.scene.player.setSprinting === 'function') {
            this.scene.player.setSprinting(!!this.keysdown['Shift'])
        }

        if (typeof this.scene.update === 'function') {
            this.scene.update(this.dt)
        }

        if (this.scene.weapon && (this.scene.weapon.triggerDown || this.keysdown[' '])) {
            const enemy = this.scene.weapon.fire()
            if (enemy) {
                const dead = enemy.takeDamage(50)
                if (dead) {
                    if (window.audioManager) {window.audioManager.playEnemyDeath(enemy.textureIndex)}
                    this.scene.addScore(enemy.score || 100)
                    if (window.commentaryService) {
                        const remaining = this.scene.spriteManager.sprites.filter(
                            (s) => s.alive && s.type === 'enemy'
                        ).length
                        window.commentaryService.queue('enemy_kill', {
                            enemyType: enemy.textureIndex,
                            remaining,
                        })
                    }
                } else {
                    if (window.audioManager) {window.audioManager.playHit()}
                }
            }
        }
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        if (this.scene && this.scene.state !== 'playing') {
            this.contextImage.clearRect(0, 0, this.canvasImage.width, this.canvasImage.height)
        }
    }

    draw() {
        if (this.scene) {this.scene.draw()}
        if (this.scene && this.scene.state === 'playing') {
            if (this.scene.weapon) {
                this.scene.weapon.draw(
                    this.contextImage,
                    this.canvasImage.width,
                    this.canvasImage.height
                )
            }
            this.drawHUD()
            if (this.scene.paused) {
                const ctx = this.contextImage
                ctx.fillStyle = 'rgba(0,0,0,0.45)'
                ctx.fillRect(0, 0, this.canvasImage.width, this.canvasImage.height)
                ctx.fillStyle = 'rgb(200,200,200)'
                ctx.font = 'bold 48px monospace'
                ctx.textAlign = 'center'
                ctx.fillText('PAUSED', this.canvasImage.width / 2, this.canvasImage.height / 2)
                ctx.textAlign = 'left'
            }
        }
    }

    drawHUD() {
        const ctx = this.contextImage
        const width = this.canvasImage.width

        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(width - 130, 6, 124, 102)
        ctx.fillStyle = 'rgb(200,255,200)'
        ctx.font = '12px monospace'
        ctx.textAlign = 'right'
        ctx.fillText('FPS: ' + this.fps.toFixed(0), width - 14, 24)

        if (this.scene && this.scene.player) {
            const p = this.scene.player
            ctx.fillText(
                'Pos: ' + p.position.x.toFixed(1) + ', ' + p.position.y.toFixed(1),
                width - 14,
                38
            )
            ctx.fillText('Dir: ' + p.dirX.toFixed(2) + ', ' + p.dirY.toFixed(2), width - 14, 50)
        }

        ctx.fillStyle = 'rgb(255,220,80)'
        ctx.font = 'bold 14px monospace'
        ctx.fillText('SCORE: ' + (this.scene ? this.scene.score : 0), width - 14, 66)

        if (this.scene && this.scene.highScore > 0) {
            ctx.fillStyle = 'rgb(255,180,80)'
            ctx.font = '12px monospace'
            ctx.fillText('HI: ' + this.scene.highScore, width - 14, 80)
        }

        if (this.scene) {
            ctx.fillStyle = 'rgb(180,220,255)'
            ctx.font = 'bold 13px monospace'
            ctx.fillText('WAVE: ' + (this.scene.wave + 1) + '/5', width - 14, 96)
        }

        if (!this.isPointerLocked) {
            ctx.textAlign = 'left'
            ctx.fillStyle = 'rgba(0,0,0,0.55)'
            ctx.fillRect(8, 8, 260, 52)
            ctx.fillStyle = 'rgb(255,220,120)'
            ctx.font = '13px monospace'
            ctx.fillText('[点击画面] 启动鼠标视角', 14, 26)
            ctx.fillText('WASD/↑↓ 移动  A/D 平移  Space 射击', 14, 46)
        }

        if (this.scene && this.scene.player) {
            const p = this.scene.player
            const barX = 10,
                barY = this.canvasImage.height - 30,
                barW = 200,
                barH = 18
            ctx.fillStyle = 'rgba(0,0,0,0.6)'
            ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4)
            ctx.fillStyle = 'rgba(60,10,10,0.9)'
            ctx.fillRect(barX, barY, barW, barH)
            const hpRatio = Math.max(0, p.hp / p.maxHp)
            let fillColor = hpRatio > 0.5 ? 'rgb(50,200,50)' : 'rgb(230,40,40)'
            if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 3) % 2 === 0) {
                fillColor = 'rgb(255,255,255)'
            }
            ctx.fillStyle = fillColor
            ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpRatio, barH - 2)
            ctx.fillStyle = 'rgb(255,255,255)'
            ctx.font = 'bold 13px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('HP: ' + Math.ceil(p.hp) + '/' + p.maxHp, barX + barW / 2, barY + barH - 4)
        }

        if (this.scene && this.scene.waveNotifyTimer > 0) {
            const alpha = Math.min(1, this.scene.waveNotifyTimer)
            ctx.fillStyle = `rgba(255,220,80,${alpha})`
            ctx.font = 'bold 36px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('第 ' + (this.scene.wave + 1) + ' 波', this.canvasImage.width / 2, this.canvasImage.height / 2 - 20)
        }

        ctx.textAlign = 'left'
    }

    runLoop(now) {
        this.dt = Math.min((now - this.lastTime) / 1000, 0.05)
        this.lastTime = now

        this._fpsFrames++
        this._fpsTimer += this.dt
        if (this._fpsTimer >= 0.5) {
            this.fps = this._fpsFrames / this._fpsTimer
            this._fpsFrames = 0
            this._fpsTimer = 0
        }

        if (!this.scene || !this.scene.paused) {
            this.doAction()
        }
        this.update()
        this.clear()
        this.draw()

        requestAnimationFrame((t) => this.runLoop(t))
    }

    start(scene) {
        this.scene = scene
        this.lastTime = performance.now()
        requestAnimationFrame((t) => this.runLoop(t))
    }
}

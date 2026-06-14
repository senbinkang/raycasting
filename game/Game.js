// Game.js
// 负责：
//   - 主循环 runLoop(now)：deltaTime 计算 + 驱动按键动作 + 触发绘制
//   - 鼠标 Pointer Lock：点击 canvas 进入 FPS 视角；ESC 退出
//   - HUD：右上角 FPS / 位置 / 朝向 提示；右下角操作提示
//
// 依赖注册方式：game.registerAction('w', (dt) => {...})
// 每帧 runLoop 中会对所有已注册按键调用 action(dt)，由 Player 等模块填充。

class Game {
    constructor() {
        this.canvas = document.getElementById('id-canvas')
        this.context = this.canvas.getContext('2d')
        this.canvasImage = document.getElementById('id-canvas-image')
        this.contextImage = this.canvasImage.getContext('2d')

        // 场景与事件
        this.scene = null
        this.keysdown = {}
        this.actions = {}

        // deltaTime
        this.lastTime = performance.now()
        this.dt = 1 / 60

        // FPS 统计（给 HUD 用）
        this._fpsFrames = 0
        this._fpsTimer = 0
        this.fps = 60

        // === 阶段 C：鼠标 pointer lock ===
        this.mouseDX = 0
        this.mouseSensitivity = 0.0025   // rad / px
        this.isPointerLocked = false

        window.addEventListener('keydown', (e) => {
            this.keysdown[e.key] = true
        })
        window.addEventListener('keyup', (e) => {
            this.keysdown[e.key] = false
        })

        // 点击 canvas 启动 Pointer Lock
        const tryLock = () => {
            if (this.canvasImage.requestPointerLock) {
                this.canvasImage.requestPointerLock()
            } else if (this.canvas.requestPointerLock) {
                this.canvas.requestPointerLock()
            }
        }
        this.canvasImage.addEventListener('click', tryLock)
        this.canvas.addEventListener('click', tryLock)

        // Pointer lock 状态变化监听
        const updateLockState = () => {
            this.isPointerLocked = (document.pointerLockElement === this.canvasImage ||
                                    document.pointerLockElement === this.canvas)
        }
        document.addEventListener('pointerlockchange', updateLockState)
        document.addEventListener('mozpointerlockchange', updateLockState)
        document.addEventListener('webkitpointerlockchange', updateLockState)

        // 鼠标移动：累加至 mouseDX，每帧交给 player.rotate
        const onMouseMove = (e) => {
            if (!this.isPointerLocked) return
            this.mouseDX += e.movementX || e.mozMovementX || e.webkitMovementX || 0
        }
        document.addEventListener('mousemove', onMouseMove)

        // 禁止右键菜单
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
        this.canvasImage.addEventListener('contextmenu', (e) => e.preventDefault())

        // 左键射击
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
        let keys = Object.keys(this.actions)
        for (let k of keys) {
            if (this.keysdown[k]) this.actions[k](this.dt)
        }
    }

    update() {
        // 每帧处理鼠标旋转（交给 player.rotate）
        if (this.mouseDX !== 0 && this.scene && this.scene.player) {
            this.scene.player.rotate(this.mouseDX * this.mouseSensitivity)
            this.mouseDX = 0
        }

        // 加速跑状态（Shift）
        if (this.scene && this.scene.player && typeof this.scene.player.setSprinting === 'function') {
            this.scene.player.setSprinting(!!this.keysdown['Shift'])
        }

        // Scene 的 sprite 更新（AI / 碰撞）
        if (this.scene && typeof this.scene.update === 'function') {
            this.scene.update(this.dt)
        }

        // 左键按住射击
        if (this.scene && this.scene.weapon && this.scene.weapon.triggerDown) {
            let enemy = this.scene.weapon.fire()
            if (enemy) {
                let dead = enemy.takeDamage(35)
                if (dead) {
                    if (window.audioManager) window.audioManager.playEnemyDeath()
                } else {
                    if (window.audioManager) window.audioManager.playHit()
                }
            }
        }
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    draw() {
        if (this.scene) this.scene.draw()
        // 武器在最上层绘制（覆盖一切）
        if (this.scene && this.scene.weapon) {
            this.scene.weapon.draw(this.contextImage, this.canvasImage.width, this.canvasImage.height)
        }
        this.drawHUD()
    }

    // HUD：FPS / 位置 / 操作提示
    drawHUD() {
        let ctx = this.contextImage
        let width = this.canvasImage.width

        // 右上：FPS
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(width - 110, 8, 102, 44)
        ctx.fillStyle = 'rgb(200,255,200)'
        ctx.font = '12px monospace'
        ctx.textAlign = 'right'
        ctx.fillText('FPS: ' + this.fps.toFixed(0), width - 14, 24)

        if (this.scene && this.scene.player) {
            let p = this.scene.player
            ctx.fillText('Pos: ' + p.position.x.toFixed(1) + ', ' + p.position.y.toFixed(1), width - 14, 38)
            ctx.fillText('Dir: ' + p.dirX.toFixed(2) + ', ' + p.dirY.toFixed(2), width - 14, 50)
        }

        // 左上：pointer lock 提示（仅在未锁定时显示）
        if (!this.isPointerLocked) {
            ctx.textAlign = 'left'
            ctx.fillStyle = 'rgba(0,0,0,0.55)'
            ctx.fillRect(8, 8, 240, 50)
            ctx.fillStyle = 'rgb(255,220,120)'
            ctx.font = '13px monospace'
            ctx.fillText('[点击画面] 启动鼠标视角', 14, 26)
            ctx.fillText('WASD 移动  A/D 旋转  Shift 加速', 14, 46)
        }

        ctx.textAlign = 'left'
    }

    runLoop(now) {
        this.dt = Math.min((now - this.lastTime) / 1000, 0.05)
        this.lastTime = now

        // FPS 统计（每 0.5s 更新一次）
        this._fpsFrames++
        this._fpsTimer += this.dt
        if (this._fpsTimer >= 0.5) {
            this.fps = this._fpsFrames / this._fpsTimer
            this._fpsFrames = 0
            this._fpsTimer = 0
        }

        this.doAction()
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

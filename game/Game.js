class Game {
    constructor() {
        this.canvas = e('#id-canvas')
        this.context = this.canvas.getContext('2d')
        this.canvasImage = e('#id-canvas-image')
        this.contextImage = this.canvasImage.getContext('2d')

        // 场景与事件
        this.scene = null
        this.keysdown = {}
        this.actions = {}

        // === deltaTime 相关：让移动速度与帧率无关 ===
        this.lastTime = performance.now()
        this.dt = 1 / 60   // 初始值，每一帧会更新

        // 按键监听（全局 keydown/keyup）
        window.addEventListener('keydown', (e) => {
            this.keysdown[e.key] = true
        })
        window.addEventListener('keyup', (e) => {
            this.keysdown[e.key] = false
        })

        // 禁止右键菜单
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    }

    registerAction(key, callback) {
        this.actions[key] = callback
    }

    // 每帧执行：把 dt 作为参数传给按键回调
    doAction() {
        let actions = Object.keys(this.actions)
        for (let key of actions) {
            if (this.keysdown[key]) {
                this.actions[key](this.dt)
            }
        }
    }

    update() {
        // 当前场景没有 update 逻辑（update 在按键回调里已经执行）
        // 但保留此函数便于后续扩展（如敌人 AI、子弹物理等）
    }

    clear() {
        // 清左 Canvas（小地图），右 Canvas 由 Screen.drawBg 负责
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    draw() {
        if (this.scene) this.scene.draw()
    }

    // 每一帧：计算 deltaTime → 处理输入 → 更新 → 绘制 → 请求下一帧
    runLoop(now) {
        // deltaTime = 与上一帧的间隔（秒）
        // clamp 到 0.05 秒：防止切到其他标签后再切回来产生瞬移
        this.dt = Math.min((now - this.lastTime) / 1000, 0.05)
        this.lastTime = now

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

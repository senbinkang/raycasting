class Game {
    constructor() {
        this.canvas = e('#id-canvas')
        this.context = this.canvas.getContext('2d')
        this.canvasImage = e('#id-canvas-image')
        this.contextImage = this.canvasImage.getContext('2d')

        window.fps = 30
        this.scene = null
        this.keysdown = {}
        this.actions = {}

        // 按键监听
        window.addEventListener('keydown', (e) => {
            this.keysdown[e.key] = true
        })
        window.addEventListener('keyup', (e) => {
            this.keysdown[e.key] = false
        })
        // canvas 禁止右键菜单
        this.canvas.addEventListener('contextmenu', function (e) {
            e.preventDefault()
        })
    }

    registerAction(key, callback) {
        this.actions[key] = callback
    }

    doAction() {
        let g = this
        let actions = Object.keys(g.actions)
        for (let key of actions) {
            if (g.keysdown[key]) {
                g.actions[key]()
            }
        }
    }

    update() {
        this.scene.update()
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    draw() {
        this.scene.draw()
    }

    runLoop() {
        let g = this
        g.doAction()
        g.update()
        g.clear()
        g.draw()

        // next run loop
        setTimeout(function () {
            g.runLoop()
        }, 1000 / window.fps)
    }

    start(scene) {
        let g = this
        g.scene = scene
        setTimeout(function () {
            g.runLoop()
        }, 1000 / window.fps)
    }
}
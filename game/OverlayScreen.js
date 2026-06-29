class OverlayScreen {
    constructor() {
        this.canvas = document.getElementById('id-canvas-overlay')
        this.ctx = this.canvas.getContext('2d')
        this.width = this.canvas.width
        this.height = this.canvas.height
    }

    show() {
        this.canvas.style.pointerEvents = 'auto'
        this.canvas.style.display = 'block'
    }

    hide() {
        this.canvas.style.pointerEvents = 'none'
        this.canvas.style.display = 'none'
    }

    drawTitle() {
        let ctx = this.ctx
        ctx.clearRect(0, 0, this.width, this.height)
        ctx.fillStyle = 'rgba(0,0,0,0.75)'
        ctx.fillRect(0, 0, this.width, this.height)

        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgb(220,50,50)'
        ctx.font = '48px monospace'
        ctx.fillText('RAYCASTING', this.width / 2, this.height / 2 - 60)

        ctx.fillStyle = 'rgb(200,200,200)'
        ctx.font = '16px monospace'
        ctx.fillText('Wolfenstein 风格伪 3D 引擎', this.width / 2, this.height / 2 - 20)

        ctx.fillStyle = 'rgb(255,220,80)'
        ctx.font = '20px monospace'
        ctx.fillText('按 Enter / Space 开始游戏', this.width / 2, this.height / 2 + 50)

        ctx.fillStyle = 'rgb(160,160,160)'
        ctx.font = '12px monospace'
        ctx.fillText('纯键盘：WASD 移动 | ← → 旋转 | Space 射击 | Shift 加速', this.width / 2, this.height / 2 + 85)
        ctx.fillText('键鼠：WASD 移动 | 鼠标旋转视角 | 左键/Space 射击 | Shift 加速', this.width / 2, this.height / 2 + 105)
    }

    drawGameover() {
        let ctx = this.ctx
        ctx.clearRect(0, 0, this.width, this.height)
        ctx.fillStyle = 'rgba(80,0,0,0.7)'
        ctx.fillRect(0, 0, this.width, this.height)

        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgb(220,30,30)'
        ctx.font = '56px monospace'
        ctx.fillText('YOU DIED', this.width / 2, this.height / 2 - 20)

        ctx.fillStyle = 'rgb(255,220,80)'
        ctx.font = '20px monospace'
        ctx.fillText('按 Enter / Space 重新开始', this.width / 2, this.height / 2 + 50)
    }

    drawWin() {
        let ctx = this.ctx
        ctx.clearRect(0, 0, this.width, this.height)
        ctx.fillStyle = 'rgba(0,40,0,0.7)'
        ctx.fillRect(0, 0, this.width, this.height)

        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgb(255,200,40)'
        ctx.font = '48px monospace'
        ctx.fillText('MISSION', this.width / 2, this.height / 2 - 40)
        ctx.fillText('COMPLETE', this.width / 2, this.height / 2 + 10)

        ctx.fillStyle = 'rgb(255,220,80)'
        ctx.font = '20px monospace'
        ctx.fillText('按 Enter / Space 重新开始', this.width / 2, this.height / 2 + 70)
    }
}

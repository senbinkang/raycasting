class Screen {
    constructor(game, player, bg) {
        this.game = game
        this.canvas = game.canvasImage
        this.context = game.contextImage
        this.height = game.canvasImage.height
        this.width = game.canvasImage.width
        this.bg = bg
        this.lines = bg.lines
        this.unit = bg.unit
        this.columns = bg.columns
        this.wallData = bg.wallData

        this.player = player
        this.position = player.position
        this.degrees = player.degrees
        this.digits = player.digits
        // this.endPointArr = player.endPointArr

        // 方法
        this.getEndPoint = player.getEndPoint
        this.isWall = player.isWall
        this.isStop = player.isStop

        // log('this.getEndPoint', this.getEndPoint)
        log('bg', bg)
        log('player', player)
        this.isLog = true
    }
    get minDeg() {
        return this.player.degrees - this.player.includedAngle
    }
    get maxDeg() {
        return this.player.degrees + this.player.includedAngle
    }

    getDir(rad) {
        let sin = Math.sin(rad)
        let cos = Math.cos(rad)
        return new Vec(cos, sin)
    }

    update() {
        // this.endPointArr = clone(this.player.endPointArr)
        // this.player.endPointArr = []
    }

    draw() {
        this.drawBg()
        this.drawWall()
    }

    drawBg(context = this.context) {
        drawRect(context, 'rgb(93,93,93)', 0, 0, this.width, this.height / 2)
        drawRect(context, 'rgb(172,172,172)', 0, this.height / 2, this.width, this.height / 2)
    }

    drawWall(context = this.context) {
        let px = this.position.x
        let py = this.position.y
        let endPointArr = clone(this.player.endPointArr)
        let {includedAngle, degrees} = this.player
        // 比率
        let rate = 0.3
        let mult = 0.95
        let h = this.height / 2
        // log('hhh', h)

        for (let i = 0; i < endPointArr.length; i++) {
            let c = endPointArr[i]
            // 射线的射线长度
            let len = new Vec(c.x - px, c.y - py).len
            if (this.isLog) {
                log(i, '|', Number(len.toFixed(4)), endPointArr)
            }

            let color = 'rgb(255,162,162)'
            let width = this.width / 100
            let height = h / len * mult
            // let height = (len / rate) * mult

            let x = i * width
            let y = this.height / 2
            drawRect(context, color, x, y, width, height)
            drawRect(context, color, x, y - height, width, height)
        }

        this.player.endPointArr = []
        this.isLog = false
    }
}
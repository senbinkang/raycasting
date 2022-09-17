class Screen {
    constructor(game, player) {
        this.game = game
        this.context = game.contextImage
        this.height = game.canvasImage.height
        this.width = game.canvasImage.width

        this.player = player
        this.position = player.position
        this.lines = player.lines
        this.columns = player.columns

        this.defaultWallColor = new Color(255,162,162)
        this.isLog = true
    }

    draw() {
        this.drawBg()
        this.drawWall()
    }

    drawBg(context = this.context) {
        // 随意给的上下背景色
        drawRect(context, new Color(93,93,93), 0, 0, this.width, this.height / 2)
        drawRect(context, new Color(172,172,172), 0, this.height / 2, this.width, this.height / 2)
    }

    getAllPoint(endPointArr) {
        let arr = []
        for (let i = 0; i < endPointArr.length; i++) {
            let {x, y, color} = endPointArr[i]
            arr.push({x, y, color})
        }
        return arr
    }

    getColor(pColor, len){
        let {r, g, b} = pColor
        let lines = this.lines
        let columns = this.columns
        let maxLen = Math.sqrt(lines * lines + columns * columns)
        // 等号右边为 大概的一个数（根据个人想要的光线效果来）
        maxLen -= columns + 1
        let ra = (maxLen / len) > 1 ? 1 : maxLen / len
        r *= ra
        g *= ra
        b *= ra

        return new Color(r, g, b)
    }

    drawWall(context = this.context) {
        let px = this.position.x
        let py = this.position.y
        let endPointArr = this.getAllPoint(this.player.endPointArr)
        // 高度和距离 比率（自己随便给的一个比率）
        let mult = 0.95
        let h = this.height / 2

        for (let i = 0; i < endPointArr.length; i++) {
            let c = endPointArr[i]
            // 射线的射线长度
            let len = new Vec(c.x - px, c.y - py).len
            let color = this.getColor(c.color, len)

            // 每一条竖线的宽度
            let width = this.width / 100
            // 通过比率和距离，得到的高度
            let height = h / len * mult

            let x = i * width
            let y = this.height / 2
            drawRect(context, color, x, y, width, height)
            drawRect(context, color, x, y - height, width, height)
        }

        this.player.endPointArr = []
        this.isLog = false
    }
}
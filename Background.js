class Background {
    constructor(game) {
        this.game = game
        this.canvas = game.canvas
        this.context = game.context
        this.height = game.canvas.height
        this.width = game.canvas.width
        this.lines = 3
        this.columns = 3

        this.wallData = [
            { y:0, x:0, },
            { y:0, x:2, },
            { y:2, x:2, },
        ]
    }
    get unit() {
        return this.width / this.columns
    }

    draw() {
        // 画背景色
        this.drawBgColor()
        // 墙体数量
        this.drawWall()
        // 画网格
        this.drawLines()
    }

    drawBgColor() {
        let context = this.context
        let color = 'rgb(0, 0, 0)'
        let height = this.height
        let width = this.width
        drawRect(context, color, 0,0, width, height)
    }

    drawWall() {
        let context = this.context
        let unit = this.unit

        for (let i = 0; i < this.wallData.length; i++) {
            let c = this.wallData[i]
            let x = c.x * unit
            let y = c.y * unit

            // 障碍物
            let gridColor = 'rgb(61,198,152)'
            drawRect(context, gridColor, x, y, unit, unit)

            // 写坐标
            let fontSize = 20
            let textColor = 'rgb(255,255,255)'
            let text = `(${c.y}, ${c.x})`
            let textLen = context.measureText(text).width
            let centerX = x + unit / 2
            let centerY = y + unit / 2
            let px = centerX - textLen
            let py = centerY + fontSize / 2
            drawText(context, fontSize, textColor, text, px, py)
        }
    }

    drawLines() {
        let context = this.context
        let unit = this.unit
        let color = 'white'

        for (let i = 0; i < this.lines; i++) {
            let x = 0
            let y = (i + 1) * unit
            let endX = this.width
            let endY = (i + 1) * unit
            drawLine(context, color, x, y, endX, endY)
        }

        for (let i = 0; i < this.columns; i++) {
            let x = (i + 1) * unit
            let y = 0
            let endX = (i + 1) * unit
            let endY = this.height
            drawLine(context, color, x, y, endX, endY)
        }
    }
}
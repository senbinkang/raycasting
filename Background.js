class Background {
    constructor(game) {
        this.game = game
        this.canvas = game.canvas
        this.context = game.context
        this.height = game.canvas.height
        this.width = game.canvas.width
        this.lines = 10
        this.columns = 10

        this.wallData = [
            {x: 0, y: 0},
            {x: 1, y: 0},
            {x: 2, y: 2},
            {x: 2, y: 4},
            {x: 5, y: 6},
            {x: 6, y: 7},
        ]
    }

    get unit() {
        return this.width / this.columns
    }

    draw() {
        // 画背景色
        this.drawBgColor()
        // 画网格
        this.drawLines()
        // 画障碍物
        this.drawWall()
        // 画坐标
        this.drawCoordinates()
    }

    drawBgColor() {
        let color = 'rgb(0, 0, 0)'
        drawRect(this.context, color, 0, 0, this.width, this.height)
    }

    drawLines() {
        let context = this.context
        let unit = this.unit
        let color = 'rgba(255,255,255,0.4)'

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
        }
    }

    // 画坐标
    drawCoordinates() {
        let context = this.context
        let unit = this.unit

        let fontSize = 10
        let textColor = 'rgba(255,255,255, 0.7)'
        for (let x = 0; x < this.columns; x++) {
            for (let y = 0; y < this.lines; y++) {
                let text = `(${x}, ${y})`
                let textLen = context.measureText(text).width / 2 / unit
                let tx = (x + fontSize / unit) * unit
                let ty = (y + textLen) * unit
                drawText(context, fontSize, textColor, text, tx, ty)
            }
        }
    }
}
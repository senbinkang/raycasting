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
            {i: 0, x: 0, y: 0, color: Color.Red, },
            {i: 1, x: 1, y: 0, color: Color.Blue, },
            {i: 2, x: 2, y: 2, color: Color.Green, },
            {i: 3, x: 2, y: 4, color: Color.Green, },
            {i: 4, x: 4, y: 5, color: Color.Green, },
            {i: 5, x: 5, y: 6, color: Color.Blue, },
            {i: 6, x: 6, y: 7, color: Color.Blue, },
        ]
    }

    get unit() {
        return this.width / this.columns
    }

    draw() {
        // 画背景色
        this.drawBgColor()
        // 画障碍物
        this.drawWall()
        // 画坐标
        this.drawCoordinates()
        // 画网格
        this.drawLines()
    }

    drawBgColor(context = this.context) {
        drawRect(context, Color.Black, 0, 0, this.width, this.height)
    }

    drawLines(context = this.context) {
        let unit = this.unit
        let color = Color.White

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

    drawWall(context = this.context) {
        let unit = this.unit

        for (let i = 0; i < this.wallData.length; i++) {
            let c = this.wallData[i]
            let x = c.x * unit
            let y = c.y * unit
            let gridColor = c.color

            // 画障碍物
            drawRect(context, gridColor, x, y, unit, unit)
        }
    }

    // 画坐标
    drawCoordinates(context = this.context) {
        let unit = this.unit
        let fontSize = 10
        let textColor = new Color(255,255,255, 0.7)
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
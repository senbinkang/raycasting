class Background {
    constructor(game) {
        this.game = game
        this.canvas = game.canvas
        this.context = game.context
        this.height = game.canvas.height
        this.width = game.canvas.width
        this.lines = 10
        this.columns = 10

        // 颜色表：索引 = worldMap 中的值
        // 0 = 空（不画），1 = 红，2 = 蓝，3 = 绿，4 = 橙
        this.wallColors = [
            null,
            new Color(220, 70, 70),
            new Color(70, 130, 220),
            new Color(70, 200, 100),
            new Color(240, 170, 60),
        ]

        // worldMap[y][x] = 墙类型（0 表示空地）
        // 10x10 地图：外圈红色边界 + 蓝色房间 + 绿色柱子 + 橙色走廊
        this.worldMap = [
            [1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,2,2,0,0,0,3,0,1],
            [1,0,2,2,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,4,4,4,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,3,0,0,0,0,3,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1],
        ]
    }

    get unit() {
        return this.width / this.columns
    }

    draw() {
        this.drawBgColor()
        this.drawWall()
        this.drawCoordinates()
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

    // 从 worldMap 二维数组中读取墙壁并绘制
    drawWall(context = this.context) {
        let unit = this.unit
        for (let y = 0; y < this.lines; y++) {
            for (let x = 0; x < this.columns; x++) {
                let cell = this.worldMap[y][x]
                if (cell > 0) {
                    let color = this.wallColors[cell] || new Color(255, 162, 162)
                    drawRect(context, color, x * unit, y * unit, unit, unit)
                }
            }
        }
    }

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

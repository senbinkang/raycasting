// Background.js
// 10×10 地图：外圈红色边界 + 蓝色房间 + 绿色柱子 + 橙色走廊
// 渲染：左侧小地图（墙体方块 + 深色描边 + 坐标）

class Background {
    constructor(game) {
        this.game = game
        this.canvas = game.canvas
        this.context = game.context
        this.height = game.canvas.height
        this.width = game.canvas.width
        this.lines = 20
        this.columns = 20

        // wallColors[i]：墙体类型 i 的颜色（同时用于小地图纯色 & 3D 纹理 fallback）
        this.wallColors = [
            null,
            new Color(210, 70, 70),    // 1 = 红砖
            new Color(80, 140, 220),   // 2 = 蓝砖
            new Color(80, 190, 110),   // 3 = 绿色（石头柱）
            new Color(240, 170, 60),   // 4 = 橙色（木头/走廊）
        ]

        // worldMap[y][x]: 0 = 空地；1-99 = 墙类型；101-199 = 门（101=横门，102=竖门）
        this.worldMap = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,2,2,2,0,0,0,0,0,0,0,3,0,0,0,0,1],
            [1,0,0,0,2,0,2,0,0,0,0,0,0,0,3,0,0,0,0,1],
            [1,0,0,0,2,0,2,0,0,4,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,1],
            [1,0,0,0,0,0,0,0,2,2,2,0,0,0,0,0,4,4,0,1],
            [1,0,0,0,0,0,0,0,2,0,2,0,0,0,0,0,0,0,0,1],
            [1,0,0,4,0,0,0,0,2,0,2,0,0,0,3,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,3,0,0,0,0,4,4,0,0,0,0,0,2,2,0,0,1],
            [1,0,0,0,0,0,0,0,4,4,0,0,0,0,0,2,2,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,2,2,0,0,0,0,0,0,0,3,3,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        ]
    }

    get unit() {
        return this.width / this.columns
    }

    draw() {
        this.drawBgColor()
        this.drawGridLines()
        this.drawWall()
        this.drawCoordinates()
        this.drawTitle()
    }

    drawBgColor(ctx = this.context) {
        // 深色背景（给墙体 + 玩家 + 精灵提供对比）
        drawRect(ctx, new Color(18, 22, 30), 0, 0, this.width, this.height)
    }

    drawGridLines(ctx = this.context) {
        const unit = this.unit
        const color = new Color(50, 58, 70, 0.8)
        // 竖线
        for (let i = 0; i <= this.columns; i++) {
            drawLine(ctx, color, i * unit, 0, i * unit, this.height)
        }
        // 横线
        for (let i = 0; i <= this.lines; i++) {
            drawLine(ctx, color, 0, i * unit, this.width, i * unit)
        }
    }

    drawWall(ctx = this.context) {
        const unit = this.unit
        for (let y = 0; y < this.lines; y++) {
            for (let x = 0; x < this.columns; x++) {
                const cell = this.worldMap[y][x]
                if (cell > 0) {
                    const color = this.wallColors[cell] || new Color(200, 200, 200)
                    drawRect(ctx, color, x * unit, y * unit, unit, unit)
                    ctx.strokeStyle = 'rgba(10,10,15,0.9)'
                    ctx.lineWidth = 1
                    ctx.strokeRect(x * unit, y * unit, unit, unit)
                }
            }
        }
    }

    drawCoordinates(ctx = this.context) {
        const unit = this.unit
        ctx.fillStyle = 'rgba(200,200,210,0.45)'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        for (let x = 0; x < this.columns; x++) {
            ctx.fillText(x.toString(), x * unit + unit / 2, unit * 0.35)
        }
        for (let y = 1; y < this.lines; y++) {
            ctx.fillText(y.toString(), unit * 0.25, y * unit + unit / 2)
        }
        ctx.textAlign = 'left'
    }

    drawTitle(ctx = this.context) {
        ctx.fillStyle = 'rgba(255,220,120,0.7)'
        ctx.font = '11px monospace'
        ctx.textAlign = 'right'
        ctx.fillText('Minimap', this.width - 6, this.height - 6)
        ctx.textAlign = 'left'
    }
}

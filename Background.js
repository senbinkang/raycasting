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
        this.lines = 10
        this.columns = 10

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
            [1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,2,2,0,0,0,3,0,1],
            [1,0,2,2,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,101,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,0,3,0,0,0,0,3,0,1],
            [1,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1],
        ]

        // 门数据结构：key = "x,y"，value = { open, openProgress(0~1), axis }
        this.doors = {}
        this._initDoors()

        // 门颜色（小地图）
        this.doorColor = new Color(200, 160, 60)
    }

    // 扫描 worldMap，初始化所有门格
    _initDoors() {
        for (let y = 0; y < this.lines; y++) {
            for (let x = 0; x < this.columns; x++) {
                let cell = this.worldMap[y][x]
                if (cell >= 101 && cell <= 199) {
                    // 101 = 横门（沿 X 轴开），102 = 竖门（沿 Y 轴开）
                    this.doors[x + ',' + y] = {
                        open: false,
                        openProgress: 0,  // 0 = 关，1 = 全开
                        axis: cell === 101 ? 'x' : 'y',
                    }
                }
            }
        }
    }

    // 某格子是否是门（任意状态）
    isDoor(x, y) {
        return !!this.doors[x + ',' + y]
    }

    // 某门当前射线能否通过（openProgress >= 0.9 视为可通过）
    isDoorPassable(x, y) {
        let d = this.doors[x + ',' + y]
        return !d || d.openProgress >= 0.9
    }

    // 切换门的开关状态
    toggleDoor(x, y) {
        let d = this.doors[x + ',' + y]
        if (!d) return
        d.open = !d.open
    }

    // 每帧推进所有门的动画
    updateDoors(dt) {
        for (let key in this.doors) {
            let d = this.doors[key]
            if (d.open) {
                d.openProgress = Math.min(1, d.openProgress + dt * 2)
            } else {
                d.openProgress = Math.max(0, d.openProgress - dt * 2)
            }
        }
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
                    if (cell >= 101 && cell <= 199) {
                        // 门
                        const d = this.doors[x + ',' + y]
                        const open = d ? d.openProgress : 0
                        // 越开颜色越浅（金色 → 淡黄）
                        const r = Math.floor(200 + open * 55)
                        const g = Math.floor(160 + open * 95)
                        const b = Math.floor(60 + open * 195)
                        ctx.fillStyle = `rgb(${r},${g},${b})`
                        drawRect(ctx, new Color(r, g, b), x * unit + 2, y * unit + 2, unit - 4, unit - 4)
                    } else {
                        const color = this.wallColors[cell] || new Color(200, 200, 200)
                        drawRect(ctx, color, x * unit + 2, y * unit + 2, unit - 4, unit - 4)
                    }
                    // 深色描边
                    ctx.strokeStyle = 'rgba(10,10,15,0.9)'
                    ctx.lineWidth = 1
                    ctx.strokeRect(x * unit + 2, y * unit + 2, unit - 4, unit - 4)
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

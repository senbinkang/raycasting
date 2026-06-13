class Player {
    constructor(game, bg) {
        this.game = game
        this.bg = bg
        this.unit = bg.unit
        this.lines = bg.lines
        this.columns = bg.columns
        this.worldMap = bg.worldMap

        // 玩家格坐标（初始位置：地图中上区域的空地，朝右）
        this.position = new Vec(1.5, 4.5)

        // 玩家像素半径（在小地图上画圆用）
        this.r = 10

        // === 朝向系统：用向量替代角度 ===
        // dir = 玩家朝向单位向量（长度 1）
        // plane = 相机平面向量（⊥ dir，长度决定 FOV）
        // 初始朝 X 轴正方向（向右），FOV ≈ 2 * atan(0.66) ≈ 66°
        this.dirX = 1.0
        this.dirY = 0.0
        this.planeX = 0.0
        this.planeY = 0.66

        // === 速度（单位：格/秒，弧度/秒），帧内会乘以 deltaTime ===
        this.moveSpeed = 2.5    // 格/秒
        this.rotSpeed = 1.2     // 弧度/秒 ≈ 69°/秒

        // 显示颜色
        this.rayColor = new Color(255, 255, 255, 0.4)
        this.dirArrowColor = new Color(255, 200, 0, 1.0)
        this.playerColor = new Color(88, 221, 253)

        this.init()
    }

    // === Screen.js 读取的快捷 getter ===
    get posX() { return this.position.x }
    get posY() { return this.position.y }

    init() {
        this.registerAction()
    }

    // 按键回调：每个回调接收 dt（秒），用于帧率无关的移动
    registerAction() {
        let g = this.game

        // 旋转（绕玩家 Z 轴）
        g.registerAction('a', (dt) => this.rotate(-this.rotSpeed * dt))
        g.registerAction('d', (dt) => this.rotate(+this.rotSpeed * dt))

        // 前后移动
        g.registerAction('w', (dt) => this.tryMove(this.dirX, this.dirY, this.moveSpeed * dt))
        g.registerAction('s', (dt) => this.tryMove(-this.dirX, -this.dirY, this.moveSpeed * dt))

        // 左右平移（strafing，沿相机平面方向）
        g.registerAction('q', (dt) => this.tryMove(-this.planeX, -this.planeY, this.moveSpeed * dt))
        g.registerAction('e', (dt) => this.tryMove(this.planeX, this.planeY, this.moveSpeed * dt))
    }

    // 二维旋转矩阵：同时旋转 dir 和 plane
    rotate(theta) {
        let cos = Math.cos(theta)
        let sin = Math.sin(theta)

        let oldDirX = this.dirX
        this.dirX = this.dirX * cos - this.dirY * sin
        this.dirY = oldDirX * sin + this.dirY * cos

        let oldPlaneX = this.planeX
        this.planeX = this.planeX * cos - this.planeY * sin
        this.planeY = oldPlaneX * sin + this.planeY * cos
    }

    // 分轴碰撞：先尝试 X 方向，再尝试 Y 方向。撞到墙就不移动那一个轴。
    // 这样贴墙走也能滑行。
    tryMove(dx, dy, step) {
        // 归一化方向向量（plane 不是单位向量，需要归一化）
        let len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.0001) return
        dx /= len
        dy /= len

        // 碰撞半径（以格为单位），值越大越不容易卡进墙角，但贴墙的距离越远
        let r = 0.2

        // === 尝试 X 方向移动 ===
        let newX = this.position.x + dx * step
        // 检查四角：newX ± r 与 position.y ± r
        let checkX1 = newX + Math.sign(dx) * r
        let checkX2 = newX + (dx > 0 ? r : -r)
        let y1 = this.position.y - r * 0.5
        let y2 = this.position.y + r * 0.5
        if (this.cellIsEmpty(checkX1, y1) &&
            this.cellIsEmpty(checkX1, y2) &&
            this.cellIsEmpty(checkX2, y1) &&
            this.cellIsEmpty(checkX2, y2)) {
            this.position.x = newX
        }

        // === 尝试 Y 方向移动 ===
        let newY = this.position.y + dy * step
        let checkY1 = newY + Math.sign(dy) * r
        let checkY2 = newY + (dy > 0 ? r : -r)
        let x1 = this.position.x - r * 0.5
        let x2 = this.position.x + r * 0.5
        if (this.cellIsEmpty(x1, checkY1) &&
            this.cellIsEmpty(x2, checkY1) &&
            this.cellIsEmpty(x1, checkY2) &&
            this.cellIsEmpty(x2, checkY2)) {
            this.position.y = newY
        }
    }

    // 判断某个格坐标 (gx, gy) 是否为空地（不在地图里也视为墙）
    cellIsEmpty(gx, gy) {
        let mx = Math.floor(gx)
        let my = Math.floor(gy)
        if (mx < 0 || my < 0 || mx >= this.columns || my >= this.lines) return false
        return this.worldMap[my][mx] === 0
    }

    // ========== 绘制（仅在小地图上） ==========

    draw() {
        this.drawPlayer()
        this.drawDirArrow()
    }

    drawPlayer() {
        let unit = this.unit
        let px = this.position.x * unit
        let py = this.position.y * unit
        drawArc(this.game.context, this.playerColor, px, py, this.r)
    }

    // 画：朝向黄色短箭头 + FOV 两条白色边界线（表示视野范围）
    drawDirArrow() {
        let unit = this.unit
        let startX = this.position.x * unit
        let startY = this.position.y * unit

        // 朝向箭头（沿 dir 方向，1.5 格长）
        let endX = startX + this.dirX * unit * 1.5
        let endY = startY + this.dirY * unit * 1.5
        drawLine(this.game.context, this.dirArrowColor, startX, startY, endX, endY)

        // FOV 左边界（dir - plane 方向，归一化）
        let leftX = this.dirX - this.planeX
        let leftY = this.dirY - this.planeY
        let leftLen = Math.sqrt(leftX * leftX + leftY * leftY)
        leftX /= leftLen
        leftY /= leftLen
        drawLine(this.game.context, this.rayColor,
            startX, startY,
            startX + leftX * unit * 3,
            startY + leftY * unit * 3)

        // FOV 右边界（dir + plane 方向）
        let rightX = this.dirX + this.planeX
        let rightY = this.dirY + this.planeY
        let rightLen = Math.sqrt(rightX * rightX + rightY * rightY)
        rightX /= rightLen
        rightY /= rightLen
        drawLine(this.game.context, this.rayColor,
            startX, startY,
            startX + rightX * unit * 3,
            startY + rightY * unit * 3)
    }
}

class Screen {
    constructor(game, player, bg) {
        this.game = game
        this.context = game.contextImage
        this.width = game.canvasImage.width
        this.height = game.canvasImage.height

        this.player = player      // 读取 posX, posY, dirX, dirY, planeX, planeY
        this.bg = bg              // 读取 worldMap, wallColors, lines, columns

        // 天花板/地板颜色（未做纹理，纯色填充）
        this.ceilColor = new Color(110, 110, 110)
        this.floorColor = new Color(50, 50, 50)
    }

    draw() {
        this.drawBg()
        this.drawWall()
    }

    // 画天花板 + 地板（纯色，后续可改为纹理投射）
    drawBg() {
        let ctx = this.context
        ctx.fillStyle = this.ceilColor.stringColor()
        ctx.fillRect(0, 0, this.width, this.height / 2)
        ctx.fillStyle = this.floorColor.stringColor()
        ctx.fillRect(0, this.height / 2, this.width, this.height / 2)
    }

    // ============================================================
    // 核心：标准 DDA 光线投射 + 鱼眼校正
    //
    // 算法流程：
    // 对屏幕每一列 x 像素：
    //   1. cameraX = 2x/width - 1  (屏幕上的归一化 X 坐标，-1 ~ +1)
    //   2. rayDir = dir + plane * cameraX  (本列射线方向)
    //   3. mapX, mapY = 玩家所在格子（整数）
    //   4. deltaDist = |1 / rayDir|  (射线走过一格需要的距离)
    //   5. 根据 rayDir 正负，计算 step (+1 或 -1) 与 sideDist
    //      sideDist = 从当前位置到下一条 X/Y 网格边界的距离
    //   6. DDA 循环：
    //        若 sideDistX < sideDistY → 走向下一个 X 边界：sideDistX += deltaDistX, mapX += stepX, side=0
    //        否则 → 走向下一个 Y 边界：sideDistY += deltaDistY, mapY += stepY, side=1
    //        检查 worldMap[mapY][mapX]：> 0 → 撞墙，终止
    //   7. 计算垂直距离（鱼眼校正核心）：
    //        side==0: perpDist = sideDistX - deltaDistX   (也可写成 (mapX - posX + (1-stepX)/2) / rayDirX)
    //        side==1: perpDist = sideDistY - deltaDistY
    //   8. 墙高 = screenHeight / perpDist，wallTop = -墙高/2 + screenHeight/2
    //   9. 取颜色（按 wallColors[cell]），side==1 稍变暗（模拟 Y 面光照），按距离衰减
    //   10. fillRect(x, wallTop, 1, 墙高)  —— 画一条 1 像素宽的垂直线
    // ============================================================
    drawWall() {
        let ctx = this.context
        let player = this.player
        let bg = this.bg
        let { posX, posY, dirX, dirY, planeX, planeY } = player
        let worldMap = bg.worldMap
        let wallColors = bg.wallColors

        for (let x = 0; x < this.width; x++) {

            // --- 1. 计算本列射线方向 ---
            // cameraX: -1（屏幕最左）到 +1（屏幕最右）
            let cameraX = 2 * x / this.width - 1
            let rayDirX = dirX + planeX * cameraX
            let rayDirY = dirY + planeY * cameraX

            // --- 2. 初始化 DDA 变量 ---
            let mapX = Math.floor(posX)
            let mapY = Math.floor(posY)

            // deltaDist: 射线穿越一个完整的 X/Y 格子需要走的距离
            // 注意：当 rayDirX == 0 时使用一个很大的数（除零保护）
            let deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX)
            let deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY)

            // step: +1 或 -1（射线朝 X/Y 正或负方向前进）
            // sideDist: 从当前位置到下一条 X/Y 网格边界的距离
            let stepX, stepY
            let sideDistX, sideDistY

            if (rayDirX < 0) {
                stepX = -1
                sideDistX = (posX - mapX) * deltaDistX
            } else {
                stepX = 1
                sideDistX = (mapX + 1.0 - posX) * deltaDistX
            }
            if (rayDirY < 0) {
                stepY = -1
                sideDistY = (posY - mapY) * deltaDistY
            } else {
                stepY = 1
                sideDistY = (mapY + 1.0 - posY) * deltaDistY
            }

            // --- 3. DDA 循环：逐格跳跃，直到撞墙 ---
            let hit = 0          // 0: 未撞墙, >0: 已撞墙
            let side = 0         // 0: 撞在 X 面（东西向墙）, 1: 撞在 Y 面（南北向墙）
            let safety = 0       // 防死循环上限

            while (hit === 0 && safety < 200) {
                // 跳到较近的那一条网格边界
                if (sideDistX < sideDistY) {
                    sideDistX += deltaDistX
                    mapX += stepX
                    side = 0
                } else {
                    sideDistY += deltaDistY
                    mapY += stepY
                    side = 1
                }

                // 越出地图 → 视为墙（防止射线跑出地图无限循环）
                if (mapX < 0 || mapY < 0 || mapX >= bg.columns || mapY >= bg.lines) {
                    hit = 1
                }
                // 命中墙 → 终止
                else if (worldMap[mapY][mapX] > 0) {
                    hit = 1
                }
                safety++
            }

            // --- 4. 计算垂直距离 = 鱼眼校正 ---
            // 用 perpDist 而非欧氏距离：垂直距离消除球面效应
            let perpDist
            if (side === 0) {
                perpDist = sideDistX - deltaDistX
            } else {
                perpDist = sideDistY - deltaDistY
            }
            // 保护：防止 perpDist 为 0 或负数（除零会导致 lineHeight 无穷大）
            if (perpDist < 0.01) perpDist = 0.01

            // --- 5. 计算墙柱在屏幕上的高度与位置 ---
            let lineHeight = Math.floor(this.height / perpDist)
            let drawStart = Math.floor(-lineHeight / 2 + this.height / 2)
            let drawEnd = drawStart + lineHeight
            if (drawStart < 0) drawStart = 0
            if (drawEnd > this.height) drawEnd = this.height

            // --- 6. 根据墙类型取颜色 + 光照/距离衰减 ---
            let cell = worldMap[mapY][mapX]
            let color = wallColors[cell] || new Color(255, 162, 162)

            // 6a. 侧面（side == 1 → Y 面）稍微变暗，形成立体感
            let darken = (side === 1) ? 0.7 : 1.0

            // 6b. 距离衰减：物理上光强与距离平方成反比，这里用 1 / (1 + k * d^2)
            let distFactor = 1.0 / (1.0 + 0.02 * perpDist * perpDist)

            let r = Math.floor(color.r * darken * distFactor)
            let g = Math.floor(color.g * darken * distFactor)
            let b = Math.floor(color.b * darken * distFactor)

            // --- 7. 画这条 1 像素宽的垂直线 ---
            ctx.fillStyle = `rgba(${r},${g},${b},1)`
            ctx.fillRect(x, drawStart, 1, drawEnd - drawStart)
        }
    }
}

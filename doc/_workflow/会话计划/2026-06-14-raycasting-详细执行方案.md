# Raycasting 光线投射引擎 — 详细执行方案

> 位置：`/Users/kangsenbin/Downloads/games/raycasting/doc/_workflow/会话计划/2026-06-14-raycasting-详细执行方案.md`
> 上游文档：`doc/raycasting_改进建议.md`
> 当前代码状态：原始实现（未重构）

---

## 整体路线图（六个阶段）

| 阶段 | 主题 | 核心产出 | 涉及文件数 |
|------|------|----------|-----------|
| 一 | 地图数据层重构 | `worldMap[col][line]` + `wallColors` 颜色表 | 1（Background.js） |
| 二 | 核心算法 DDA + 鱼眼校正 | Screen 每列像素跑 DDA 射线投射 | 1（game/Screen.js） |
| 三 | 玩家系统重构 | 向量朝向 + 分轴碰撞 + deltaTime | 1（Player.js） |
| 四 | 主循环改造 | requestAnimationFrame + 帧率无关 | 2（Game.js, GameScene.js） |
| 五 | Canvas 性能优化 | 去掉 save/restore 过度调用 | 1（utils.js） |
| 六 | 画布尺寸与样式 | 增大 3D 视图 + CSS 布局 | 1（raycasting.html） |

每一个阶段都独立可运行 —— 完成一阶段后，打开 HTML 可以看到该阶段的效果，不影响后续阶段。

---

## 阶段一：地图数据层重构（Background.js）

**目标**：把 `wallData: [{x, y, color}, ...]` 对象数组，改成 `worldMap[columns][lines]` 二维整数数组 + `wallColors` 颜色表。

### 1.1 为什么要改

- 当前：查墙需要遍历 `wallData` 数组，O(n)
- 目标：查墙只需要 `worldMap[mapX][mapY] > 0`，O(1)

### 1.2 设计一张 10×10 测试地图

地图约定：
- `0` = 空地（可走）
- `1` = 红色墙（外圈边界）
- `2` = 蓝色墙
- `3` = 绿色墙
- `4` = 橙色墙

地图设计（10 行 × 10 列，从上到下 = line 0~9，从左到右 = col 0~9）：

```
行 0: 1 1 1 1 1 1 1 1 1 1   ← 顶墙
行 1: 1 0 0 0 0 0 0 0 0 1   ← 左边墙 + 右边墙
行 2: 1 0 2 2 0 0 0 3 0 1   ← 蓝色小房间 + 绿色单块
行 3: 1 0 2 2 0 0 0 0 0 1
行 4: 1 0 0 0 0 0 0 0 0 1
行 5: 1 0 0 0 4 4 4 0 0 1   ← 橙色走廊
行 6: 1 0 0 0 0 0 0 0 0 1
行 7: 1 0 3 0 0 0 0 3 0 1   ← 绿色柱子
行 8: 1 0 0 0 0 0 0 0 0 1
行 9: 1 1 1 1 1 1 1 1 1 1   ← 底墙
```

玩家初始位置放在 `(1.5, 1.5)` 格坐标 = 第二行第二列中心，朝右（X 正方向）。

### 1.3 具体改动（Background.js）

**步骤 1.3.1 —— 修改构造函数**：把整个 `constructor` 替换为：

```js
class Background {
    constructor(game) {
        this.game = game
        this.canvas = game.canvas
        this.context = game.canvas.getContext('2d')
        this.lines = 10
        this.columns = 10

        // 颜色表：索引 = wallMap 中的值
        this.wallColors = [
            null,                              // 0: 无墙（占位）
            new Color(220, 70, 70),            // 1: 红
            new Color(70, 130, 220),           // 2: 蓝
            new Color(70, 200, 100),           // 3: 绿
            new Color(240, 170, 60),           // 4: 橙
        ]

        // worldMap[y][x] = 墙类型（0 表示空地）
        // 注意：用 [行][列]，y 是行，x 是列
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
```

**步骤 1.3.2 —— 保留 `get unit()` getter**：

```js
get unit() {
    return this.width / this.columns   // canvas 像素宽 / 列数 = 一格多少像素
}
```

注意：`this.width` 在 `draw()` 中第一次被赋值前可能是 undefined。这是因为原来的代码写的是 `this.height = game.canvas.height; this.width = game.canvas.width`。我们要把它移到 constructor：

```js
// 在 constructor 中补充
this.width = game.canvas.width
this.height = game.canvas.height
```

**步骤 1.3.3 —— 重写 `drawWall()`**：从 `worldMap` 中读，而非 `wallData`

```js
drawWall(context = this.context) {
    let unit = this.unit
    for (let y = 0; y < this.lines; y++) {
        for (let x = 0; x < this.columns; x++) {
            let cell = this.worldMap[y][x]
            if (cell > 0) {
                let color = this.wallColors[cell]
                drawRect(context, color, x * unit, y * unit, unit, unit)
            }
        }
    }
}
```

**步骤 1.3.4 —— `drawBgColor()` 和 `drawLines()`、`drawCoordinates()`、`draw()` 保持不变**，直接用原来的。

### 1.4 验证方式

打开 `raycasting.html`：左侧 canvas 能看到 10×10 网格地图，红色外圈 + 蓝色房间 + 绿色柱子 + 橙色走廊，玩家圆圈（蓝色）在左上角房间里。**即使 Player.js 和 Screen.js 还没改，小地图应该也能显示**，因为 Player 还在用 `bg.wallData` 但这个字段被我们删了——所以这一步需要在 Player.js 的 `constructor` 里把 `this.wallData = bg.wallData` 改成一个兼容处理：让 Player 在阶段三之前不崩溃，可以加一个临时字段。实际上为了稳妥，**阶段一完成后应该在 Player.js 中临时加一个 fallback**：

```js
// Player.js constructor 顶部（临时，阶段三会删除）：
// 如果 wallData 不存在，用空数组兜底，避免当前版本崩溃
this.wallData = bg.wallData || []
```

但因为下一阶段很快就改 Screen，所以这个临时处理是可选的。稳妥起见，建议加。

---

## 阶段二：核心算法 —— DDA 射线投射 + 鱼眼校正（game/Screen.js）

**目标**：完全重写 Screen。让 Screen 自己持有地图引用、自己跑 DDA，每帧对屏幕每一列（x 像素）跑一条射线。不再依赖 Player 的 `endPointArr`。

这是整个项目最核心的改动。

### 2.1 变量定义（坐标系）

先把坐标系统一说清楚，后面写代码才不会乱：

| 变量 | 含义 | 单位 | 范围 |
|------|------|------|------|
| `posX, posY` | 玩家格坐标（不是像素） | 格 | `(1.5, 1.5)` ~ `(8.5, 8.5)` |
| `dirX, dirY` | 玩家朝向单位向量 | - | `dirX^2 + dirY^2 = 1` |
| `planeX, planeY` | 相机平面（FOV 的半宽），⊥ dir | - | `plane ≈ 长度 0.66` |
| `cameraX` | 当前列在相机平面上的归一化坐标 | - | `-1` ~ `+1` |
| `rayDirX, rayDirY` | 当前射线方向向量 | - | `dir + plane * cameraX` |
| `mapX, mapY` | 当前射线正在检查的格子（整数） | 格 | `0 ~ columns-1` |
| `sideDistX, sideDistY` | 射线到下一条 x/y 网格边界的距离 | 格 | 初始值 + deltaDist 累加 |
| `deltaDistX, deltaDistY` | 射线穿过一格 x/y 所需距离 | 格 | `|1/rayDirX|` |
| `stepX, stepY` | DDA 每步的步进方向（±1） | 格 | `+1` 或 `-1` |
| `perpDist` | 玩家到命中点的**垂直距离**（鱼眼已校正） | 格 | `>0` |
| `side` | 命中的是 X 面（0，东西向墙）还是 Y 面（1，南北向墙） | - | `0` 或 `1` |
| `lineHeight` | 这列墙在屏幕上的高度 | 像素 | `screenHeight / perpDist` |

### 2.2 具体改动（Screen.js 全文重写）

直接把 Screen.js 的内容替换为：

```js
class Screen {
    constructor(game, player, bg) {
        this.game = game
        this.context = game.contextImage    // 右侧 3D 视图
        this.width = game.canvasImage.width
        this.height = game.canvasImage.height

        this.player = player                // 拿 posX, posY, dirX/Y, planeX/Y
        this.bg = bg                        // 拿 worldMap, wallColors, lines, columns

        this.floorColor = new Color(50, 50, 50)   // 下半部分灰色
        this.ceilColor = new Color(110, 110, 110) // 上半部分深灰
    }

    draw() {
        this.drawBg()
        this.drawWall()
    }

    // 画天花板和地板（纯色填充，后续阶段可改为纹理）
    drawBg() {
        let ctx = this.context
        ctx.fillStyle = this.ceilColor.stringColor()
        ctx.fillRect(0, 0, this.width, this.height / 2)
        ctx.fillStyle = this.floorColor.stringColor()
        ctx.fillRect(0, this.height / 2, this.width, this.height / 2)
    }

    // 核心：DDA 射线投射，对屏幕每一列 x 画一条墙的竖线
    drawWall() {
        let ctx = this.context
        let { posX, posY, dirX, dirY, planeX, planeY } = this.player
        let worldMap = this.bg.worldMap
        let wallColors = this.bg.wallColors

        // 对屏幕每一列像素，跑一条射线
        for (let x = 0; x < this.width; x++) {

            // --- 1. 计算本列射线方向 ---
            // cameraX: -1（最左） ~ +1（最右）
            let cameraX = 2 * x / this.width - 1
            let rayDirX = dirX + planeX * cameraX
            let rayDirY = dirY + planeY * cameraX

            // --- 2. 初始化 DDA 变量 ---
            let mapX = Math.floor(posX)
            let mapY = Math.floor(posY)

            // deltaDist: 射线穿越一整个 x/y 格子需要走的距离
            let deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX)
            let deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY)

            // step + sideDist: 步进方向 + 到第一条网格边界的距离
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

            // --- 3. DDA 循环：跳格子，直到撞墙 ---
            let hit = 0           // 0 = 还没撞到墙，1 = 已撞到
            let side = 0          // 0 = X 面（东西向墙），1 = Y 面（南北向墙）
            let safety = 0        // 防死循环：超过地图对角线格数就停

            while (hit === 0 && safety < 100) {
                if (sideDistX < sideDistY) {
                    // 下一条 X 网格边界更近 → 走 X 方向一步
                    sideDistX += deltaDistX
                    mapX += stepX
                    side = 0
                } else {
                    // 下一条 Y 网格边界更近 → 走 Y 方向一步
                    sideDistY += deltaDistY
                    mapY += stepY
                    side = 1
                }
                // 检查当前格子是否是墙
                if (mapX < 0 || mapY < 0 || mapX >= this.bg.columns || mapY >= this.bg.lines) {
                    hit = 1 // 出边界也视为命中
                } else if (worldMap[mapY][mapX] > 0) {
                    hit = 1
                }
                safety++
            }

            if (hit === 0) continue // 没撞到墙，跳过这一列

            // --- 4. 计算垂直距离（鱼眼校正的核心） ---
            // 注意：这里用 side 决定用哪条公式，perpDist 与玩家朝向垂直，
            // 所以不会出现"中心射线路径短、边缘射线路径长"造成的鱼眼弧形
            let perpDist
            if (side === 0) {
                perpDist = sideDistX - deltaDistX   // 也可 = (mapX - posX + (1-stepX)/2) / rayDirX
            } else {
                perpDist = sideDistY - deltaDistY   // 也可 = (mapY - posY + (1-stepY)/2) / rayDirY
            }

            // 避免除零
            if (perpDist < 0.01) perpDist = 0.01

            // --- 5. 计算墙柱高度和绘制范围 ---
            let lineHeight = Math.floor(this.height / perpDist)
            let drawStart = Math.floor(-lineHeight / 2 + this.height / 2)
            let drawEnd = drawStart + lineHeight
            // clamp，防止越界
            if (drawStart < 0) drawStart = 0
            if (drawEnd > this.height) drawEnd = this.height

            // --- 6. 根据墙类型取颜色 + 做光照和距离衰减 ---
            let cell = worldMap[mapY][mapX]
            let color = wallColors[cell]
            if (!color) color = new Color(255, 162, 162)

            // (a) side = 1（南北向墙）稍微变暗，形成 3D 立体感
            let darken = (side === 1) ? 0.7 : 1.0

            // (b) 距离衰减：越远越暗，用简单的线性/指数混合
            // 公式：factor = 1 / (1 + k * perpDist^2)，k 取 0.02
            let distFactor = 1.0 / (1.0 + 0.02 * perpDist * perpDist)

            let r = Math.floor(color.r * darken * distFactor)
            let g = Math.floor(color.g * darken * distFactor)
            let b = Math.floor(color.b * darken * distFactor)

            // --- 7. 画这条竖线（1 像素宽 = 一条射线） ---
            ctx.fillStyle = `rgba(${r},${g},${b},1)`
            ctx.fillRect(x, drawStart, 1, drawEnd - drawStart)
        }
    }
}
```

### 2.3 同步改动 —— GameScene.js 初始化 Screen 时传 bg

`game/GameScene.js` 中 `init()` 里原来只传了 `(game, player)`，要改成传 3 个参数：

```js
init() {
    let g = this.game
    this.bg = new Background(g)
    this.player = new Player(g, this.bg)
    this.screen = new Screen(g, this.player, this.bg)   // 多传 this.bg
}
```

### 2.4 同步改动 —— Player.js 添加 dir/plane 字段（先硬编码一个默认值）

因为新 Screen 依赖 `player.dirX, dirY, planeX, planeY`，但当前 Player 只有 `degrees`，没有这些字段。阶段三会完整重写 Player，但为了阶段二能跑起来，先在 Player.js 顶部加几个 getter（临时方案，阶段三再改成字段形式以获得更好性能）：

在 Player.js 里，constructor 之后立刻加：

```js
// 临时：暴露 dirX/Y，让 Screen 能直接读。阶段三会改。
get dirX() { return Math.cos(this.radians) }
get dirY() { return Math.sin(this.radians) }
// plane 垂直于 dir，长度 0.66 → FOV = 2*atan(0.66) ≈ 66°
get planeX() { return -this.dirY * 0.66 }
get planeY() { return this.dirX * 0.66 }
// 兼容 Screen，把 position 拆成 posX / posY
get posX() { return this.position.x }
get posY() { return this.position.y }
```

### 2.5 验证方式

打开 HTML：
- 右侧 3D 视图应该看到**笔直、等高**的墙面
- 按 `w` 前进，墙柱高度随距离平滑变化；按 `a`/`d` 转向，画面也跟着旋转
- 不同颜色的墙（红/蓝/绿/橙）有不同的颜色；南北向墙略暗
- **不会再有弧形的鱼眼效果**（这是算法正确的核心标志）
- 小地图（左侧）仍然显示原来的射线和网格

如果右侧画面是空的（全灰色），检查：
1. `player.degrees` 当前是 90°，所以方向是 +Y 向下。玩家在 (4.5, 3.5)，朝 +Y 方向看，应该看到正前方有东西。否则修改 Player 初始位置为 `(1.5, 4.5)`，朝 0°（向右）来测试更清楚。

---

## 阶段三：玩家系统重构（Player.js 全文重写）

**目标**：把角度系统改成向量系统（dir + plane），实现分轴碰撞（贴墙滑行），速度按 deltaTime 缩放。

### 3.1 为什么要改

当前问题：
- 用 `degrees` 角度 + `degOffset = 5` 度/帧 → 帧率变化，速度会变
- `setInArea()` 的"撞墙就整步撤回"→ 斜向移动贴墙时卡住
- `Vec.mult()` 是 mutable（修改 this）+ 每次都 `new Vec` → GC 压力

### 3.2 具体改动（Player.js 全文）

直接把 Player.js 替换为：

```js
class Player {
    constructor(game, bg) {
        this.game = game
        this.bg = bg
        this.unit = bg.unit
        this.lines = bg.lines
        this.columns = bg.columns
        this.worldMap = bg.worldMap

        // 玩家格坐标（注意：与背景地图对应，范围 0~columns / 0~lines）
        this.position = new Vec(1.5, 4.5)   // 第二列第五行中心，朝右
        this.r = 10                         // 玩家像素半径

        // 方向向量（单位长度，决定玩家朝向）
        this.dirX = 1.0
        this.dirY = 0.0

        // 相机平面（⊥ dir，长度决定 FOV = 2*atan(|plane|/|dir|)
        // |dir|=1, |plane|=0.66 → FOV ≈ 66°
        this.planeX = 0.0
        this.planeY = 0.66

        // 速度（单位：格/秒，弧度/秒）—— 每帧乘以 deltaTime
        this.moveSpeed = 2.5      // 格/秒
        this.rotSpeed = 1.2       // 弧度/秒

        // 小地图上的显示颜色
        this.rayColor = new Color(255, 255, 255, 0.4)
        this.dirArrowColor = new Color(255, 200, 0, 1.0)
        this.playerColor = new Color(88, 221, 253)

        this.init()
    }

    // 为 Screen 提供的快捷 getter（Screen 通过这些字段读）
    get posX() { return this.position.x }
    get posY() { return this.position.y }

    init() {
        this.registerAction()
    }

    registerAction() {
        let g = this.game
        // 旋转
        g.registerAction('a', () => this.rotate(-this.rotSpeed))
        g.registerAction('d', () => this.rotate(+this.rotSpeed))
        // 前进/后退
        g.registerAction('w', () => this.tryMove(this.dirX, this.dirY, this.moveSpeed))
        g.registerAction('s', () => this.tryMove(-this.dirX, -this.dirY, this.moveSpeed))
        // 左右平移（strafing）
        g.registerAction('q', () => this.tryMove(-this.planeX, -this.planeY, this.moveSpeed))
        g.registerAction('e', () => this.tryMove(this.planeX, this.planeY, this.moveSpeed))
    }

    // 旋转玩家视角（用 2D 旋转矩阵，dt 是秒）
    rotate(rotSpeedDt) {
        let cos = Math.cos(rotSpeedDt)
        let sin = Math.sin(rotSpeedDt)
        // 先存旧值
        let oldDirX = this.dirX
        let oldPlaneX = this.planeX
        // dir 旋转
        this.dirX = this.dirX * cos - this.dirY * sin
        this.dirY = oldDirX * sin + this.dirY * cos
        // plane 同样旋转
        this.planeX = this.planeX * cos - this.planeY * sin
        this.planeY = oldPlaneX * sin + this.planeY * cos
    }

    // 分轴碰撞：分别尝试 X 方向和 Y 方向移动，撞墙就不移动那个轴
    // dx, dy 是单位方向向量；speed 是格/秒；dt 在调用方已经传入（阶段四接入）
    // 这里暂时用 speed 直接作为一步，阶段四再接入 deltaTime
    // 为了兼容现在的帧率：把 speed 改成 "步/帧"——当前 ~30fps → speed/30
    tryMove(dx, dy, speed) {
        // 半径（以格为单位）
        let r = this.r / this.unit * 0.5   // 稍微放宽一点，0.5 格半径 ≈ 实际碰撞半径
        let step = speed   // 暂时按帧速，阶段四接 deltaTime

        let newX = this.position.x + dx * step
        let newY = this.position.y + dy * step

        // X 方向：尝试移动
        let testMapX = Math.floor(newX + Math.sign(dx) * r)
        let testMapY = Math.floor(this.position.y)
        if (this.isInBounds(testMapX, testMapY) && this.worldMap[testMapY][testMapX] === 0) {
            // 额外再检查玩家四角都没撞墙
            if (this.cellIsEmpty(newX + Math.sign(dx) * r, this.position.y) &&
                this.cellIsEmpty(newX + Math.sign(dx) * r, this.position.y + r * 0.5) &&
                this.cellIsEmpty(newX + Math.sign(dx) * r, this.position.y - r * 0.5)) {
                this.position.x = newX
            }
        }

        // Y 方向：尝试移动
        testMapX = Math.floor(this.position.x)
        testMapY = Math.floor(newY + Math.sign(dy) * r)
        if (this.isInBounds(testMapX, testMapY) && this.worldMap[testMapY][testMapX] === 0) {
            if (this.cellIsEmpty(this.position.x, newY + Math.sign(dy) * r) &&
                this.cellIsEmpty(this.position.x + r * 0.5, newY + Math.sign(dy) * r) &&
                this.cellIsEmpty(this.position.x - r * 0.5, newY + Math.sign(dy) * r)) {
                this.position.y = newY
            }
        }
    }

    isInBounds(mx, my) {
        return mx >= 0 && mx < this.columns && my >= 0 && my < this.lines
    }

    cellIsEmpty(x, y) {
        let mx = Math.floor(x)
        let my = Math.floor(y)
        if (!this.isInBounds(mx, my)) return false
        return this.worldMap[my][mx] === 0
    }

    // ---- 绘制：只画小地图上的玩家、朝向箭头和视野扇区 ----

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

    drawDirArrow() {
        // 画一条从玩家中心出发，沿 dir 方向的箭头线
        let unit = this.unit
        let startX = this.position.x * unit
        let startY = this.position.y * unit
        let len = unit * 1.5   // 箭头长度 = 1.5 格
        let endX = startX + this.dirX * len
        let endY = startY + this.dirY * len
        drawLine(this.game.context, this.dirArrowColor, startX, startY, endX, endY)

        // FOV 的两条边界线（表示视觉范围）
        // FOV 左边界方向：dir - plane
        let leftX = this.dirX - this.planeX
        let leftY = this.dirY - this.planeY
        let lenLeft = Math.sqrt(leftX*leftX + leftY*leftY)
        leftX /= lenLeft; leftY /= lenLeft
        drawLine(this.game.context, this.rayColor,
            startX, startY, startX + leftX * unit * 3, startY + leftY * unit * 3)

        // FOV 右边界方向：dir + plane
        let rightX = this.dirX + this.planeX
        let rightY = this.dirY + this.planeY
        let lenRight = Math.sqrt(rightX*rightX + rightY*rightY)
        rightX /= lenRight; rightY /= lenRight
        drawLine(this.game.context, this.rayColor,
            startX, startY, startX + rightX * unit * 3, startY + rightY * unit * 3)
    }
}
```

### 3.3 重点说明

- `tryMove()` 中 X 和 Y 是**分开检测、分开移动**的。这就是「贴墙滑行」的核心：玩家朝斜向移动时，如果 X 方向没撞墙但 Y 方向撞墙了，玩家仍然会沿 X 方向滑动。
- `moveSpeed = 2.5` 格/秒 是暂时的值。**它还没乘以 deltaTime**，所以目前实际上是"2.5 格/帧"，太快了。阶段四接入 Game 的 deltaTime 后会修正。你可以先把 `moveSpeed` 改成 `0.08` 左右让它在当前 30fps 下感觉正常，或者直接进入阶段四。
- 去掉了 `getEndPoint`, `drawAllRay`, `drawRay`, `endPointArr`, `isStop`, `setInArea`, `getWallInfo`, `currentPoint`, `digits`, `defaultWallColor`, `isLog`。这些都不再需要了。Screen 自己跑 DDA。

### 3.4 验证方式

打开 HTML：
- 小地图上显示玩家（蓝色圆点）、朝向箭头（黄色）、FOV 边界两条淡线
- 按 `w` 前进，玩家朝朝向箭头方向走
- **贴着一面墙斜着走**：把玩家放到贴墙的位置，朝大约 45° 方向走，玩家应该能**沿着墙滑**而不是卡死
- 按 `q`/`e` 可以左右平移（strafing）
- 不会走进任何墙块里

---

## 阶段四：主循环改造 —— requestAnimationFrame + deltaTime（game/Game.js + game/GameScene.js）

**目标**：让游戏帧率和浏览器刷新率同步（通常 60fps），让移动速度和帧率无关。

### 4.1 具体改动（game/Game.js）

把 Game.js 替换为：

```js
class Game {
    constructor() {
        this.canvas = e('#id-canvas')
        this.context = this.canvas.getContext('2d')
        this.canvasImage = e('#id-canvas-image')
        this.contextImage = this.canvasImage.getContext('2d')

        this.scene = null
        this.keysdown = {}
        this.actions = {}

        // deltaTime 相关
        this.lastTime = performance.now()  // 上一帧时间（ms）
        this.dt = 1 / 60                    // 当前帧时间差（秒，初始 1/60）

        // 按键监听
        window.addEventListener('keydown', (e) => {
            this.keysdown[e.key] = true
        })
        window.addEventListener('keyup', (e) => {
            this.keysdown[e.key] = false
        })
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    }

    registerAction(key, callback) {
        this.actions[key] = callback
    }

    // 把 dt（秒）传给按键回调，玩家的 tryMove 和 rotate 会用它缩放速度
    doAction() {
        let actions = Object.keys(this.actions)
        for (let key of actions) {
            if (this.keysdown[key]) {
                this.actions[key](this.dt)
            }
        }
    }

    update() {
        if (this.scene) this.scene.update(this.dt)
    }

    clear() {
        // 清左边小地图 + 右边 3D 视图
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    draw() {
        if (this.scene) this.scene.draw()
    }

    runLoop(now) {
        // 计算 deltaTime（秒），夹在 0~0.05 秒，避免长时间暂停后瞬移
        this.dt = Math.min((now - this.lastTime) / 1000, 0.05)
        this.lastTime = now

        this.doAction()
        this.update()
        this.clear()
        this.draw()

        // 下一帧：与浏览器 VSync 同步
        requestAnimationFrame((t) => this.runLoop(t))
    }

    start(scene) {
        this.scene = scene
        this.lastTime = performance.now()
        requestAnimationFrame((t) => this.runLoop(t))
    }
}
```

### 4.2 具体改动（game/GameScene.js）

`GameScene.update()` 要把 dt 传给 player：

```js
class GameScene {
    constructor(game) {
        this.game = game
        this.height = game.canvas.height
        this.width = game.canvas.width
        this.init()
    }

    init() {
        let g = this.game
        this.bg = new Background(g)
        this.player = new Player(g, this.bg)
        this.screen = new Screen(g, this.player, this.bg)
    }

    update(dt) {
        // 这里预留：如果有敌人/物理，也用 dt 驱动
        // 玩家的移动在 doAction 中已经被驱动（因为按键是持续的）
    }

    draw() {
        this.bg.draw()
        this.player.draw()
        this.screen.draw()
    }
}
```

### 4.3 具体改动（Player.js 的按键回调要接收 dt）

Player.js 中 `registerAction()` 里的回调要接收 dt 并相乘：

```js
registerAction() {
    let g = this.game
    // 旋转：把 rotSpeed * dt 传进去
    g.registerAction('a', (dt) => this.rotate(-this.rotSpeed * dt))
    g.registerAction('d', (dt) => this.rotate(+this.rotSpeed * dt))
    // 前进/后退：把 moveSpeed * dt 作为步长
    g.registerAction('w', (dt) => this.tryMove(this.dirX, this.dirY, this.moveSpeed * dt))
    g.registerAction('s', (dt) => this.tryMove(-this.dirX, -this.dirY, this.moveSpeed * dt))
    // 左右平移
    g.registerAction('q', (dt) => this.tryMove(-this.planeX, -this.planeY, this.moveSpeed * dt))
    g.registerAction('e', (dt) => this.tryMove(this.planeX, this.planeY, this.moveSpeed * dt))
}
```

然后 `tryMove` 就可以直接用 `speed`（已经是"这一帧要移动的格数"），不需要再除以帧率。可以简化 `tryMove`：

```js
tryMove(dx, dy, step) {
    let r = 0.2   // 以格为单位的玩家半径，0.2 格（安全距离）

    // 尝试 X 方向移动
    let newX = this.position.x + dx * step
    let checkX = newX + Math.sign(dx) * r
    if (this.cellIsEmpty(checkX, this.position.y) &&
        this.cellIsEmpty(checkX, this.position.y + r * 0.5) &&
        this.cellIsEmpty(checkX, this.position.y - r * 0.5)) {
        this.position.x = newX
    }

    // 尝试 Y 方向移动
    let newY = this.position.y + dy * step
    let checkY = newY + Math.sign(dy) * r
    if (this.cellIsEmpty(this.position.x, checkY) &&
        this.cellIsEmpty(this.position.x + r * 0.5, checkY) &&
        this.cellIsEmpty(this.position.x - r * 0.5, checkY)) {
        this.position.y = newY
    }
}
```

### 4.4 验证方式

- 打开 HTML，画面帧率变高，不卡顿
- 打开浏览器开发者工具 → Performance 面板录制 3 秒：看到稳定的 ~60fps
- **改变浏览器标签页，再切回来**：玩家不会瞬移（因为 dt 被 clamp 到 0.05s 上限）
- `w` 前进速度：2.5 格/秒，穿过 10 格地图大约 4 秒，感觉合理
- 旋转速度：1.2 弧度/秒 ≈ 69°/秒，大约 5 秒转一圈，感觉合理

---

## 阶段五：Canvas 性能优化（utils.js）

**目标**：去掉 `drawLine` 和 `drawRect` 中每次都 `save()/restore()` 的多余状态切换。

### 5.1 具体改动（utils.js）

当前每一次画线或矩形都 save/restore 一次。Screen 里每帧有 `width`（=400）次 `fillRect`，就是 400 次 save + 400 次 restore。这是不必要的。

把 utils.js 修改为：

```js
const log = console.log.bind(console)
const e = sel => document.querySelector(sel)

// 画一条线段（不带 save/restore——调用方自行管理 fillStyle / strokeStyle）
const drawLine = (context, color, x, y, endX, endY) => {
    context.strokeStyle = color.stringColor()
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(endX, endY)
    context.stroke()
}

// 画矩形
const drawRect = (context, color, x, y, width, height) => {
    context.fillStyle = color.stringColor()
    context.fillRect(x, y, width, height)
}

// 画文本
const drawText = (context, fontSize, textColor, text, x, y) => {
    context.fillStyle = textColor.stringColor()
    context.font = `${fontSize}px Georgia`
    context.fillText(text, x, y)
}

// 画圆（玩家头像）
const drawArc = (context, color, x, y, r) => {
    context.beginPath()
    context.arc(x, y, r, 0, 2 * Math.PI)
    context.fillStyle = color.stringColor()
    context.fill()
}

// 工具类：向量
class Vec {
    constructor(x, y) {
        this.x = x
        this.y = y
    }
    get len() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }
    add(v) {
        this.x += v.x; this.y += v.y; return this
    }
    sub(v) {
        this.x -= v.x; this.y -= v.y; return this
    }
    mult(v) {
        if (v instanceof Vec) { this.x *= v.x; this.y *= v.y }
        else { this.x *= v; this.y *= v }
        return this
    }
    clone() { return new Vec(this.x, this.y) }
}

// 工具类：颜色
class Color {
    constructor(r, g, b, a = 1) {
        this.r = r; this.g = g; this.b = b; this.a = a
    }
    static get White() { return new Color(255,255,255) }
    static get Black() { return new Color(0,0,0) }
    static get Red()   { return new Color(255,0,0) }
    static get Green() { return new Color(0,255,0) }
    static get Blue()  { return new Color(0,0,255) }

    stringColor() { return `rgba(${this.r},${this.g},${this.b},${this.a})` }

    add(color) {
        return new Color(this.r + color.r, this.g + color.g, this.b + color.b, this.a + color.a)
    }
}
```

### 5.2 注意点

去掉 `save/restore` 意味着：如果上下文有 `transform` / `clip` 等状态设置，需要手动管理。但在我们的代码里，只用到了 `fillStyle` 和 `strokeStyle`，不会出问题。Screen 的 DDA 循环里每次都会重设 `fillStyle`，Background/Player 也是每次绘制重新设置，所以去掉 save/restore 是安全的。

### 5.3 验证方式

- 视觉上看起来和之前**完全一样**
- 可以在浏览器 Performance 面板录制，观察每帧的 Canvas 调用耗时是否减少（不强制，肉眼感觉即可）

---

## 阶段六：画布尺寸与 CSS 布局（raycasting.html）

**目标**：把 3D 视图画布加宽，让效果更清晰；让两个 canvas 顶部对齐。

### 6.1 具体改动（raycasting.html）

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>RayCasting</title>
    <style>
        body {
            margin: 12px;
            font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
            background: #1a1a1a;
            color: #ddd;
        }
        .wrap {
            display: flex;
            align-items: flex-start;   /* 顶部对齐 */
            gap: 16px;
        }
        canvas {
            background: #000;
            image-rendering: pixelated;  /* 防止 Canvas 被平滑模糊 */
            border: 1px solid #444;
            display: block;
        }
        .label {
            font-size: 12px;
            color: #888;
            margin-bottom: 4px;
        }
        .hint {
            margin-top: 12px;
            font-size: 13px;
            color: #888;
            line-height: 1.7;
        }
        kbd {
            background: #333;
            border: 1px solid #555;
            border-radius: 3px;
            padding: 1px 6px;
            font-family: inherit;
            color: #ccc;
        }
    </style>
</head>
<body>
    <h2 style="margin:0 0 12px 0;">Raycasting — Wolfenstein 风格伪 3D 引擎</h2>
    <div class="wrap">
        <div>
            <div class="label">小地图（Top-down Map）</div>
            <canvas id="id-canvas" width="400" height="400"></canvas>
        </div>
        <div>
            <div class="label">3D 视图（Raycasted View）</div>
            <canvas id="id-canvas-image" width="640" height="400"></canvas>
        </div>
    </div>

    <div class="hint">
        <b>操作：</b>
        <kbd>w</kbd> 前进　<kbd>s</kbd> 后退　<kbd>a</kbd> 左转　<kbd>d</kbd> 右转　<kbd>q</kbd>/<kbd>e</kbd> 左右平移
    </div>

    <script src="utils.js"></script>
    <script src="game/Game.js"></script>
    <script src="game/GameScene.js"></script>
    <script src="Background.js"></script>
    <script src="Player.js"></script>
    <script src="game/Screen.js"></script>

    <script src="index.js"></script>
</body>
</html>
```

### 6.2 验证方式

- 左侧 400×400 小地图 + 右侧 640×400 3D 视图并排显示，顶部对齐
- 背景深色，两个 canvas 有细边框
- 页面下方有操作提示文字
- 画面比之前更清晰（每帧 640 条射线，比原来 100 条细 6 倍）

---

## 改动文件总览（所有阶段）

| 文件 | 改动性质 | 具体变更 |
|------|---------|---------|
| `Background.js` | 重写 | wallData → worldMap 二维数组 + wallColors 颜色表 |
| `game/Screen.js` | 全文重写 | 从读 endPointArr 改为自己跑 DDA 射线投射；每列像素 1 条射线 |
| `Player.js` | 全文重写 | 角度 → dir/plane 向量；分轴碰撞；接入 dt 的 tryMove/rotate |
| `game/Game.js` | 重写 | setTimeout 30fps → requestAnimationFrame，加 dt 计算与传递 |
| `game/GameScene.js` | 小改 | Screen 构造传 bg；update 接收 dt |
| `utils.js` | 优化 | drawLine/drawRect/drawArc 去掉 save/restore |
| `raycasting.html` | 小改 | canvas 尺寸调整 + CSS 布局美化 |

总计：**7 个文件，无新依赖，无新文件**。

---

## 做完六步后，项目的新架构

```
┌────────────────────────────────────┐
│   Game.js  (主循环 + 事件)          │
│   - requestAnimationFrame           │
│   - dt = now - lastTime             │
│   - keysdown / actions              │
└──────────────┬─────────────────────┘
               │ 1 帧 = doAction(dt) → update(dt) → clear → draw
               ▼
┌────────────────────────────────────┐
│   GameScene.js                      │
│   ├── Background (地图 + 小地图绘制)│
│   │   └── worldMap[y][x]            │
│   ├── Player (位置 + 向量朝向 + 碰撞)│
│   │   └── posX/posY, dirX/Y, plane  │
│   └── Screen (DDA 射线投射)         │
│       └── 对每列 x：跑 DDA → 画墙柱│
└────────────────────────────────────┘
```

数据流向：
- Screen.drawWall() → 读 `player.posX/posY/dirX/Y/planeX/Y` + `bg.worldMap` + `bg.wallColors` → DDA → 直接画到 `game.contextImage`
- Player.tryMove() → 读 `worldMap` 做碰撞检测 → 修改 `position.x/y`
- Background.draw() → 读 `worldMap` 画网格/墙体 → 直接画到 `game.context`

---

## 可能的坑 & 调试方法

| 现象 | 可能原因 | 检查方式 |
|------|---------|---------|
| 3D 视图全灰，看不到墙 | DDA 循环没进入或 early return | 在 `drawWall` 顶部加 `console.log('posX=', this.player.posX, 'dirX=', this.player.dirX)`，看坐标对不对 |
| 画面有弧形 / 鱼眼弯曲 | `perpDist` 计算用了欧氏距离而非垂直距离 | 检查 `sideDistX - deltaDistX` 公式；确认没用 `sqrt(dx^2+dy^2)` |
| 画面一片纯色，没有墙柱 | `lineHeight` 太大或太小 | 打印 `perpDist`、`lineHeight`，看是否 `perpDist` 接近 0 导致 lineHeight 巨大 |
| 墙是一条条竖线但缝隙不均 | `x` 循环从 `0` 到 `width-1` 用整数，每条宽度 1 | 检查 `fillRect(x, drawStart, 1, ...)` 第三个参数是否是 `1` |
| 玩家穿墙 | 碰撞检测的 r 太小或 cellIsEmpty 判断不完整 | 把 `r` 调大到 0.3；在 `cellIsEmpty` 里打印坐标 |
| 玩家贴墙卡死 | 碰撞检测没分轴或者 r 太大把玩家卡死在边界 | 检查 `tryMove` 是否是两个独立的 if（不是 if/else） |
| 画面上下颠倒或左右镜像 | plane 的方向和 dir 方向关系不对 | 标准做法 `planeX = -dirY * k, planeY = dirX * k`，如果画面镜像把两个都取反 |

---

## 本方案涉及的文件完整路径

| 相对路径 | 绝对路径 |
|----------|---------|
| `Background.js` | `/Users/kangsenbin/Downloads/games/raycasting/Background.js` |
| `Player.js` | `/Users/kangsenbin/Downloads/games/raycasting/Player.js` |
| `utils.js` | `/Users/kangsenbin/Downloads/games/raycasting/utils.js` |
| `raycasting.html` | `/Users/kangsenbin/Downloads/games/raycasting/raycasting.html` |
| `game/Game.js` | `/Users/kangsenbin/Downloads/games/raycasting/game/Game.js` |
| `game/GameScene.js` | `/Users/kangsenbin/Downloads/games/raycasting/game/GameScene.js` |
| `game/Screen.js` | `/Users/kangsenbin/Downloads/games/raycasting/game/Screen.js` |

---

## 验证流程总览（做完六个阶段后做一次全面回归）

1. **冷启动**：双击打开 `raycasting.html`，控制台无红色错误
2. **画面完整性**：左=小地图（网格+墙体+玩家+朝向箭头+FOV边界），右=3D 视图（上灰下深灰 + 彩色墙柱）
3. **前进**：按 `w`，玩家朝黄色箭头方向走，3D 视图中墙柱高度随距离变化
4. **旋转**：按 `a`/`d`，玩家和 3D 视图一起旋转，FOV 在正确方向
5. **贴墙滑行**：把玩家贴到一面墙，朝斜方向走，应该沿墙滑而不卡
6. **左右平移**：按 `q`/`e`，玩家向左右两侧平行移动
7. **不穿墙**：直接朝墙走，玩家在墙前停住，不会穿过去
8. **帧率**：DevTools Performance 面板录制 → 60fps 稳定
9. **切页测试**：切到别的 tab 停 5 秒再切回来 → 不瞬移
10. **墙体颜色**：红/蓝/绿/橙 四种墙颜色正确，南北向墙略暗

全部通过 = 六阶段重构完成 ✅

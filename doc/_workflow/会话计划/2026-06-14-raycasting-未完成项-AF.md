# Raycasting 光线投射引擎 — 未完成项执行方案（A ~ F）

> 位置：`doc/_workflow/会话计划/2026-06-14-raycasting-未完成项-AF.md`
> 对应总清单：`doc/_workflow/todoList.md` 中 3.1 ~ 4.1（墙面纹理 → 光照增强）
> 上游文档：`doc/raycasting_改进建议.md`
> 前置已完成：阶段一~六（DDA + 鱼眼 + 二维地图 + rAF + 分轴碰撞 + 画布样式）

---

## 总览

| 阶段 | 功能 | 难度 | 预计代码量 | 推荐实施顺序 |
|------|------|------|-----------|-------------|
| A | 墙面纹理贴图（Textured Raycasting） | 中 | 中等（1 新文件 + 修改 Screen/Background） | 1（先做，视觉提升最大） |
| B | 地板/天花板纹理投射 | 中 | 中等（修改 Screen.drawBg） | 2（紧随 A，视觉同样提升很大） |
| C | 鼠标控制视角 + 键盘增强 | 小 | 小（修改 Game/Player/HTML） | 3 |
| D | Sprite 系统（敌人/物品） | 大 | 大（2 新文件 + 修改 Screen/Player/Texture） | 4 |
| E | 增强型小地图 | 小 | 小 | 5 |
| F | 阴影/光照/雾效 | 小 | 小（修改 Screen） | 6 |

---

## 阶段 A：墙面纹理贴图

### A.1 目标

墙面从纯色块变成砖块/石头/木材等纹理。视觉上最直观的提升。

### A.2 涉及文件

| 文件 | 改动 |
|------|------|
| `textures.js`（**新建**） | 程序化生成 3~4 张 64×64 纹理（砖、石、木等） |
| `game/Screen.js` | `drawWall()` 从「纯色 fillRect」改成「纹理列采样」；新增 `zBuffer: Float32Array` |
| `Background.js` | `wallColors` 保留，`worldMap` 的值 1/2/3/4 同时作为纹理编号 |
| `game/GameScene.js` | init 时创建 `TextureManager`，传给 `Screen` |

### A.3 关键实现

**1）textures.js（新建文件，放在根目录或 game/ 下）：**

```js
// textures.js
class TextureManager {
    constructor() {
        this.size = 64  // 每张贴图 64x64
        this.textures = {} // { key: <canvas> }
        this.generateAll()
    }

    // 工具：给 canvas 加点随机噪声，避免过度光滑
    _addNoise(canvas, amount = 16) {
        let ctx = canvas.getContext('2d')
        let img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        let d = img.data
        for (let i = 0; i < d.length; i += 4) {
            let n = (Math.random() - 0.5) * amount
            d[i]   = Math.max(0, Math.min(255, d[i] + n))
            d[i+1] = Math.max(0, Math.min(255, d[i+1] + n))
            d[i+2] = Math.max(0, Math.min(255, d[i+2] + n))
        }
        ctx.putImageData(img, 0, 0)
    }

    // 生成砖墙（brickH 高 brickW 宽，偶数行错开半块）
    generateBrick(baseR = 180, baseG = 80, baseB = 80) {
        let size = this.size
        let c = document.createElement('canvas')
        c.width = size; c.height = size
        let ctx = c.getContext('2d')

        ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`
        ctx.fillRect(0, 0, size, size)

        ctx.strokeStyle = `rgb(${Math.floor(baseR*0.5)},${Math.floor(baseG*0.5)},${Math.floor(baseB*0.5)})`
        ctx.lineWidth = 2
        const brickH = 8, brickW = 16
        for (let row = 0; row < size / brickH; row++) {
            let offset = (row % 2) * (brickW / 2)
            for (let col = -1; col < size / brickW + 1; col++) {
                ctx.strokeRect(col * brickW + offset, row * brickH, brickW, brickH)
            }
        }
        this._addNoise(c, 20)
        return c
    }

    // 石头墙（随机多边形块）
    generateStone(baseR = 140, baseG = 140, baseB = 150) {
        let size = this.size
        let c = document.createElement('canvas')
        c.width = size; c.height = size
        let ctx = c.getContext('2d')
        ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`
        ctx.fillRect(0, 0, size, size)

        ctx.strokeStyle = `rgb(${baseR*0.5|0},${baseG*0.5|0},${baseB*0.5|0})`
        ctx.lineWidth = 3
        for (let i = 0; i < 14; i++) {
            let x = Math.random() * size
            let y = Math.random() * size
            let r = 8 + Math.random() * 12
            ctx.beginPath()
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.stroke()
        }
        this._addNoise(c, 25)
        return c
    }

    // 木材（竖条纹 + 深浅交替）
    generateWood(baseR = 160, baseG = 110, baseB = 60) {
        let size = this.size
        let c = document.createElement('canvas')
        c.width = size; c.height = size
        let ctx = c.getContext('2d')

        ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`
        ctx.fillRect(0, 0, size, size)

        for (let i = 0; i < size; i += 8) {
            let shade = 0.85 + Math.random() * 0.3
            let r = Math.floor(baseR * shade)
            let g = Math.floor(baseG * shade)
            let b = Math.floor(baseB * shade)
            ctx.fillStyle = `rgb(${r},${g},${b})`
            ctx.fillRect(i, 0, 8, size)
        }
        this._addNoise(c, 15)
        return c
    }

    generateAll() {
        this.textures[1] = this.generateBrick(180, 80, 80)   // 红砖墙
        this.textures[2] = this.generateBrick(80, 120, 200)  // 蓝砖墙
        this.textures[3] = this.generateStone(140, 140, 150) // 石头
        this.textures[4] = this.generateWood(160, 110, 60)   // 木材/橙
    }

    // 取一张纹理的一列像素（用于 1 条 DDA 射线对应的墙柱）
    // texX: 0 ~ size-1（该列在纹理上的 x 坐标）
    // 返回：Array length = size，每个元素 [r,g,b]
    getTextureColumn(textureIndex, texX) {
        let canvas = this.textures[textureIndex]
        if (!canvas) return null
        let ctx = canvas.getContext('2d')
        let img = ctx.getImageData(texX, 0, 1, this.size)
        let d = img.data
        let out = []
        for (let y = 0; y < this.size; y++) {
            let i = y * 4
            out.push([d[i], d[i+1], d[i+2]])
        }
        return out
    }
}
```

**2）修改 `game/Screen.js`：**

- constructor 增加 `textureManager` 参数
- 声明 `this.zBuffer = new Float32Array(this.width)`
- `drawWall()` 中，把"取颜色 → fillRect"改成"取纹理列 → 每像素画"

核心改动部分：

```js
// drawWall() 中，对每条射线计算完 perpDist 后：

let lineHeight = Math.floor(this.height / perpDist)
let drawStart = Math.floor(-lineHeight / 2 + this.height / 2)
let drawEnd   = drawStart + lineHeight
if (drawStart < 0) drawStart = 0
if (drawEnd   > this.height) drawEnd = this.height

// ===== 纹理部分（替换原先的纯色绘制）=====
let cell = bg.worldMap[mapY][mapX]

// 1) wallX：射线在墙上的精确位置（0 ~ 1）
let wallX
if (side === 0) wallX = posY + perpDist * rayDirY
else             wallX = posX + perpDist * rayDirX
wallX -= Math.floor(wallX)

// 2) texX：纹理列索引
let texSize = this.textures.size
let texX = Math.floor(wallX * texSize)
// 水平镜像（射线从该面的"另一个方向"进入时）避免接缝
if (side === 0 && rayDirX > 0) texX = texSize - texX - 1
if (side === 1 && rayDirY < 0) texX = texSize - texX - 1

// 3) 取纹理列（64 行），把它按 lineHeight 缩放到屏幕
let texCol = this.textures.getTextureColumn(cell, texX)
if (!texCol) {
    // 回退到纯色（不应该发生）
    let color = bg.wallColors[cell] || new Color(255,162,162)
    ctx.fillStyle = color.stringColor()
    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart)
    continue
}

// 4) 按 drawStart ~ drawEnd 画：src 的 texY / srcSize 映射到屏幕
let src = texCol
for (let screenY = drawStart; screenY < drawEnd; screenY++) {
    if (screenY < 0 || screenY >= this.height) continue
    let texY = Math.floor((screenY - drawStart) / (drawEnd - drawStart) * texSize)
    texY = Math.max(0, Math.min(texSize - 1, texY))
    let [r, g, b] = src[texY]

    // 侧面变暗
    if (side === 1) { r *= 0.7; g *= 0.7; b *= 0.7 }
    // 距离衰减
    let distFactor = 1.0 / (1.0 + 0.02 * perpDist * perpDist)
    r = Math.floor(r * distFactor); g = Math.floor(g * distFactor); b = Math.floor(b * distFactor)

    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(x, screenY, 1, 1)
}

// 5) 存 zBuffer（给 Sprite 用）
this.zBuffer[x] = perpDist
```

**3）GameScene.js 修改：**

```js
init() {
    let g = this.game
    this.bg = new Background(g)
    this.textureManager = new TextureManager()
    this.player = new Player(g, this.bg)
    this.screen = new Screen(g, this.player, this.bg, this.textureManager)
}
```

### A.4 验证方式

- 打开 HTML → 墙面是砖块/石头纹理而不是纯色
- 不同的墙（红/蓝/绿/橙）显示为不同类型纹理
- 远墙比近墙暗
- 朝墙移动时，纹理正确放大（没有明显抖动或错位）
- 3D 视图每帧能在 ~30fps 以上（性能 OK 就进入下一阶段）

---

## 阶段 B：地板/天花板纹理

### B.1 目标

把上半部分（天花板）和下半部分（地板）从纯色改成纹理。

### B.2 涉及文件

| 文件 | 改动 |
|------|------|
| `textures.js` | 增加 `generateFloor()` 或直接把地板纹理也放进 `textures`（比如 key = 10 是地板）|
| `game/Screen.js` | `drawBg()` 重写为"每行 y 用 Lodev 的地板 raycasting 算法采样" |

### B.3 算法核心

```js
drawBg() {
    let ctx = this.context
    let width = this.width, height = this.height
    let posX = this.player.position.x, posY = this.player.position.y
    let dirX = this.player.dirX, dirY = this.player.dirY
    let planeX = this.player.planeX, planeY = this.player.planeY

    let texSize = this.textures.size
    let floorTexIndex = 10   // 棋盘格地板
    let ceilTexIndex  = 11   // 灰天花板

    // 天花板先画纯色（简单版本，也可以同样用纹理算法）
    let ceil = this.textures.textures[ceilTexIndex]
    let ceilCol = ceil ? null : new Color(70, 70, 90)
    if (!ceil) {
        ctx.fillStyle = ceilCol.stringColor()
        ctx.fillRect(0, 0, width, height / 2)
    }

    // 地板 = 从 y = height/2 到 height 逐行采样
    for (let y = Math.floor(height/2); y < height; y++) {
        // rayDir 0 = 左边界（dir - plane）
        // rayDir 1 = 右边界（dir + plane）
        let rayDirX0 = dirX - planeX
        let rayDirY0 = dirY - planeY
        let rayDirX1 = dirX + planeX
        let rayDirY1 = dirY + planeY

        let p = y - height / 2
        let posZ = 0.5 * height  // 玩家相机高度
        if (p === 0) continue
        let rowDistance = posZ / p  // 这一行地板在世界中的"垂直距离"
        if (rowDistance < 0.1) continue

        // 这一行地板的起点/终点（世界坐标格）
        let floorStepX = rowDistance * (rayDirX1 - rayDirX0) / width
        let floorStepY = rowDistance * (rayDirY1 - rayDirY0) / width
        let floorX = posX + rowDistance * rayDirX0
        let floorY = posY + rowDistance * rayDirY0

        for (let x = 0; x < width; x++) {
            floorX += floorStepX
            floorY += floorStepY

            // 棋盘格地板（最简单的"地板纹理"）
            let cx = Math.floor(floorX)
            let cy = Math.floor(floorY)
            let texX = Math.floor(Math.abs(floorX - cx) * texSize)
            let texY = Math.floor(Math.abs(floorY - cy) * texSize)
            texX = Math.max(0, Math.min(texSize - 1, texX))
            texY = Math.max(0, Math.min(texSize - 1, texY))

            // 取颜色：如果有地板纹理就采样，否则用棋盘格
            let r, g, b
            if (this.textures.textures[floorTexIndex]) {
                let col = this.textures.getTextureColumn(floorTexIndex, texX)
                if (col && col[texY]) { [r, g, b] = col[texY] }
            } else {
                // 棋盘格 = 简单的两种颜色
                let checker = (cx + cy) % 2 === 0
                if (checker) { r = 80; g = 80; b = 80 }
                else { r = 60; g = 60; b = 60 }
            }

            // 距离衰减
            let df = 1.0 / (1.0 + 0.005 * rowDistance * rowDistance)
            r = Math.floor(r * df); g = Math.floor(g * df); b = Math.floor(b * df)

            ctx.fillStyle = `rgb(${r},${g},${b})`
            ctx.fillRect(x, y, 1, 1)
        }
    }

    // 天花板也同样做法（对称的 rowDistance 计算）
    for (let y = 0; y < Math.floor(height / 2); y++) {
        let p = height / 2 - y
        let rowDistance = posZ / p
        if (rowDistance < 0.1) continue
        // ... 同上：对每一行 x 采样 ceilTexIndex，画 fillRect(x, y, 1, 1)
        let rayDirX0 = dirX - planeX
        let rayDirY0 = dirY - planeY
        let rayDirX1 = dirX + planeX
        let rayDirY1 = dirY + planeY
        let floorStepX = rowDistance * (rayDirX1 - rayDirX0) / width
        let floorStepY = rowDistance * (rayDirY1 - rayDirY0) / width
        let ceilX = posX + rowDistance * rayDirX0
        let ceilY = posY + rowDistance * rayDirY0
        for (let x = 0; x < width; x++) {
            ceilX += floorStepX; ceilY += floorStepY
            let cx = Math.floor(ceilX), cy = Math.floor(ceilY)
            let checker = (cx + cy) % 2 === 0
            let r, g, b
            if (checker) { r = 110; g = 110; b = 120 }
            else { r = 85; g = 85; b = 95 }
            let df = 1.0 / (1.0 + 0.005 * rowDistance * rowDistance)
            r = Math.floor(r * df); g = Math.floor(g * df); b = Math.floor(b * df)
            ctx.fillStyle = `rgb(${r},${g},${b})`
            ctx.fillRect(x, y, 1, 1)
        }
    }
}
```

### B.4 注意事项

- **性能**：地板算法 = O(width * height / 2)。640×400 → 每帧 ~128,000 个 fillRect(1,1)。比墙体的 640 条射线慢很多。
- **性能优化建议**（遇到掉帧再做）：
  - 把画帧放到一个 offscreen ImageData，最后 `putImageData` 一次提交
  - 降低分辨率（如 320×200）然后 CSS 放大
  - 每 2 行/2 列 采样一次
- **顺序**：`drawBg()` 必须先于 `drawWall()` 调用（墙体覆盖在地板/天花板之上）

---

## 阶段 C：鼠标控制视角 + 键盘增强

### C.1 目标

- 点击画面后，鼠标左右移动 = 旋转（像 FPS 一样）
- Shift = 加速跑
- 保持原来的 a/d 键盘旋转（兼容纯键盘）

### C.2 涉及文件

| 文件 | 改动 |
|------|------|
| `game/Game.js` | 新增 `requestPointerLock` 监听、`mousemove` 监听、记录 `mouseDX`；`runLoop` 中把鼠标移动传给 Player |
| `Player.js` | 加 `moveSpeedBase / moveSpeedSprint` 和 `setSprinting(bool)` |
| `raycasting.html` | 更新"操作"提示 |

### C.3 Game.js 增量代码

```js
// Game.js constructor 中新增：
this.mouseDX = 0
this.mouseSensitivity = 0.0025   // rad/px（越大越快）
this.isPointerLocked = false

// 点击右侧 canvas 启动 pointer lock
let canvasImg = this.canvasImage
canvasImg.addEventListener('click', () => {
    canvasImg.requestPointerLock && canvasImg.requestPointerLock()
})
// 监听 pointer lock 状态
document.addEventListener('pointerlockchange', () => {
    this.isPointerLocked = (document.pointerLockElement === canvasImg)
})
// 鼠标移动 → 累加 dx
document.addEventListener('mousemove', (e) => {
    if (!this.isPointerLocked) return
    this.mouseDX += e.movementX
})

// runLoop(now) 中新增（在 doAction 之前）：
runLoop(now) {
    // ... 已有 dt 计算 ...

    // 鼠标旋转：把 mouseDX 变成角度，传给 player
    if (this.mouseDX !== 0 && this.scene.player) {
        this.scene.player.rotate(this.mouseDX * this.mouseSensitivity)
        this.mouseDX = 0
    }

    // 加速跑状态
    if (this.scene.player) {
        this.scene.player.setSprinting(!!this.keysdown['Shift'])
    }

    // ... 已有 doAction / update / draw ...
}
```

### C.4 Player.js 增量代码

```js
constructor(...) {
    // ... 原有 ...
    this.moveSpeedBase = 2.5
    this.moveSpeedSprint = 5.0
    this.moveSpeed = this.moveSpeedBase
}

setSprinting(isSprinting) {
    this.moveSpeed = isSprinting ? this.moveSpeedSprint : this.moveSpeedBase
}

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
```

### C.5 HTML 提示更新

```html
在 raycasting.html 的操作行中增加：
<kbd>Shift</kbd> 加速跑  |  鼠标移动控制视角（点击画面启动）
```

### C.6 验证方式

- 点击 canvas → 鼠标指针消失 → 鼠标左右移 → 画面旋转
- 按 Shift 走 → 速度加倍
- Esc → 鼠标恢复，控制停止

---

## 阶段 D：Sprite 系统（敌人 / 物品）

### D.1 目标

在 3D 场景中加入始终面向玩家的精灵（敌人、物品、装饰物），支持：
- 透视缩放（远的小、近的大）
- 被墙遮挡（用 zBuffer 每列判断）
- 互相遮挡（按距离从远到近排序）
- 玩家与精灵的碰撞 / 捡取

### D.2 涉及文件

| 文件 | 改动 |
|------|------|
| `game/Sprite.js`（**新建**） | `Sprite` 类：位置、纹理、类型、AI、碰撞半径 |
| `game/SpriteManager.js`（**新建**） | 管理所有精灵、排序、绘制、更新 AI |
| `game/Screen.js` | `zBuffer[x] = perpDist`（已在 A 阶段加入）；最后调用 `spriteManager.draw(ctx, player, textures, zBuffer, w, h)` |
| `Player.js` | `tryMove` 中检查与「blocking」类型精灵的碰撞；`update` 检查与「pickable」类型的捡取 |
| `game/GameScene.js` | init 时创建 SpriteManager，放置几个初始精灵 |
| `textures.js` | 增加 1~2 张精灵纹理（简单圆形脸 / 药包图标） |

### D.3 Sprite.js

```js
// game/Sprite.js
class Sprite {
    constructor(x, y, textureIndex, options = {}) {
        this.x = x
        this.y = y
        this.textureIndex = textureIndex
        this.type = options.type || 'decoration'  // 'enemy', 'item', 'decoration'
        this.radius = options.radius || 0.2
        this.isPickable = !!options.isPickable
        this.isBlocking = options.isBlocking !== false  // 默认挡路

        // AI
        this.speed = options.speed || 0      // 格/秒
        this.hp = options.hp || 100
        this.alive = true
        this._attackCooldown = 0
    }

    // 简单 AI：每帧调用
    update(dt, player, bg) {
        if (!this.alive || this.type !== 'enemy' || this.speed === 0) return

        let dx = player.position.x - this.x
        let dy = player.position.y - this.y
        let dist = Math.sqrt(dx*dx + dy*dy)
        if (dist > 15) return  // 太远不动

        let ndx = dx / dist, ndy = dy / dist

        // 视线检查（沿连接线上每 0.25 格采样一次格子是否是墙）
        let canSee = true
        let steps = Math.floor(dist * 4)
        for (let i = 1; i <= steps; i++) {
            let cx = Math.floor(this.x + ndx * (i / 4))
            let cy = Math.floor(this.y + ndy * (i / 4))
            if (cx < 0 || cy < 0 || cx >= bg.columns || cy >= bg.lines) { canSee = false; break }
            let cell = bg.worldMap[cy][cx]
            if (cell > 0 && cell < 100) { canSee = false; break }
            if (cell >= 101 && !bg.isDoorOpen(cx, cy)) { canSee = false; break }
        }
        if (!canSee) return

        // 近距离攻击
        if (dist < 0.8) {
            this._attackCooldown -= dt
            if (this._attackCooldown <= 0) {
                this._attackCooldown = 1.0
                player.hp = (player.hp || 100) - 10
                if (window.audioManager) window.audioManager.playHurt()
            }
            return
        }

        // 朝玩家走（简单：先尝试沿 x 轴，再沿 y 轴）
        let nx = this.x + ndx * this.speed * dt
        let ny = this.y + ndy * this.speed * dt
        let cx1 = Math.floor(nx), cy1 = Math.floor(this.y)
        if (bg.worldMap[cy1] && bg.worldMap[cy1][cx1] === 0) this.x = nx
        let cx2 = Math.floor(this.x), cy2 = Math.floor(ny)
        if (bg.worldMap[cy2] && bg.worldMap[cy2][cx2] === 0) this.y = ny
    }
}
```

### D.4 SpriteManager.js

```js
// game/SpriteManager.js
class SpriteManager {
    constructor() {
        this.sprites = []
    }

    add(s) { this.sprites.push(s) }

    update(dt, player, bg) {
        for (let s of this.sprites) s.update(dt, player, bg)
    }

    // 在 Screen.drawWall 之后调用，zBuffer 是每列的距离
    draw(ctx, player, textureManager, zBuffer, width, height) {
        let posX = player.position.x, posY = player.position.y
        let dirX = player.dirX, dirY = player.dirY
        let planeX = player.planeX, planeY = player.planeY

        // 按距离从远到近排序（远的先画）
        let sorted = this.sprites
            .filter(s => s.alive)
            .map(s => ({ s, d: (s.x - posX)**2 + (s.y - posY)**2 }))
            .sort((a, b) => b.d - a.d)

        for (let entry of sorted) {
            let s = entry.s

            // 1) 变换到相机空间
            let spriteX = s.x - posX
            let spriteY = s.y - posY
            let invDet = 1.0 / (planeX * dirY - dirX * planeY)
            let transformX = invDet * (dirY * spriteX - dirX * spriteY)
            let transformY = invDet * (-planeY * spriteX + planeX * spriteY)

            if (transformY <= 0.1) continue  // 在背后

            // 2) 屏幕 x 坐标
            let spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY))

            // 3) 屏幕高度/宽度（用 |height/transformY|）
            let spriteHeight = Math.abs(Math.floor(height / transformY))
            let spriteWidth  = Math.abs(Math.floor(width  / transformY))

            let drawStartY = Math.floor(-spriteHeight / 2 + height / 2)
            let drawEndY   = drawStartY + spriteHeight
            let drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX)
            let drawEndX   = drawStartX + spriteWidth

            // 4) 取精灵纹理（整张 64x64）
            let texSize = textureManager.size
            let tex = textureManager.getPixels(s.textureIndex)  // getPixels: 返回 ImageData
            if (!tex) {
                // 没纹理就画个彩色方块
                let col = s.type === 'enemy' ? 'rgb(220,40,40)' : s.type === 'item' ? 'rgb(230,220,80)' : 'rgb(200,200,200)'
                ctx.fillStyle = col
                ctx.fillRect(drawStartX, drawStartY, drawEndX - drawStartX, drawEndY - drawStartY)
                continue
            }

            // 5) 对每列 stripe 绘制
            for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
                if (stripe < 0 || stripe >= width) continue
                if (zBuffer[stripe] < transformY) continue  // 被墙挡住

                let texX = Math.floor((stripe - (-spriteWidth/2 + spriteScreenX)) * texSize / spriteWidth)
                if (texX < 0 || texX >= texSize) continue
                if (!tex.columnCache) tex.columnCache = {} // 简单缓存
                let col = tex.columnCache[texX]
                if (!col) {
                    col = []
                    for (let y = 0; y < texSize; y++) {
                        let i = (y * texSize + texX) * 4
                        col.push([tex.data[i], tex.data[i+1], tex.data[i+2], tex.data[i+3]])
                    }
                    tex.columnCache[texX] = col
                }

                for (let y = drawStartY; y < drawEndY; y++) {
                    if (y < 0 || y >= height) continue
                    let d = (y - drawStartY) / spriteHeight  // 0~1
                    let texY = Math.floor(d * texSize)
                    if (texY < 0 || texY >= texSize) continue
                    let [r, g, b, a] = col[texY]
                    if (a < 32) continue  // 透明像素跳过

                    // 距离衰减
                    let df = 1.0 / (1.0 + 0.015 * transformY * transformY)
                    r = Math.floor(r * df); g = Math.floor(g * df); b = Math.floor(b * df)

                    ctx.fillStyle = `rgb(${r},${g},${b})`
                    ctx.fillRect(stripe, y, 1, 1)
                }
            }
        }
    }

    // 小地图绘制
    drawOnMinimap(ctx, unit) {
        for (let s of this.sprites) {
            if (!s.alive) continue
            let color
            if (s.type === 'enemy') color = new Color(255, 50, 50)
            else if (s.type === 'item') color = new Color(255, 230, 50)
            else color = new Color(255, 255, 255)
            drawArc(ctx, color, s.x * unit, s.y * unit, 4)
        }
    }
}
```

### D.5 TextureManager 需要新增 `getPixels`

```js
// textures.js TextureManager 中：
getPixels(textureIndex) {
    let canvas = this.textures[textureIndex]
    if (!canvas) return null
    let ctx = canvas.getContext('2d')
    return ctx.getImageData(0, 0, this.size, this.size)
}
```

### D.6 Player.js 增加精灵碰撞与捡取

```js
// Player.tryMove()：检查目标位置是否会撞到"挡路"的精灵
tryMove(dx, dy, step) {
    // ... 原有归一化 ...

    let r = 0.2

    let newX = this.position.x + dx * step
    let checkX = newX + Math.sign(dx) * r
    let collidesWallX = !this.cellIsEmpty(checkX, this.position.y)
    let collidesSpriteX = this._collidesWithBlockingSprite(newX, this.position.y)
    if (!collidesWallX && !collidesSpriteX) this.position.x = newX

    let newY = this.position.y + dy * step
    let checkY = newY + Math.sign(dy) * r
    let collidesWallY = !this.cellIsEmpty(this.position.x, checkY)
    let collidesSpriteY = this._collidesWithBlockingSprite(this.position.x, newY)
    if (!collidesWallY && !collidesSpriteY) this.position.y = newY

    // 脚步声（仅当确实移动）
    if ((!collidesWallX || !collidesWallY) && window.audioManager) {
        this._stepTimer = (this._stepTimer || 0) - step * 5
        if (this._stepTimer <= 0) {
            this._stepTimer = 1.0
            window.audioManager.playFootstep()
        }
    }
}

_collidesWithBlockingSprite(x, y) {
    if (!this.spriteManager) return false
    for (let s of this.spriteManager.sprites) {
        if (!s.alive || !s.isBlocking) continue
        let dx = x - s.x, dy = y - s.y
        if (dx*dx + dy*dy < (this.playerRadius + s.radius)**2) return true
    }
    return false
}

// Player.update(dt)：检查是否捡到物品
update(dt) {
    if (!this.spriteManager) return
    for (let s of this.spriteManager.sprites) {
        if (!s.alive || !s.isPickable) continue
        let dx = this.position.x - s.x, dy = this.position.y - s.y
        if (dx*dx + dy*dy < 0.4 * 0.4) {
            s.alive = false
            console.log('Picked up item at', s.x.toFixed(1), s.y.toFixed(1))
        }
    }
}
```

⚠️ 注意 `Player` 的 constructor 里需要接收 `spriteManager` 参数，并记录在 `this.spriteManager`。同时加 `this.playerRadius = 0.2`（默认值）。

### D.7 GameScene.js 初始化场景中的精灵

```js
init() {
    let g = this.game
    this.bg = new Background(g)
    this.textureManager = new TextureManager()
    this.spriteManager = new SpriteManager()

    // 放几个敌人和物品（注意 x,y 必须是 worldMap 中 = 0 的格子）
    // 地图 10x10，外圈（0/y 和 9/y 和 x/0 和 x/9）都是红墙
    // 安全位置：(2.5, 2.5), (6.5, 3.5), (5.5, 7.5), (8.5, 4.5)
    this.spriteManager.add(new Sprite(2.5, 2.5, 201, { type: 'enemy', speed: 1.5 }))
    this.spriteManager.add(new Sprite(6.5, 3.5, 201, { type: 'enemy', speed: 1.5 }))
    this.spriteManager.add(new Sprite(5.5, 7.5, 202, { type: 'item', isPickable: true }))
    this.spriteManager.add(new Sprite(8.5, 4.5, 202, { type: 'item', isPickable: true }))

    this.player = new Player(g, this.bg, this.spriteManager)
    this.screen = new Screen(g, this.player, this.bg, this.textureManager, this.spriteManager)
}

draw() {
    this.bg.draw()
    this.player.draw()
    this.screen.draw()
    this.spriteManager.drawOnMinimap(this.game.context, this.bg.unit)
}
```

### D.8 textures.js 增加精灵纹理

```js
// generateAll() 末尾加：
this.textures[201] = this.generateEnemy()
this.textures[202] = this.generateItem()

// 并在 class 中新增：
generateEnemy() {
    let size = this.size
    let c = document.createElement('canvas')
    c.width = size; c.height = size
    let ctx = c.getContext('2d')
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, size, size)
    // 红圆脸
    ctx.fillStyle = 'rgb(220,50,50)'
    ctx.beginPath(); ctx.arc(size/2, size/2, size*0.4, 0, Math.PI*2); ctx.fill()
    // 眼睛
    ctx.fillStyle = 'rgb(255,255,255)'
    ctx.beginPath(); ctx.arc(size*0.35, size*0.4, size*0.08, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(size*0.65, size*0.4, size*0.08, 0, Math.PI*2); ctx.fill()
    // 嘴巴
    ctx.strokeStyle = 'rgb(0,0,0)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(size/2, size*0.6, size*0.15, 0, Math.PI); ctx.stroke()
    this._addNoise(c, 10)
    return c
}

generateItem() {
    let size = this.size
    let c = document.createElement('canvas')
    c.width = size; c.height = size
    let ctx = c.getContext('2d')
    // 黄色十字（医疗包）
    ctx.fillStyle = 'rgb(240,240,240)'
    ctx.fillRect(size*0.2, size*0.2, size*0.6, size*0.6)
    ctx.fillStyle = 'rgb(220,50,50)'
    ctx.fillRect(size*0.45, size*0.25, size*0.1, size*0.5)
    ctx.fillRect(size*0.25, size*0.45, size*0.5, size*0.1)
    this._addNoise(c, 8)
    return c
}
```

### D.9 验证点

- 进入游戏后，3D 视图中能看到红圆脸敌人和医疗包图标
- 朝敌人走 → 走近后尺寸变大，远离后变小
- 走到墙后看敌人 → 墙柱挡住敌人的对应列（不显示透明像素）
- 两个敌人一近一远 → 近的挡住远的（排序正确）
- 撞敌人 → 被挡路（isBlocking）
- 走到医疗包 → 消失（isPickable）

---

## 阶段 E：增强型小地图

### E.1 目标

左侧 canvas 顶部显示：墙体方块、玩家圆点 + 朝向箭头、FOV 扇形边界、精灵小圆点。目前已经有基础绘制了，E 阶段主要是美化和补充 FOV/精灵。

### E.2 涉及文件

| 文件 | 改动 |
|------|------|
| `Background.js` | `drawWall()` 中把墙块画得更干净（带深色描边） |
| `Player.js` | `drawDirArrow()` 画 FOV 边界（已有但可再美化） |
| `game/SpriteManager.js` | 新增 `drawOnMinimap()` — 在 Player.draw 之后画小圆点 |

### E.3 Background 绘制增强

```js
// Background.js drawWall() 改成：
drawWall(context = this.context) {
    let unit = this.unit
    for (let y = 0; y < this.lines; y++) {
        for (let x = 0; x < this.columns; x++) {
            let cell = this.worldMap[y][x]
            if (cell > 0) {
                let color = this.wallColors[cell] || new Color(200, 150, 100)
                drawRect(context, color, x * unit + 2, y * unit + 2, unit - 4, unit - 4)
                // 描边
                context.strokeStyle = 'rgba(20,20,20,1)'
                context.lineWidth = 1
                context.strokeRect(x * unit + 2, y * unit + 2, unit - 4, unit - 4)
            }
        }
    }
}
```

### E.4 小地图上的 FOV 扇形

```js
// Player.js drawDirArrow() 中增加：
drawDirArrow() {
    let unit = this.unit
    let startX = this.position.x * unit
    let startY = this.position.y * unit
    let ctx = this.game.context

    // 朝向箭头
    drawLine(ctx, new Color(255, 200, 0), startX, startY,
             startX + this.dirX * unit * 1.5, startY + this.dirY * unit * 1.5)

    // FOV 两条边界
    let leftX = this.dirX - this.planeX
    let leftY = this.dirY - this.planeY
    let len = Math.sqrt(leftX*leftX + leftY*leftY)
    leftX /= len; leftY /= len
    drawLine(ctx, new Color(255, 255, 120, 0.4), startX, startY,
             startX + leftX * unit * 3, startY + leftY * unit * 3)

    let rightX = this.dirX + this.planeX
    let rightY = this.dirY + this.planeY
    len = Math.sqrt(rightX*rightX + rightY*rightY)
    rightX /= len; rightY /= len
    drawLine(ctx, new Color(255, 255, 120, 0.4), startX, startY,
             startX + rightX * unit * 3, startY + rightY * unit * 3)
}
```

### E.5 精灵在小地图上

见前面 D.4 中 `SpriteManager.drawOnMinimap()` 的实现。

---

## 阶段 F：阴影/光照增强 + 雾效

### F.1 目标

- 在现有「距离衰减」和「侧面变暗」的基础上，增加雾效
- 增加"手电筒"效果：玩家视线中心略微变亮
- 简单的按玩家视线与墙面的点积光照（更真实的方向性）

### F.2 涉及文件

| 文件 | 改动 |
|------|------|
| `game/Screen.js` | `drawWall()` 中每个像素颜色计算后，再乘以「雾因子」和「手电筒光锥」 |

### F.3 雾效公式

```js
// 在墙柱绘制循环的颜色计算末尾
// fogStartDist：多远开始起雾（例如 4 格以外）
// fogFullDist：多远完全融到雾色（例如 12 格）
let fogStart = 4
let fogFull = 12
let fogFactor = Math.max(0, Math.min(1, (perpDist - fogStart) / (fogFull - fogStart)))

// 雾色 = 天花板灰
let fogR = 80, fogG = 80, fogB = 100

r = Math.floor(r * (1 - fogFactor) + fogR * fogFactor)
g = Math.floor(g * (1 - fogFactor) + fogG * fogFactor)
b = Math.floor(b * (1 - fogFactor) + fogB * fogFactor)

// 然后再画 fillRect
ctx.fillStyle = `rgb(${r},${g},${b})`
ctx.fillRect(x, screenY, 1, 1)
```

同样的雾效也应该在 `drawBg()` 的地板/天花板采样后应用（rowDistance 就是距离）。

### F.4 手电筒光锥

```js
// 在墙柱绘制循环中加（在雾效之前或之后都可以）：
// stripe 的 cameraX = 2*x/width - 1，用它做光锥
let camX = 2 * x / this.width - 1  // -1 ~ +1
let flashlight = Math.max(0, 1 - Math.abs(camX) * 1.5)  // 中心 1.0，边缘 0
flashlight = Math.pow(flashlight, 2)  // 让光锥更集中
let bonus = Math.floor(flashlight * 60)

r = Math.min(255, r + bonus)
g = Math.min(255, g + bonus)
b = Math.min(255, b + bonus)
```

### F.5 方向光（点积）

```js
// rayDirX/Y 与 墙面法线 的点积 → 正对着玩家的面更亮
// side=0 → 东西向墙，法线沿 X 轴（符号取决于 stepX）
// side=1 → 南北向墙，法线沿 Y 轴
let normalX = (side === 0) ? -stepX : 0
let normalY = (side === 1) ? -stepY : 0
let dot = Math.max(0, rayDirX * normalX + rayDirY * normalY)
let dirLight = 0.6 + 0.4 * dot  // 0.6(最暗) ~ 1.0(最亮)
r = Math.floor(r * dirLight); g = Math.floor(g * dirLight); b = Math.floor(b * dirLight)
```

### F.6 注意

把所有光照和雾效组合起来时，**按以下顺序叠加避免数值崩溃**：
1. 纹理原始颜色
2. 侧面变暗（可选，有了方向光后可以直接去掉侧面变暗）
3. 方向光（dot product）
4. 距离衰减
5. 手电筒光锥（加值）
6. 雾效（线性插值到雾色）

### F.7 验证

- 远处的墙明显与天花板颜色混合（雾）
- 正中央的墙比两侧略亮（手电筒）
- 正对着玩家的墙面更亮，斜着的更暗（方向光）

---

## 阶段 A ~ F 完成后的总结

| 阶段 | 结果 |
|------|------|
| A | 墙面不再是纯色块，有砖/石/木的程序化纹理 |
| B | 地板和天花板也是纹理（或棋盘格），不再是纯色 |
| C | 鼠标控制视角（FPS 体验）；Shift 加速 |
| D | 场景中有敌人（红圆脸）和物品（医疗包）；碰撞/捡取/AI |
| E | 左侧小地图显示墙体方块、玩家点、朝向箭头、FOV 扇形、精灵小圆点 |
| F | 雾效 + 手电筒 + 方向光，场景更有氛围 |

做完这 6 个阶段后，项目就从「DDA 算法演示」变成了一个「能玩的小游戏雏形」。

下一部分见 `doc/_workflow/会话计划/2026-06-14-raycasting-未完成项-GL.md`（阶段 G~L：开门、音效、武器射击、多种墙高、天气、地图编辑器）。

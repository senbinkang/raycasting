# Raycasting 光线投射引擎 — 执行方案（G ~ L）

> 状态：**G/H/I 已完成 ✅，J/K/L 未开始 ⏳**（2026-06-14）
> 位置：`doc/_archive/2026-06-14-raycasting-执行方案-GL.md`
> 前置：阶段 A ~ F 已完成（墙面纹理 + 地板纹理 + 鼠标 + Sprite + 小地图 + 光照雾效）

---

## 总览

| 阶段 | 功能 | 难度 | 代码量 | 推荐顺序 |
|------|------|------|--------|---------|
| G | 开门/关门 & 可交互 | 中 | 中 | 7（在 D 之后即可做） |
| H | 音效 & 背景音乐 | 小 | 小 | 8 |
| I | 武器/射击/敌人 AI 增强 | 大 | 大 | 9 |
| J | 多种墙壁高度/跳跃/楼梯 | 大 | 大 | 12（放到最后，架构改动最大） |
| K | 天气/环境效果（雨/雾增强） | 中 | 中 | 10 |
| L | 地图编辑器 | 中 | 中 | 11 |

---

## 阶段 G：开门/关门 & 可交互

### G.1 目标

- 地图中某些格子是「门」（红色横条），按 E 键切换开/关
- 门开动画：门柱在屏幕上逐渐缩短到 0；关动画反之
- 门未开时当作墙；完全打开时当作空地

### G.2 涉及文件

| 文件 | 改动 |
|------|------|
| `Background.js` | `worldMap` 中 `>= 101` 的值表示门（101 红门、102 蓝门...）；`doors` 对象存门状态 `{ openProgress, open }`；新增 `isDoorOpen(x, y)`；`drawWall()` 给门格子画特殊纹理 |
| `Player.js` | `registerAction('e', ...)`：前方格子是门则切换；`update(dt)`：更新所有门的动画进度 |
| `game/Screen.js` | DDA 命中一个格子时：如果是完全打开的门就不算命中（让射线继续走）；如果是部分打开的门 → 按打开比例缩短墙柱高度 |
| `raycasting.html` | 操作提示加「<kbd>e</kbd> 开关门」 |

### G.3 数据结构（Background.js 新增）

```js
constructor(...) {
    // ... worldMap 初始化 ...
    // 新增：扫描 worldMap，把所有 >= 101 的格子记到 doors
    this.doors = {}
    for (let y = 0; y < this.lines; y++) {
        for (let x = 0; x < this.columns; x++) {
            let v = this.worldMap[y][x]
            if (v >= 101 && v <= 199) {
                this.doors[`${x},${y}`] = {
                    open: false,
                    openProgress: 0.0   // 0 = 完全关闭，1 = 完全打开
                }
            }
        }
    }
}

isDoorOpen(x, y) {
    let d = this.doors[`${x},${y}`]
    return d && d.openProgress >= 1.0
}

isDoor(x, y) {
    return !!this.doors[`${x},${y}`]
}
```

### G.4 Player.js 中处理 E 键

```js
// registerAction 中新增：
g.registerAction('e', (dt) => {
    // 前方 1 格处的地图格
    let fx = this.position.x + this.dirX
    let fy = this.position.y + this.dirY
    let mx = Math.floor(fx), my = Math.floor(fy)
    let door = this.bg.doors[`${mx},${my}`]
    if (!door) {
        // 也允许侧面一点容错：检查 ±0.5 格
        let fx2 = this.position.x + this.dirX * 0.5 + (-this.planeX) * 0.5
        let fy2 = this.position.y + this.dirY * 0.5 + (-this.planeY) * 0.5
        mx = Math.floor(fx2); my = Math.floor(fy2)
        door = this.bg.doors[`${mx},${my}`]
    }
    if (door) {
        // 切换"目标状态"
        door.open = !door.open
        if (window.audioManager) window.audioManager.playDoor()
    }
})

// Player.update(dt) 中推进所有门动画
update(dt) {
    for (let key in this.bg.doors) {
        let d = this.bg.doors[key]
        let speed = 1.5   // 2/3 秒开完
        if (d.open) d.openProgress = Math.min(1.0, d.openProgress + dt * speed)
        else         d.openProgress = Math.max(0.0, d.openProgress - dt * speed)
    }

    // 捡取物品
    if (this.spriteManager) {
        for (let s of this.spriteManager.sprites) {
            if (!s.alive || !s.isPickable) continue
            let dx = this.position.x - s.x, dy = this.position.y - s.y
            if (dx*dx + dy*dy < 0.4 * 0.4) {
                s.alive = false
                console.log('Picked up', s.type)
            }
        }
    }
}
```

### G.5 Screen.js 中门的渲染

```js
// 在 drawWall() 的 DDA 命中循环中：
let cell = bg.worldMap[mapY][mapX]
let isDoor = (cell >= 101 && cell <= 199)
let doorOpen = isDoor ? (bg.doors[`${mapX},${mapY}`] || {}).openProgress : 0

// 完全打开的门 → 不画，让射线继续穿过
if (isDoor && doorOpen >= 0.98) continue

// 否则按正常墙柱处理，但如果是门且未全关，压缩可见高度
let perpDist = ...   // 原计算
let lineHeight = Math.floor(this.height / perpDist)
let drawStart = Math.floor(-lineHeight / 2 + this.height / 2)
let drawEnd = drawStart + lineHeight

// 门：根据 doorOpen 从顶部缩减（模拟门向上收）
if (isDoor) {
    let reduce = Math.floor(lineHeight * doorOpen)
    drawStart += reduce
    // 如果门已缩减到看不见，跳过
    if (drawStart >= drawEnd) continue
}
```

⚠️ 注意：对门的特殊处理会让 DDA 射线命中门但不挡住后续的墙。如果你的简单实现只想做到"门是墙 + 开了之后空"，也可以直接在循环中做：

```js
// 如果命中的是完全打开的门 → 继续（不 break），让射线还能继续走
if (isDoor && doorOpen >= 0.98) {
    // 不 break：这条射线继续前进
    continue
}
// 否则 hit = 1（与原来一致）
let hit = 1
```

但标准做法是让门柱按打开比例缩短高度，视觉上更像真正的门在滑动。

### G.6 给门一个专门的纹理（可选）

在 `textures.js` 中加 `generateDoor()`，返回一张画着横向金属条的 64×64 纹理。Screen.js 中 `cell` 是门时用 `cell - 100` 索引到门纹理。

### G.7 验证方式

- 走到门前 → 3D 视图中看到红/蓝色的门柱（有金属条纹理）
- 按 E → 门柱从顶部缩短，在 ~0.66 秒内消失
- 穿过门 → 在另一侧再按 E → 门柱从 0 滑回满高度
- 走到一半被卡时（门还没全开），撞不到墙的那部分是透明的

---

## 阶段 H：音效 & 背景音乐

### H.1 目标

用 Web Audio API 程序化合成简单音效，不需要外部音频文件：
- 脚步声（走的时候循环触发）
- 开门声（按 E 时触发）
- 枪声（开枪时触发）
- 受伤声（被攻击时）
- 背景音乐（循环和弦）

### H.2 涉及文件

| 文件 | 改动 |
|------|------|
| `game/AudioManager.js`（**新建**） | 封装所有音效的程序化生成 + 播放 |
| `game/GameScene.js` | init 时创建 `this.audioManager = new AudioManager()`，挂到 `window.audioManager` |
| `Player.js` | tryMove 里有移动时调用 `audio.playFootstep()` |

### H.3 AudioManager.js

```js
// game/AudioManager.js
class AudioManager {
    constructor() {
        this.ctx = null
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)() }
        catch(e) { console.warn('Audio unavailable', e.message) }
        this.masterGain = null
        if (this.ctx) {
            this.masterGain = this.ctx.createGain()
            this.masterGain.gain.value = 0.3
            this.masterGain.connect(this.ctx.destination)
        }
        this._lastFootstep = 0
        this._musicStarted = false
    }

    // 浏览器需要用户交互后才允许 AudioContext。此函数在第一次按键/点击时调用。
    ensureStarted() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
    }

    // 短暂的"刷"一声（脚步）
    playFootstep() {
        if (!this.ctx) return
        let now = this.ctx.currentTime
        if (now - this._lastFootstep < 0.3) return   // 限流
        this._lastFootstep = now

        // 用 10ms 噪声缓冲区 + 0.1 秒衰减
        let bufSize = Math.floor(this.ctx.sampleRate * 0.1)
        let buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
        let data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random()*2-1) * (1 - i/bufSize)
        let src = this.ctx.createBufferSource()
        src.buffer = buf
        let gain = this.ctx.createGain()
        gain.gain.value = 0.3
        src.connect(gain).connect(this.masterGain)
        src.start()
    }

    // 开门：从低频扫到高频的短促滑音
    playDoor() {
        if (!this.ctx) return
        let now = this.ctx.currentTime
        let osc = this.ctx.createOscillator()
        let gain = this.ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(150, now)
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.25)
        gain.gain.setValueAtTime(0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.connect(gain).connect(this.masterGain)
        osc.start(now); osc.stop(now + 0.3)
    }

    // 枪声：强噪声瞬态
    playShoot() {
        if (!this.ctx) return
        let now = this.ctx.currentTime
        let bufSize = Math.floor(this.ctx.sampleRate * 0.15)
        let buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
        let data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) {
            data[i] = (Math.random()*2-1) * Math.pow(1 - i/bufSize, 2)
        }
        let src = this.ctx.createBufferSource()
        src.buffer = buf
        let gain = this.ctx.createGain()
        gain.gain.value = 0.5
        src.connect(gain).connect(this.masterGain)
        src.start(now)
    }

    // 受伤：低频脉冲
    playHurt() {
        if (!this.ctx) return
        let now = this.ctx.currentTime
        let osc = this.ctx.createOscillator()
        let gain = this.ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.2)
        gain.gain.setValueAtTime(0.3, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
        osc.connect(gain).connect(this.masterGain)
        osc.start(now); osc.stop(now + 0.25)
    }

    // 背景音乐：每 0.7 秒弹一个和弦音
    startMusic() {
        if (!this.ctx || this._musicStarted) return
        this._musicStarted = true
        const notes = [262, 330, 392, 523, 392, 330]  // C E G C G E
        let idx = 0
        let tick = () => {
            if (!this.ctx) return
            let now = this.ctx.currentTime
            let osc = this.ctx.createOscillator()
            let gain = this.ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = notes[idx % notes.length]
            gain.gain.setValueAtTime(0, now)
            gain.gain.linearRampToValueAtTime(0.08, now + 0.05)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
            osc.connect(gain).connect(this.masterGain)
            osc.start(now); osc.stop(now + 0.75)
            idx++
        }
        tick()
        setInterval(tick, 700)
    }
}
```

### H.4 集成到主循环

```js
// GameScene.js init 末尾
this.audioManager = new AudioManager()
window.audioManager = this.audioManager

// Game.js runLoop 中（处理按键回调之前）
// 用户首次按键/点击后启动 AudioContext + 背景音乐
if (this.scene && this.scene.audioManager) {
    this.scene.audioManager.ensureStarted()
    if (!this._musicStarted) {
        this.scene.audioManager.startMusic()
        this._musicStarted = true
    }
}

// Player.tryMove 中检测到真正移动时：
// if (window.audioManager) window.audioManager.playFootstep()
```

### H.5 验证方式

- 打开 HTML → 点一下 canvas（启动 AudioContext）→ 听到舒缓的背景音乐
- 走动 → 听到脚步声（频率和速度匹配）
- 按 E 开门 → 听到滑音
- 后续阶段 I 实现武器后，左键能听到枪声

---

## 阶段 I：武器 / 射击 / 敌人 AI 增强

### I.1 目标

- 屏幕底部中央画一把手枪的 sprite，一直面向相机（不随视角变化）
- 鼠标左键射击（按住连射）：沿玩家视线方向发射一条 DDA 射线
- 命中敌人 → 扣 HP，敌人死亡时消失
- 敌人增强 AI：检测到玩家视线后追击，近距离攻击

### I.2 涉及文件

| 文件 | 改动 |
|------|------|
| `game/Weapon.js`（**新建**） | 画枪、处理射击 DDA、管理后坐力动画 |
| `game/Screen.js` | 在最后调用 `weapon.draw(ctx, width, height, dt)` |
| `game/Sprite.js` | `update()` 里增强敌人 AI（见 D 阶段已实现，这里微调） |
| `game/Game.js` | 监听 mousedown/mouseup（左键）给 `weapon` |
| `textures.js` | 新增 `generateGunHUD()` 或程序化绘制武器（简单方式：直接在 Weapon.js 里画 2D 图形，不用纹理） |
| `Player.js` | 加 `hp` 字段和 `ammo`（可选） |

### I.3 武器渲染（Weapon.js）

因为武器始终在屏幕最前方（固定大小/位置），**不需要 raycasting 算法**，直接在屏幕上画 2D 图形即可：

```js
// game/Weapon.js
class Weapon {
    constructor() {
        this.recoil = 0          // 0~1，每帧衰减
        this.fireRate = 5        // 每秒最多 5 发
        this._cooldown = 0
        this.triggerDown = false // 玩家是否按住左键
    }

    update(dt) {
        this.recoil = Math.max(0, this.recoil - 5 * dt)
        this._cooldown = Math.max(0, this._cooldown - dt)
    }

    // 沿玩家视线发射 DDA。返回 { hitEnemy: Sprite|null, hitDist: number }
    fire(player, bg, sprites, audio) {
        if (this._cooldown > 0) return null
        this._cooldown = 1 / this.fireRate
        this.recoil = 1.0
        if (audio) audio.playShoot()

        // DDA：沿 player.dirX/Y 方向前进，直到撞墙或越界
        let posX = player.position.x, posY = player.position.y
        let rayDirX = player.dirX, rayDirY = player.dirY
        let mapX = Math.floor(posX), mapY = Math.floor(posY)
        let deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX)
        let deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY)
        let stepX, stepY, sideDistX, sideDistY
        if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaDistX }
        else              { stepX = 1; sideDistX = (mapX + 1.0 - posX) * deltaDistX }
        if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaDistY }
        else              { stepY = 1; sideDistY = (mapY + 1.0 - posY) * deltaDistY }

        let nearestEnemy = null
        let nearestDist = Infinity

        for (let i = 0; i < 200; i++) {
            if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX }
            else                         { sideDistY += deltaDistY; mapY += stepY }

            let curDist = (sideDistX < sideDistY ? sideDistX - deltaDistX : sideDistY - deltaDistY)

            // 检查是否有敌人在此距离被击中：
            // 对每个 alive 敌人，子弹距它的垂直距离 < radius → 命中
            if (sprites) {
                for (let s of sprites.sprites) {
                    if (!s.alive || s.type !== 'enemy') continue
                    let sx = s.x - posX, sy = s.y - posY
                    // 子弹方向 = (rayDirX, rayDirY)，单位向量
                    // 沿子弹方向的投影 t = sx*rayDirX + sy*rayDirY
                    let t = sx * rayDirX + sy * rayDirY
                    if (t < 0 || t > curDist + 0.5) continue
                    // 垂直偏移
                    let px = sx - t * rayDirX
                    let py = sy - t * rayDirY
                    let perp2 = px*px + py*py
                    if (perp2 < s.radius * s.radius && t < nearestDist) {
                        nearestDist = t
                        nearestEnemy = s
                    }
                }
            }

            // 撞墙/越界 → 停止
            if (mapX < 0 || mapY < 0 || mapX >= bg.columns || mapY >= bg.lines) break
            let cell = bg.worldMap[mapY][mapX]
            if (cell > 0 && cell < 100) break
            if (cell >= 101 && !bg.isDoorOpen(mapX, mapY)) break
        }

        if (nearestEnemy) {
            nearestEnemy.hp -= 25
            if (nearestEnemy.hp <= 0) nearestEnemy.alive = false
            if (window.audioManager) window.audioManager.playShoot()
            return { enemy: nearestEnemy, dist: nearestDist }
        }
        return null
    }

    // 在屏幕底部画枪（2D 图形，不用 DDA）
    draw(ctx, width, height, dt) {
        this.update(dt)

        // 后坐力下沉：gunYOffset 越大，枪越往下
        let gunYOffset = Math.floor(this.recoil * 20)

        // 枪身：梯形/矩形
        let cx = width / 2
        let cy = height - 20 + gunYOffset

        // 手（棕色圆）
        ctx.fillStyle = 'rgb(120,80,50)'
        ctx.beginPath(); ctx.arc(cx - 20, cy, 25, 0, Math.PI*2); ctx.fill()

        // 枪身（黑色矩形）
        ctx.fillStyle = 'rgb(30,30,35)'
        ctx.fillRect(cx - 15, cy - 40, 30, 60)
        // 枪管
        ctx.fillRect(cx - 5, cy - 80, 10, 40)
        // 准星
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(width/2 - 8, height/2); ctx.lineTo(width/2 + 8, height/2)
        ctx.moveTo(width/2, height/2 - 8); ctx.lineTo(width/2, height/2 + 8)
        ctx.stroke()

        // 后坐力 > 0.5 时的枪口闪光
        if (this.recoil > 0.5) {
            let grad = ctx.createRadialGradient(width/2, height/2 - 50, 5, width/2, height/2 - 50, 80)
            grad.addColorStop(0, 'rgba(255,230,120,0.9)')
            grad.addColorStop(1, 'rgba(255,230,120,0)')
            ctx.fillStyle = grad
            ctx.beginPath(); ctx.arc(width/2, height/2 - 50, 80, 0, Math.PI*2); ctx.fill()
        }
    }
}
```

### I.4 Game.js 中监听左键

```js
// Game.js constructor 中新增：
this.weapon = null  // 由 GameScene 注入

canvasImg.addEventListener('mousedown', (e) => {
    if (e.button === 0 && this.scene && this.scene.player && this.scene.weapon) {
        this.scene.weapon.triggerDown = true
    }
})
canvasImg.addEventListener('mouseup', (e) => {
    if (e.button === 0 && this.scene && this.scene.weapon) {
        this.scene.weapon.triggerDown = false
    }
})

// runLoop(now) 中：如果按住左键，每帧尝试 fire
if (this.scene && this.scene.weapon) {
    if (this.scene.weapon.triggerDown) {
        this.scene.weapon.fire(
            this.scene.player,
            this.scene.bg,
            this.scene.spriteManager,
            this.scene.audioManager
        )
    }
    this.scene.weapon.draw(this.contextImage, this.canvasImage.width, this.canvasImage.height, dt)
}
```

⚠️ 注意：要让 `GameScene.js` 中在 `init()` 里创建 weapon：

```js
// GameScene.js
init() {
    // ...
    this.weapon = new Weapon()
    // 把 weapon 挂到 game 上方便 Game.js 拿到（或让 game.scene.weapon 直接拿）
}

draw() {
    // ... 已有 bg.draw / player.draw / screen.draw ...
    // weapon.draw 在 Game.runLoop 里单独调用（保证最上层）
}
```

### I.5 敌人的 HP/死亡状态（已在 Sprite.js 里）

D 阶段已经给 `Sprite.hp` 和 `Sprite.alive` 了，`SpriteManager.draw` 会跳过 `!alive` 的。这里只需确认：被击中 4 次（4 × 25 = 100）后敌人消失。

### I.6 验证方式

- 屏幕下方中央可见一把黑色手枪（+ 棕色手）和屏幕中央的准星
- 按住左键 → 枪每 ~0.2 秒射一次，后坐力抖动 + 枪口闪光
- 朝敌人开火并命中 → 第 4 发后敌人消失（或 HP 条更直观）
- 朝墙射击 → 没命中敌人，DDA 停止在墙上，枪声仍然播放

---

## 阶段 J：多种墙壁高度 / 跳跃 / 楼梯

### J.1 目标（可选，最后做）

让地图支持**不同高度的墙**（矮墙挡不住远处视线但挡住移动）、**玩家跳跃**（上下移动相机）、**楼梯**（floorHeight 逐格上升/下降）。

这是从「Wolfenstein 3D」到「Doom 引擎」的架构改动——**工作量最大、对已有代码侵入最深**。建议在完成其他所有阶段之后再考虑。

### J.2 核心概念变化

| 概念 | 原来 | 新方案 |
|------|------|--------|
| 墙柱高度 | `height / perpDist`，顶部固定 `y = height/2 - lineHeight/2` | `yTop = height/2 - (worldHeight - eyeZ) * heightScale / perpDist`，`yBot = height/2 - (floorZ - eyeZ) * heightScale / perpDist` |
| 每格有多少层 | 1 层（只有一堵墙，从地面到天花板） | 多层（地面、第一层墙、第二层墙等） |
| 玩家 Z 位置 | 固定 0.5 | `eyeZ = baseFloor + jumpOffset`（跳跃时通过 velZ 改变） |
| 墙柱颜色 | 1 种纹理/色 | 每层墙有自己的纹理；floor/ceiling 有自己的纹理 |

### J.3 需要新增 / 修改的数据结构

**Background.js / worldMap**：从 `number[][]` 改为对象数组 `Cell[][]`，每个 Cell =

```js
{
    floorZ: 0.0,            // 这一格的地面高度（0 = 标准）
    ceilZ:  1.0,            // 这一格的天花板高度（1 = 标准）
    walls: [                // 每一格内的"柱段"，从远到近
        { z0: 0.0, z1: 1.0, texture: 1 }  // 一段墙
    ],
    door: null              // 门（如果有）
}
```

**Player.js**：

```js
this.z = 0.0              // 玩家眼睛高度偏移（= 0 时眼睛在屏幕中线之上一点）
this.velZ = 0.0           // 垂直速度
this.onGround = true      // 是否在地面
// registerAction 中新增：空格 = 跳跃（仅当 onGround 时触发）
g.registerAction(' ', (dt) => {
    if (this.onGround) { this.velZ = 0.5; this.onGround = false }
})

// update(dt)：重力 + 地面检测
update(dt) {
    // 重力
    this.velZ -= 1.5 * dt
    this.z += this.velZ

    // 简单地面检测（根据脚下格子的 floorZ 决定）
    let mx = Math.floor(this.position.x), my = Math.floor(this.position.y)
    let groundZ = 0.0
    if (this.bg && this.bg.worldMap[my] && this.bg.worldMap[my][mx]) {
        groundZ = this.bg.worldMap[my][mx].floorZ
    }
    if (this.z <= groundZ) {
        this.z = groundZ
        this.velZ = 0
        this.onGround = true
    }
}
```

**Screen.js 的 drawWall**：改成「对每条射线的每一段墙柱段画一个矩形条」。伪代码：

```js
// 命中格子 (mapX, mapY) → 取得 cell = worldMap[mapY][mapX]
// 对 cell.walls 的每一段 { z0, z1, texture }：
//   screenY0 = height/2 - (z1 - eyeZ) * height / perpDist
//   screenY1 = height/2 - (z0 - eyeZ) * height / perpDist
//   在 y = screenY0 ~ screenY1 之间画对应纹理
// eyeZ = 0.5 + this.player.z (眼睛相对地面 0.5 格，加跳跃偏移)
```

### J.4 地板/天花板同样要区分 Z

drawBg 里需要知道「该条射线在 world 坐标下每一行 y 对应的 floorZ 和 ceilZ」——要根据 `worldMap` 里每格的 floorZ/ceilZ 做插值。

这个改动本身就可以做一个独立的阶段。

### J.5 验证

- 走到楼梯（floorZ 逐格升高的格子）→ 画面视角同步升高
- 按空格 → 跳起（视觉上画面往下沉一点再回来）
- 矮墙（z1 = 0.3）→ 可以看到矮墙后面的东西但走不过去

### J.6 建议

**不建议在前期做这个阶段**。它的架构影响太大，会把 DDA / Screen / Sprite 所有已完成的渲染逻辑重写一遍。项目达到 "能玩" 的状态之后再考虑迭代到这个版本。

---

## 阶段 K：天气/环境效果（雨 / 手电筒增强）

### K.1 目标

- 下雨：全屏随机短竖线 + 微透明 + 按摄像机移动方向有水平偏移（模拟玩家前进时雨滴斜飘）
- 雾效（已在 F 阶段实现）— 这里做加强：通过全屏渐变 overlay 让雾气更真实
- 手电筒增强：屏幕中央一个柔和的光锥（乘在最终画面上）

### K.2 涉及文件

| 文件 | 改动 |
|------|------|
| `game/ParticleSystem.js`（**新建**） | 粒子系统：管理雨滴、每帧 update、draw |
| `game/Screen.js` 或 GameScene.js | 在所有绘制之后，叠加雾效 overlay 和手电筒遮罩 |
| `game/GameScene.js` | init 时创建 `particleSystem` |

### K.3 雨滴粒子系统

```js
// game/ParticleSystem.js
class ParticleSystem {
    constructor(width, height, density = 200) {
        this.width = width
        this.height = height
        this.drops = []
        for (let i = 0; i < density; i++) {
            this.drops.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vy: 600 + Math.random() * 300,  // px/sec 下落速度
                len: 8 + Math.random() * 12
            })
        }
    }

    update(dt, moveX = 0, moveY = 0) {
        // moveX/moveY 是玩家水平/垂直移动速度（像素/秒）：给雨滴一个水平偏移
        for (let d of this.drops) {
            d.y += d.vy * dt
            d.x += moveX * dt * 0.1  // 雨滴随玩家移动略微偏斜
            if (d.y > this.height) { d.y = -20; d.x = Math.random() * this.width }
            if (d.x < 0) d.x += this.width
            if (d.x > this.width) d.x -= this.width
        }
    }

    draw(ctx) {
        ctx.strokeStyle = 'rgba(180,200,255,0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let d of this.drops) {
            ctx.moveTo(d.x, d.y)
            ctx.lineTo(d.x - 3, d.y - d.len)
        }
        ctx.stroke()
    }
}
```

### K.4 手电筒遮罩（径向渐变）

```js
// 在 Screen.js 的 draw() 最后（或者单独 drawLighting）：
drawFlashlight(ctx, width, height) {
    // 屏幕中央径向亮 → 边缘暗
    let grad = ctx.createRadialGradient(width/2, height/2, width*0.1, width/2, height/2, width*0.7)
    grad.addColorStop(0, 'rgba(255,240,200,0.25)')
    grad.addColorStop(1, 'rgba(0,0,40,0.5)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
}
```

⚠️ 注意：这是一个"乘"效果（让画面某些区域变暗），需要 `ctx.globalCompositeOperation = 'multiply'` 先设置。但普通 `fillRect` 也足够看出效果了。

### K.5 集成

在 `GameScene.js` 中：

```js
init() {
    // ... 已有 bg / textureManager / spriteManager / player / screen / audioManager ...
    this.particles = new ParticleSystem(this.game.canvasImage.width, this.game.canvasImage.height)
}

draw() {
    this.bg.draw()
    this.player.draw()
    this.screen.draw()
    this.spriteManager.drawOnMinimap(this.game.context, this.bg.unit)
    // 雨粒子：画在 3D 视图上
    this.particles.draw(this.game.contextImage)
}

update(dt) {
    this.player.update(dt)
    this.spriteManager.update(dt, this.player, this.bg)
    // 雨滴更新，附带玩家移动时的水平偏移（用 dirX*moveSpeed 的简单近似）
    let vx = (this.player.dirX * this.player.moveSpeed) * this.bg.unit
    this.particles.update(dt, vx, 0)
}
```

### K.6 验证方式

- 画面上有雨线（深色背景中最明显）
- 按 w 前进时雨线略微向后飘（模拟相对运动）
- 画面中心偏亮，四周偏暗（手电筒效果）

---

## 阶段 L：地图编辑器（浏览器内）

### L.1 目标

- 一个独立的 HTML/JS 文件 `editor.html`，打开后在浏览器里可以：
  - 点击格子 → 切换为红墙（1）/蓝墙（2）/绿墙（3）/橙墙（4）/空（0）/门（101）
  - 点击"保存地图"→ 导出 JSON 并下载
  - 点击"加载地图"→ 选择 JSON 文件，替换当前地图
  - 点击"设置玩家起点"→ 点一个空格子
  - 点击"添加敌人/物品"→ 点一个空格子，放精灵
- 主游戏 `raycasting.html` 能加载同一个 JSON（通过 localStorage 或文件读取）

### L.2 文件结构

| 文件 | 作用 |
|------|------|
| `editor.html`（**新建**） | 独立页面：网格画布 + 工具栏 |
| `editor.js`（**新建**） | 处理点击、画笔逻辑、JSON 导入/导出 |
| `Background.js` | 加 `fromJSON(jsonString)` 和 `toJSON()` |
| `Player.js` | 加 `setStart(x, y)` 和 `getStart()` |
| `game/SpriteManager.js` | 加 `toJSON()` 和 `fromJSON()` |
| `raycasting.html` | 加一个"从 JSON 加载地图"按钮（可选） |

### L.3 JSON 格式约定

```json
{
    "format": "raycasting-map-v1",
    "columns": 10,
    "lines": 10,
    "worldMap": [
        [1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,1],
        [1,0,2,2,0,0,0,3,0,1],
        ...
    ],
    "playerStart": { "x": 1.5, "y": 4.5, "dirDeg": 0 },
    "sprites": [
        { "type": "enemy", "x": 2.5, "y": 2.5, "textureIndex": 201, "hp": 100 },
        { "type": "item",  "x": 5.5, "y": 7.5, "textureIndex": 202, "isPickable": true }
    ]
}
```

### L.4 Background.js JSON 支持

```js
// Background.js 新增：
toJSON() {
    return {
        format: 'raycasting-map-v1',
        columns: this.columns,
        lines: this.lines,
        worldMap: this.worldMap.map(row => row.slice()),
        doors: Object.keys(this.doors).reduce((acc, k) => {
            let d = this.doors[k]
            acc[k] = { open: d.open, openProgress: d.openProgress }
            return acc
        }, {})
    }
}

static fromJSON(game, jsonObj) {
    let bg = new Background(game)  // 用默认构造创建（默认地图）
    bg.columns = jsonObj.columns
    bg.lines = jsonObj.lines
    bg.worldMap = jsonObj.worldMap.map(row => row.slice())
    bg.doors = {}
    for (let y = 0; y < bg.lines; y++) {
        for (let x = 0; x < bg.columns; x++) {
            let v = bg.worldMap[y][x]
            if (v >= 101 && v <= 199) {
                let saved = jsonObj.doors && jsonObj.doors[`${x},${y}`]
                bg.doors[`${x},${y}`] = saved || { open: false, openProgress: 0 }
            }
        }
    }
    return bg
}
```

### L.5 editor.html（极简版）

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Raycasting Map Editor</title>
<style>
body { background: #222; color: #ddd; font-family: system-ui; padding: 12px; }
canvas { background: #000; border: 1px solid #666; image-rendering: pixelated; }
button { background: #444; color: #ddd; border: 1px solid #666; padding: 6px 12px; margin: 2px; cursor: pointer; border-radius: 4px; }
button.active { background: #2a6; border-color: #5c7; }
input[type=file] { color: #ddd; }
.label { display: inline-block; width: 160px; font-size: 13px; }
</style>
</head>
<body>
<h2>Raycasting 地图编辑器</h2>
<p><b>笔刷：</b>
<button data-brush="0">空地</button>
<button data-brush="1" class="active">红墙</button>
<button data-brush="2">蓝墙</button>
<button data-brush="3">绿墙</button>
<button data-brush="4">橙墙</button>
<button data-brush="101">红门</button>
<button data-brush="102">蓝门</button>
<br><br>
<b>特殊操作：</b>
<button id="btnStart">设置玩家起点</button>
<button id="btnEnemy">放置敌人</button>
<button id="btnItem">放置物品</button>
</p>
<canvas id="grid" width="500" height="500"></canvas>
<p>
<button id="btnSave">↓ 保存地图到 JSON</button>
<button id="btnLoad">↑ 从 JSON 加载地图</button>
<input type="file" id="fileInput" accept=".json" style="display:none">
<button id="btnReset">重置为默认地图</button>
</p>
<p style="font-size: 12px; color: #888;">
点格子应用当前笔刷 / 按住拖动可连续画。保存 JSON 后，把文件内容贴到主游戏的 worldMap 加载逻辑里即可。
</p>

<script>
// === 状态 ===
const COLS = 10, LINES = 10, CELL = 50
const canvas = document.getElementById('grid')
const ctx = canvas.getContext('2d')
let worldMap = defaultMap()
let playerStart = { x: 1.5, y: 4.5 }
let sprites = [
    { type: 'enemy', x: 2.5, y: 2.5 },
    { type: 'item', x: 5.5, y: 7.5 }
]
let brush = 1
let mode = 'brush'    // 'brush' | 'start' | 'enemy' | 'item'
let dragging = false

// === 默认地图 ===
function defaultMap() {
    let m = []
    for (let y = 0; y < LINES; y++) {
        let row = []
        for (let x = 0; x < COLS; x++) {
            if (y === 0 || y === LINES-1 || x === 0 || x === COLS-1) row.push(1)
            else row.push(0)
        }
        m.push(row)
    }
    // 加一点默认墙和门
    m[2][2] = 2; m[2][3] = 2; m[3][2] = 2; m[3][3] = 2
    m[2][7] = 3; m[7][2] = 3; m[7][7] = 3
    m[5][4] = 4; m[5][5] = 4; m[5][6] = 4
    m[4][5] = 101  // 门
    return m
}

// === 渲染 ===
const wallColors = {
    1: '#c44', 2: '#48c', 3: '#4c6', 4: '#eb8',
    101: '#a44', 102: '#48a'
}
function render() {
    ctx.clearRect(0,0,500,500)
    for (let y = 0; y < LINES; y++) {
        for (let x = 0; x < COLS; x++) {
            let cell = worldMap[y][x]
            if (cell > 0) {
                ctx.fillStyle = wallColors[cell] || '#888'
                ctx.fillRect(x*CELL+2, y*CELL+2, CELL-4, CELL-4)
                if (cell >= 101 && cell <= 199) {
                    // 画一个门符号（横向金属条）
                    ctx.fillStyle = '#222'
                    ctx.fillRect(x*CELL+5, y*CELL+CELL/2-3, CELL-10, 6)
                }
            }
            ctx.strokeStyle = '#333'
            ctx.strokeRect(x*CELL, y*CELL, CELL, CELL)
        }
    }
    // 玩家起点
    ctx.fillStyle = 'rgba(88,221,253,0.7)'
    ctx.beginPath()
    ctx.arc(playerStart.x*CELL, playerStart.y*CELL, 8, 0, Math.PI*2)
    ctx.fill()

    // 精灵
    for (let s of sprites) {
        ctx.fillStyle = s.type === 'enemy' ? '#e44' : '#ee4'
        ctx.beginPath()
        ctx.arc(s.x*CELL, s.y*CELL, 7, 0, Math.PI*2)
        ctx.fill()
    }
}

// === 交互 ===
function getCellFromEvent(e) {
    let rect = canvas.getBoundingClientRect()
    let cx = e.clientX - rect.left, cy = e.clientY - rect.top
    return [Math.floor(cx / CELL), Math.floor(cy / CELL)]
}
canvas.addEventListener('mousedown', (e) => {
    dragging = true
    handleAt(e)
})
canvas.addEventListener('mousemove', (e) => { if (dragging) handleAt(e) })
window.addEventListener('mouseup', () => dragging = false)

function handleAt(e) {
    let [x, y] = getCellFromEvent(e)
    if (x < 0 || y < 0 || x >= COLS || y >= LINES) return

    if (mode === 'brush') {
        worldMap[y][x] = brush
        render()
    } else if (mode === 'start') {
        playerStart = { x: x + 0.5, y: y + 0.5 }
        render()
    } else if (mode === 'enemy') {
        sprites.push({ type: 'enemy', x: x + 0.5, y: y + 0.5 })
        render()
    } else if (mode === 'item') {
        sprites.push({ type: 'item', x: x + 0.5, y: y + 0.5 })
        render()
    }
}

// === 按钮 ===
document.querySelectorAll('[data-brush]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-brush]').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        brush = Number(btn.dataset.brush)
        mode = 'brush'
    })
})
document.getElementById('btnStart').onclick = () => { mode = 'start'; alert('点击地图上一个空格设置玩家起点') }
document.getElementById('btnEnemy').onclick = () => { mode = 'enemy'; alert('点击地图放置敌人（红色圆点）') }
document.getElementById('btnItem').onclick  = () => { mode = 'item';  alert('点击地图放置物品（黄色圆点）') }

document.getElementById('btnSave').onclick = () => {
    let data = {
        format: 'raycasting-map-v1',
        columns: COLS, lines: LINES,
        worldMap, playerStart, sprites
    }
    let blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    let url = URL.createObjectURL(blob)
    let a = document.createElement('a')
    a.href = url; a.download = 'map.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
document.getElementById('btnLoad').onclick = () => document.getElementById('fileInput').click()
document.getElementById('fileInput').onchange = (e) => {
    let file = e.target.files[0]
    if (!file) return
    let reader = new FileReader()
    reader.onload = () => {
        try {
            let data = JSON.parse(reader.result)
            if (data.format !== 'raycasting-map-v1') return alert('格式不支持')
            worldMap = data.worldMap
            playerStart = data.playerStart || { x: 1.5, y: 4.5 }
            sprites = data.sprites || []
            render()
        } catch (err) { alert('JSON 解析失败: ' + err.message) }
    }
    reader.readAsText(file)
}
document.getElementById('btnReset').onclick = () => {
    worldMap = defaultMap()
    playerStart = { x: 1.5, y: 4.5 }
    sprites = [ { type: 'enemy', x: 2.5, y: 2.5 }, { type: 'item', x: 5.5, y: 7.5 } ]
    render()
}

render()
</script>
</body>
</html>
```

### L.6 在主游戏里加载 JSON

最直接的方式：让 `raycasting.html` 提供一个 `选择地图文件` 按钮，点击后读取 JSON → 重新构造 `Background` 和 `SpriteManager`。如果不想加文件选择器，也可以把地图 JSON 内容直接贴到 `Background.js` 顶部的 `DEFAULT_MAP` 常量里，在 editor.html 中保存时提示用户替换。

### L.7 验证方式

- 打开 editor.html → 看到默认地图网格（红外圈、蓝方块、绿柱子、橙走廊、一个门）
- 点击其他格子 → 应用当前笔刷（默认红墙）
- 拖动鼠标 → 连续画
- 保存地图 → 浏览器下载 `map.json`
- 点重置 → 恢复默认地图

---

## G ~ L 全阶段完成后的总结

| 阶段 | 结果 |
|------|------|
| G | 场景中有门，按 E 开关，有动画 |
| H | 背景音乐循环，走路/开门/射击/受伤各有音效 |
| I | 屏幕下方有枪，左键射击，命中敌人扣 HP，敌人死了消失；敌人发现玩家后追击 |
| J（可选）| 支持多种墙高、矮墙、玩家跳跃、楼梯；架构最大的改动，最后做 |
| K | 画面有雨滴粒子 + 手电筒/雾效的氛围 |
| L | 独立地图编辑器，可在浏览器里画地图 → 导出 JSON → 在主游戏里加载 |

到这里，项目就从「一个 raycasting 算法演示」真正升级成了「一个有敌人、有道具、有射击、有地图、有音效、可以编辑关卡」的小型 FPS 了。

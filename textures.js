// textures.js
// 程序化生成 64x64 纹理（砖墙 / 石头 / 木头 / 地板 / 天花板 / 敌人 / 物品）
// 供 Screen.js / SpriteManager.js 读取纹理列或整张 ImageData
//
// 使用方法：
//   let tm = new TextureManager();
//   let col = tm.getTextureColumn(cell, texX);   // 返回 [r,g,b] 数组（长度 64）
//   let img = tm.getPixels(textureIndex);        // 返回 ImageData（width=64,height=64）
//   tm.size  // 64

class TextureManager {
    constructor() {
        this.size = 64
        this.textures = {}          // key -> <canvas>
        this._pixelCache = {}       // key -> ImageData（懒加载缓存）
        this.generateAll()
    }

    // ===== 工具函数 =====

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

    _newCanvas() {
        let c = document.createElement('canvas')
        c.width = this.size
        c.height = this.size
        return c
    }

    // ===== 墙面纹理（1..4，与 Background.wallColors 对齐） =====

    // 砖墙（可指定基色，用于红蓝两色不同的墙）
    generateBrick(baseR, baseG, baseB) {
        let size = this.size
        let c = this._newCanvas()
        let ctx = c.getContext('2d')

        ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`
        ctx.fillRect(0, 0, size, size)

        // 砖缝（深色）
        let seamR = Math.floor(baseR * 0.4)
        let seamG = Math.floor(baseG * 0.4)
        let seamB = Math.floor(baseB * 0.4)
        ctx.fillStyle = `rgb(${seamR},${seamG},${seamB})`

        const brickH = 8, brickW = 16
        for (let row = 0; row < size / brickH; row++) {
            let offset = (row % 2) * (brickW / 2)
            // 水平缝
            ctx.fillRect(0, row * brickH, size, 2)
            for (let col = -1; col < size / brickW + 1; col++) {
                let bx = col * brickW + offset
                // 竖直缝（2 像素宽）
                ctx.fillRect(bx, row * brickH, 2, brickH)
            }
        }
        this._addNoise(c, 12)
        return c
    }

    generateStone(baseR, baseG, baseB) {
        let size = this.size
        let c = this._newCanvas()
        let ctx = c.getContext('2d')
        ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`
        ctx.fillRect(0, 0, size, size)

        // 不规则暗色斑块（模拟石头表面）
        for (let i = 0; i < 60; i++) {
            let x = Math.random() * size
            let y = Math.random() * size
            let r = 4 + Math.random() * 8
            let shade = 0.65 + Math.random() * 0.4
            let rr = Math.floor(baseR * shade)
            let gg = Math.floor(baseG * shade)
            let bb = Math.floor(baseB * shade)
            ctx.fillStyle = `rgba(${rr},${gg},${bb},0.9)`
            ctx.beginPath()
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.fill()
        }
        // 表面裂痕（几条随机短线）
        ctx.strokeStyle = `rgba(${Math.floor(baseR * 0.4)},${Math.floor(baseG * 0.4)},${Math.floor(baseB * 0.4)},0.8)`
        ctx.lineWidth = 1
        for (let i = 0; i < 8; i++) {
            ctx.beginPath()
            let sx = Math.random() * size
            let sy = Math.random() * size
            let ex = sx + (Math.random() - 0.5) * 20
            let ey = sy + (Math.random() - 0.5) * 20
            ctx.moveTo(sx, sy)
            ctx.lineTo(ex, ey)
            ctx.stroke()
        }
        this._addNoise(c, 20)
        return c
    }

    generateWood(baseR, baseG, baseB) {
        let size = this.size
        let c = this._newCanvas()
        let ctx = c.getContext('2d')

        ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`
        ctx.fillRect(0, 0, size, size)

        // 垂直木板条纹（每 16 像素一条木板 + 深色拼缝）
        for (let i = 0; i < size; i += 16) {
            let shade = 0.7 + Math.random() * 0.5
            let rr = Math.floor(baseR * shade)
            let gg = Math.floor(baseG * shade)
            let bb = Math.floor(baseB * shade)
            ctx.fillStyle = `rgb(${rr},${gg},${bb})`
            ctx.fillRect(i, 0, 14, size)
            // 深色拼缝
            ctx.fillStyle = `rgb(${Math.floor(baseR * 0.4)},${Math.floor(baseG * 0.4)},${Math.floor(baseB * 0.4)})`
            ctx.fillRect(i + 14, 0, 2, size)
        }
        // 木纹横向波浪（半透明横线，增加自然感）
        for (let y = 0; y < size; y += 4) {
            let a = 0.03 + Math.random() * 0.05
            ctx.fillStyle = `rgba(0,0,0,${a})`
            ctx.fillRect(0, y, size, 1)
        }
        this._addNoise(c, 12)
        return c
    }

    // ===== 地面 / 天花板纹理（10, 11） =====

    generateFloorChecker() {
        let size = this.size
        let c = this._newCanvas()
        let ctx = c.getContext('2d')
        // 2x2 棋盘格（每格 32x32）
        const t = size / 2
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                if ((x + y) % 2 === 0) {
                    ctx.fillStyle = 'rgb(70,70,75)'
                } else {
                    ctx.fillStyle = 'rgb(50,50,55)'
                }
                ctx.fillRect(x * t, y * t, t, t)
            }
        }
        // 格缝
        ctx.strokeStyle = 'rgb(30,30,30)'
        ctx.lineWidth = 1
        ctx.strokeRect(0, 0, size, size)
        this._addNoise(c, 10)
        return c
    }

    generateCeil() {
        let size = this.size
        let c = this._newCanvas()
        let ctx = c.getContext('2d')
        // 淡色格子（模拟天花板）
        const t = size / 2
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                if ((x + y) % 2 === 0) {
                    ctx.fillStyle = 'rgb(105,105,115)'
                } else {
                    ctx.fillStyle = 'rgb(90,90,100)'
                }
                ctx.fillRect(x * t, y * t, t, t)
            }
        }
        ctx.strokeStyle = 'rgb(60,60,70)'
        ctx.lineWidth = 1
        ctx.strokeRect(0, 0, size, size)
        this._addNoise(c, 8)
        return c
    }

    // ===== 精灵纹理（201 敌人, 202 物品） =====

    generateEnemy() {
        let size = this.size
        let c = this._newCanvas()
        let ctx = c.getContext('2d')

        // 先清理为全透明（精灵贴图透明像素跳过绘制）
        ctx.clearRect(0, 0, size, size)

        // 红色圆脸（主体）
        ctx.fillStyle = 'rgb(210, 50, 50)'
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2)
        ctx.fill()
        // 下半部阴影（立体感）
        ctx.fillStyle = 'rgba(120,0,0,0.55)'
        ctx.beginPath()
        ctx.arc(size / 2, size * 0.62, size * 0.38, 0, Math.PI)
        ctx.fill()

        // 眼睛白底
        ctx.fillStyle = 'rgb(255,255,255)'
        ctx.beginPath(); ctx.arc(size * 0.35, size * 0.4, size * 0.08, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(size * 0.65, size * 0.4, size * 0.08, 0, Math.PI * 2); ctx.fill()
        // 黑色瞳孔
        ctx.fillStyle = 'rgb(0,0,0)'
        ctx.beginPath(); ctx.arc(size * 0.35, size * 0.4, size * 0.04, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(size * 0.65, size * 0.4, size * 0.04, 0, Math.PI * 2); ctx.fill()

        // 嘴巴（凶恶的锯齿状）
        ctx.strokeStyle = 'rgb(0,0,0)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(size * 0.3, size * 0.62)
        for (let i = 0; i <= 10; i++) {
            let t = i / 10
            let x = size * 0.3 + t * size * 0.4
            let y = size * 0.62 + (i % 2 === 0 ? 0 : size * 0.05)
            ctx.lineTo(x, y)
        }
        ctx.stroke()

        this._addNoise(c, 10)
        return c
    }

    generateItem() {
        let size = this.size
        let c = this._newCanvas()
        let ctx = c.getContext('2d')
        ctx.clearRect(0, 0, size, size)

        // 白色背景方块
        ctx.fillStyle = 'rgb(235,235,235)'
        ctx.fillRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6)

        // 红十字 + 字横条组成医疗包
        ctx.fillStyle = 'rgb(200,30,30)'
        ctx.fillRect(size * 0.45, size * 0.25, size * 0.1, size * 0.5)
        ctx.fillRect(size * 0.25, size * 0.45, size * 0.5, size * 0.1)

        // 边缘描边（加深色）
        ctx.strokeStyle = 'rgb(80,80,80)'
        ctx.lineWidth = 2
        ctx.strokeRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6)

        this._addNoise(c, 8)
        return c
    }

    generateAll() {
        // 1/2 = 红蓝砖墙；3 = 石头；4 = 木头
        this.textures[1] = this.generateBrick(200, 70, 70)
        this.textures[2] = this.generateBrick(70, 120, 210)
        this.textures[3] = this.generateStone(150, 150, 160)
        this.textures[4] = this.generateWood(180, 130, 70)

        // 10 = 地板，11 = 天花板
        this.textures[10] = this.generateFloorChecker()
        this.textures[11] = this.generateCeil()

        // 201 = 敌人，202 = 物品
        this.textures[201] = this.generateEnemy()
        this.textures[202] = this.generateItem()
    }

    // ===== 读取接口 =====

    // 取纹理某一列像素（wall 渲染使用）。texX 范围 0..size-1。
    // 返回: length = size, 每元素 [r,g,b]；带缓存，避免每帧 getImageData
    getTextureColumn(textureIndex, texX) {
        let cacheKey = textureIndex + '_' + texX
        if (this._colCache && this._colCache[cacheKey]) return this._colCache[cacheKey]

        let canvas = this.textures[textureIndex]
        if (!canvas) return null
        let ctx = canvas.getContext('2d')
        let img = ctx.getImageData(texX, 0, 1, this.size)
        let d = img.data
        let out = new Array(this.size)
        for (let y = 0; y < this.size; y++) {
            let i = y * 4
            out[y] = [d[i], d[i + 1], d[i + 2]]
        }

        if (!this._colCache) this._colCache = {}
        this._colCache[cacheKey] = out
        return out
    }

    // 返回某一张纹理的整张 ImageData（Sprite 绘制使用）
    getPixels(textureIndex) {
        if (this._pixelCache[textureIndex]) return this._pixelCache[textureIndex]
        let canvas = this.textures[textureIndex]
        if (!canvas) return null
        let ctx = canvas.getContext('2d')
        let img = ctx.getImageData(0, 0, this.size, this.size)
        this._pixelCache[textureIndex] = img
        return img
    }
}

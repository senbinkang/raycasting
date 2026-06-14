// Screen.js
// 负责 3D 视图渲染（性能优化版）：
//   1) 墙体标准 DDA + 鱼眼校正 + 纹理采样
//   2) 地板/天花板纹理投射（逐行 raycasting）
//   3) 精灵绘制（按距离排序 + zBuffer 遮挡）
//   4) 雾效 / 方向光 / 手电筒增强
//
// 性能优化策略（完整）：
//   A. 全帧只分配一个 ImageData，墙/地板/天花板/精灵都写同一份 pixels
//   B. 构造时一次性预加载：墙体纹理列缓存 + 地板/天花板/精灵纹理 ImageData 缓存
//   C. drawBg 确保每一行都覆盖（避免中间水平线残留上一帧脏像素）
//   D. 无任何每帧 fillRect 或 getImageData 调用，全部都是纯数组读写
//   E. 所有光照 / 雾效 / 距离衰减都在 CPU 内完成，不走 GPU 回读

class Screen {
    constructor(game, player, bg, textureManager, spriteManager) {
        this.game = game
        this.context = game.contextImage
        this.width = game.canvasImage.width
        this.height = game.canvasImage.height

        this.player = player
        this.bg = bg
        this.textures = textureManager
        this.spriteManager = spriteManager || null

        this.zBuffer = new Float32Array(this.width)

        this.fogStart = 4
        this.fogFull = 14
        this.fogR = 80
        this.fogG = 80
        this.fogB = 100
        this.flashlightStrength = 70

        // ===== 预加载 =====
        this._wallColCache = {}       // key: "cell_texX" → Uint8ClampedArray(size*3)
        this._pixelCache = {}         // key: textureIndex → ImageData
        this._preloadTextures()

        this._frameImageData = this.context.createImageData(this.width, this.height)
    }

    _preloadTextures() {
        const texSize = this.textures.size

        // 墙体纹理列缓存
        for (let cell of [1, 2, 3, 4]) {
            let canvas = this.textures.textures[cell]
            if (!canvas) continue
            let ctx = canvas.getContext('2d')
            let fullImg = ctx.getImageData(0, 0, texSize, texSize)
            for (let tx = 0; tx < texSize; tx++) {
                let col = new Uint8ClampedArray(texSize * 3)
                for (let ty = 0; ty < texSize; ty++) {
                    let si = (ty * texSize + tx) * 4
                    col[ty * 3]     = fullImg.data[si]
                    col[ty * 3 + 1] = fullImg.data[si + 1]
                    col[ty * 3 + 2] = fullImg.data[si + 2]
                }
                this._wallColCache[cell + '_' + tx] = col
            }
        }

        // 精灵/地板/地板整张图缓存（textures.getPixels 已有 _pixelCache，这里做二次映射）
        for (let idx of [5, 6, 7, 8, 9, 10, 11]) {
            let canvas = this.textures.textures[idx]
            if (!canvas) continue
            let ctx = canvas.getContext('2d')
            this._pixelCache[idx] = ctx.getImageData(0, 0, texSize, texSize)
        }
    }

    _getWallCol(cell, texX) {
        let key = cell + '_' + texX
        if (this._wallColCache[key]) return this._wallColCache[key]
        return null
    }

    _getImageData(textureIndex) {
        if (this._pixelCache[textureIndex]) return this._pixelCache[textureIndex]
        // fallback：虽然不应该走到这里
        let canvas = this.textures.textures[textureIndex]
        if (!canvas) return null
        let ctx = canvas.getContext('2d')
        let img = ctx.getImageData(0, 0, this.textures.size, this.textures.size)
        this._pixelCache[textureIndex] = img
        return img
    }

    draw() {
        const imgData = this._frameImageData
        this._drawBg(imgData)
        this._drawWall(imgData)
        if (this.spriteManager) this._drawSprites(imgData)
        this.context.putImageData(imgData, 0, 0)
    }

    // ====== drawBg: 地板/天花板逐行投射 ======
    _drawBg(imgData) {
        const width = this.width
        const height = this.height
        const pixels = imgData.data
        const texSize = this.textures.size

        const { posX, posY, dirX, dirY, planeX, planeY } = this.player

        const floorImg = this._getImageData(10)
        const ceilImg = this._getImageData(11)
        const floorData = floorImg ? floorImg.data : null
        const ceilData = ceilImg ? ceilImg.data : null

        const heightHalf = height >> 1
        const posZ = height * 0.5

        const rayDirX0 = dirX - planeX
        const rayDirY0 = dirY - planeY
        const rayDirX1 = dirX + planeX
        const rayDirY1 = dirY + planeY
        const fsX = (rayDirX1 - rayDirX0) / width
        const fsY = (rayDirY1 - rayDirY0) / width

        const fogR = this.fogR, fogG = this.fogG, fogB = this.fogB
        const fogStart = this.fogStart, fogFull = this.fogFull

        // ---------- 天花板 ----------
        for (let y = 0; y < heightHalf; y++) {
            let p = heightHalf - y
            let rowDistance = (p >= 1) ? posZ / p : 9999

            let stepX = rowDistance * fsX
            let stepY = rowDistance * fsY
            let ceilX = posX + rowDistance * rayDirX0
            let ceilY = posY + rowDistance * rayDirY0

            let fogAlpha
            let distFactor
            if (rowDistance >= fogFull) {
                fogAlpha = 1; distFactor = 0
            } else {
                fogAlpha = Math.max(0, (rowDistance - fogStart) / (fogFull - fogStart))
                distFactor = 1.0 / (1.0 + 0.006 * rowDistance * rowDistance)
            }

            let rowBase = (y * width) << 2

            if (fogAlpha >= 1) {
                for (let x = 0; x < width; x++) {
                    let pi = rowBase + (x << 2)
                    pixels[pi] = fogR; pixels[pi + 1] = fogG; pixels[pi + 2] = fogB; pixels[pi + 3] = 255
                }
                continue
            }

            for (let x = 0; x < width; x++) {
                ceilX += stepX; ceilY += stepY

                let cellX = Math.floor(ceilX)
                let cellY = Math.floor(ceilY)
                let tx = (Math.abs(ceilX - cellX) * texSize) | 0
                let ty = (Math.abs(ceilY - cellY) * texSize) | 0
                if (tx >= texSize) tx = texSize - 1
                if (ty >= texSize) ty = texSize - 1

                let r, g, b
                if (ceilData) {
                    let si = (ty * texSize + tx) << 2
                    r = ceilData[si]; g = ceilData[si + 1]; b = ceilData[si + 2]
                } else {
                    if (((cellX + cellY) & 1) === 0) { r = 110; g = 110; b = 120 }
                    else { r = 85; g = 85; b = 95 }
                }

                r = (r * distFactor) | 0
                g = (g * distFactor) | 0
                b = (b * distFactor) | 0

                if (fogAlpha > 0) {
                    r = (r * (1 - fogAlpha) + fogR * fogAlpha) | 0
                    g = (g * (1 - fogAlpha) + fogG * fogAlpha) | 0
                    b = (b * (1 - fogAlpha) + fogB * fogAlpha) | 0
                }

                let pi = rowBase + (x << 2)
                pixels[pi] = r; pixels[pi + 1] = g; pixels[pi + 2] = b; pixels[pi + 3] = 255
            }
        }

        // ---------- 地板 ----------
        for (let y = heightHalf; y < height; y++) {
            let p = y - heightHalf
            let rowDistance = (p >= 1) ? posZ / p : 9999

            let stepX = rowDistance * fsX
            let stepY = rowDistance * fsY
            let floorX = posX + rowDistance * rayDirX0
            let floorY = posY + rowDistance * rayDirY0

            let fogAlpha
            let distFactor
            if (rowDistance >= fogFull) {
                fogAlpha = 1; distFactor = 0
            } else {
                fogAlpha = Math.max(0, (rowDistance - fogStart) / (fogFull - fogStart))
                distFactor = 1.0 / (1.0 + 0.006 * rowDistance * rowDistance)
            }

            let rowBase = (y * width) << 2

            if (fogAlpha >= 1) {
                for (let x = 0; x < width; x++) {
                    let pi = rowBase + (x << 2)
                    pixels[pi] = fogR; pixels[pi + 1] = fogG; pixels[pi + 2] = fogB; pixels[pi + 3] = 255
                }
                continue
            }

            for (let x = 0; x < width; x++) {
                floorX += stepX; floorY += stepY

                let cellX = Math.floor(floorX)
                let cellY = Math.floor(floorY)
                let tx = (Math.abs(floorX - cellX) * texSize) | 0
                let ty = (Math.abs(floorY - cellY) * texSize) | 0
                if (tx >= texSize) tx = texSize - 1
                if (ty >= texSize) ty = texSize - 1

                let r, g, b
                if (floorData) {
                    let si = (ty * texSize + tx) << 2
                    r = floorData[si]; g = floorData[si + 1]; b = floorData[si + 2]
                } else {
                    if (((cellX + cellY) & 1) === 0) { r = 80; g = 80; b = 80 }
                    else { r = 60; g = 60; b = 60 }
                }

                r = (r * distFactor) | 0
                g = (g * distFactor) | 0
                b = (b * distFactor) | 0

                if (fogAlpha > 0) {
                    r = (r * (1 - fogAlpha) + fogR * fogAlpha) | 0
                    g = (g * (1 - fogAlpha) + fogG * fogAlpha) | 0
                    b = (b * (1 - fogAlpha) + fogB * fogAlpha) | 0
                }

                let pi = rowBase + (x << 2)
                pixels[pi] = r; pixels[pi + 1] = g; pixels[pi + 2] = b; pixels[pi + 3] = 255
            }
        }
    }

    // ====== drawWall: 标准 DDA + 纹理采样 ======
    _drawWall(imgData) {
        const player = this.player
        const bg = this.bg
        const { posX, posY, dirX, dirY, planeX, planeY } = player
        const worldMap = bg.worldMap
        const texSize = this.textures.size
        const width = this.width
        const height = this.height

        const pixels = imgData.data
        const zBuffer = this.zBuffer

        const fogR = this.fogR, fogG = this.fogG, fogB = this.fogB
        const fogStart = this.fogStart, fogFull = this.fogFull
        const flashlightStrength = this.flashlightStrength

        const stride4 = width << 2

        for (let x = 0; x < width; x++) {
            let cameraX = 2 * x / width - 1
            let rayDirX = dirX + planeX * cameraX
            let rayDirY = dirY + planeY * cameraX

            let mapX = Math.floor(posX)
            let mapY = Math.floor(posY)

            let deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX)
            let deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY)

            let sideDistX, sideDistY, stepX, stepY
            if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaDistX }
            else { stepX = 1; sideDistX = (mapX + 1.0 - posX) * deltaDistX }
            if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaDistY }
            else { stepY = 1; sideDistY = (mapY + 1.0 - posY) * deltaDistY }

            let hit = 0, side = 0, safety = 0
            while (hit === 0 && safety < 200) {
                if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0 }
                else { sideDistY += deltaDistY; mapY += stepY; side = 1 }
                if (mapX < 0 || mapY < 0 || mapX >= bg.columns || mapY >= bg.lines) { hit = 1; break }
                if (worldMap[mapY][mapX] > 0) hit = 1
                safety++
            }

            let perpDist = (side === 0) ? sideDistX - deltaDistX : sideDistY - deltaDistY
            if (perpDist < 0.01) perpDist = 0.01
            zBuffer[x] = perpDist

            let lineHeight = Math.floor(height / perpDist)
            let drawStart = Math.floor(-lineHeight / 2 + height / 2)
            let drawEnd = drawStart + lineHeight
            if (drawStart < 0) drawStart = 0
            if (drawEnd > height) drawEnd = height

            let wallX = (side === 0) ? posY + perpDist * rayDirY : posX + perpDist * rayDirX
            wallX -= Math.floor(wallX)

            let cell = worldMap[mapY][mapX]
            let texX = Math.floor(wallX * texSize)
            if (side === 0 && rayDirX > 0) texX = texSize - texX - 1
            if (side === 1 && rayDirY < 0) texX = texSize - texX - 1
            if (texX < 0) texX = 0; if (texX >= texSize) texX = texSize - 1

            let texCol = this._getWallCol(cell, texX)

            // 每列一次预计算光照
            let normalX = (side === 0) ? -stepX : 0
            let normalY = (side === 1) ? -stepY : 0
            let dot = Math.max(0, rayDirX * normalX + rayDirY * normalY)
            let dirLight = 0.65 + 0.35 * dot
            let distFactor = 1.0 / (1.0 + 0.02 * perpDist * perpDist)
            let sideDarken = (side === 1) ? 0.8 : 1.0
            let lightMul = sideDarken * dirLight * distFactor

            let flashlight = Math.max(0, 1 - Math.abs(cameraX) * 1.2)
            flashlight = flashlight * flashlight
            let bonus = (flashlight * flashlightStrength) | 0

            let fogAlpha = Math.max(0, Math.min(1, (perpDist - fogStart) / (fogFull - fogStart)))
            let fogMixR = fogR * fogAlpha
            let fogMixG = fogG * fogAlpha
            let fogMixB = fogB * fogAlpha
            let oneMinusFog = 1 - fogAlpha

            let colBase = x << 2

            for (let screenY = drawStart; screenY < drawEnd; screenY++) {
                let texY = ((screenY - drawStart) / (drawEnd - drawStart) * texSize) | 0
                if (texY >= texSize) texY = texSize - 1

                let r, g, b
                if (texCol) {
                    let ci = texY * 3
                    r = texCol[ci]; g = texCol[ci + 1]; b = texCol[ci + 2]
                } else {
                    r = 200; g = 80; b = 80
                }

                r = r * lightMul
                g = g * lightMul
                b = b * lightMul

                if (bonus > 0) {
                    r = Math.min(255, r + bonus)
                    g = Math.min(255, g + bonus)
                    b = Math.min(255, b + bonus)
                }

                if (fogAlpha > 0) {
                    r = r * oneMinusFog + fogMixR
                    g = g * oneMinusFog + fogMixG
                    b = b * oneMinusFog + fogMixB
                }

                let pi = colBase + screenY * stride4
                pixels[pi]     = r | 0
                pixels[pi + 1] = g | 0
                pixels[pi + 2] = b | 0
                pixels[pi + 3] = 255
            }
        }
    }

    // ====== drawSprites: 精灵也直接写入 ImageData ======
    _drawSprites(imgData) {
        const width = this.width
        const height = this.height
        const pixels = imgData.data
        const zBuffer = this.zBuffer
        const texSize = this.textures.size
        const player = this.player

        // 1) 按距离从远到近排序
        let entries = this.spriteManager.sprites
            .filter(s => s.alive)
            .map(s => ({ s, d: (s.x - player.position.x) ** 2 + (s.y - player.position.y) ** 2 }))
            .sort((a, b) => b.d - a.d)

        const stride4 = width << 2

        for (let entry of entries) {
            let s = entry.s

            let spriteX = s.x - player.position.x
            let spriteY = s.y - player.position.y

            let invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY)
            let transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY)
            let transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY)

            if (transformY <= 0.05) continue

            let spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY))
            let spriteHeight = Math.abs(Math.floor(height / transformY))
            let spriteWidth = Math.abs(Math.floor(width / transformY))

            let drawStartY = Math.floor(-spriteHeight / 2 + height / 2)
            let drawEndY = drawStartY + spriteHeight
            let drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX)
            let drawEndX = drawStartX + spriteWidth

            // 取精灵纹理 ImageData（从预加载缓存）
            let img = this._getImageData(s.textureIndex)

            // 距离衰减（精灵整体变暗）
            let distFactor = 1.0 / (1 + 0.015 * transformY * transformY)

            // 每列 stripe
            for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
                if (stripe < 0 || stripe >= width) continue
                if (zBuffer[stripe] < transformY) continue

                let texX = Math.floor((stripe - (-spriteWidth / 2 + spriteScreenX)) * texSize / spriteWidth)
                if (texX < 0 || texX >= texSize) continue

                let colBase = stripe << 2

                for (let y = drawStartY; y < drawEndY; y++) {
                    if (y < 0 || y >= height) continue
                    let d = (y - drawStartY) / spriteHeight
                    let texY = Math.floor(d * texSize)
                    if (texY < 0 || texY >= texSize) continue

                    let r, g, b, a
                    if (img) {
                        let idx = (texY * texSize + texX) << 2
                        r = img.data[idx]
                        g = img.data[idx + 1]
                        b = img.data[idx + 2]
                        a = img.data[idx + 3]
                    } else {
                        if (s.type === 'enemy') { r = 220; g = 40; b = 40; a = 255 }
                        else if (s.type === 'item') { r = 230; g = 220; b = 80; a = 255 }
                        else { r = 200; g = 200; b = 200; a = 255 }
                    }

                    if (a < 32) continue

                    r = (r * distFactor) | 0
                    g = (g * distFactor) | 0
                    b = (b * distFactor) | 0

                    let pi = colBase + y * stride4
                    pixels[pi]     = r
                    pixels[pi + 1] = g
                    pixels[pi + 2] = b
                    pixels[pi + 3] = 255
                }
            }
        }
    }
}

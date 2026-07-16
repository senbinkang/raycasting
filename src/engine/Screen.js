export class Screen {
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
        this.projectiles = []

        this._wallColCache = {}
        this._pixelCache = {}
        this._preloadTextures()

        this._frameImageData = this.context.createImageData(this.width, this.height)
    }

    _preloadTextures() {
        const texSize = this.textures.size

        for (const cell of [1, 2, 3, 4]) {
            const canvas = this.textures.textures[cell]
            if (!canvas) { continue }
            const ctx = canvas.getContext('2d')
            const fullImg = ctx.getImageData(0, 0, texSize, texSize)
            for (let tx = 0; tx < texSize; tx++) {
                const col = new Uint8ClampedArray(texSize * 3)
                for (let ty = 0; ty < texSize; ty++) {
                    const si = (ty * texSize + tx) * 4
                    col[ty * 3] = fullImg.data[si]
                    col[ty * 3 + 1] = fullImg.data[si + 1]
                    col[ty * 3 + 2] = fullImg.data[si + 2]
                }
                this._wallColCache[cell + '_' + tx] = col
            }
        }

        for (const idx of [10, 11]) {
            const canvas = this.textures.textures[idx]
            if (!canvas) { continue }
            const ctx = canvas.getContext('2d')
            this._pixelCache[idx] = ctx.getImageData(0, 0, texSize, texSize)
        }
    }

    _getWallCol(cell, texX) {
        const key = cell + '_' + texX
        if (this._wallColCache[key]) { return this._wallColCache[key] }
        return null
    }

    _getImageData(textureIndex) {
        if (this._pixelCache[textureIndex]) { return this._pixelCache[textureIndex] }
        const canvas = this.textures.textures[textureIndex]
        if (!canvas) { return null }
        const ctx = canvas.getContext('2d')
        const img = ctx.getImageData(0, 0, this.textures.size, this.textures.size)
        this._pixelCache[textureIndex] = img
        return img
    }

    draw() {
        const imgData = this._frameImageData
        this._drawBg(imgData)
        this._drawWall(imgData)
        if (this.spriteManager) { this._drawSprites(imgData) }
        if (this.projectiles && this.projectiles.length > 0) { this._drawProjectiles(imgData) }
        this.context.putImageData(imgData, 0, 0)
    }

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

        const fogR = this.fogR,
            fogG = this.fogG,
            fogB = this.fogB
        const fogStart = this.fogStart,
            fogFull = this.fogFull

        for (let y = 0; y < heightHalf; y++) {
            const p = heightHalf - y
            const rowDistance = p >= 1 ? posZ / p : 9999

            const stepX = rowDistance * fsX
            const stepY = rowDistance * fsY
            let ceilX = posX + rowDistance * rayDirX0
            let ceilY = posY + rowDistance * rayDirY0

            let fogAlpha
            let distFactor
            if (rowDistance >= fogFull) {
                fogAlpha = 1
                distFactor = 0
            } else {
                fogAlpha = Math.max(0, (rowDistance - fogStart) / (fogFull - fogStart))
                distFactor = 1.0 / (1.0 + 0.006 * rowDistance * rowDistance)
            }

            const rowBase = (y * width) << 2

            if (fogAlpha >= 1) {
                for (let x = 0; x < width; x++) {
                    const pi = rowBase + (x << 2)
                    pixels[pi] = fogR
                    pixels[pi + 1] = fogG
                    pixels[pi + 2] = fogB
                    pixels[pi + 3] = 255
                }
                continue
            }

            for (let x = 0; x < width; x++) {
                ceilX += stepX
                ceilY += stepY

                const cellX = Math.floor(ceilX)
                const cellY = Math.floor(ceilY)
                let tx = (Math.abs(ceilX - cellX) * texSize) | 0
                let ty = (Math.abs(ceilY - cellY) * texSize) | 0
                if (tx >= texSize) { tx = texSize - 1 }
                if (ty >= texSize) { ty = texSize - 1 }

                let r, g, b
                if (ceilData) {
                    const si = (ty * texSize + tx) << 2
                    r = ceilData[si]
                    g = ceilData[si + 1]
                    b = ceilData[si + 2]
                } else {
                    if (((cellX + cellY) & 1) === 0) {
                        r = 110
                        g = 110
                        b = 120
                    } else {
                        r = 85
                        g = 85
                        b = 95
                    }
                }

                r = (r * distFactor) | 0
                g = (g * distFactor) | 0
                b = (b * distFactor) | 0

                if (fogAlpha > 0) {
                    r = (r * (1 - fogAlpha) + fogR * fogAlpha) | 0
                    g = (g * (1 - fogAlpha) + fogG * fogAlpha) | 0
                    b = (b * (1 - fogAlpha) + fogB * fogAlpha) | 0
                }

                const pi = rowBase + (x << 2)
                pixels[pi] = r
                pixels[pi + 1] = g
                pixels[pi + 2] = b
                pixels[pi + 3] = 255
            }
        }

        for (let y = heightHalf; y < height; y++) {
            const p = y - heightHalf
            const rowDistance = p >= 1 ? posZ / p : 9999

            const stepX = rowDistance * fsX
            const stepY = rowDistance * fsY
            let floorX = posX + rowDistance * rayDirX0
            let floorY = posY + rowDistance * rayDirY0

            let fogAlpha
            let distFactor
            if (rowDistance >= fogFull) {
                fogAlpha = 1
                distFactor = 0
            } else {
                fogAlpha = Math.max(0, (rowDistance - fogStart) / (fogFull - fogStart))
                distFactor = 1.0 / (1.0 + 0.006 * rowDistance * rowDistance)
            }

            const rowBase = (y * width) << 2

            if (fogAlpha >= 1) {
                for (let x = 0; x < width; x++) {
                    const pi = rowBase + (x << 2)
                    pixels[pi] = fogR
                    pixels[pi + 1] = fogG
                    pixels[pi + 2] = fogB
                    pixels[pi + 3] = 255
                }
                continue
            }

            for (let x = 0; x < width; x++) {
                floorX += stepX
                floorY += stepY

                const cellX = Math.floor(floorX)
                const cellY = Math.floor(floorY)
                let tx = (Math.abs(floorX - cellX) * texSize) | 0
                let ty = (Math.abs(floorY - cellY) * texSize) | 0
                if (tx >= texSize) { tx = texSize - 1 }
                if (ty >= texSize) { ty = texSize - 1 }

                let r, g, b
                if (floorData) {
                    const si = (ty * texSize + tx) << 2
                    r = floorData[si]
                    g = floorData[si + 1]
                    b = floorData[si + 2]
                } else {
                    if (((cellX + cellY) & 1) === 0) {
                        r = 80
                        g = 80
                        b = 80
                    } else {
                        r = 60
                        g = 60
                        b = 60
                    }
                }

                r = (r * distFactor) | 0
                g = (g * distFactor) | 0
                b = (b * distFactor) | 0

                if (fogAlpha > 0) {
                    r = (r * (1 - fogAlpha) + fogR * fogAlpha) | 0
                    g = (g * (1 - fogAlpha) + fogG * fogAlpha) | 0
                    b = (b * (1 - fogAlpha) + fogB * fogAlpha) | 0
                }

                const pi = rowBase + (x << 2)
                pixels[pi] = r
                pixels[pi + 1] = g
                pixels[pi + 2] = b
                pixels[pi + 3] = 255
            }
        }
    }

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

        const fogR = this.fogR,
            fogG = this.fogG,
            fogB = this.fogB
        const fogStart = this.fogStart,
            fogFull = this.fogFull
        const flashlightStrength = this.flashlightStrength

        const stride4 = width << 2

        for (let x = 0; x < width; x++) {
            const cameraX = (2 * x) / width - 1
            const rayDirX = dirX + planeX * cameraX
            const rayDirY = dirY + planeY * cameraX

            let mapX = Math.floor(posX)
            let mapY = Math.floor(posY)

            const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX)
            const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY)

            let sideDistX,
                sideDistY,
                stepX,
                stepY
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

            let hit = 0,
                side = 0,
                safety = 0
            while (hit === 0 && safety < 200) {
                if (sideDistX < sideDistY) {
                    sideDistX += deltaDistX
                    mapX += stepX
                    side = 0
                } else {
                    sideDistY += deltaDistY
                    mapY += stepY
                    side = 1
                }
                if (mapX < 0 || mapY < 0 || mapX >= bg.columns || mapY >= bg.lines) {
                    break
                }
                if (worldMap[mapY][mapX] > 0) {
                    hit = 1
                }
                safety++
            }

            let perpDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY
            if (perpDist < 0.01) { perpDist = 0.01 }
            zBuffer[x] = perpDist

            const lineHeight = Math.floor(height / perpDist)
            let drawStart = Math.floor(-lineHeight / 2 + height / 2)
            let drawEnd = drawStart + lineHeight
            if (drawStart < 0) { drawStart = 0 }
            if (drawEnd > height) { drawEnd = height }

            if (drawStart > 0) { drawStart-- }
            if (drawEnd < height) { drawEnd++ }

            let wallX = side === 0 ? posY + perpDist * rayDirY : posX + perpDist * rayDirX
            wallX -= Math.floor(wallX)

            const cell = worldMap[mapY][mapX]
            let texX = Math.floor(wallX * texSize)
            if (side === 0 && rayDirX > 0) { texX = texSize - texX - 1 }
            if (side === 1 && rayDirY < 0) { texX = texSize - texX - 1 }
            if (texX < 0) { texX = 0 }
            if (texX >= texSize) { texX = texSize - 1 }

            const texCol = this._getWallCol(cell, texX)

            const normalX = side === 0 ? -stepX : 0
            const normalY = side === 1 ? -stepY : 0
            const dot = Math.max(0, rayDirX * normalX + rayDirY * normalY)
            const dirLight = 0.65 + 0.35 * dot
            const distFactor = 1.0 / (1.0 + 0.02 * perpDist * perpDist)
            const sideDarken = side === 1 ? 0.8 : 1.0
            const lightMul = sideDarken * dirLight * distFactor

            let flashlight = Math.max(0, 1 - Math.abs(cameraX) * 1.2)
            flashlight = flashlight * flashlight
            const bonus = (flashlight * flashlightStrength) | 0

            const fogAlpha = Math.max(0, Math.min(1, (perpDist - fogStart) / (fogFull - fogStart)))
            const fogMixR = fogR * fogAlpha
            const fogMixG = fogG * fogAlpha
            const fogMixB = fogB * fogAlpha
            const oneMinusFog = 1 - fogAlpha

            const colBase = x << 2

            for (let screenY = drawStart; screenY < drawEnd; screenY++) {
                let texY = ((screenY - drawStart) / (drawEnd - drawStart) * texSize) | 0
                if (texY >= texSize) { texY = texSize - 1 }

                let r, g, b
                if (texCol) {
                    const ci = texY * 3
                    r = texCol[ci]
                    g = texCol[ci + 1]
                    b = texCol[ci + 2]
                } else {
                    r = 200
                    g = 80
                    b = 80
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

                const pi = colBase + screenY * stride4
                pixels[pi] = r | 0
                pixels[pi + 1] = g | 0
                pixels[pi + 2] = b | 0
                pixels[pi + 3] = 255
            }
        }
    }

    _drawSprites(imgData) {
        const width = this.width
        const height = this.height
        const pixels = imgData.data
        const zBuffer = this.zBuffer
        const texSize = this.textures.size
        const player = this.player

        const entries = this.spriteManager.sprites
            .filter((s) => s.alive)
            .map((s) => ({
                s,
                d: (s.x - player.position.x) ** 2 + (s.y - player.position.y) ** 2,
            }))
            .sort((a, b) => b.d - a.d)

        const stride4 = width << 2

        for (const entry of entries) {
            const s = entry.s

            const spriteX = s.x - player.position.x
            const spriteY = s.y - player.position.y

            const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY)
            const transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY)
            const transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY)

            if (transformY <= 0.05) { continue }

            const spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY))
            const spriteHeight = Math.abs(Math.floor(height / transformY))
            const spriteWidth = Math.abs(Math.floor(width / transformY))

            const drawStartY = Math.floor(-spriteHeight / 2 + height / 2)
            const drawEndY = drawStartY + spriteHeight
            const drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX)
            const drawEndX = drawStartX + spriteWidth

            const img = this._getImageData(s.textureIndex)

            const distFactor = 1.0 / (1 + 0.015 * transformY * transformY)

            for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
                if (stripe < 0 || stripe >= width) { continue }
                if (zBuffer[stripe] < transformY) { continue }

                const texX = Math.floor((stripe - (-spriteWidth / 2 + spriteScreenX)) * (texSize / spriteWidth))
                if (texX < 0 || texX >= texSize) { continue }

                const colBase = stripe << 2

                for (let y = drawStartY; y < drawEndY; y++) {
                    if (y < 0 || y >= height) { continue }
                    const d = (y - drawStartY) / spriteHeight
                    const texY = Math.floor(d * texSize)
                    if (texY < 0 || texY >= texSize) { continue }

                    let r, g, b, a
                    if (img) {
                        const idx = (texY * texSize + texX) << 2
                        r = img.data[idx]
                        g = img.data[idx + 1]
                        b = img.data[idx + 2]
                        a = img.data[idx + 3]
                    } else {
                        if (s.type === 'enemy') {
                            r = 220
                            g = 40
                            b = 40
                            a = 255
                        } else if (s.type === 'item') {
                            r = 230
                            g = 220
                            b = 80
                            a = 255
                        } else {
                            r = 200
                            g = 200
                            b = 200
                            a = 255
                        }
                    }

                    if (a < 32) { continue }

                    if (s.hitFlashTimer > 0) {
                        r = Math.min(255, r + 150)
                        g = Math.min(255, g + 150)
                        b = Math.min(255, b + 150)
                    }

                    r = (r * distFactor) | 0
                    g = (g * distFactor) | 0
                    b = (b * distFactor) | 0

                    const pi = colBase + y * stride4
                    pixels[pi] = r
                    pixels[pi + 1] = g
                    pixels[pi + 2] = b
                    pixels[pi + 3] = 255
                }
            }
        }
    }

    _drawProjectiles(imgData) {
        const player = this.player
        const width = this.width
        const height = this.height
        const pixels = imgData.data
        const zBuffer = this.zBuffer
        const stride4 = width << 2

        for (const p of this.projectiles) {
            const sx = p.x - player.position.x
            const sy = p.y - player.position.y
            const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY)
            const transformX = invDet * (player.dirY * sx - player.dirX * sy)
            const transformY = invDet * (-player.planeY * sx + player.planeX * sy)
            if (transformY <= 0.05) { continue }

            const screenX = Math.floor((width / 2) * (1 + transformX / transformY))
            const screenY = Math.floor(height / 2)
            if (screenX < 0 || screenX >= width) { continue }
            if (zBuffer[screenX] < transformY) { continue }

            const size = Math.max(1, Math.floor(2 / transformY))
            const distFactor = 1.0 / (1 + 0.01 * transformY * transformY)
            for (let dy = -size; dy <= size; dy++) {
                for (let dx = -size; dx <= size; dx++) {
                    const rx = screenX + dx,
                        ry = screenY + dy
                    if (rx < 0 || rx >= width || ry < 0 || ry >= height) { continue }
                    const pi = (rx << 2) + ry * stride4
                    pixels[pi] = Math.min(255, (pixels[pi] + 200 * distFactor) | 0)
                    pixels[pi + 1] = Math.min(255, (pixels[pi + 1] + 180 * distFactor) | 0)
                    pixels[pi + 2] = Math.min(255, (pixels[pi + 2] + 50 * distFactor) | 0)
                    pixels[pi + 3] = 255
                }
            }
        }
    }
}

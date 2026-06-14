# 2026-06-14 — raycasting 性能优化

## 一、需求/问题

用户反馈画面卡顿，FPS 目测约 20，旋转和移动都不流畅。排查发现三个大瓶颈。

## 二、做了什么

- 把 `Screen.js` 的 `fillRect(x, y, 1, 1)`（每帧 ~45 万次）改为分配一个 `ImageData`，所有像素直接写 `pixels` 数组，每帧只调用一次 `putImageData`
- 构造时一次性把墙体 64 列像素、整张地板/天花板/精灵纹理读入内存缓存，不再每帧触发 `getImageData`（GPU→CPU 数据回读是最大开销来源）
- `textures.js` 的 `getTextureColumn` 加缓存（`_colCache`），避免被其他地方调用时重复回读
- 把 `SpriteManager.draw()` 原本的 `fillRect` 精灵绘制合并到 `Screen` 的同一份 `ImageData` 流程中
- 光照由每像素多次乘法合并为一个 `lightMul` 乘法

## 三、关键决策 / 踩过的坑

- **坑 1**：最初 `_resetPerFrameCache` 里每帧清空了 `_wallColCache`，导致预加载白做了，性能反而退化——后来改成只在构造时预加载、不再清空
- **坑 2**：起初想让 `Screen` 和 `SpriteManager` 各自独立绘制，`putImageData` 会互相覆盖——后来决定让 `Screen` 接管全部精灵绘制，SpriteManager 只负责 AI 和位置更新
- **决策**：选了「每帧一次性写 `ImageData`」而不是其他优化，因为这是单次投入最大、后续维护成本最低的方案；WebGL 等更激进方案暂时不碰，避免重构整个项目

## 四、文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 重写 | `game/Screen.js` | 统一 ImageData 流程 + 预加载纹理缓存 + 合并精灵绘制 |
| 修改 | `textures.js` | `getTextureColumn` 加 `_colCache` |

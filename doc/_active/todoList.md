# Raycasting 光线投射引擎 — TodoList

> 上游文档：`doc/_archive/2026-06-14-raycasting改进建议.md`（本文所有条目均来源于此）
> 当前版本：**2026-06-16 — doc 目录重组 + 工作流合并**（上次功能完成：2026-06-14 武器+音效+门）

---

## 一、核心算法（已全部完成 ✅）

| 编号 | 项目 | 状态 | 所在文件 |
|------|------|------|----------|
| 1.1 | 标准 DDA 射线（deltaDist + sideDist + step） | ✅ 已完成 | `game/Screen.js` `_drawWall()` |
| 1.2 | 鱼眼修正（perpendicular distance） | ✅ 已完成 | `game/Screen.js` `perpDist` |
| 1.3 | 分轴滑动碰撞检测 | ✅ 已完成 | `Player.js` |
| 1.4 | requestAnimationFrame + deltaTime 帧率独立 | ✅ 已完成 | `game/Game.js` |
| 1.5 | worldMap 二维数组化（地图数据与绘制解耦） | ✅ 已完成 | `Background.js` |

---

## 二、视觉与游戏性（阶段 A~F，已完成 ✅）

| 编号 | 项目 | 状态 | 所在文件 | 备注 |
|------|------|------|----------|------|
| 2.1 | 程序化墙面纹理（砖墙 / 石头 / 木头 / 金属等） | ✅ 已完成 | `textures.js` `TextureManager` | 64×64 程序化贴图，4 种墙 + 2 种地板天花板 + 敌人 / 物品 |
| 2.2 | 地板 / 天花板纹理投射（逐行 floor-casting） | ✅ 已完成 | `game/Screen.js` `_drawBg()` | 距离衰减 + 雾效 |
| 2.3 | 鼠标视角控制（Pointer Lock） | ✅ 已完成 | `raycasting.html` / `Player.js` | 现代 FPS 操作方式 |
| 2.4 | Sprite 系统（敌人/物品，zBuffer 遮挡排序） | ✅ 已完成 | `game/Sprite.js` + `game/SpriteManager.js` + `game/Screen.js` `_drawSprites()` |
| 2.5 | 小地图（Minimap） | ✅ 已完成 | `Background.js` `drawMinimap()` | 玩家位置 + 朝向 + 墙体描边 |
| 2.6 | 光照效果（手电筒 + 方向光 + 距离衰减 + 雾） | ✅ 已完成 | `game/Screen.js` `lightMul` / `bonus` / `fogAlpha` |
| 2.7 | HUD（FPS 指示器 + 键盘操作说明） | ⚠️ 轻量版已在 raycasting.html | 可用独立 HUD 面板增强 |

---

## 三、性能优化（本轮新加，已完成 ✅）

| 编号 | 项目 | 状态 | 所在文件 |
|------|------|------|----------|
| 3.1 | 全帧 ImageData 批量像素写入（替代每帧 ~450,000 次 `fillRect`） | ✅ 已完成 | `game/Screen.js` `draw()` 流程 |
| 3.2 | 纹理列 + 纹理图预加载（构造时一次读入内存缓存） | ✅ 已完成 | `game/Screen.js` `_preloadTextures()` + `_wallColCache` + `_pixelCache` |
| 3.3 | `getTextureColumn` 缓存（避免每列触发 `getImageData`） | ✅ 已完成 | `textures.js` `_colCache` |
| 3.4 | 精灵绘制合并到同一 ImageData 流程 | ✅ 已完成 | `game/Screen.js` `_drawSprites()` |
| 3.5 | 光照合并为单个 `lightMul` 乘法，降低逐像素计算量 | ✅ 已完成 | `game/Screen.js` |

---

## 四、工程化与剩余项目（未完成 ⏳）

| 编号 | 项目 | 状态 | 对应执行方案 | 预估工作量 |
|------|------|------|------------|-----------|
| 4.1 | 迁移到 TypeScript | ⏳ 远期 | `执行方案-GL.md` 阶段独立任务 | 大 |
| 4.2 | 构建工具链（Vite）+ ESM 模块化 | ⏳ 远期 | 同上 | 中 |
| 4.3 | 武器 HUD（屏幕底部像素风手枪 + 瞄准准星） | ✅ 已完成 | 本次实现 | — |
| 4.4 | 敌人 AI（巡逻 + 射线视线判断） | ✅ 已完成 | 本次实现，敌人有 HP / 死亡 | — |
| 4.5 | 音效（Web Audio API）— 走路 / 射击 / BGM | ✅ 已完成 | 本次实现 | — |
| 4.6 | 门与可交互物体（可开关门 / 拾取钥匙） | ✅ 已完成 | 本次实现 | — |
| 4.7 | 多关卡地图 / 可变墙高 | ⏳ 远期 | `执行方案-GL.md` 阶段 J | 中 |
| 4.8 | 天气与环境（雨 / 雾增强 / 昼夜） | ⏳ 远期 | `执行方案-GL.md` 阶段 K | 中 |
| 4.9 | 地图编辑器 | ⏳ 远期 | `执行方案-GL.md` 阶段 L | 大 |
| 4.10 | 移动端触摸支持 | ⏳ 远期 | 独立追加 | 中 |

---

## 五、个人网站集成（独立仓库任务，未开始 ⏳）

| 编号 | 项目 | 状态 | 备注 |
|------|------|------|------|
| 5.1 | raycasting 保持独立仓库（GitHub Pages） | ✅ 已完成 | `senbinkang.github.io/raycasting` |
| 5.2 | 个人网站 Projects 页面改造：Dialog + iframe 弹窗 | ⏳ 未开始 | `Kang-Senbin-Portfolio` 仓库，与本项目无关 |
| 5.3 | raycasting 加 postMessage 支持暂停/静音 | ⏳ 未开始 | 配合 5.2 |

---

## 六、完成度总览

```
✅ 已完成（核心算法 + 纹理 + 精灵 + 光照 + 性能 + 武器+音效+门） ████████████████████████  20 / 26 项
⏳ 未开始（多关卡/天气/地图编辑器/TS/移动端）                      ██░░░░░░░░░░░░░░░░░░░░░  6 / 26 项
```

**当前最应该推进的三件事（按推荐度）：**

1. **多关卡地图 / 可变墙高**（让游戏有多个房间/关卡）
2. **天气与环境**（雨/雾增强/昼夜循环能大幅提升氛围）
3. **地图编辑器**（让玩家能自己画地图）

---

## 七、文件索引

### 活跃文档（`doc/_active/`）

| 文件 | 用途 |
|------|------|
| `todoList.md` | **本文件**，总览进度 |

### 历史档案（`doc/_archive/`）

| 文件 | 用途 |
|------|------|
| `2026-06-14-raycasting改进建议.md` | 上游原始诊断报告 |
| `2026-06-14-raycasting-详细执行方案.md` | 阶段一~六（DDA/碰撞/帧率独立/地图二维化） |
| `2026-06-14-raycasting-执行方案-AF.md` | 阶段 A~F 的执行方案（已全部实现 ✅） |
| `2026-06-14-raycasting-执行方案-GL.md` | 阶段 G~L（G/H/I 已完成 ✅，J/K/L 未开始 ⏳） |
| `2026-06-14-raycasting工作流调整.md` | doc 目录重组 + 工作流规范调整 |
| `2026-06-14-raycasting武器AI音效门.md` | 武器 HUD + 射击 DDA + 敌人 HP/死亡 + Web Audio 音效 + 门系统 |
| `2026-06-14-raycasting性能优化.md` | ImageData 批量写入 + 纹理缓存 + 光照合并 |

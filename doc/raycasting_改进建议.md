
现在我已经深入了解了 raycasting 项目代码和你个人网站的结构。让我为你提供一份全面的分析和改进方案。

---

## 一、当前代码存在的问题

先通过阅读代码指出几个**立即可以修复**的问题，这些都在 `raycasting-main/` 目录下：

### 1. 鱼眼失真（Fisheye Distortion）— 核心算法 Bug ⚠️

**位置**：[Screen.js](file:///Users/kangsenbin/Downloads/games/raycasting/game/Screen.js#L52-L75)

```js
let len = new Vec(c.x - px, c.y - py).len  // ❌ 使用的是射线的真实长度
let height = h / len * mult                // 会导致视野边缘的墙被拉长
```

**问题**：你用的是玩家到墙的**直线距离**，而不是**垂直于相机平面的距离**。两边的射线比中心的射线走得更远，导致边缘的墙会显得更矮，画面会出现"鱼眼鼓包"效果。

**修复方法**：需要乘以 `cos(射线角度 - 玩家朝向)` 做修正：

```js
// 伪代码思路 - 每个射线要修正距离
const rayAngle = playerAngle - fov/2 + (i / numRays) * fov;
const correctedLen = len * Math.cos(rayAngle - playerAngle);
let height = h / correctedLen * mult;
```

### 2. DDA 算法不完整 — 性能问题 ⚠️

**位置**：[Player.js](file:///Users/kangsenbin/Downloads/games/raycasting/Player.js#L131-L196)

你的 `getEndPoint()` 方法：
- 每次只沿一个格子移动，然后**重算**，再做下一步判断。真正的 DDA（Digital Differential Analyzer）算法应该：
  - 计算 `deltaDistX`、`deltaDistY`（每穿过一格 x/y 方向需要走的距离）
  - 计算 `sideDistX`、`sideDistY`（从当前位置到下一个 x/y 边界的距离）
  - 通过比较 `sideDistX` 和 `sideDistY` 的大小，**决定下一步沿 x 还是 y 跳一整格**，而不是逐点逼近
  - 还可以记录撞到的是 x 方向边还是 y 方向边，以便给墙的两个面打不同亮度（这是 Wolfenstein 3D 的经典做法）

### 3. 没有纹理（Textures）— 视觉太朴素

目前每面墙只有一个纯色块，缺乏质感。经典实现都会为不同的墙类型分配纹理贴图（`drawImage` 到离屏 canvas），然后根据射线命中的 x 位置取对应的纹理列。

### 4. 没有小地图（Minimap）— 但你其实有地图数据

[Background.js](file:///Users/kangsenbin/Downloads/games/raycasting/Background.js#L11-L18) 里已经有墙数据，但没有一个小地图可视化给用户定位。

### 5. 视角固定为 18° FOV — 太窄了

[Player.js](file:///Users/kangsenbin/Downloads/games/raycasting/Player.js#L21) 里 `includedAngle = 18`，这意味着视野只有 18°（正常 FPS 游戏是 60°~90°）。100 条射线 18° 每格 0.18°，虽然精度够但视野太窄，体验很"受限"。

### 6. Screen 里的 `endPointArr` 必须每帧重置，但逻辑上有隐患

`Screen.drawWall()` 最后清空 `this.player.endPointArr = []`。如果 render 顺序出错或某帧没执行，下帧颜色计算就会用旧数据。

---

## 二、可以做的改进（按优先级排序）

### 🟥 核心算法改进（最重要，最能体现技术深度）
1. **DDA 重构**：按标准 DDA 实现 `deltaDist` / `sideDist`，每格一步判断撞到哪个方向的墙，O(N) 每次一格。
2. **鱼眼修正**：加入 `cos(angleDiff)` 修正距离。
3. **Side 明暗差异**：x 方向边和 y 方向边给不同亮度，产生"这面墙被从不同方向照亮"的感觉——这是 Wolfenstein 3D 标志性视觉效果。

### 🟨 视觉与体验
4. **纹理映射（Textured walls）**：加载 64×64 的小贴图作为砖墙/木墙/金属墙等；根据射线击中的 x 偏移取对应纹理列。
5. **天花板与地面渐变/纹理**：可以用简单的垂直渐变或 floor-casting 让地面和天花板也带上纹理。
6. **光源/手电筒效果**：根据距离再乘一个强度衰减，模拟手电筒或暗黑环境。
7. **可交互物体（Sprites）**：比如放一个小箱子作为可拾取的精灵，按距离对 sprite 进行 z-buffer 排序后绘制。
8. **鼠标视角控制（Pointer Lock）**：用 `requestPointerLock` 让玩家能用鼠标转视角——这是现代 FPS 的标配。
9. **多关卡地图**：用 2D 字符串数组定义关卡（例如 `"1"` 表示砖墙、`"2"` 表示木墙），支持关卡切换。
10. **小地图（Minimap）**：右下角一个小的 2D 俯视图，显示玩家位置和射线扇形。

### 🟩 工程化
11. **迁移到 TypeScript**：目前是原生 JS，改为 TS + Vite 打包，加 `tsconfig`、类型定义、严格模式，和你个人网站的工程风格对齐。
12. **构建工具链**：用 Vite 代替 `<script>` 标签加载，支持打包部署到 GitHub Pages。
13. **模块化 & ESM**：当前每个文件用 `<script>` 全局加载，改为 ESM import/export。
14. **性能优化**：用 `ImageData`（像素数组）直接写像素，而不是 `ctx.fillRect` 一条条画——这能大幅提升渲染性能，尤其在高分辨率下。
15. **FPS 指示器**：屏幕右上角显示实时 FPS。
16. **键盘映射面板**：WASD + 鼠标 + ESC 暂停。

### 🟦 可选项（锦上添花）
17. **武器 HUD**：屏幕底部画一个简单的像素风手枪（带瞄准准星）。
18. **敌人 AI**：在地图上放置巡逻敌人，用射线做视线判断。
19. **音效（Web Audio API）**：走路/射击/背景音乐。
20. **移动端触摸支持**：虚拟摇杆。

---

## 三、关于"独立仓库"与"融入个人网站"的方案

你已经有 `https://github.com/senbinkang/raycasting` 仓库，同时个人网站目前已经在 [Projects.tsx](file:///Users/kangsenbin/Downloads/Kang-Senbin-Portfolio/src/pages/Projects.tsx#L60-L67) 里引用了这个项目的 demo 链接。

我建议的**最佳方案**：**保持双仓库 + iframe 弹窗**。原因和实现如下：

### 为什么保持独立仓库？
- **项目边界清晰**：Raycasting 3D 引擎是一个完整的、有独立技术栈的项目（纯 JS/Canvas），和你个人网站（React + Vite + Tailwind）是不同的技术体系。
- **方便其他开发者直接 fork/学习**：作为个人作品展示，独立的 repo 更能体现"这是一个独立完成的技术作品"。
- **独立部署**：可以用 GitHub Pages 独立部署（已经在用 `senbinkang.github.io/raycasting`），升级不用动主站。

### 在个人网站里加"点击体验"弹窗（iframe）
**需要修改** [Projects.tsx](file:///Users/kangsenbin/Downloads/Kang-Senbin-Portfolio/src/pages/Projects.tsx)，给第 4 个项目（Raycasting）加一个"打开 Demo"按钮。方案建议：

1. **用现有的 Dialog 组件作为弹窗**：你项目里已经有 [dialog.tsx](file:///Users/kangsenbin/Downloads/Kang-Senbin-Portfolio/src/components/ui/dialog.tsx)（Radix UI 风格），直接复用它即可，不用新造轮子。
2. **在弹窗里嵌入 iframe**，src 指向 `https://senbinkang.github.io/raycasting/raycasting.html`。
3. **弹窗顶部加操作说明**：「按 W/S 移动，A/D 旋转；点击游戏画面启用鼠标视角」。
4. **处理键盘焦点问题**：iframe 内部有自己的键盘监听（WASD），所以需要 iframe `allow="fullscreen"`，并且在关闭弹窗时 `blur()` 防止按键残留。
5. **建议 raycasting 仓库加上自动暂停/静音开关**：给 iframe 发 postMessage，主站弹窗关闭时告诉 iframe 停止渲染以省 CPU。

### 最小改动的代码思路（Projects.tsx）

```tsx
// 为 projectData 的第 4 项加一个 showIframeDemo 字段
// 在 ProjectCard 内部，当 project.showIframeDemo 为 true 时，
// 把 demoUrl 的 <a> 按钮改为打开 Dialog 的 <button>

// ProjectCard 里新增逻辑（概念代码，需要你确认后我再动手实现）：
{project.showIframeDemo ? (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button className="inline-flex items-center gap-2 text-sm font-medium text-[#8b949e] hover:text-cyan transition-colors duration-300">
        <ExternalLink size={18} />
        <span>{t('projects_link_try_it')}</span>
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-4xl bg-[#0d1117] border-[#21262d] text-[#e6edf3]">
      <DialogHeader>
        <DialogTitle>Raycasting 3D 引擎 — 在线体验</DialogTitle>
        <p className="text-sm text-[#8b949e]">
          操作：W/S 前后移动，A/D 左右旋转；点击画面聚焦后可用鼠标
        </p>
      </DialogHeader>
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
        <iframe
          src={project.demoUrl}
          className="w-full h-full"
          allow="fullscreen; autoplay"
          sandbox="allow-same-origin allow-scripts allow-pointer-lock"
          title="Raycasting 3D Demo"
        />
      </div>
      <DialogClose />
    </DialogContent>
  </Dialog>
) : (
  // 原来的 <a href={project.demoUrl}>
)}
```

---

## 四、我的建议工作流

按这个顺序做，**每一步都能独立对外 demo**，不会陷入"做到一半无法展示"的尴尬：

1. **第 1 周**：修复鱼眼失真 + 重写 DDA + side 明暗 → 画面立刻变专业。
2. **第 2 周**：加纹理映射（砖墙贴图） + 天花板地面渐变 → 视觉升级为"Wolfenstein 级"。
3. **第 3 周**：工程化（TS + Vite + ESM）+ 添加 FPS 指示器 + 小地图 → 代码质量提升。
4. **第 4 周**：鼠标 Pointer Lock + 武器 HUD + iframe 弹窗集成到个人网站 → 完成闭环。
5. **后续可选**：Sprites、敌人、多关卡、音效、移动端。

---

## 五、接下来你希望我先做哪一步？

我可以立刻开始帮你动手实现：

**A. 先修复核心算法**（DDA 重写 + 鱼眼修正 + side 明暗差异）——让画面立刻变专业  
**B. 先做个人网站集成**（iframe 弹窗 + Dialog 组件改造）——让访客现在就能点进去玩  
**C. A + B 一起做**——从算法修复到工程化到个人网站集成，完整一条龙  

告诉我你想从哪一步开始，我直接写代码改。
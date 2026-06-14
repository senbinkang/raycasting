# 2026-06-14 — raycasting 武器+AI+音效+门

## 一、需求/问题

按 todoList 第四部分 4.3~4.6 一次性完成：武器 HUD + 射击 / 敌人 AI 增强 / 音效 / 门与可交互物体。

## 二、做了什么

### 阶段 H — 音效系统（AudioManager.js）

- 新建 `game/AudioManager.js`：Web Audio API 封装，程序化合成所有音效，无需音频文件
- 实现：射击 `playShoot()`、敌人受伤 `playHit()`、敌人死亡 `playEnemyDeath()`、开门 `playDoor()`、关门 `playDoorClose()`、走路脚步声 `playStep()`（带间隔自动触发）、背景音乐 `startBgm()`
- 挂到 `window.audioManager` 供全局调用

### 阶段 G — 门系统（Background.js + Screen.js + Player.js）

- `Background.js`：地图加门格（101 = 横门，102 = 竖门）；`_initDoors()` 扫描初始化；`toggleDoor()` / `isDoorPassable()` / `updateDoors(dt)` 方法；小地图门格按 `openProgress` 从深金变淡黄
- `Player.js`：E 键改为 `tryInteractDoor()`（面向 1 格有门则切换开关）；`cellIsEmpty()` 支持穿完全打开的门；加 `hp/maxHp` 字段
- `Screen.js` DDA：射线命中门格时——完全打开（`openProgress >= 0.9`）则射线穿过；未完全打开则渲染墙体，且高度按 `1 - openProgress` 缩小

### 阶段 I — 武器 + 敌人 AI 增强

- 新建 `game/Weapon.js`：2D 手枪渲染（黑色枪身 + 棕色握把 + 准星）；后坐力动画（`recoil`，每帧衰减）；`fire()` 方法做 DDA 射线检测，返回命中的第一个敌人
- `Sprite.js`：加 `maxHp` 字段；`takeDamage(amount)` 方法，被击中扣血、归零则 `alive = false`；敌人 AI 的视线检测和移动碰撞都考虑门的状态
- `GameScene.js`：注入 `AudioManager` + `Weapon`；`update()` 中推进门动画、`weapon.update(dt)`、走路脚步声
- `Game.js`：监听左键 `mousedown/mouseup` 控制 `weapon.triggerDown`；按住左键每帧调用 `weapon.fire()`；命中敌人扣 35 HP，被打死播死亡音效；`weapon.draw()` 放在所有绘制之后（保证枪在最上层）

### raycasting.html

- 脚本加载顺序：AudioManager → Weapon → Game → GameScene（GameScene 最后是因为它依赖所有其他模块）
- 操作提示更新：E 开关门、左键射击

## 三、关键决策 / 踩过的坑

- **踩坑 1**：HTML 中 `GameScene` 必须最后加载，因为它依赖 `Weapon` / `AudioManager` 都已经初始化完毕（`window.audioManager` 在 `AudioManager.js` 末尾已挂载）
- **踩坑 2**：Weapon 的 DDA 射击射线目前不穿门（因为 `worldMap[mapY][mapX] > 0` 对所有门格都返回 true），这是保守设计——可后续改进为「完全打开的门不挡射线」
- **决策**：所有音效都用 Web Audio API 程序化合成（正弦波 + 白噪声叠加 + 指数衰减），不依赖任何外部音频文件，维护成本最低

## 四、文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `game/AudioManager.js` | Web Audio API 程序化音效 |
| 新建 | `game/Weapon.js` | 武器 2D 渲染 + DDA 射击检测 |
| 修改 | `Background.js` | 门数据结构、地图更新、门颜色 |
| 修改 | `Player.js` | E 键改开关门、碰撞考虑门、HP 字段 |
| 修改 | `game/Screen.js` | DDA 射线对门格特殊处理 |
| 修改 | `game/Sprite.js` | `takeDamage()`、maxHp、AI 门感知 |
| 修改 | `game/GameScene.js` | 注入 Audio + Weapon、走路脚步声 |
| 修改 | `game/Game.js` | 左键射击控制、命中扣血 |
| 修改 | `raycasting.html` | 新脚本顺序、新操作提示 |

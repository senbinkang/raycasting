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

    update() {
        // 玩家的移动/旋转由按键回调直接驱动，无需集中 update 调度
        // 保留接口以便后续扩展（敌人 AI、物理、子弹等）
    }

    draw() {
        this.bg.draw()
        this.player.draw()
        this.screen.draw()
    }
}

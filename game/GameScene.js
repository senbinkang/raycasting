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
        // this.food = new Food(g, this.player)
    }
    effect() {
        let f = {
            x: this.food.p.x,
            y: this.food.p.y,
            color: this.food.color,
        }
        this.particleSystem = new ParticleSystem(this.game, f)
    }

    // 检测碰撞
    checkCollide() {
        // 检测是否撞到自己
        if (this.player.isEatSelf()) {
            this.game.gameOver()
        }

        // 检测是否吃到食物
        if (this.player.has(this.food.p)) {
            this.food.dead()
            // this.effect()
            this.player.addBody(this.food.p)
            this.food.create()
        }
    }

    update() {
        // if (!this.game.over) {
            // this.player.update()
            // this.checkCollide()
        // }
    }

    draw() {
        this.bg.draw()
        this.player.draw()
        // this.food.draw()
    }
}

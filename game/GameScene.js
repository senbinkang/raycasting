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
        // this.player.update()
        // this.screen.update()
    }

    draw() {
        this.bg.draw()
        this.player.draw()
        this.screen.draw()
    }
}

const __main = () => {
    let game = new Game()
    let scene = new GameScene(game)

    game.start(scene)
}

__main()
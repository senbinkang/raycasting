const __main = () => {
    let game = new Game()
    let scene = new GameScene(game)

    if (window.commentaryService) {
        window.commentaryService.initUI()
    }

    game.start(scene)
}

__main()
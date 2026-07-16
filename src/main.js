import './bootstrap.js'
import { Game } from './game/Game.js'
import { GameScene } from './game/GameScene.js'

const __main = () => {
    const game = new Game()
    const scene = new GameScene(game)

    if (window.commentaryService) {
        window.commentaryService.initUI()
    }

    game.start(scene)
}

__main()

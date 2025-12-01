// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract ChessWagerUSDC {
    enum GameState { Open, Started, Finished }
    struct Game {
        address player1;
        address player2;
        uint256 wager;
        GameState state;
        address winner;
    }

    IERC20 public usdc;
    mapping(uint256 => Game) public games;
    uint256 public nextGameId;

    event GameCreated(uint256 indexed gameId, address indexed player1, uint256 wager);
    event GameJoined(uint256 indexed gameId, address indexed player2);
    event GameFinished(uint256 indexed gameId, address indexed winner);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function createGame(uint256 wager) external returns (uint256 gameId) {
        require(wager > 0, "Wager must be > 0");
        // Player must approve this contract to spend USDC before calling
        require(usdc.transferFrom(msg.sender, address(this), wager), "USDC transfer failed");
        gameId = nextGameId++;
        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            wager: wager,
            state: GameState.Open,
            winner: address(0)
        });
        emit GameCreated(gameId, msg.sender, wager);
    }

    function joinGame(uint256 gameId) external {
        Game storage game = games[gameId];
        require(game.state == GameState.Open, "Game not open");
        require(msg.sender != game.player1, "Cannot join your own game");
        // Player must approve this contract to spend USDC before calling
        require(usdc.transferFrom(msg.sender, address(this), game.wager), "USDC transfer failed");
        game.player2 = msg.sender;
        game.state = GameState.Started;
        emit GameJoined(gameId, msg.sender);
    }

    // Only callable by backend/oracle for now (off-chain winner determination)
    function finishGame(uint256 gameId, address winner) external {
        Game storage game = games[gameId];
        require(game.state == GameState.Started, "Game not started");
        require(winner == game.player1 || winner == game.player2, "Invalid winner");
        game.state = GameState.Finished;
        game.winner = winner;
        require(usdc.transfer(winner, game.wager * 2), "USDC payout failed");
        emit GameFinished(gameId, winner);
    }
}
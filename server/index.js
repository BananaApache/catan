
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const games = {};

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    //~ Handle joining a lobby
    socket.on("joinLobby", ({playerName, roomId }) => {        
        socket.join(roomId);

        if (!games[roomId]) {
            games[roomId] = {
                roomId: roomId,
                players: {},
                gameState: null,
                playerOrder: [],
                currentTurn: null,
            };
        }

        const player = {
            playerId: socket.id,
            playerName: playerName || socket.id,
            playerResources: {
                wood: 0,
                brick: 0,
                sheep: 0,
                wheat: 0,
                stone: 0,
            },
            playerColor: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
            isTurn: false,
            settlements: [],
            cities: [],
            roads: [],
            victoryPoints: 0,
        };

        games[roomId].players[socket.id] = player;

        io.to(roomId).emit("updateLobby", games[roomId].players);

        console.log(games)
    })

    //~ Handle starting a game
    socket.on("startGame", ({ roomId }) => {
        io.to(roomId).emit("gameStart", { roomId } );
    });

    //~ Handle player ending their turn
    socket.on("updateBoard", ({ roomId, gameState }) => {
        console.log(`Updating board for room ${roomId}`, gameState);
        
        io.to(roomId).emit("boardUpdate", { gameState });
    });

    //~ update player list
    socket.on("updatePlayers", ({ roomId, players }) => {
        console.log(`Updating players for room ${roomId}`, players);
        
        games[roomId].players = players;

        io.to(roomId).emit("updatePlayers", { players: games[roomId].players });
    });

    //~ handle turns
    socket.on("updateTurn", ({ roomId, currentTurnId, players}) => {
        games[roomId].players = players;
        games[roomId].currentTurn = currentTurnId;

        io.to(roomId).emit('updatePlayers', { players });
        io.to(roomId).emit('updateTurn', { currentTurnId });
    })
    
    //~ clear dice roll log
    socket.on("clearDiceRoll", ({ roomId }) => {
        io.to(roomId).emit("clearDiceRoll");
    });

    //~ update initial turn
    socket.on("updateInitialTurn", ({ roomId, currentTurnId, players, initialTurnIndex}) => {
        games[roomId].players = players;
        games[roomId].currentTurn = currentTurnId;

        io.to(roomId).emit('updatePlayers', { players });
        io.to(roomId).emit('updateInitialTurn', { currentTurnId, initialTurnIndex });
    })

    //~ move robber
    socket.on("robber", ({ roomId, players }) => {
        games[roomId].players = players;

        io.to(roomId).emit("robber", { players });
    })

    //~ Getting player list
    socket.on("getPlayers", ({ roomId }) => {
        const playerIds = Object.keys(games[roomId].players);
        
        // Fisher-Yates shuffle
        for (let i = playerIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
        }
        
        games[roomId].playerOrder = playerIds;

        games[roomId].players[playerIds[0]].isTurn = true; // Set the first player in the shuffled list to have the turn

        const snakeOrder = [...playerIds, ...playerIds.slice().reverse()];

        console.log("sent", games[roomId].players, playerIds);
        
        io.to(roomId).emit("playersList", { players: games[roomId].players, playerOrder: playerIds, snakeOrder: snakeOrder });
    });

    //~ dice roll
    socket.on("rollDice", ({ roomId, diceRoll }) => {
        console.log(`Dice rolled in room ${roomId}:`, diceRoll);
        
        io.to(roomId).emit("rollDice", { diceRoll });
    });

    //~ Handle player disconnection
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

app.use(cors());

app.get("/", (req, res) => res.send("Catan server running"));

server.listen(4000, () => console.log("Server listening on http://localhost:4000"));

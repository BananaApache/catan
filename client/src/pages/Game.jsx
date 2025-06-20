import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../socket';

export default function Game() {
  const { id: roomId } = useParams();
  const [players, setPlayers] = useState({});
  const [currentTurnId, setCurrentTurnId] = useState(null);
  const [currentMode, setCurrentMode] = useState('settlement'); // 'settlement' or 'road'
  const [diceRoll, setDiceRoll] = useState("");
  const [isInitialPlacement, setIsInitialPlacement] = useState(true);
  const [initialTurnIndex, setInitialTurnIndex] = useState(0);
  const [showDiscardUI, setShowDiscardUI] = useState(false);
  const [discardRequired, setDiscardRequired] = useState(0);
  const [victoryPoints, setVictoryPoints] = useState(0);
  const [robberMovedThisTurn, setRobberMovedThisTurn] = useState(false);
  const [playersToStealFrom, setPlayersToStealFrom] = useState([]);
  const [showStealModal, setShowStealModal] = useState(false);
  const [showTradeUI, setShowTradeUI] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [myOffer, setMyOffer] = useState({});
  const [theirOffer, setTheirOffer] = useState({});
  const [iSubmitted, setISubmitted] = useState(false);
  const [theySubmitted, setTheySubmitted] = useState(false);
  const [incomingTrade, setIncomingTrade] = useState(null);
  const [gameState, setGameState] = useState({
    hexLayout: [],
    roads: new Set(),
    settlements: new Set(),
    cities: new Set()
  });
  const [discardedResources, setDiscardedResources] = useState({
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    stone: 0
  });

  const currentTurnIdRef = useRef('');
  const currentModeRef = useRef('settlement');
  const playersRef = useRef(players);
  const playerOrderRef = useRef([]);
  const gameStateRef = useRef(gameState);
  const setupTurnOrderRef = useRef([]);
  const initialTurnIndexRef = useRef(0);
  const isInitialPlacementRef = useRef(true);
  const diceRollRef = useRef("");
  const victoryPointsRef = useRef(0);
  const robberMovedRef = useRef(false);

  const hexRadius = 60;
  const centerX = 400;
  const centerY = 350;

  function addLog(message) {
    const logBox = document.getElementById('logs');
    if (!logBox) return;

    const entry = document.createElement('div');
    entry.textContent = `• ${message} (PERSONAL)`;
    logBox.appendChild(entry);

    // Scroll to the bottom
    logBox.scrollTop = logBox.scrollHeight;
  }
  function addGlobalLog(message) {
    console.log(`Global Log: ${message}`);
    socket.emit('globalLog', { roomId, message });
  }
  function addLogMessageToUI(message) {
    const logBox = document.getElementById('logs');
    if (!logBox) return;

    const entry = document.createElement('div');
    entry.textContent = `-> ${message} (GLOBAL)`;
    logBox.appendChild(entry);

    // Scroll to the bottom
    logBox.scrollTop = logBox.scrollHeight;
  }

  useEffect(() => {

    socket.emit("getPlayers", { roomId });

    socket.once('playersList', ({ players, playerOrder, snakeOrder }) => {
      setPlayers(players);
      playersRef.current = players;

      // console.log(snakeOrder)
      setupTurnOrderRef.current = snakeOrder;
      setInitialTurnIndex(0);
      initialTurnIndexRef.current = 0;
      setCurrentTurnId(snakeOrder[0]);
      currentTurnIdRef.current = snakeOrder[0];

      playerOrderRef.current = playerOrder;

      // console.log("Players in game:", players);
    });

    socket.on('rollDice', ({ diceRoll }) => {
      setDiceRoll(diceRoll);
      diceRollRef.current = diceRoll;

      addGlobalLog(`Player ${playersRef.current[currentTurnIdRef.current]?.playerName} rolled a ${diceRoll}`);
    });

    socket.on("tradeOfferFrom", ({ fromPlayerId, offer }) => {
      if (fromPlayerId === selectedPlayerId) {
        setTheirOffer(offer);
        setTheySubmitted(true);
      }
    });

    socket.on("receiveTradeOffer", ({ fromPlayerId, offer }) => {
      console.log("Received trade offer from", fromPlayerId, offer);
      setSelectedPlayerId(fromPlayerId);  // Set the sender as the selected trade partner
      setTheirOffer(offer);               // Show the sender's offer
      setTheySubmitted(true);             // Mark them as having submitted
      setShowTradeUI(true);
    });

    socket.on('globalLog', (message) => {
      addLogMessageToUI(message);
    });

    socket.on('stolenResource', ({ stolenResource, fromPlayerId }) => {
      console.log(`You stole "${stolenResource}" from Player ${playersRef.current[fromPlayerId]?.playerName}.`);
      addLog(`You stole "${stolenResource}" from Player ${playersRef.current[fromPlayerId]?.playerName}.`);
    })

    socket.on("updatePlayers", ({ players }) => {
      setPlayers(players);
      playersRef.current = players;

      // console.log("Updated players list:", players);
    });

    socket.on('updateTurn', ({ currentTurnId }) => {
      setCurrentTurnId(currentTurnId);
      currentTurnIdRef.current = currentTurnId;

      setDiceRoll("");
      diceRollRef.current = "";

      setRobberMovedThisTurn(false);
      robberMovedRef.current = false;
      
      // console.log("Current turn updated to:", currentTurnId);
      addGlobalLog(`It's now Player ${playersRef.current[currentTurnId]?.playerName}'s turn.`);
    });

    socket.on('updateInitialTurn', ({ currentTurnId, initialTurnIndex }) => {
      setCurrentTurnId(currentTurnId);
      currentTurnIdRef.current = currentTurnId;

      if (initialTurnIndex === -1) {
        setIsInitialPlacement(false);
        isInitialPlacementRef.current = false;
      }
      else {
        setInitialTurnIndex(initialTurnIndex);
        initialTurnIndexRef.current = initialTurnIndex;
        // console.log("Current turn updated to:", currentTurnId);
      }

      addGlobalLog(`It's now Player ${playersRef.current[currentTurnId]?.playerName}'s turn.`);
    });

    socket.on('robber', ({ players }) => {
      setPlayers(players);
      playersRef.current = players;

      const totalResources = Object.values(players[socket.id].playerResources).reduce((acc, i) => acc + i, 0);

      if (totalResources > 7) {
        const discardCount = Math.floor(totalResources / 2);

        setDiscardRequired(discardCount);
        setDiscardedResources({ wood: 0, brick: 0, sheep: 0, wheat: 0, stone: 0 });
        setShowDiscardUI(true);
      }

      // console.log("updated players:", players);
    })

    socket.on("tradeCompleted", () => {
      setShowTradeUI(false);
      setISubmitted(false);
      setTheySubmitted(false);
      setMyOffer({});
      setTheirOffer({});
      setSelectedPlayerId(null);
    });

    socket.on('boardUpdate', ({ gameState }) => {
      document.getElementById('road-layer').innerHTML = '';
      document.getElementById('settlement-layer').innerHTML = '';
      document.querySelectorAll('circle').forEach(circle => {circle.style.fill = '';});

      const roads = gameState.roads;
      roads.forEach(road => {
        const newRoad = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        newRoad.setAttribute('x1', road.tx1);
        newRoad.setAttribute('y1', road.ty1);
        newRoad.setAttribute('x2', road.tx2);
        newRoad.setAttribute('y2', road.ty2);
        newRoad.setAttribute('class', 'road');
        newRoad.setAttribute('data-edge-id', road.edgeId);
        newRoad.style.stroke = road.color;
        
        document.getElementById('road-layer').appendChild(newRoad);
      });

      const settlements = gameState.settlements;
      settlements.forEach(settlement => {
        const newSettlement = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        newSettlement.setAttribute('points', settlement.points);
        newSettlement.setAttribute('class', 'settlement');
        newSettlement.setAttribute('data-vertex-id', settlement.vertexId);
        newSettlement.style.fill = settlement.color;
        
        document.getElementById('settlement-layer').appendChild(newSettlement);
      });

      const cities = gameState.cities;
      cities.forEach(city => {
        const [x, y] = city.vertexId.split(',').map(Number);
        const size = 10;
        const cityPoints = [
          `${x - size},${y + size}`,
          `${x + size},${y + size}`,
          `${x + size},${y - size}`,
          `${x - size},${y - size}`
        ].join(' ');

        const newCity = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        newCity.setAttribute('x', x - size);
        newCity.setAttribute('y', y - size);
        newCity.setAttribute('width', size * 2);
        newCity.setAttribute('height', size * 2);
        newCity.setAttribute('class', 'city');
        newCity.setAttribute('data-vertex-id', city.vertexId);
        newCity.style.fill = city.color;
        document.getElementById('settlement-layer').appendChild(newCity);
      });

      const robber = gameState.robber;
      if (robber) {
        // console.log("Moving robber to hex:", robber);
        document.querySelector(`polygon[points="${robber.hexPoints}"]`).nextSibling.nextSibling.style.fill = 'gray';
      }

      setGameState(gameState);
      gameStateRef.current = gameState;

      // console.log("Board updated with new game state:", gameState);
    })

    // Game state
    currentModeRef.current = 'settlement';
    let settlements = new Set();
    let roads = new Set();

    // Board configuration
    const hexRadius = 60;
    const centerX = 400;
    const centerY = 350;

    // Catan board layout (19 hexes) - Classic 3-4-5-4-3 pattern
    const hexLayout = [
      // Row 1 (3 hexes) - Top row
      {q: 0, r: -2, type: 'wood', number: 11},
      {q: 1, r: -2, type: 'wheat', number: 12},
      {q: 2, r: -2, type: 'sheep', number: 9},
      
      // Row 2 (4 hexes)
      {q: -1, r: -1, type: 'brick', number: 4},
      {q: 0, r: -1, type: 'stone', number: 6},
      {q: 1, r: -1, type: 'wood', number: 5},
      {q: 2, r: -1, type: 'wheat', number: 10},
      
      // Row 3 (5 hexes) - Middle row
      {q: -2, r: 0, type: 'sheep', number: 9},
      {q: -1, r: 0, type: 'brick', number: 11},
      {q: 0, r: 0, type: 'desert'},
      {q: 1, r: 0, type: 'wood', number: 3},
      {q: 2, r: 0, type: 'stone', number: 8},
      
      // Row 4 (4 hexes)
      {q: -2, r: 1, type: 'sheep', number: 8},
      {q: -1, r: 1, type: 'wheat', number: 10},
      {q: 0, r: 1, type: 'brick', number: 5},
      {q: 1, r: 1, type: 'stone', number: 4},
      
      // Row 5 (3 hexes) - Bottom row
      {q: -2, r: 2, type: 'wheat', number: 6},
      {q: -1, r: 2, type: 'sheep', number: 2},
      {q: 0, r: 2, type: 'wood', number: 3}
    ];
    const updatedState = {
      ...gameStateRef.current,
      hexLayout: hexLayout,

    };

    setGameState(updatedState);
    gameStateRef.current = updatedState;

    // Convert axial coordinates to pixel coordinates (pointy-top hexagons)
    function axialToPixel(q, r) {
        const x = centerX + hexRadius * Math.sqrt(3) * (q + r/2);
        const y = centerY + hexRadius * (3/2) * r;
        return {x, y};
    }

    // Generate hexagon points (rotated 90 degrees - pointy top)
    function getHexPoints(centerX, centerY) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i + Math.PI / 2; // Add 90 degree rotation
            const x = centerX + hexRadius * Math.cos(angle);
            const y = centerY + hexRadius * Math.sin(angle);
            points.push(`${x},${y}`);
        }
        return points.join(' ');
    }

    // Get hex vertices (rotated 90 degrees - pointy top)
    function getHexVertices(centerX, centerY) {
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i + Math.PI / 2; // Add 90 degree rotation
            const x = centerX + hexRadius * Math.cos(angle);
            const y = centerY + hexRadius * Math.sin(angle);
            vertices.push({x, y, id: `${Math.round(x)},${Math.round(y)}`});
        }
        return vertices;
    }

    // Get hex edges
    function getHexEdges(centerX, centerY) {
        const vertices = getHexVertices(centerX, centerY);
        const edges = [];
        for (let i = 0; i < 6; i++) {
            const start = vertices[i];
            const end = vertices[(i + 1) % 6];
            const id = `${Math.round(start.x)},${Math.round(start.y)}-${Math.round(end.x)},${Math.round(end.y)}`;
            edges.push({start, end, id});
        }
        return edges;
    }

    // Initialize board
    function initBoard() {
      document.getElementById('hex-layer').innerHTML = '';
      document.getElementById('interaction-layer').innerHTML = '';
      document.getElementById('road-layer').innerHTML = '';
      document.getElementById('settlement-layer').innerHTML = '';

      const hexLayer = document.getElementById('hex-layer');
      const interactionLayer = document.getElementById('interaction-layer');
      const allVertices = new Map();
      const allEdges = new Map();

      // Create hexes
      hexLayout.forEach(hex => {
        const {x, y} = axialToPixel(hex.q, hex.r);
        
        // Create hex polygon with background color
        const hexElement = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        hexElement.setAttribute('points', getHexPoints(x, y));
        hexElement.setAttribute('class', 'hex');
        
        // Set background colors for each resource type
        const colors = {
            brick: '#CD853F',
            wood: '#228B22', 
            wheat: '#DAA520',
            stone: '#708090',
            sheep: '#9ACD32',
            desert: '#DEB887'
        };
        hexElement.setAttribute('fill', colors[hex.type] || '#4a7c59');
        hexLayer.appendChild(hexElement);

        // Add centered image for each hex type
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        const imageSize = 120;
        image.setAttribute('x', x - imageSize / 2);
        image.setAttribute('y', y - imageSize / 2);
        image.setAttribute('width', imageSize);
        image.setAttribute('height', imageSize);
        image.setAttribute('href', `/images/${hex.type}.png`);
        image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        hexLayer.appendChild(image);

        // Add number token for resource hexes
        if (hex.number) {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', x);
          circle.setAttribute('cy', y);
          circle.setAttribute('r', 18);
          circle.setAttribute('class', 'number-circle');
          circle.addEventListener('click', moveRobber);
          hexLayer.appendChild(circle);

          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', x);
          text.setAttribute('y', y);
          text.setAttribute('class', `number-text ${(hex.number === 6 || hex.number === 8) ? 'red-number' : ''}`);
          text.textContent = hex.number;
          hexLayer.appendChild(text);
        }

        // Collect vertices and edges
        const vertices = getHexVertices(x, y);
        const edges = getHexEdges(x, y);

        vertices.forEach(vertex => {
            allVertices.set(vertex.id, vertex);
        });

        edges.forEach(edge => {
            allEdges.set(edge.id, edge);
        });
      });

      // Create interactive vertex zones
      allVertices.forEach(vertex => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', vertex.x);
        circle.setAttribute('cy', vertex.y);
        circle.setAttribute('r', 13);
        circle.setAttribute('class', 'vertex-zone');
        circle.setAttribute('data-vertex-id', vertex.id);
        circle.addEventListener('click', handleVertexClick);
        interactionLayer.appendChild(circle);
      });

      // Create interactive edge zones
      allEdges.forEach(edge => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        
        const x1 = edge.start.x;
        const y1 = edge.start.y;
        const x2 = edge.end.x;
        const y2 = edge.end.y;

        const trim = 5; // how much to trim from each end

        // Calculate unit vector
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;

        // Apply trim
        const tx1 = x1 + ux * trim;
        const ty1 = y1 + uy * trim;
        const tx2 = x2 - ux * trim;
        const ty2 = y2 - uy * trim;

        line.setAttribute('x1', tx1);
        line.setAttribute('y1', ty1);
        line.setAttribute('x2', tx2);
        line.setAttribute('y2', ty2);
        line.setAttribute('class', 'edge-zone');
        line.setAttribute('data-edge-id', edge.id);
        line.addEventListener('click', handleEdgeClick);
        interactionLayer.appendChild(line);
      });
    }

    // Handle vertex clicks (settlements)
    function handleVertexClick(event) {
      if (isInitialPlacementRef.current) {
        placeFirstSettlement(event);
        return;
      }
      
      // Handle upgrading settlement to city
      if (currentModeRef.current === 'city') {
        const vertexId = event.target.getAttribute('data-vertex-id');
        const player = playersRef.current[socket.id];

        if (
          player.playerResources.wheat < 2 ||
          player.playerResources.stone < 3
        ) {
          // console.log("Not enough resources to upgrade to city.");
          return;``
        }

        const existingSettlement = (gameStateRef.current.settlements || []).find(
          s => s.vertexId === vertexId && s.playerId === socket.id
        );

        if (!existingSettlement) {
          // console.log("No owned settlement to upgrade at this vertex.");
          return;
        }

        // console.log("Upgrading settlement to city at vertex:", vertexId);

        // Remove existing settlement from DOM and list
        const settlementElem = document.querySelector(`[data-vertex-id="${vertexId}"].settlement`);
        if (settlementElem) settlementElem.remove();

        const [x, y] = vertexId.split(',').map(Number);
        const size = 10;
        const cityPoints = [
          `${x - size},${y + size}`,
          `${x + size},${y + size}`,
          `${x + size},${y - size}`,
          `${x - size},${y - size}`
        ].join(' ');

        const city = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        city.setAttribute('x', x - size);
        city.setAttribute('y', y - size);
        city.setAttribute('width', size * 2);
        city.setAttribute('height', size * 2);
        city.setAttribute('class', 'city');
        city.setAttribute('data-vertex-id', vertexId);
        city.style.fill = player.playerColor;

        document.getElementById('settlement-layer').appendChild(city);

        // Update state
        const updatedSettlements = gameStateRef.current.settlements.filter(s => s.vertexId !== vertexId);
        const newCity = {
          vertexId,
          color: player.playerColor,
          playerId: socket.id
        };

        const updatedState = {
          ...gameStateRef.current,
          settlements: updatedSettlements,
          cities: [...gameStateRef.current.cities, newCity]
        };
        setGameState(updatedState);
        gameStateRef.current = updatedState;

        const updatedPlayersState = {
          ...playersRef.current,
          [socket.id]: {
            ...player,
            playerResources: {
              ...player.playerResources,
              wheat: player.playerResources.wheat - 2,
              stone: player.playerResources.stone - 3
            },
            cities: [...(player.cities || []), newCity],
            settlements: (player.settlements || []).filter(s => s.vertexId !== vertexId),
            victoryPoints: (player.victoryPoints || 0) + 1
          }
        };
        setPlayers(updatedPlayersState);
        playersRef.current = updatedPlayersState;

        addGlobalLog(`Player ${player.playerName} upgraded a settlement to a city.`);

        return;
      }

      if (currentModeRef.current !== 'settlement') return;
      if (currentTurnIdRef.current !== socket.id) return; // Not current player's turn
      if (
        playersRef.current[socket.id].playerResources.wood < 1 || 
        playersRef.current[socket.id].playerResources.brick < 1 || 
        playersRef.current[socket.id].playerResources.sheep < 1 ||
        playersRef.current[socket.id].playerResources.wheat < 1
      ) return; // not enough to build

      
      const vertexId = event.target.getAttribute('data-vertex-id');
      if (settlements.has(vertexId)) return; // Already has settlement

      const [x, y] = vertexId.split(',').map(Number);

      // Check distance from all existing settlements (prevent too-close)
      const existingSettlements = Array.from(gameStateRef.current.settlements || []);
      const isTooClose = existingSettlements.some(settlement => {
        const [sx, sy] = settlement.vertexId.split(',').map(Number);
        const dx = sx - x;
        const dy = sy - y;
        const dist = Math.hypot(dx, dy);
        return dist < hexRadius * 1.1; // Must be more than 1 edge apart
      });

      if (isTooClose) {
        // console.log("Too close to another settlement.");
        return;
      }
      
      // Create settlement
      const settlement = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const size = 8;
      const points = [
          `${x},${y-size}`,      // Top
          `${x+size},${y+size}`, // Bottom right
          `${x-size},${y+size}`  // Bottom left
      ].join(' ');
      
      settlement.setAttribute('points', points);
      settlement.setAttribute('class', 'settlement');
      settlement.setAttribute('data-vertex-id', vertexId);
      settlement.style.fill = playersRef.current[socket.id].playerColor; // Use player's color
      
      // Add to settlement layer instead of main board
      document.getElementById('settlement-layer').appendChild(settlement);
      settlements.add(vertexId);

      const newSettlement = {
        points,
        vertexId,
        color: playersRef.current[socket.id].playerColor,
        playerId: socket.id
      };

      const updatedState = {
        ...gameStateRef.current,
        settlements: [...gameStateRef.current.settlements, newSettlement]
      };

      setGameState(updatedState);
      gameStateRef.current = updatedState;    

      const updatedPlayersState = {
        ...playersRef.current,
        [socket.id]: {
          ...playersRef.current[socket.id],
          playerResources: {
            ...playersRef.current[socket.id].playerResources,
            wood: playersRef.current[socket.id].playerResources.wood - 1,
            brick: playersRef.current[socket.id].playerResources.brick - 1,
            sheep: playersRef.current[socket.id].playerResources.sheep - 1,
            wheat: playersRef.current[socket.id].playerResources.wheat - 1
          },
          settlements: [...(playersRef.current[socket.id].settlements || []), newSettlement],
          victoryPoints: (playersRef.current[socket.id].victoryPoints || 0) + 1
        }
      };

      setPlayers(updatedPlayersState);
      playersRef.current = updatedPlayersState;

      addGlobalLog(`Player ${playersRef.current[socket.id].playerName} placed a settlement.`);
    }

    // Handle edge clicks (roads)
    function handleEdgeClick(event) {
      if (isInitialPlacementRef.current) {
        placeFirstRoad(event);
        return;
      }
      if (currentModeRef.current !== 'road') return
      if (currentTurnIdRef.current !== socket.id) return // Not current player's turn
      if (
        playersRef.current[socket.id].playerResources.wood < 1 || 
        playersRef.current[socket.id].playerResources.brick < 1
      ) return // not enough to build

      const edgeId = event.target.getAttribute('data-edge-id');
      if (roads.has(edgeId)) return; // Already has road

      const [start, end] = edgeId.split('-');

      const ownsBuildingConnected = (gameStateRef.current.settlements || [])
      .concat(gameStateRef.current.cities || [])
      .some(building =>
        building.playerId === socket.id &&
        (building.vertexId === start || building.vertexId === end)
      );

      const ownsRoadConnected = (gameStateRef.current.roads || [])
      .some(road => {
        if (road.playerId !== socket.id) return false;
        const [roadStart, roadEnd] = road.edgeId.split('-');
        return (
          roadStart === start ||
          roadStart === end ||
          roadEnd === start ||
          roadEnd === end
        );
      });

      if (!ownsBuildingConnected && !ownsRoadConnected) {
        // console.log("Edge is not connected to your own building or road.");
        return;
      }

      const [x1, y1] = start.split(',').map(Number);
      const [x2, y2] = end.split(',').map(Number);

      const trim = 5; // how much to trim from each end

      // Calculate unit vector
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;

      // Apply trim
      const tx1 = x1 + ux * trim;
      const ty1 = y1 + uy * trim;
      const tx2 = x2 - ux * trim;
      const ty2 = y2 - uy * trim;
      
      // Create road
      const road = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      road.setAttribute('x1', tx1);
      road.setAttribute('y1', ty1);
      road.setAttribute('x2', tx2);
      road.setAttribute('y2', ty2);
      road.setAttribute('class', 'road');
      road.setAttribute('data-edge-id', edgeId);
      road.style.stroke = playersRef.current[socket.id].playerColor; // Use player's color
      
      // Add to road layer instead of main board
      document.getElementById('road-layer').appendChild(road);
      roads.add(edgeId);

      const newRoad = {
        tx1, ty1, tx2, ty2, edgeId,
        color: playersRef.current[socket.id].playerColor,
        playerId: socket.id
      };

      const updatedState = {
        ...gameStateRef.current,
        roads: [...gameStateRef.current.roads, newRoad]
      };

      setGameState(updatedState);
      gameStateRef.current = updatedState;

      const updatedPlayersState = {
        ...playersRef.current,
        [socket.id]: {
          ...playersRef.current[socket.id],
          playerResources: {
            ...playersRef.current[socket.id].playerResources,
            wood: playersRef.current[socket.id].playerResources.wood - 1,
            brick: playersRef.current[socket.id].playerResources.brick - 1
          },
          roads: [...(playersRef.current[socket.id].roads || []), newRoad]
        }
      };

      setPlayers(updatedPlayersState);
      playersRef.current = updatedPlayersState;

      checkForLongestRoad(socket.id);

      addGlobalLog(`Player ${playersRef.current[socket.id].playerName} placed a road.`);
    }

    function checkForLongestRoad(playerId) {
      const roads = (gameStateRef.current.roads || []).filter(r => r.playerId === playerId);
      const settlements = gameStateRef.current.settlements || [];
      const blockedVertices = new Set(
        settlements.filter(s => s.playerId !== playerId).map(s => s.vertexId)
      );

      const graph = {};

      roads.forEach(road => {
        const [v1, v2] = road.edgeId.split('-');
        if (!graph[v1]) graph[v1] = [];
        if (!graph[v2]) graph[v2] = [];
        graph[v1].push(v2);
        graph[v2].push(v1);
      });

      function dfs(current, visitedEdges, blocked) {
        let maxLen = 0;
        const neighbors = graph[current] || [];

        for (let next of neighbors) {
          const edgeId = current < next ? `${current}-${next}` : `${next}-${current}`;
          if (visitedEdges.has(edgeId)) continue;
          if (blocked.has(next)) continue;

          visitedEdges.add(edgeId);
          const len = 1 + dfs(next, visitedEdges, blocked);
          maxLen = Math.max(maxLen, len);
          visitedEdges.delete(edgeId);
        }

        return maxLen;
      }

      let longest = 0;
      Object.keys(graph).forEach(vertex => {
        if (blockedVertices.has(vertex)) return;
        const len = dfs(vertex, new Set(), blockedVertices);
        longest = Math.max(longest, len);
      });

      playersRef.current[playerId].longestRoadLength = longest;

      // Check if this is the new longest
      let currentLeaderId = null;
      let maxRoad = 5; // You need at least 5 to get Longest Road
      for (const [id, p] of Object.entries(playersRef.current)) {
        if (p.longestRoadLength > maxRoad) {
          maxRoad = p.longestRoadLength;
          currentLeaderId = id;
        }
      }

      // Update hasLongestRoad
      for (const id of Object.keys(playersRef.current)) {
        playersRef.current[id].hasLongestRoad = (id === currentLeaderId);
      }

      setPlayers({ ...playersRef.current });
      socket.emit("updatePlayers", { roomId, players: playersRef.current });

      addGlobalLog(`Longest Road is now ${playersRef.current[currentLeaderId]?.playerName} with ${maxRoad} segments.`);
    }

    // move robber
    function moveRobber(event) {
      if (currentTurnIdRef.current !== socket.id) return; // Not current player's turn
      if (diceRollRef.current !== 7) return; // Only allow on dice roll or 7
      if (robberMovedRef.current) return; // Robber already moved this turn

      setRobberMovedThisTurn(true);
      robberMovedRef.current = true;

      const robberCircle = event.target;
      const hex = event.target.previousSibling.previousElementSibling;

      if (!hex || !hex.getAttribute('points')) return;

      // console.log(hex);
      const hexPoints = hex.getAttribute('points');
      const hexPointsArray = hexPoints.split(' ').map(p => p.split(',').map(n => Math.round(Number(n))));

      // console.log(hexPoints);

      const updatedGameState = {
        ...gameStateRef.current,
        robber: {
          hexPoints: hexPoints,
          movedBy: socket.id
        }
      };
      setGameState(updatedGameState);
      gameStateRef.current = updatedGameState;

      const touchingPlayers = [];

      console.log("Hex vertices:", hexPointsArray);

      const buildings = [
        ...(gameStateRef.current.settlements || []),
        ...(gameStateRef.current.cities || [])
      ];

      console.log("Buildings on board:", buildings);

      hexPointsArray.forEach(vertex => {
        const vx = vertex[0];
        const vy = vertex[1];
        const key = `${vx},${vy}`;

        buildings.forEach(building => {
          if (building.vertexId === key) {
            if (!touchingPlayers.includes(building.playerId) && building.playerId !== socket.id) {
              touchingPlayers.push(building.playerId);
            }
          }
        });
      });

      setPlayersToStealFrom(touchingPlayers);
      setShowStealModal(true);

      console.log("Touching buildings:", touchingPlayers);

      socket.emit('moveRobber', { roomId, hexPoints: hexPoints, gameState: gameStateRef.current });
    }

    // Initialize the board
    initBoard();

    return () => {
      socket.off('boardUpdate');
      socket.off('playersList');
      socket.off('updatePlayers');
      socket.off('updateTurn');
      socket.off('updateInitialTurn');
      socket.off('rollDice');
      socket.off('robber');  
      socket.off('globalLog');
      socket.off('stolenResource');
      socket.off("tradeOfferFrom");
      socket.off("receiveTradeOffer")
      socket.off("tradeCompleted");
    }
  }, []);

  // Convert axial coordinates to pixel coordinates (pointy-top hexagons)
  function axialToPixel(q, r) {
      const x = centerX + hexRadius * Math.sqrt(3) * (q + r/2);
      const y = centerY + hexRadius * (3/2) * r;
      return {x, y};
  }

  // Get hex vertices (rotated 90 degrees - pointy top)
  function getHexVertices(centerX, centerY) {
      const vertices = [];
      for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i + Math.PI / 2; // Add 90 degree rotation
          const x = centerX + hexRadius * Math.cos(angle);
          const y = centerY + hexRadius * Math.sin(angle);
          vertices.push({x, y, id: `${Math.round(x)},${Math.round(y)}`});
      }
      return vertices;
  }

  function updateBoard() {
    const serializableGameState = {
      hexLayout: gameStateRef.current.hexLayout.map(hex => ({ ...hex })),
      roads: Array.from(gameStateRef.current.roads),
      settlements: Array.from(gameStateRef.current.settlements),
      cities: Array.from(gameStateRef.current.cities),
      robber: gameStateRef.current.robber ? { ...gameStateRef.current.robber } : null
    };

    socket.emit('updateBoard', { roomId, gameState: serializableGameState });

    // console.log("New board updated:", gameStateRef.current);

    if (isInitialPlacement) { // still in initial placement phase
      const nextIndex = initialTurnIndexRef.current + 1;

      if (nextIndex >= setupTurnOrderRef.current.length) { // at the very end of snake order
        // Done with initial placement
        setIsInitialPlacement(false);
        const firstNormalPlayer = playerOrderRef.current[0];
        setCurrentTurnId(firstNormalPlayer);
        currentTurnIdRef.current = firstNormalPlayer;
        socket.emit('updateTurn', { roomId, currentTurnId: firstNormalPlayer, players: playersRef.current });

        //~ add all resources to players
        // console.log("Game State:", gameStateRef.current);
        const settlementsArray = gameStateRef.current.settlements || [];
        // console.log("Settlements on board:", settlementsArray);

        settlementsArray.forEach(settlement => {
          const vertexId = settlement.vertexId;
          const playerColor = settlement.color;

          const touchingHexes = [];

          // console.log(gameStateRef.current);

          gameStateRef.current.hexLayout?.forEach(hex => {
            const { x: cx, y: cy } = axialToPixel(hex.q, hex.r);
            const vertices = getHexVertices(cx, cy);

            for (let vertex of vertices) {
              const vertexKey = `${Math.round(vertex.x)},${Math.round(vertex.y)}`;
              if (vertexKey === vertexId) {
                touchingHexes.push(hex);
                break;
              }
            }
          });

          // console.log(touchingHexes)

          touchingHexes.forEach(hex => {
            // Find playerId by color
            const playerId = Object.keys(playersRef.current).find(
              id => playersRef.current[id].playerColor === playerColor
            );

            if (playerId) {
              // Update the resources for the correct player
              playersRef.current[playerId].playerResources[hex.type] += 1;

              // console.log(hex.type, "gained by player", playerId);
            }
          });
        });

        setPlayers({...playersRef.current});

        // console.log(playersRef.current);

        socket.emit('updatePlayers', { roomId, players: playersRef.current });
        socket.emit('updateInitialTurn', { roomId, currentTurnId: firstNormalPlayer, players: playersRef.current, initialTurnIndex: -1 });

      } else { // still in initial placement
        const nextPlayerId = setupTurnOrderRef.current[nextIndex];
        // console.log("DEBUG");
        // console.log("nextIndex", nextIndex);
        // console.log("setupTurnOrderRef", setupTurnOrderRef.current);
        // console.log("nextPlayerId", nextPlayerId);
        setInitialTurnIndex(nextIndex);
        initialTurnIndexRef.current = nextIndex;
        setCurrentTurnId(nextPlayerId);
        currentTurnIdRef.current = nextPlayerId;
        socket.emit('updatePlayers', { roomId, players: playersRef.current });
        socket.emit('updateInitialTurn', { roomId, currentTurnId: nextPlayerId, players: playersRef.current, initialTurnIndex: nextIndex });
      }
    } 
    else { // normal phase
      // console.log("Normal turn order, moving to next player");
      
      nextTurn(); 
    }

    document.querySelector('#settlement-btn').classList.add('active');
    document.querySelector('#road-btn').classList.remove('active');
    currentModeRef.current = 'settlement';
    setCurrentMode('settlement');

    setDiceRoll("");
    diceRollRef.current = "";
  }

  function nextTurn() {
    const playerIds = playerOrderRef.current;
    const currentPlayerIndex = playerIds.indexOf(socket.id);
    const nextPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
    const nextPlayerId = playerIds[nextPlayerIndex];

    // Reset all players' isTurn state
    Object.values(playersRef.current).forEach(player => {
      player.isTurn = false;
    });

    // Set the next player to have the turn
    playersRef.current[nextPlayerId].isTurn = true;

    setCurrentTurnId(nextPlayerId);
    currentTurnIdRef.current = nextPlayerId;

    socket.emit('updateTurn', { roomId, currentTurnId: nextPlayerId, players: playersRef.current });
  }

  function rollDice() {
    if (currentTurnIdRef.current !== socket.id) return; // Not current player's turn

    // document.querySelector("#dice-btn").remove() // Disable button after rolling (for debugging purposes)

    const myDiceRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1; // Roll two dice

    // console.log("Dice rolled:", myDiceRoll);

    if (myDiceRoll === 7) {
      // console.log("Rolled a 7! Moving the robber.");

      socket.emit('robber', { roomId, players: playersRef.current });
    }
    
    const settlementsArray = gameStateRef.current.settlements || [];
    const citiesArray = gameStateRef.current.cities || [];

    const allBuildings = [
      ...settlementsArray.map(s => ({ ...s, type: 'settlement' })),
      ...citiesArray.map(c => ({ ...c, type: 'city' }))
    ];

    // Create a copy of current player's resources to modify
    const updatedResources = { ...playersRef.current[socket.id].playerResources };
    // console.log("Resource gains before rolling:", updatedResources);

    allBuildings.forEach(building => {
      const vertexId = building.vertexId;
      const playerColor = building.color;
      const touchingHexes = [];

      gameState.hexLayout?.forEach(hex => {
        const { x: cx, y: cy } = axialToPixel(hex.q, hex.r);
        const vertices = getHexVertices(cx, cy);

        for (let vertex of vertices) {
          const vertexKey = `${Math.round(vertex.x)},${Math.round(vertex.y)}`;
          if (vertexKey === vertexId) {
            touchingHexes.push(hex);
            break;
          }
        }
      });

      touchingHexes.forEach(hex => {
        if (hex.number === myDiceRoll && hex.type !== 'desert') {
          // console.log(`${building.type} matched hex:`, hex);

          const playerId = Object.keys(playersRef.current).find(
            id => playersRef.current[id].playerColor === playerColor
          );

          if (playerId) {
            const gain = building.type === 'city' ? 2 : 1;
            playersRef.current[playerId].playerResources[hex.type] += gain;

            // console.log(`${hex.type} +${gain} to player ${playerId}`);
          }
        }
      });
    });

    // Update React state
    setPlayers({...playersRef.current});
    setDiceRoll(myDiceRoll);
    diceRollRef.current = myDiceRoll;

    // Send updated players to server
    socket.emit('updatePlayers', { roomId, players: playersRef.current });
    socket.emit('rollDice', { roomId, diceRoll: myDiceRoll });
  }

  const settlements = new Set();
  const roads = new Set();

  function placeFirstSettlement(event) {
    if (initialTurnIndexRef.current < Object.keys(playersRef.current).length && playersRef.current[socket.id].settlements?.length === 1) return; // Already placed first settlement DURING FIRST SNAKE
    if (initialTurnIndexRef.current >= Object.keys(playersRef.current).length && playersRef.current[socket.id].settlements?.length === 2) return; // Already placed first settlement DURING SECOND SNAKE
    if (currentModeRef.current !== 'settlement') return;
    if (currentTurnIdRef.current !== socket.id) return; // Not current player's turn

    const vertexId = event.target.getAttribute('data-vertex-id');
    if (settlements.has(vertexId)) return; // Already has settlement

    const [x, y] = vertexId.split(',').map(Number);

    // Check distance from all existing settlements (prevent too-close)
    const existingSettlements = Array.from(gameStateRef.current.settlements || []);
    const isTooClose = existingSettlements.some(settlement => {
      const [sx, sy] = settlement.vertexId.split(',').map(Number);
      const dx = sx - x;
      const dy = sy - y;
      const dist = Math.hypot(dx, dy);
      return dist < hexRadius * 1.1; // Must be more than 1 edge apart
    });

    if (isTooClose) {
      // console.log("Too close to another settlement.");
      return;
    }
    
    // Create settlement
    const settlement = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const size = 8;
    const points = [
        `${x},${y-size}`,      // Top
        `${x+size},${y+size}`, // Bottom right
        `${x-size},${y+size}`  // Bottom left
    ].join(' ');
    
    settlement.setAttribute('points', points);
    settlement.setAttribute('class', 'settlement');
    settlement.setAttribute('data-vertex-id', vertexId);
    settlement.style.fill = playersRef.current[socket.id].playerColor; // Use player's color
    
    // Add to settlement layer instead of main board
    document.getElementById('settlement-layer').appendChild(settlement);
    settlements.add(vertexId);

    const newSettlement = {
      points,
      vertexId,
      color: playersRef.current[socket.id].playerColor,
      playerId: socket.id
    };

    const updatedGameState = {
      ...gameStateRef.current,
      settlements: [...gameStateRef.current.settlements, newSettlement]
    };

    setGameState(updatedGameState);
    gameStateRef.current = updatedGameState;    

    const updatedPlayersState = {
      ...playersRef.current,
      [socket.id]: {
        ...playersRef.current[socket.id],
        settlements: [...(playersRef.current[socket.id].settlements || []), newSettlement],
        victoryPoints: (playersRef.current[socket.id].victoryPoints || 0) + 1
      }
    };

    setPlayers(updatedPlayersState);
    playersRef.current = updatedPlayersState;

    addGlobalLog(`Player ${playersRef.current[socket.id].playerName} placed a settlement.`);
  }

  function placeFirstRoad(event) {
    if (initialTurnIndexRef.current < Object.keys(playersRef.current).length && playersRef.current[socket.id].roads?.length === 1) return; // Already placed first road DURING FIRST SNAKE
    if (initialTurnIndexRef.current >= Object.keys(playersRef.current).length && playersRef.current[socket.id].roads?.length === 2) return; // Already placed first road DURING SECOND SNAKE
    if (currentModeRef.current !== 'road') return;
    if (currentTurnIdRef.current !== socket.id) return; // Not current player's turn
    if (settlements.size === 0) return; // Can't place roads without settlements

    const edgeId = event.target.getAttribute('data-edge-id');
    if (roads.has(edgeId)) return; // Already has road

    const [start, end] = edgeId.split('-');

    const ownsBuildingConnected = (gameStateRef.current.settlements || [])
    .concat(Array.from(gameStateRef.current.cities || []))
    .some(building =>
      building.playerId === socket.id &&
      (building.vertexId === start || building.vertexId === end)
    );

    const ownsRoadConnected = (Array.from(gameStateRef.current.roads || []))
    .some(road => {
      if (road.playerId !== socket.id) return false;
      const [roadStart, roadEnd] = road.edgeId.split('-');
      return (
        roadStart === start ||
        roadStart === end ||
        roadEnd === start ||
        roadEnd === end
      );
    });

    if (!ownsBuildingConnected && !ownsRoadConnected) {
      // console.log("Edge is not connected to your own building or road.");
      return;
    }

    const [x1, y1] = start.split(',').map(Number);
    const [x2, y2] = end.split(',').map(Number);

    const trim = 5; // how much to trim from each end

    // Calculate unit vector
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;

    // Apply trim
    const tx1 = x1 + ux * trim;
    const ty1 = y1 + uy * trim;
    const tx2 = x2 - ux * trim;
    const ty2 = y2 - uy * trim;
    
    // Create road
    const road = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    road.setAttribute('x1', tx1);
    road.setAttribute('y1', ty1);
    road.setAttribute('x2', tx2);
    road.setAttribute('y2', ty2);
    road.setAttribute('class', 'road');
    road.setAttribute('data-edge-id', edgeId);
    road.style.stroke = playersRef.current[socket.id].playerColor; // Use player's color
    
    // Add to road layer instead of main board
    document.getElementById('road-layer').appendChild(road);
    roads.add(edgeId);

    const newRoad = {
      tx1, ty1, tx2, ty2, edgeId,
      color: playersRef.current[socket.id].playerColor,
      playerId: socket.id
    };

    const updatedGameState = {
      ...gameStateRef.current,
      roads: [...gameStateRef.current.roads, newRoad]
    };

    setGameState(updatedGameState);
    gameStateRef.current = updatedGameState;

    const updatedPlayersState = {
      ...playersRef.current,
      [socket.id]: {
        ...playersRef.current[socket.id],
        roads: [...(playersRef.current[socket.id].roads || []), newRoad]
      }
    };

    setPlayers(updatedPlayersState);
    playersRef.current = updatedPlayersState;

    addGlobalLog(`Player ${playersRef.current[socket.id].playerName} placed a road.`);
  }

  function updateDiscard(resource, delta) {
    setDiscardedResources(prev => ({
      ...prev,
      [resource]: Math.max(0, prev[resource] + delta)
    }));
  }

  function submitDiscard() {
    // console.log("Submitting discarded resources:", discardedResources);

    const updatedResources = { ...players[socket.id].playerResources };
    Object.keys(discardedResources).forEach(resource => {
      updatedResources[resource] -= discardedResources[resource];
    });

    setPlayers(prev => ({
      ...prev,
      [socket.id]: {
        ...prev[socket.id],
        playerResources: updatedResources
      }
    }));
    playersRef.current[socket.id].playerResources = updatedResources;

    socket.emit('updatePlayers', { roomId, players: playersRef.current });

    setShowDiscardUI(false);

    addGlobalLog(`Player ${players[socket.id].playerName} discarded resources: ${JSON.stringify(discardedResources)}`);
  }

  function robPlayer(targetPlayerId) {
    setShowStealModal(false);

    socket.emit('robPlayer', {
      roomId,
      fromPlayerId: targetPlayerId,
      toPlayerId: socket.id
    });

    addGlobalLog(`Player ${players[socket.id].playerName} stole a resource from ${players[targetPlayerId].playerName}.`);
  }

  function trade(playerId) {
    setSelectedPlayerId(playerId);
    setShowTradeUI(true);
    document.querySelector('#trade-players').classList.remove('show');
  }

  function canAffordTrade(offer, resources) {
    return Object.entries(offer).every(([res, amt]) => (resources[res] || 0) >= amt);
  }

  return (
    <>
    <style>
      {`
        #logs {
          width: 300px;
          height: 100px;
          overflow-y: auto;
          border: 1px solid #ccc;
          padding: 5px;
          font-size: 12px;
          background-color: #f9f9f9;
          white-space: pre-wrap;
        }
        
        .show {
          display: block !important;
        }

        #trade-players {
          display: none;
        }

        /* Hex tiles */
        .hex {
            stroke: #333;
            stroke-width: 2;
        }

        /* Interactive elements */
        .vertex-zone {
            fill: rgba(255, 255, 255, 0.1);
            stroke: none;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .vertex-zone:hover {
            opacity: 1;
            fill: rgba(255, 255, 255, 0.3);
        }

        .edge-zone {
            stroke: rgba(255, 255, 255, 0.1);
            stroke-width: 8;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .edge-zone:hover {
            opacity: 1;
            stroke: rgba(255, 255, 255, 0.5);
        }

        /* Placed pieces */
        .settlement {
            /* fill: #FF6347; */
            stroke: black;
            stroke-width: 2;
        }

        .city {
          stroke: black;
          stroke-width: 2;
          fill-opacity: 1;
        }

        .road {
            stroke: #8B4513;
            stroke-width: 6;
            stroke-linecap: round;
        }

        /* Numbers */
        .number-circle {
            fill: #FFF;
            stroke: #000;
            stroke-width: 2;
            cursor: pointer;
        }

        .number-text {
            fill: #000;
            font-size: 16px;
            font-weight: bold;
            text-anchor: middle;
            dominant-baseline: central;
        }

        .red-number {
            fill: #FF0000;
        }

        button:hover {
            background: #A0522D;
        }

        button.active {
            background: #FF6347;
        }

        #info {
            color: white;
            margin-top: 10px;
            font-size: 18px;
        }
      `}
    </style>

    <h1>Game ID: {roomId}</h1>

    <h2>Players:</h2>
    <ul>
      {Array.from(playerOrderRef.current).map(player => (
        <li key={players[player]?.playerId}>
          {players[player]?.playerName} <span style={{ color: players[player]?.playerColor }}>●</span> { currentTurnId === player ? '(Current Turn)' : '' }
        </li>
      ))}
    </ul>

    <h2>You</h2>
    <p>Name: {players[socket.id]?.playerName || "Loading..."}  <span style={{ color: players[socket.id]?.playerColor }}>●</span></p>
    <p>Player ID: { socket.id }</p>
    <p>Resources: </p>
    {
      players[socket.id] ?
      <>
        <ul>
          <li>wood: {players[socket.id].playerResources.wood}</li>
          <li>brick: {players[socket.id].playerResources.brick}</li>
          <li>sheep: {players[socket.id].playerResources.sheep}</li>
          <li>wheat: {players[socket.id].playerResources.wheat}</li>
          <li>stone: {players[socket.id].playerResources.stone}</li>
        </ul>
        <p>Total Resources: { Object.values(players[socket.id].playerResources).reduce( (acc, i) => acc + i, 0 ) }</p>
      </>
      :
      <>
        <ul>
          <li>wood: 0</li>
          <li>brick: 0</li>
          <li>sheep: 0</li>
          <li>wheat: 0</li>
          <li>stone: 0</li>
        </ul>
        <p>Total Resources: 0</p>
      </>
    }
    <p>Victory Points: { players[socket.id]?.victoryPoints }</p>
    { diceRoll !== "" && players[currentTurnId]?.playerName && (
      <span id="dice-roll">Player {players[currentTurnId]?.playerName} rolled a {diceRoll}</span>
    )
    }

    <p id="logs"></p>

    {showDiscardUI && (
      <div className="modal">
        <h3>Discard {discardRequired} Resources</h3>
        <ul>
          {Object.keys(discardedResources).map(resource => (
            <li key={resource}>
              {resource}: {players[socket.id].playerResources[resource]} &nbsp;
              <button onClick={() => updateDiscard(resource, -1)} disabled={discardedResources[resource] === 0}>-</button>
              {discardedResources[resource]}
              <button onClick={() => updateDiscard(resource, 1)} disabled={discardedResources[resource] >= players[socket.id].playerResources[resource]}>+</button>
            </li>
          ))}
        </ul>
        <p>Total selected: {Object.values(discardedResources).reduce((a, b) => a + b, 0)} / {discardRequired}</p>
        <button
          onClick={submitDiscard}
          disabled={Object.values(discardedResources).reduce((a, b) => a + b, 0) !== discardRequired}
        >
          Submit Discard
        </button>
      </div>
    )}

    {showStealModal && (
      <div className="steal-modal">
        <h3>Select a player to steal from:</h3>
        {playersToStealFrom.map(playerId => (
          <button
            key={playerId}
            onClick={() => robPlayer(playerId)}
          >
            {players[playerId]?.playerName || 'Unknown Player'}
          </button>
        ))}
      </div>
    )}

    {showTradeUI && (
      <div style={{ border: '1px solid #ccc', padding: '16px', background: '#f0f0f0', width: '300px', marginTop: '20px' }}>
        <h3>Trade With: {players[selectedPlayerId]?.playerName || selectedPlayerId}</h3>

        <div style={{ marginBottom: '10px' }}>
          <strong>Your Offer:</strong>
          {['wood', 'brick', 'sheep', 'wheat', 'stone'].map(resource => (
            <div key={resource}>
              {resource}:{' '}
              <input
                type="number"
                min="0"
                style={{ width: '50px' }}
                value={myOffer[resource] || 0}
                onChange={(e) =>
                  setMyOffer(prev => ({ ...prev, [resource]: Math.max(0, parseInt(e.target.value) || 0) }))
                }
              />
            </div>
          ))}
          {!iSubmitted && (
            <button disabled={!canAffordTrade(myOffer, players[socket.id]?.playerResources || {}) || Object.values(myOffer).every(val => val === 0 || !val)} onClick={() => {
              socket.emit("tradeOfferTo", { toPlayerId: selectedPlayerId, offer: myOffer });
              setISubmitted(true);
            }}>
              Submit Offer
            </button>
          )}
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>Their Offer:</strong>
          {['wood', 'brick', 'sheep', 'wheat', 'stone'].map(resource => (
            <div key={resource}>
              {resource}: {theirOffer[resource] || 0}
            </div>
          ))}
        </div>

        <button
          disabled={!(iSubmitted && theySubmitted)}
          onClick={() => {
            socket.emit("finalizeTrade", {
              fromPlayerId: socket.id,
              toPlayerId: selectedPlayerId,
              offerA: myOffer,
              offerB: theirOffer,
              roomId
            });
            setISubmitted(false);
            setTheySubmitted(false);
            setShowTradeUI(false);
            setMyOffer({});
            setTheirOffer({});
          }}
        >
          Confirm Trade
        </button>
      </div>
    )}

    <svg id="board" width="800" height="700" viewBox="0 0 800 700">
        <defs></defs>
        <g id="hex-layer"></g>
        <g id="interaction-layer"></g>
        <g id="road-layer"></g>
        <g id="settlement-layer"></g>
    </svg>

    <div id="trade-players">
      <p>Trade with Other Players</p>
        {Object.keys(players).filter(id => id !== socket.id).map(playerId => (
          <li key={playerId}>
            {players[playerId].playerName} <span style={{ color: players[playerId].playerColor }}>●</span>
            <button onClick={() => trade(playerId)}>Trade</button>
          </li>
        ))}
    </div>

    { currentTurnIdRef.current === socket.id && (
      <div id="controls">
        {isInitialPlacement ? 
          (<>
            <button id="settlement-btn" className={currentMode === 'settlement' ? 'active' : ''} onClick={() => { currentModeRef.current = 'settlement'; setCurrentMode('settlement'); }}>Place Settlement</button>
            <button id="road-btn" className={currentMode === 'road' ? 'active' : ''} onClick={() => { currentModeRef.current = 'road'; setCurrentMode('road'); }}>Place Road</button>
            <button id="submit-btn" onClick={ updateBoard }>End Turn</button>
          </>)
          :
          (<>
            <button id="settlement-btn" className={currentMode === 'settlement' ? 'active' : ''} onClick={() => { currentModeRef.current = 'settlement'; setCurrentMode('settlement'); }}>Place Settlement</button>
            <button id="road-btn" className={currentMode === 'road' ? 'active' : ''} onClick={() => { currentModeRef.current = 'road'; setCurrentMode('road'); }}>Place Road</button>
            <button id="road-btn" className={currentMode === 'city' ? 'active' : ''} onClick={() => { currentModeRef.current = 'city'; setCurrentMode('city'); }}>Place City</button>
            <button id="dice-btn" onClick={rollDice}>Roll Dice</button>
            <button id="dice-btn" onClick={() => {document.querySelector("#trade-players").classList.add('show')}}>Trade</button>
            <button id="submit-btn" onClick={ updateBoard }>End Turn</button>  
          </>)
        }
      </div>
    )}
    
    </>
  );
}

import { io } from "socket.io-client";

import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';
import CreateGame from './pages/CreateGame.jsx'
import JoinGame from './pages/JoinGame.jsx'

const socket = io("http://localhost:4000");

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateGame />}></Route>
      <Route path="/join" element={<JoinGame />}></Route>
      <Route path="/lobby/:id" element={<Lobby />} />
      <Route path="/game/:id" element={<Game />} />
    </Routes>
  );
}

export default App;

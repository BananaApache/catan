
import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

export default function Lobby() {
  const { id: roomId } = useParams();

  const location = useLocation();
  const playerName = location.state?.name || '';

  const [users, setUsers] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    socket.emit("joinLobby", { playerName, roomId });

    socket.on("gameStart", ({ roomId }) => {
      navigate(`/game/${roomId}`);
    })

    socket.on("updateLobby", (userDict) => {
      setUsers(userDict);
      console.log("Users in lobby:", userDict);
    });

    return () => {
      socket.off("updateLobby");
    };
  }, []);

  return (
    <>
    <h1>Lobby: Start a Game</h1>
    <h2>Welcome { playerName }</h2>
    <p>Copy this id and send to friends!</p>
    <p>{ roomId }</p>

    <ul>
      {
        Object.values(users).map((user) => (
          <li key={user.playerId}>
            { user.playerId == socket.id ? <b>{user.playerName} (You)</b> : user.playerName }
          </li>
        ))
      }
    </ul>

    <button onClick={ () => socket.emit("startGame", { roomId }) }>Begin Game</button>
    </>
  );
}

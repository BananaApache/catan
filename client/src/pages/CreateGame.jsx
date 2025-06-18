
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket'

export default function CreateGame() {
  const [name, setName] = useState('');
  const navigate = useNavigate();
  
  function generateRandomSequence(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function startGame() {
    const roomId = generateRandomSequence(15);

    navigate(`/lobby/${roomId}`, { state: { name } });
  }

  return (
    <>
    <h1>Create a Game</h1>
    <input type="text" placeholder="Enter your Player name: " size={25} onChange={ (e) => setName(e.target.value) } />
    <button onClick={ startGame }>Start Game</button>
    </>
  );
}

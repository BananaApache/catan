
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket'

export default function JoinGame() {
    const [name, setName] = useState('');
    const [roomId, setRoomId] = useState('');

    const navigate = useNavigate();

    function joinGame() {
        if (!roomId) {
            return;
        }

        navigate(`/lobby/${roomId}`, { state: { name } });
    }

    return (
        <>
            <h1>Join a Game</h1>
            <input type="text" placeholder="Enter your Player name: " size={25} onChange={ (e) => setName(e.target.value) } />
            <input type="text" placeholder="Enter the Room ID: " size={25} onChange={ (e) => setRoomId(e.target.value) } />
            <button onClick={ joinGame }>Join Game</button>
        </>
    )

}

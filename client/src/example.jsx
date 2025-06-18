
import { io } from "socket.io-client";

import { useEffect, useState } from "react";

const socket = io("http://localhost:4000");

function App() {
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    socket.on("connect", () => {
      setMyId(socket.id)
      console.log("Connected to server:", socket.id);
    });

    socket.on("updateUsers", (userList) => {
      setUsers(userList);
    });

    // Clean up listeners
    return () => {
      socket.off("connect");
      socket.off("updateUsers");
    };
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>👥 Who's Online</h1>
      <p>Your ID: <code>{myId}</code></p>
      <ul>
        {users.map((id) => (
          <li key={id}>
            {id === myId ? <strong>{id} (You)</strong> : id}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;


import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <>
    <h1>Welcome to Catan Online</h1>
    <Link to="/join">Join a Game!</Link>
    <br />
    <Link to="/create">Create a Game!</Link>
    </>
  );
}

import { useParams, useNavigate } from "react-router-dom";

export default function Game() {
    const { code } = useParams();
    const navigate = useNavigate();

    return (
        <div style={{ padding: 20 }}>
            <h1>Game</h1>
            <p>
                Room code: <b>{code}</b>
            </p>

            <button onClick={() => navigate("/")}>Back Home</button>
        </div>
    );
}

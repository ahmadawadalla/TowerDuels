import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

export default function Home() {
    const [code, setCode] = useState("");
    const navigate = useNavigate();

    function getOrCreatePlayerId() {
        let playerId = localStorage.getItem("player_id");
        if (!playerId) {
            playerId = crypto.randomUUID();
            localStorage.setItem("player_id", playerId);
        }
        return playerId;
    }

    function createCode() {
        // 5 digit numeric code as a string
        return (Math.floor(Math.random() * (99999 - 1 + 1)) + 1).toString();
    }

    async function joinRoom() {
        const roomCode = code.trim().toUpperCase();
        if (!roomCode) return;

        const playerId = getOrCreatePlayerId();

        // 1) Find the room by code
        const { data: room, error: roomError } = await supabase
            .from("rooms")
            .select("id, code, status")
            .eq("code", roomCode)
            .single();

        if (roomError || !room) {
            console.log("Room not found:", roomError);
            alert("Room not found.");
            return;
        }

        // 2) Fetch current players in that room
        const { data: players, error: playersError } = await supabase
            .from("room_players")
            .select("id, room_id, player_id, slot")
            .eq("room_id", room.id);

        if (playersError) {
            console.log("Error loading players:", playersError);
            alert("Could not join room (players load failed).");
            return;
        }

        // If you're already in, just go to lobby
        const alreadyInRoom = players.some((p) => p.player_id === playerId);
        if (alreadyInRoom) {
            navigate(`/lobby/${roomCode}`);
            return;
        }

        const slot1Taken = players.some((p) => p.slot === 1);
        const slot2Taken = players.some((p) => p.slot === 2);

        if (!slot1Taken) {
            alert("Room is not ready yet. Try again.");
            return;
        }

        if (slot2Taken) {
            alert("Room is full.");
            return;
        }

        // 3) Insert this player as slot 2
        const { error: joinError } = await supabase.from("room_players").insert({
            room_id: room.id,
            player_id: playerId,
            slot: 2,
            connected: true,
        });

        if (joinError) {
            console.log("Join error:", joinError);
            alert("Failed to join room.");
            return;
        }

        // 4) Flip room status so both lobbies start countdown
        const { error: statusError } = await supabase
            .from("rooms")
            .update({ status: "playing" })
            .eq("id", room.id);

        if (statusError) {
            console.log("Status update error:", statusError);
            alert("Joined, but failed to start match (status update).");
            return;
        }

        navigate(`/lobby/${roomCode}`);
    }

    async function createRoom() {
        const playerId = getOrCreatePlayerId();

        // Pull existing codes so you can avoid collisions (fine for now)
        const { data, error } = await supabase.from("rooms").select("code");
        if (error) {
            console.log("Error loading room codes:", error);
            alert("Could not create room.");
            return;
        }

        let check_code = createCode();
        const list_of_codes = (data || []).map((row) => row.code);

        while (list_of_codes.includes(check_code)) {
            check_code = createCode();
        }

        setCode(check_code);

        // 1) Create room (status waiting)
        const { data: createdRoom, error: createError } = await supabase
            .from("rooms")
            .insert({ code: check_code, status: "waiting" })
            .select("id, code, status")
            .single();

        if (createError || !createdRoom) {
            console.log("Create room error:", createError);
            alert("Failed to create room.");
            return;
        }

        // 2) Insert creator as Player 1
        const { error: p1Error } = await supabase.from("room_players").insert({
            room_id: createdRoom.id,
            player_id: playerId,
            slot: 1,
            connected: true,
        });

        if (p1Error) {
            console.log("Insert P1 error:", p1Error);
            alert("Room created, but failed to add player 1.");
            return;
        }

        navigate(`/lobby/${check_code}`);
    }

    return (
        <div>
            <div className="min-h-screen bg-slate-800 flex py-80 justify-center">
                <div className="flex flex-col gap-5 ">
                    <h1 className="text-white text-5xl pb-16 text-center w-full">
                        TowerDuels
                    </h1>

                    <div className="bg-slate-600 text-white px-14 pt-6 pb-9 rounded-2xl w-full max-w-md shadow-cyan-100/70 shadow-lg ring-2 ring-cyan-500/20">
                        <h2 className="text-3xl pb-14 pl-16">Join Room</h2>
                        <input
                            className="rounded-lg text-center text-black"
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Enter room code"
                        />
                        <button
                            className="bg-green-700 px-4 py-1 rounded-lg"
                            onClick={joinRoom}
                            style={{ marginLeft: 8 }}
                        >
                            Join
                        </button>
                    </div>

                    <button
                        className="bg-slate-600 text-white text-3xl p-8 rounded-2xl w-full max-w-md text-center cursor-pointer shadow-cyan-100/70 shadow-lg ring-2 ring-cyan-500/20"
                        onClick={createRoom}
                    >
                        Create Room
                    </button>
                </div>
            </div>
        </div>
    );
}

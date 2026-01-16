import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Lobby() {
    const { code } = useParams();
    const navigate = useNavigate();

    const [room, setRoom] = useState(null);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [countdown, setCountdown] = useState(null);

    async function fetchPlayers(roomId) {
        const { data, error } = await supabase
            .from("room_players")
            .select("id, room_id, player_id, slot, connected")
            .eq("room_id", roomId)
            .order("slot", { ascending: true });

        if (error) {
            console.log("fetchPlayers error:", error);
            return;
        }

        setPlayers(data || []);
    }

    const readyToStart = useMemo(() => {
        if (!room) return false;
        return room.status === "playing" && players.length === 2;
    }, [room, players]);

    useEffect(() => {
        let cancelled = false;

        async function loadLobby() {
            setLoading(true);
            setMessage("");
            setRoom(null);
            setPlayers([]);
            setCountdown(null);

            const { data: roomData, error: roomError } = await supabase
                .from("rooms")
                .select("id, code, status")
                .eq("code", code)
                .single();

            if (cancelled) return;

            if (roomError || !roomData) {
                console.log("loadLobby roomError:", roomError);
                setMessage("Room not found.");
                setLoading(false);
                return;
            }

            setRoom(roomData);
            await fetchPlayers(roomData.id);
            setLoading(false);
        }

        loadLobby();

        return () => {
            cancelled = true;
        };
    }, [code]);

    useEffect(() => {
        if (!room?.id) return;

        const roomId = room.id;

        const playersChannel = supabase
            .channel(`room_players_${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "room_players",
                    filter: `room_id=eq.${roomId}`,
                },
                async () => {
                    await fetchPlayers(roomId);
                }
            )
            .subscribe();

        const roomChannel = supabase
            .channel(`rooms_${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "rooms",
                    filter: `id=eq.${roomId}`,
                },
                (payload) => {
                    setRoom((prev) => (prev ? { ...prev, ...payload.new } : prev));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(playersChannel);
            supabase.removeChannel(roomChannel);
        };
    }, [room?.id]);

    useEffect(() => {
        if (!readyToStart) {
            setCountdown(null);
            return;
        }

        setCountdown(5);

        const interval = setInterval(() => {
            setCountdown((c) => {
                if (c === null) return null;
                if (c <= 1) return 0;
                return c - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [readyToStart]);

    useEffect(() => {
        if (countdown === 0) {
            navigate(`/game/${code}`);
        }
    }, [countdown, code, navigate]);

    const hasP1 = players.some((p) => p.slot === 1);
    const hasP2 = players.some((p) => p.slot === 2);

    const statusText =
        message ||
        (loading
            ? "Loading..."
            : countdown !== null
                ? `Starting in ${countdown}...`
                : "Waiting for opponent...");

    return (
        <div className="min-h-screen bg-slate-800 flex items-center justify-center">
            <div className="w-full max-w-3xl p-8">
                <h1 className="text-white text-5xl text-center mb-6">Room # {code}</h1>

                <p className="text-white text-center mb-6">{statusText}</p>

                {!loading && !message && (
                    <div className="grid grid-cols-2 gap-8">
                        <div className="bg-slate-600 text-gray-200 p-6 rounded-xl text-center">
                            Player 1: {hasP1 ? "✅" : "—"}
                        </div>
                        <div className="bg-slate-600 text-gray-200 p-6 rounded-xl text-center">
                            Player 2: {hasP2 ? "✅" : "—"}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

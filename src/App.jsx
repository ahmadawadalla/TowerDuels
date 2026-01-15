import './App.css'
import { supabase } from "./supabaseClient";

export default function App() {
  const testInsert = async () => {
    const code = "TEST" + Math.floor(Math.random() * 10000);
    const { data, error } = await supabase.from("rooms").insert({ code }).select().single();
    console.log("insert result:", { data, error });
  };

  return (
      <div style={{ padding: 20 }}>
        <h1>TowerDuels</h1>
        <button onClick={testInsert}>Test Supabase Insert</button>
      </div>
  );
}

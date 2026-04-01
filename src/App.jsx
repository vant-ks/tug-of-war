import { useState } from "react";
import EditorView from "./views/EditorView";
import ArenaDisplay from "./views/ArenaDisplay";
import PlayerView from "./views/PlayerView";
import DevReset from "./components/DevReset";

export default function App() {
  const [view] = useState(() => {
    const p = new URLSearchParams(window.location.search || window.location.hash.replace("#", "?"));
    return p.get("view") || "editor";
  });

  return (
    <>
      {view === "arena" ? <ArenaDisplay /> : view === "player" ? <PlayerView /> : <EditorView />}
      <DevReset />
    </>
  );
}

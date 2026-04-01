import { useState } from "react";
import EditorView from "./views/EditorView";
import ArenaDisplay from "./views/ArenaDisplay";
import PlayerView from "./views/PlayerView";

export default function App() {
  const [view] = useState(() => {
    const p = new URLSearchParams(window.location.search || window.location.hash.replace("#", "?"));
    return p.get("view") || "editor";
  });

  if (view === "arena") return <ArenaDisplay />;
  if (view === "player") return <PlayerView />;
  return <EditorView />;
}

import fs from "node:fs";

const file = "src/app/page.tsx";
let s = fs.readFileSync(file, "utf8");
function rep(from, to) {
  if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 80));
  s = s.replace(from, to);
}

rep(
  "  const [filteredList, setFilteredList] = useState<FilteredOut[] | null>(null);",
  "  const [filteredList, setFilteredList] = useState<FilteredOut[] | null>(null);\n  const [flash, setFlash] = useState<string[]>([]);",
);
rep("      .filter((i) => !i.status)\n", "      .filter((i) => !i.status || flash.includes(i.postId))\n");
rep("  }, [shortlist]);", "  }, [shortlist, flash]);");
rep(
  '<li key={it.postId} className="todoitem">',
  '<li key={it.postId} className={`todoitem ${flash.includes(it.postId) ? "flashed" : ""}`}>',
);
rep(
  '<span className="step" aria-hidden="true">{it.rank}</span>',
  '<span className={`step ${flash.includes(it.postId) ? "done" : ""}`} aria-hidden="true">{flash.includes(it.postId) ? <Icon name="check" /> : it.rank}</span>',
);
rep(
  '<button className="btn primary" onClick={() => setStatus(it, "contacted")}>Mark contacted</button>',
  '<button className="btn primary" onClick={() => markFromTodo(it)}>Mark contacted</button>',
);
rep(
  "  const items = data?.items ?? [];",
  '  // From the "Do this today" list: show the item ticked off for a moment, then it leaves the list.\n  function markFromTodo(it: Item) {\n    setFlash((f) => [...f, it.postId]);\n    setStatus(it, "contacted");\n    setTimeout(() => setFlash((f) => f.filter((x) => x !== it.postId)), 1100);\n  }\n\n  const items = data?.items ?? [];',
);
fs.writeFileSync(file, s, "utf8");
console.log("page patched");

import fs from "node:fs";

function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`not found in ${file}: ${from.slice(0, 70)}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(file, s, "utf8");
  console.log("patched", file);
}

patch("src/lib/data.ts", [
  ["export type Dashboard = { items: Item[]; filteredOut: FilteredOut[];", "export type Dashboard = { items: Item[]; filteredOut: FilteredOut[]; filteredCount: number;"],
  ["export async function getDashboard(): Promise<Dashboard> {", "export async function getDashboard(includeFiltered = false): Promise<Dashboard> {"],
  ["return { items, filteredOut, pending, run,", "return { items, filteredOut: includeFiltered ? filteredOut : [], filteredCount: filteredOut.length, pending, run,"],
]);

patch("src/app/api/launches/route.ts", [
  ["export async function GET() {", "export async function GET(req: Request) {\n  const full = new URL(req.url).searchParams.get(\"filtered\") === \"1\";"],
  ["getDashboard()", "getDashboard(full)"],
]);

patch("src/app/page.tsx", [
  ['import type { Dashboard, Item } from "../lib/data";', 'import type { Dashboard, FilteredOut, Item } from "../lib/data";'],
  ['  const [saveError, setSaveError] = useState("");', '  const [saveError, setSaveError] = useState("");\n  const [filteredList, setFilteredList] = useState<FilteredOut[] | null>(null);'],
  ["{data?.filteredOut.length ?? 0}</span></button>", "{data?.filteredCount ?? 0}</span></button>"],
  ["{(data?.filteredOut ?? []).slice(0, 300).map((f) => (", "{(filteredList ?? []).slice(0, 300).map((f) => ("],
  [
    '  const rowsToShow = effView === "today" ? shortlist : filtered;',
    '  const rowsToShow = effView === "today" ? shortlist : filtered;\n\n  useEffect(() => {\n    if (effView !== "filtered" || filteredList) return;\n    fetch("/api/launches?filtered=1", { cache: "no-store" }).then((r) => r.json()).then((j) => setFilteredList(j.filteredOut ?? [])).catch(() => setFilteredList([]));\n  }, [effView, filteredList]);',
  ],
  ['<p className="muted">Launches judged not relevant for B2B teams that run standups. They are never ranked.</p>', '<p className="muted">Launches judged not relevant for B2B teams that run standups. They are never ranked.{filteredList === null ? " Loading…" : ""}</p>'],
]);

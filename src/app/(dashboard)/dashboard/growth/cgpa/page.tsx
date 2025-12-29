
"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import Link from "next/link";
import { useState, useMemo } from "react";
import { PlusCircle, Trash2, Repeat, Download, FilePlus } from "lucide-react";

type Course = { id: string; title: string; units: number; score: number };
type Semester = { id: string; name: string; courses: Course[] };

type Snapshot = { id: number; name: string; createdAt: string; semesters: Semester[]; prevCgpa?: string; prevCredits?: string };

const gradePoint = (score: number) => {
  if (score >= 70) return 4.0;
  if (score >= 60) return 3.0;
  if (score >= 50) return 2.0;
  if (score >= 45) return 1.0;
  return 0;
};

const calcSemester = (courses: Course[]) => {
  const units = courses.reduce((s, c) => s + Number(c.units || 0), 0);
  const qp = courses.reduce((s, c) => s + gradePoint(c.score) * Number(c.units || 0), 0);
  return { units, gpa: units > 0 ? Number((qp / units).toFixed(2)) : 0 };
};

export default function CgpaPage() {
  const [semesters, setSemesters] = useState<Semester[]>([
    { id: "s1", name: "Semester 1", courses: [{ id: "s1c1", title: "Calculus I", units: 3, score: 70 }] },
  ]);

  const [openSemesters, setOpenSemesters] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    return map;
  });

  const [prevCgpa, setPrevCgpa] = useState<string>("");
  const [prevCredits, setPrevCredits] = useState<string>("");

  const [tab, setTab] = useState<"workspace" | "simulator" | "personal">("workspace");

  // simulator: overrides per course id
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const addSemester = () => setSemesters((s) => [...s, { id: `s${s.length + 1}`, name: `Semester ${s.length + 1}`, courses: [] }]);
  const duplicateSemester = (sid: string) => {
    setSemesters((s) => {
      const idx = s.findIndex((x) => x.id === sid);
      if (idx === -1) return s;
      const orig = s[idx];
      const copy = { ...orig, id: `s_dup_${Date.now()}`, name: `${orig.name} (copy)`, courses: orig.courses.map(c => ({ ...c, id: `${c.id}_dup_${Math.random().toString(36).slice(2,6)}` })) };
      const out = [...s];
      out.splice(idx + 1, 0, copy);
      return out;
    });
  };
  const removeSemester = (sid: string) => {
    setSemesters((s) => s.filter((sem) => sem.id !== sid));
  };
  const toggleSemester = (sid: string) => setOpenSemesters((m) => ({ ...m, [sid]: !m[sid] }));
  const addCourse = (sid: string) =>
    setSemesters((s) => s.map((sem) => (sem.id === sid ? { ...sem, courses: [...sem.courses, { id: `${sid}c${sem.courses.length + 1}`, title: "", units: 3, score: 0 }] } : sem)));
  const updateCourse = (sid: string, cid: string, patch: Partial<Course>) =>
    setSemesters((s) => s.map((sem) => (sem.id === sid ? { ...sem, courses: sem.courses.map((c) => (c.id === cid ? { ...c, ...patch } : c)) } : sem)));
  const removeCourse = (sid: string, cid: string) => {
    setSemesters((s) => s.map((sem) => (sem.id === sid ? { ...sem, courses: sem.courses.filter((c) => c.id !== cid) } : sem)));
    setOverrides((o) => {
      const copy = { ...o };
      delete copy[cid];
      return copy;
    });
  };

  const semesterSummaries = useMemo(() => semesters.map((sem) => ({ id: sem.id, name: sem.name, ...calcSemester(sem.courses) })), [semesters]);

  const baseline = useMemo(() => {
    let totalUnits = 0;
    let totalQP = 0;
    semesters.forEach((sem) => {
      sem.courses.forEach((c) => {
        totalUnits += Number(c.units || 0);
        totalQP += gradePoint(c.score) * Number(c.units || 0);
      });
    });
    if (prevCgpa && prevCredits) {
      totalQP += Number(prevCgpa) * Number(prevCredits);
      totalUnits += Number(prevCredits);
    }
    const cgpa = totalUnits > 0 ? Number((totalQP / totalUnits).toFixed(2)) : 0;
    return { cgpa, totalUnits };
  }, [semesters, prevCgpa, prevCredits]);

  const simulated = useMemo(() => {
    let totalUnits = 0;
    let totalQP = 0;
    semesters.forEach((sem) => {
      sem.courses.forEach((c) => {
        const score = overrides[c.id] !== undefined ? overrides[c.id] : c.score;
        totalUnits += Number(c.units || 0);
        totalQP += gradePoint(score) * Number(c.units || 0);
      });
    });
    if (prevCgpa && prevCredits) {
      totalQP += Number(prevCgpa) * Number(prevCredits);
      totalUnits += Number(prevCredits);
    }
    const cgpa = totalUnits > 0 ? Number((totalQP / totalUnits).toFixed(2)) : 0;
    return { cgpa, totalUnits };
  }, [semesters, overrides, prevCgpa, prevCredits]);

  // presets for quick scenarios
  const PRESETS = [
    { id: "raise5", name: "Raise all scores by 5", apply: (s: Semester[]) => { const o: Record<string, number> = {}; s.forEach((sem) => sem.courses.forEach((c) => (o[c.id] = Math.min(100, c.score + 5)))); return o; } },
    { id: "aimA", name: "Bring one course to 70+ (A)", apply: (s: Semester[]) => { const o: Record<string, number> = {}; const first = s.flatMap(x => x.courses)[0]; if (first) o[first.id] = Math.max(70, first.score); return o; } },
    { id: "perfect", name: "Perfect semester (all 100)", apply: (s: Semester[]) => { const o: Record<string, number> = {}; s.forEach((sem) => sem.courses.forEach((c) => (o[c.id] = 100))); return o; } },
  ];

  const applyPreset = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid);
    if (!p) return;
    setOverrides(p.apply(semesters));
    setTab("simulator");
  };

  const clearOverrides = () => setOverrides({});

  // small helpers for CSV import/export (simple format)
  const exportCSV = () => {
    const rows = ["Semester,Course,Units,Score"];
    semesters.forEach((sem) => sem.courses.forEach((c) => rows.push(`${sem.name},${(c.title || "").replace(/,/g, " ")},${c.units},${c.score}`)));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cgpa_export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importCSV = async (file?: File) => {
    if (!file) return;
    const content = await file.text();
    const lines = content.split(/\r?\n/).slice(1).filter(Boolean);
    const map: Record<string, Course[]> = {};
    lines.forEach((ln) => {
      const [sem, title, units, score] = ln.split(",");
      if (!sem) return;
      if (!map[sem]) map[sem] = [];
      map[sem].push({ id: `imp_${Math.random().toString(36).slice(2,8)}`, title: (title||"").trim(), units: Number(units)||0, score: Number(score)||0 });
    });
    const imported = Object.keys(map).map((k,i) => ({ id: `s_imp_${i}`, name: k, courses: map[k] }));
    if (imported.length) setSemesters(imported);
  };

  const [snapshotName, setSnapshotName] = useState<string>("");

  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    try {
      if (typeof window === "undefined") return [];
      const raw = localStorage.getItem("cgpa_snapshots");
      return raw ? JSON.parse(raw) as Snapshot[] : [];
    } catch (e) {
      console.warn("Failed to parse cgpa snapshots", e);
      return [];
    }
  });

  const saveSnapshot = () => {
    const snap: Snapshot = { id: Date.now(), name: snapshotName || `Snapshot ${new Date().toLocaleString()}`, createdAt: new Date().toISOString(), semesters, prevCgpa, prevCredits };
    const updated = [snap, ...snapshots].slice(0, 20);
    setSnapshots(updated);
    try { localStorage.setItem("cgpa_snapshots", JSON.stringify(updated)); } catch (e) { console.warn(e); }
    setSnapshotName("");
  };

  const loadSnapshot = (id: number) => {
    const snap = snapshots.find((s) => s.id === id);
    if (!snap) return;
    setSemesters(snap.semesters || []);
    setPrevCgpa(snap.prevCgpa || "");
    setPrevCredits(snap.prevCredits || "");
  };

  const deleteSnapshot = (id: number) => {
    const updated = snapshots.filter((s) => s.id !== id);
    setSnapshots(updated);
    try { localStorage.setItem("cgpa_snapshots", JSON.stringify(updated)); } catch (e) { console.warn(e); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader title="CGPA Workspace" />
      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">CGPA Workspace</h1>
            <p className="text-foreground/70">Organize semesters, simulate scenarios, and preview how score changes affect your CGPA.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex gap-2">
              <button onClick={() => setTab("workspace")} className={`px-3 py-2 rounded-md ${tab === "workspace" ? "bg-[var(--primary)] text-white" : "bg-[var(--glass-bg)]"}`}>Workspace</button>
              <button onClick={() => setTab("simulator")} className={`px-3 py-2 rounded-md ${tab === "simulator" ? "bg-[var(--primary)] text-white" : "bg-[var(--glass-bg)]"}`}>Simulator</button>
              <button onClick={() => setTab("personal")} className={`px-3 py-2 rounded-md ${tab === "personal" ? "bg-[var(--primary)] text-white" : "bg-[var(--glass-bg)]"}`}>Personal</button>
            </div>
            <input aria-label="Import CSV" type="file" accept=".csv" onChange={(e) => importCSV(e.target.files?.[0])} className="text-sm" />
            <button onClick={exportCSV} className="px-3 py-2 rounded-md border border-[var(--glass-border)]">Export CSV</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <main className="lg:col-span-8 space-y-4">
            {/* workspace editor */}
            {tab === "workspace" && (
              <>
                {semesters.map((sem) => (
                  <section key={sem.id} className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSemester(sem.id)}
                              // aria-expanded={openSemesters[sem.id] ? "true" : "false"}
                              className="text-sm text-foreground/80 font-medium"
                            >
                              {sem.name}
                            </button>
                            <div className="px-2 py-0.5 rounded-full bg-background/50 text-xs font-semibold border border-[var(--glass-border)]">
                              {(() => { const s = semesterSummaries.find(x => x.id === sem.id); return s ? `${s.gpa} · ${s.units}u` : '—'; })()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => duplicateSemester(sem.id)} title="Duplicate semester" className="p-2 rounded-md hover:bg-foreground/5"><Repeat className="w-4 h-4" /></button>
                            <button onClick={() => addCourse(sem.id)} title="Add course" className="px-3 py-1 rounded-md bg-[var(--primary)] text-white text-sm inline-flex items-center gap-2"><FilePlus className="w-4 h-4" /> Add course</button>
                            <button onClick={() => removeSemester(sem.id)} title="Remove semester" className="p-2 rounded-md hover:bg-foreground/5"><Trash2 className="w-4 h-4 text-red-500" /></button>
                          </div>
                        </div>

                        <div className={`${openSemesters[sem.id] === false ? 'hidden' : ''} space-y-3`}>

                      {sem.courses.length === 0 && <div className="text-sm text-foreground/60">No courses yet.</div>}
                      {sem.courses.map((c, i) => (
                        <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                          <input aria-label={`Course ${i+1}`} value={c.title} onChange={(e) => updateCourse(sem.id, c.id, { title: e.target.value })} placeholder="Course title" className="col-span-6 bg-transparent border border-[var(--glass-border)] rounded-md px-3 py-2" />
                          <input aria-label="Units" type="number" value={c.units} onChange={(e) => updateCourse(sem.id, c.id, { units: Number(e.target.value) || 0 })} className="col-span-2 bg-transparent border border-[var(--glass-border)] rounded-md px-3 py-2" />
                          <input aria-label="Score" type="number" value={c.score} onChange={(e) => updateCourse(sem.id, c.id, { score: Number(e.target.value) || 0 })} className="col-span-2 bg-transparent border border-[var(--glass-border)] rounded-md px-3 py-2" min={0} max={100} />
                          <div className="col-span-2 flex justify-end items-center gap-2">
                            <div className="text-xs text-foreground/70 mr-2">{gradePoint(c.score).toFixed(1)}</div>
                            <button title="Remove course" onClick={() => removeCourse(sem.id, c.id)} className="p-2 rounded-md hover:bg-foreground/5"><Trash2 className="w-4 h-4 text-red-500" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}

                <div className="flex gap-2">
                  <button onClick={addSemester} className="px-3 py-2 rounded-md border border-[var(--glass-border)]">Add semester</button>
                  <Link href="../" className="px-3 py-2 rounded-md text-foreground/70">Back</Link>
                </div>
              </>
            )}

            {/* simulator */}
            {tab === "simulator" && (
              <section className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
                <h2 className="text-lg font-semibold mb-3">Simulator</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-foreground/60">Preset scenarios</label>
                    <div className="mt-2 flex flex-col gap-2">
                      {PRESETS.map((p) => (
                        <button key={p.id} onClick={() => applyPreset(p.id)} className="text-left px-3 py-2 rounded-md bg-[var(--glass-bg)] border border-[var(--glass-border)]">{p.name}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-foreground/60">Manual override</label>
                    <select aria-label="Select course to override" className="form-select mt-1 w-full" onChange={(e) => { const cid = e.target.value; const course = semesters.flatMap(s => s.courses).find(c => c.id === cid); if (course) setOverrides(o => ({ ...o, [cid]: course.score })); }}>
                      <option value="">Select course</option>
                      {semesters.flatMap((s) => s.courses.map((c) => ({ sem: s, c }))).map(({ sem, c }) => (
                        <option key={c.id} value={c.id}>{`${sem.name} — ${c.title || '(untitled)'}`}</option>
                      ))}
                    </select>
                    <div className="mt-2">
                      <input aria-label="Override slider" type="range" min={0} max={100} onChange={(e) => { const val = Number(e.target.value); const firstCid = Object.keys(overrides)[0]; if (firstCid) setOverrides(o => ({ ...o, [firstCid]: val })); }} className="w-full" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-foreground/60">Simulator results</label>
                    <div className="mt-2 p-3 bg-background/50 rounded-md border border-[var(--glass-border)]">
                      <div className="text-sm text-foreground/70">Baseline CGPA</div>
                      <div className="text-2xl font-bold">{baseline.cgpa}</div>
                      <div className="text-sm text-foreground/70 mt-2">Simulated CGPA</div>
                      <div className="text-3xl font-extrabold">{simulated.cgpa}</div>
                      <div className={`mt-2 text-sm ${simulated.cgpa >= baseline.cgpa ? 'text-green-500' : 'text-red-500'}`}>{simulated.cgpa >= baseline.cgpa ? '+' : '-'}{Math.abs(Number((simulated.cgpa - baseline.cgpa).toFixed(2)))}</div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={clearOverrides} className="px-3 py-2 rounded-md border border-[var(--glass-border)]">Clear</button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "personal" && (
              <section className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
                <h2 className="text-lg font-semibold">Personal</h2>
                <p className="text-sm text-foreground/70">Saved calculators and personal snapshots will appear here.</p>
              </section>
            )}
          </main>

          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
              <h3 className="font-semibold">Per-semester</h3>
              <div className="mt-2 space-y-2">
                {semesterSummaries.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="text-sm text-foreground/80">{s.name}</div>
                    <div className="text-sm font-medium">{s.gpa} · {s.units}u</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
              <h3 className="font-semibold">Cumulative</h3>
              <div className="mt-2">
                <label className="block text-xs text-foreground/60">Previous CGPA</label>
                <input value={prevCgpa} onChange={(e) => setPrevCgpa(e.target.value)} placeholder="e.g. 3.2" className="mt-1 w-full bg-transparent border border-[var(--glass-border)] rounded-md px-3 py-2" />
                <label className="block text-xs text-foreground/60 mt-3">Previous credits</label>
                <input value={prevCredits} onChange={(e) => setPrevCredits(e.target.value)} placeholder="e.g. 60" className="mt-1 w-full bg-transparent border border-[var(--glass-border)] rounded-md px-3 py-2" />

                <div className="pt-3 border-t border-[var(--glass-border)] mt-3">
                  <div className="text-sm text-foreground/70">Total credits</div>
                  <div className="text-2xl font-bold">{baseline.totalUnits}</div>
                  <div className="text-sm text-foreground/60 mt-1">Estimated CGPA</div>
                  <div className="text-3xl font-extrabold mt-1">{baseline.cgpa}</div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium">Snapshots</h4>
                  <div className="mt-2 flex gap-2">
                    <input value={snapshotName} onChange={(e) => setSnapshotName(e.target.value)} placeholder="Snapshot name (optional)" className="flex-1 bg-transparent border border-[var(--glass-border)] rounded-md px-3 py-2" />
                    <button onClick={saveSnapshot} disabled={semesters.length === 0} className="px-3 py-2 rounded-md bg-[var(--primary)] text-white">Save</button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {snapshots.length === 0 && <div className="text-sm text-foreground/60">No snapshots saved.</div>}
                    {snapshots.map((s) => (
                      <div key={s.id} className="flex items-center justify-between">
                        <div className="text-sm">{s.name}</div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => loadSnapshot(s.id)} className="text-sm text-primary">Load</button>
                          <button onClick={() => deleteSnapshot(s.id)} className="text-sm text-foreground/60">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

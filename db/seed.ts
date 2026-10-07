/**
 * Deterministic seed script (spec §104, §68, §69, §111).
 *
 * Creates a realistic Pune-based demo dataset: citizens, authority staff,
 * admins, field workers, departments, categories with SLA configs, ~900
 * issues across all statuses/priorities with timelines, comments, upvotes,
 * notifications, feedback and audit history. Uses a fixed PRNG so repeated
 * seeds produce identical data.
 *
 * Demo password: DEMO_SEED_PASSWORD env var (see .env.example).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb, isPostgres } from "@/lib/db";
import {
  users,
  departments,
  workers,
  categories,
  issues,
  issueImages,
  issueStatusHistory,
  issueEvents,
  comments,
  upvotes,
  follows,
  confirmations,
  feedback,
  notifications,
  auditLogs,
  counters,
  appSettings,
  passwordResets,
  abuseReports,
  drafts,
} from "@/drizzle/sqlite/schema";
import { hashPassword } from "@/lib/auth";
import { computePriority } from "@/lib/priority/engine";
import { computeSlaDeadline } from "@/lib/sla/engine";
import { obscureCoordinate, round6 } from "@/lib/maps/geo";
import type { IssueStatus, Severity } from "@/lib/types";

// ---------------------------------------------------------------------------
// Deterministic PRNG
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261007);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
let idCounter = 0;
const nextId = () => `seed-${Date.now().toString(36)}-${(idCounter++).toString(36)}-${Math.floor(rand() * 1e6).toString(36)}`;

// ---------------------------------------------------------------------------
// Static reference data
// ---------------------------------------------------------------------------

const DEPARTMENTS = [
  { name: "Road Maintenance", description: "Repairs roads, potholes, footpaths and road furniture.", email: "roads@civicissue.demo", zones: "North Zone,Central Zone,West Zone" },
  { name: "Waste Management", description: "Garbage collection, street cleaning and waste processing.", email: "waste@civicissue.demo", zones: "All Zones" },
  { name: "Water Supply", description: "Drinking water pipelines, leakage and supply scheduling.", email: "water@civicissue.demo", zones: "East Zone,South Zone" },
  { name: "Drainage & Sewerage", description: "Storm drains, sewers and manhole maintenance.", email: "drainage@civicissue.demo", zones: "All Zones" },
  { name: "Electricity & Street Lighting", description: "Streetlights, public electrical fixtures and dark spots.", email: "lighting@civicissue.demo", zones: "North Zone,West Zone,Central Zone" },
  { name: "Traffic Management", description: "Signals, markings, dividers and road safety infrastructure.", email: "traffic@civicissue.demo", zones: "Central Zone" },
  { name: "Parks & Environment", description: "Trees, gardens, playgrounds and green spaces.", email: "parks@civicissue.demo", zones: "South Zone,East Zone" },
  { name: "Public Health & Sanitation", description: "Public toilets, sanitation and health hazards.", email: "health@civicissue.demo", zones: "All Zones" },
  { name: "Urban Infrastructure", description: "Bridges, public buildings and civic structures.", email: "infrastructure@civicissue.demo", zones: "Central Zone,North Zone" },
];

const CATEGORY_DEFS = [
  { name: "Road Damage", slug: "road-damage", icon: "construction", dept: "Road Maintenance", sla: { c: 24, h: 48, m: 120, l: 240 } },
  { name: "Streetlight", slug: "streetlight", icon: "lamp", dept: "Electricity & Street Lighting", sla: { c: 24, h: 72, m: 168, l: 336 } },
  { name: "Garbage / Waste", slug: "garbage-waste", icon: "trash-2", dept: "Waste Management", sla: { c: 24, h: 48, m: 96, l: 240 } },
  { name: "Water Supply", slug: "water-supply", icon: "droplets", dept: "Water Supply", sla: { c: 12, h: 36, m: 96, l: 240 } },
  { name: "Drainage / Sewer", slug: "drainage", icon: "waves", dept: "Drainage & Sewerage", sla: { c: 12, h: 48, m: 120, l: 288 } },
  { name: "Traffic Signal", slug: "traffic-signal", icon: "traffic-cone", dept: "Traffic Management", sla: { c: 12, h: 24, m: 96, l: 240 } },
  { name: "Public Infrastructure", slug: "public-infrastructure", icon: "building-2", dept: "Urban Infrastructure", sla: { c: 24, h: 72, m: 240, l: 480 } },
  { name: "Footpath", slug: "footpath", icon: "footprints", dept: "Road Maintenance", sla: { c: 48, h: 96, m: 240, l: 480 } },
  { name: "Tree / Environment", slug: "tree-environment", icon: "trees", dept: "Parks & Environment", sla: { c: 24, h: 72, m: 168, l: 336 } },
  { name: "Public Safety", slug: "public-safety", icon: "shield-alert", dept: "Urban Infrastructure", sla: { c: 6, h: 24, m: 72, l: 168 } },
  { name: "Public Toilet", slug: "public-toilet", icon: "toilet", dept: "Public Health & Sanitation", sla: { c: 24, h: 72, m: 168, l: 336 } },
  { name: "Noise", slug: "noise", icon: "volume-2", dept: "Public Health & Sanitation", sla: { c: 24, h: 120, m: 240, l: 480 } },
  { name: "Animal-related", slug: "animal-related", icon: "paw-print", dept: "Public Health & Sanitation", sla: { c: 12, h: 48, m: 120, l: 288 } },
  { name: "Public Spaces", slug: "public-spaces", icon: "trees", dept: "Parks & Environment", sla: { c: 48, h: 120, m: 240, l: 480 } },
  { name: "Other", slug: "other", icon: "cone", dept: "Urban Infrastructure", sla: { c: 24, h: 96, m: 240, l: 480 } },
];

interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: "CITIZEN" | "AUTHORITY" | "WORKER" | "ADMIN";
  city: string;
  locality?: string;
  departmentIdx?: number;
  zone?: string;
  employeeId?: string;
}

const PEOPLE: SeedUser[] = [
  { id: "u-ananya", name: "Ananya Deshmukh", email: "citizen@example.com", role: "CITIZEN", city: "Pune", locality: "Kothrud" },
  { id: "u-rohan", name: "Rohan Kulkarni", email: "rohan.kulkarni@example.com", role: "CITIZEN", city: "Pune", locality: "Baner" },
  { id: "u-meera", name: "Meera Joshi", email: "meera.joshi@example.com", role: "CITIZEN", city: "Pune", locality: "Shivajinagar" },
  { id: "u-imran", name: "Imran Shaikh", email: "imran.shaikh@example.com", role: "CITIZEN", city: "Pune", locality: "Camp" },
  { id: "u-kavita", name: "Kavita Patil", email: "kavita.patil@example.com", role: "CITIZEN", city: "Pune", locality: "Hadapsar" },
  { id: "u-siddharth", name: "Siddharth Rane", email: "siddharth.rane@example.com", role: "CITIZEN", city: "Pune", locality: "Wakad" },
  { id: "u-fatima", name: "Fatima Sayyed", email: "fatima.sayyed@example.com", role: "CITIZEN", city: "Pune", locality: "Viman Nagar" },
  { id: "u-vikram", name: "Vikram Holkar", email: "vikram.holkar@example.com", role: "CITIZEN", city: "Pune", locality: "Katraj" },
  { id: "u-neha", name: "Neha Kulkarni", email: "authority@example.com", role: "AUTHORITY", city: "Pune", locality: "Shivajinagar" },
  { id: "u-ramesh", name: "Ramesh Gaikwad", email: "ramesh.gaikwad@example.com", role: "AUTHORITY", city: "Pune", locality: "Kothrud", departmentIdx: 0 },
  { id: "u-sunita", name: "Dr. Sunita Rao", email: "admin@example.com", role: "ADMIN", city: "Pune", locality: "Central Zone" },
  { id: "u-santosh", name: "Santosh Jadhav", email: "worker@example.com", role: "WORKER", city: "Pune", zone: "West Zone", departmentIdx: 0, employeeId: "RMD-1042" },
  { id: "u-prakash", name: "Prakash Bhosale", email: "prakash.bhosale@example.com", role: "WORKER", city: "Pune", zone: "North Zone", departmentIdx: 1, employeeId: "WM-2087" },
  { id: "u-anil", name: "Anil Kamble", email: "anil.kamble@example.com", role: "WORKER", city: "Pune", zone: "Central Zone", departmentIdx: 4, employeeId: "EL-3120" },
  { id: "u-suresh", name: "Suresh Pawar", email: "suresh.pawar@example.com", role: "WORKER", city: "Pune", zone: "East Zone", departmentIdx: 2, employeeId: "WS-4211" },
  { id: "u-mahesh", name: "Mahesh Shinde", email: "mahesh.shinde@example.com", role: "WORKER", city: "Pune", zone: "South Zone", departmentIdx: 3, employeeId: "DR-5309" },
  { id: "u-ravi", name: "Ravi Thorat", email: "ravi.thorat@example.com", role: "WORKER", city: "Pune", zone: "Central Zone", departmentIdx: 5, employeeId: "TM-6104" },
];

// Pune locality coordinates.
const LOCALITIES = [
  { name: "Kothrud", zone: "West Zone", lat: 18.5074, lng: 73.8077 },
  { name: "Baner", zone: "North Zone", lat: 18.5590, lng: 73.7868 },
  { name: "Aundh", zone: "North Zone", lat: 18.5552, lng: 73.8090 },
  { name: "Wakad", zone: "North Zone", lat: 18.5987, lng: 73.7625 },
  { name: "Shivajinagar", zone: "Central Zone", lat: 18.5308, lng: 73.8474 },
  { name: "Camp", zone: "Central Zone", lat: 18.5136, lng: 73.8749 },
  { name: "Hadapsar", zone: "East Zone", lat: 18.5012, lng: 73.9230 },
  { name: "Viman Nagar", zone: "East Zone", lat: 18.5679, lng: 73.9143 },
  { name: "Katraj", zone: "South Zone", lat: 18.4512, lng: 73.8583 },
  { name: "Warje", zone: "West Zone", lat: 18.4865, lng: 73.7961 },
  { name: "University Road", zone: "Central Zone", lat: 18.5420, lng: 73.8290 },
  { name: "FC Road", zone: "Central Zone", lat: 18.5286, lng: 73.8380 },
  { name: "Market Yard", zone: "South Zone", lat: 18.4869, lng: 73.8934 },
  { name: "Pimpri", zone: "North Zone", lat: 18.6298, lng: 73.7997 },
  { name: "Sinhagad Road", zone: "West Zone", lat: 18.4800, lng: 73.8000 },
];

const ISSUE_POOL: { title: string; description: string; slug: string }[] = [
  { title: "Large pothole near college gate", slug: "road-damage", description: "A deep pothole has formed near the main entrance of the college. Two-wheelers swerve to avoid it and it fills with water during rain, making it invisible and very dangerous." },
  { title: "Garbage accumulation near market road", slug: "garbage-waste", description: "Garbage has not been collected near the market road for over a week. The pile is spreading onto the footpath and the smell makes it hard for shoppers and vendors to stand nearby." },
  { title: "Streetlight not working near bus stop", slug: "streetlight", description: "The streetlight at the bus stop has been off for several days. The whole stretch goes completely dark after sunset and women and elderly residents feel unsafe waiting for buses." },
  { title: "Water leakage outside residential society", slug: "water-supply", description: "A water pipeline is leaking continuously outside the society gate. Clean drinking water is being wasted for days and the road surface is getting damaged by the flowing water." },
  { title: "Blocked drainage after heavy rainfall", slug: "drainage", description: "The storm drain near the junction is completely blocked. Rainwater has entered several ground-floor homes and the stagnant water is breeding mosquitoes." },
  { title: "Broken footpath near public hospital", slug: "footpath", description: "The footpath tiles near the hospital entrance are broken and uneven. Patients on stretchers and elderly visitors struggle to walk, and someone already fell here last week." },
  { title: "Traffic signal stuck on red at junction", slug: "traffic-signal", description: "The traffic signal at the main junction is malfunctioning and stays red on one side for a very long time. This causes long jams during office hours and near-misses between vehicles." },
  { title: "Open manhole on school walking route", slug: "public-safety", description: "A manhole cover is missing on the road children use to walk to school. It is only covered by a thin plank right now. A child could easily fall in — this needs urgent attention." },
  { title: "Overflowing sewage near food street", slug: "drainage", description: "Sewage water is overflowing from the drain onto the footpath next to the food street. It is a serious health hazard for the eateries and people walking in the evening." },
  { title: "Dead tree branch hanging over the road", slug: "tree-environment", description: "A large dead branch is hanging over the road after last week's storm. It could fall on a moving vehicle or two-wheeler at any time, especially when it rains or the wind picks up." },
  { title: "Public toilet in unusable condition", slug: "public-toilet", description: "The community public toilet has no running water and has not been cleaned in days. Auto drivers and street vendors who depend on it are facing a lot of difficulty." },
  { title: "Stray cattle blocking highway service lane", slug: "animal-related", description: "A herd of stray cattle sits on the service lane every evening. Vehicles have to swerve into fast traffic to avoid them and two minor accidents have already happened this month." },
  { title: "Illegal dumping behind the metro pillar", slug: "garbage-waste", description: "Construction debris and household waste are being dumped behind the metro pillar at night. The pile keeps growing, blocks the pedestrian path and attracts rodents." },
  { title: "Flickering streetlight on hospital road", slug: "streetlight", description: "The streetlight outside the hospital has been flickering all night for the past week. Ambulances entering at night find it difficult and patients in the ward cannot sleep." },
  { title: "Cracked road surface after pipeline work", slug: "road-damage", description: "The road was dug up for pipeline work two months ago but was never restored properly. The patched surface has broken apart again and loose stones are scattered across the lane." },
  { title: "Waterlogging at subway underpass", slug: "drainage", description: "Every heavy rain floods the subway underpass up to knee level. Two-wheelers stall inside and there is no warning barrier. Someone could get seriously trapped during night hours." },
  { title: "Damaged divider on the ring road", slug: "public-infrastructure", description: "A long section of the road divider was damaged by a truck last month. Vehicles now cross illegally through the gap, causing head-on near-misses at high speed." },
  { title: "Garbage bin overflowing near school", slug: "garbage-waste", description: "The community bin near the school gate has been overflowing for four days. Children walk past it every morning and stray dogs scatter the waste across the school entrance." },
  { title: "No water supply for three days", slug: "water-supply", description: "Our entire lane has had no water supply for three days without any notice. Families are buying water tankers and elderly residents cannot carry water from the next street." },
  { title: "Broken bench and swings in the park", slug: "public-spaces", description: "The children's swing in the neighbourhood park has a broken chain and the benches are damaged. Children still try to use the swing, which is a fall and injury risk." },
  { title: "Loudspeaker noise past midnight", slug: "noise", description: "A function hall nearby plays loudspeakers well past midnight despite the rules. Students preparing for exams and working residents are unable to sleep for the second week." },
  { title: "Exposed electric wires near footpath", slug: "public-safety", description: "Insulation on the electric wires near the footpath has melted and the live wires are hanging at child height after the pole was hit by a vehicle last week." },
  { title: "Pothole cluster on the station approach road", slug: "road-damage", description: "The station approach road has developed a cluster of potholes right before the turn. Autos and buses brake suddenly and rear-end collisions happen almost every week." },
  { title: "Street cleaning not happening in the lane", slug: "garbage-waste", description: "The sweeper has not visited our lane for over two weeks. Dust and plastic waste accumulate at the corner and blow into houses whenever a vehicle passes." },
  { title: "Leaking sewer line under the footpath", slug: "drainage", description: "A sewer line under the footpath is leaking and the sludge is seeping into the open. The footpath is sinking slowly and the smell has made the whole lane unbearable." },
  { title: "Faded zebra crossing near school", slug: "traffic-signal", description: "The zebra crossing near the school has completely faded. Children crossing in the morning are invisible to fast-moving traffic and parents are extremely worried." },
  { title: "Fallen tree blocking the service road", slug: "tree-environment", description: "A tree fell across the service road during the night. The entire road is blocked, ambulances cannot pass, and no department has come to clear it for two days." },
  { title: "Damaged railing on the bridge walkway", slug: "public-infrastructure", description: "The railing on the bridge walkway has collapsed over a 10-metre stretch. Pedestrians, including schoolchildren, walk right next to the drop with no protection." },
  { title: "Mosquito breeding in stagnant water pit", slug: "public-safety", description: "A construction pit filled with rainwater has become a massive mosquito breeding ground next to the residential colony. Dengue cases have been reported in three buildings." },
  { title: "Buses stopping in the middle of the road", slug: "traffic-signal", description: "Without a marked bay, buses stop in the middle of the road at this stop, forcing two-wheelers to overtake from the left. Several close calls happen every evening." },
];

// ---------------------------------------------------------------------------
// Placeholder images (SVGs written into local storage)
// ---------------------------------------------------------------------------

const IMG_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  "road-damage": { bg: "#3b3a38", fg: "#d35a34", label: "Road Damage" },
  streetlight: { bg: "#232a33", fg: "#d9930d", label: "Streetlight" },
  "garbage-waste": { bg: "#2f3a2f", fg: "#7a9a6d", label: "Waste" },
  "water-supply": { bg: "#25313d", fg: "#5b93c7", label: "Water Supply" },
  drainage: { bg: "#31373d", fg: "#6f8fae", label: "Drainage" },
  "traffic-signal": { bg: "#2d2a33", fg: "#c77b5b", label: "Traffic" },
  footpath: { bg: "#3d3a35", fg: "#b7a06d", label: "Footpath" },
  "public-safety": { bg: "#3a2d2d", fg: "#c04545", label: "Safety" },
  "tree-environment": { bg: "#2b3a2e", fg: "#6da57a", label: "Environment" },
  "public-toilet": { bg: "#33373d", fg: "#8fa9bd", label: "Sanitation" },
  "animal-related": { bg: "#3a352b", fg: "#b59a6a", label: "Animal" },
  noise: { bg: "#312d3a", fg: "#9d8fc7", label: "Noise" },
  "public-infrastructure": { bg: "#33312e", fg: "#a8977f", label: "Infrastructure" },
  "public-spaces": { bg: "#2c3830", fg: "#7fb08a", label: "Public Space" },
  other: { bg: "#353535", fg: "#aaaaaa", label: "Civic Issue" },
};

function writeSeedImages(dir: string): Map<string, string> {
  const urls = new Map<string, string>();
  for (const [slug, style] of Object.entries(IMG_STYLES)) {
    for (let v = 1; v <= 2; v++) {
      const file = `seed-${slug}-${v}.svg`;
      const full = path.join(dir, file);
      mkdirSync(path.dirname(full), { recursive: true });
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="${style.bg}"/>
  <circle cx="640" cy="120" r="180" fill="${style.fg}" opacity="0.12"/>
  <circle cx="120" cy="500" r="220" fill="${style.fg}" opacity="0.08"/>
  <g transform="translate(400 270)">
    <circle r="86" fill="${style.fg}" opacity="0.9"/>
    <path d="M0 -44 C -24 -44 -44 -24 -44 0 C -44 30 0 62 0 62 C 0 62 44 30 44 0 C 44 -24 24 -44 0 -44 Z" fill="${style.bg}"/>
    <circle cy="-4" r="15" fill="${style.fg}"/>
  </g>
  <text x="400" y="430" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#ffffff" text-anchor="middle">${style.label}</text>
  <text x="400" y="470" font-family="Arial, sans-serif" font-size="18" fill="#ffffff" opacity="0.65" text-anchor="middle">Field evidence photo · sample #${v}</text>
</svg>`;
      writeFileSync(full, svg);
      urls.set(`${slug}-${v}`, `/api/files/images/seed/${file}`);
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Seed main
// ---------------------------------------------------------------------------

export async function seed(): Promise<void> {
  console.log("▶ Seeding CivicIssue database…");
  const db = await getDb();
  const password = process.env.DEMO_SEED_PASSWORD ?? "CivicDemo!2026";
  const passwordHash = await hashPassword(password);

  // Wipe in FK-safe order.
  console.log("  · clearing existing data");
  await db.delete(issueImages);
  await db.delete(issueStatusHistory);
  await db.delete(issueEvents);
  await db.delete(comments);
  await db.delete(upvotes);
  await db.delete(follows);
  await db.delete(confirmations);
  await db.delete(feedback);
  await db.delete(notifications);
  await db.delete(auditLogs);
  await db.delete(abuseReports);
  await db.delete(passwordResets);
  await db.delete(drafts);
  await db.delete(issues);
  await db.delete(workers);
  await db.delete(users);
  await db.delete(categories);
  await db.delete(departments);
  await db.delete(counters);
  await db.delete(appSettings);

  // Departments
  const deptIds = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const id = nextId();
    deptIds.set(d.name, id);
    await db.insert(departments).values({
      id,
      name: d.name,
      description: d.description,
      contactEmail: d.email,
      contactPhone: "+91 20 2550 0000",
      zones: d.zones,
    });
  }
  console.log(`  · ${DEPARTMENTS.length} departments`);

  // Categories
  const catIds = new Map<string, { id: string; deptId: string | null; sla: { c: number; h: number; m: number; l: number } }>();
  for (const c of CATEGORY_DEFS) {
    const id = nextId();
    catIds.set(c.slug, {
      id,
      deptId: deptIds.get(c.dept) ?? null,
      sla: c.sla,
    });
    await db.insert(categories).values({
      id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      description: `Reports related to ${c.name.toLowerCase()}.`,
      defaultDepartmentId: deptIds.get(c.dept) ?? null,
      slaCriticalHours: c.sla.c,
      slaHighHours: c.sla.h,
      slaMediumHours: c.sla.m,
      slaLowHours: c.sla.l,
      defaultPriority: c.slug === "public-safety" ? "HIGH" : "MEDIUM",
    });
  }
  console.log(`  · ${CATEGORY_DEFS.length} categories with SLA configs`);

  // Users + workers
  const workerIds = new Map<string, string>(); // userId -> workerId
  for (const p of PEOPLE) {
    await db.insert(users).values({
      id: p.id,
      name: p.name,
      email: p.email,
      passwordHash,
      role: p.role,
      phone: p.role === "CITIZEN" ? null : `+91 98${randInt(10000000, 99999999)}`,
      city: p.city,
      locality: p.locality ?? null,
      departmentId: p.departmentIdx !== undefined ? [...deptIds.values()][p.departmentIdx]! : null,
      trustScore: p.role === "CITIZEN" ? randInt(10, 180) : 0,
      createdAt: new Date(Date.now() - randInt(60, 400) * 86_400_000),
    });
    if (p.role === "WORKER") {
      const wid = nextId();
      workerIds.set(p.id, wid);
      await db.insert(workers).values({
        id: wid,
        userId: p.id,
        employeeId: p.employeeId!,
        departmentId: [...deptIds.values()][p.departmentIdx ?? 0]!,
        zone: p.zone ?? null,
        phone: `+91 98${randInt(10000000, 99999999)}`,
      });
    }
  }
  console.log(`  · ${PEOPLE.length} users (${PEOPLE.filter((p) => p.role === "WORKER").length} field workers)`);

  // Seed images
  const uploadsDir = path.resolve(
    process.cwd(),
    process.env.STORAGE_LOCAL_DIR ?? "./data/uploads"
  );
  const imageUrls = writeSeedImages(path.join(uploadsDir, "images/seed"));
  console.log(`  · ${imageUrls.size} placeholder evidence images`);

  // -------------------------------------------------------------------------
  // Issues
  // -------------------------------------------------------------------------
  const citizens = PEOPLE.filter((p) => p.role === "CITIZEN");
  const NOW = Date.now();
  const YEAR = new Date(NOW).getFullYear();

  // Handcrafted "demo journey" issues first (presentation-critical).
  const heroIssues: {
    title: string;
    description: string;
    slug: string;
    status: IssueStatus;
    severity: Severity;
    localityIdx: number;
    reporter: SeedUser;
    ageDays: number;
    upvotes: number;
    privacy?: "EXACT" | "APPROXIMATE";
  }[] = [
    {
      title: "Large pothole near college gate",
      description:
        "A deep pothole has formed near the main entrance of the college on University Road. Two-wheelers are having difficulty passing through it, especially during rain. It is about two feet wide and gets completely hidden in waterlogged conditions.",
      slug: "road-damage",
      status: "IN_PROGRESS",
      severity: "HIGH",
      localityIdx: 10,
      reporter: PEOPLE[0]!,
      ageDays: 4,
      upvotes: 127,
    },
    {
      title: "Streetlight not working near bus stop",
      description:
        "The streetlight at the Kothrud bus stop has not worked for five days. The entire stretch is pitch dark after 8 PM and commuters, especially women students returning late, feel unsafe waiting there.",
      slug: "streetlight",
      status: "ASSIGNED",
      severity: "MEDIUM",
      localityIdx: 0,
      reporter: PEOPLE[0]!,
      ageDays: 6,
      upvotes: 34,
    },
    {
      title: "Open manhole on school walking route",
      description:
        "The manhole cover outside the municipal school on Katraj Road is missing. Children walk past it every day. A temporary plank has been placed but it shifts easily. This is an immediate safety risk.",
      slug: "public-safety",
      status: "ESCALATED",
      severity: "CRITICAL",
      localityIdx: 8,
      reporter: PEOPLE[7]!,
      ageDays: 9,
      upvotes: 203,
    },
    {
      title: "Garbage accumulation near market road",
      description:
        "Garbage has not been collected near Market Yard road for ten days. The heap has spread onto the footpath, stray animals scatter it at night, and the stench affects the vegetable vendors throughout the day.",
      slug: "garbage-waste",
      status: "RESOLVED",
      severity: "MEDIUM",
      localityIdx: 12,
      reporter: PEOPLE[3]!,
      ageDays: 14,
      upvotes: 58,
    },
    {
      title: "Blocked drainage after heavy rainfall",
      description:
        "The storm drain at the Baner junction is blocked and rainwater entered six ground-floor flats last night. The water is still stagnant and residents are worried about mosquito-borne disease.",
      slug: "drainage",
      status: "VERIFIED",
      severity: "HIGH",
      localityIdx: 1,
      reporter: PEOPLE[1]!,
      ageDays: 2,
      upvotes: 41,
    },
    {
      title: "Water leakage outside residential society",
      description:
        "A pipeline joint outside Sahyadri Society in Viman Nagar has been leaking continuously for three days. Clean supply water is flooding the street and the road surface is starting to cave in.",
      slug: "water-supply",
      status: "SUBMITTED",
      severity: "MEDIUM",
      localityIdx: 7,
      reporter: PEOPLE[6]!,
      ageDays: 1,
      upvotes: 8,
    },
    {
      title: "Broken footpath near public hospital",
      description:
        "Footpath slabs near Sassoon Hospital gate are broken and tilted. Attendants carrying patients and elderly visitors trip regularly. The ramp for wheelchairs is also cracked and unusable.",
      slug: "footpath",
      status: "UNDER_REVIEW",
      severity: "MEDIUM",
      localityIdx: 4,
      reporter: PEOPLE[2]!,
      ageDays: 3,
      upvotes: 19,
    },
    {
      title: "Huge pothole outside City Mall service road",
      description:
        "There is a huge hole in the road outside the City Mall service road near the parking entrance. Cars almost bottom out crossing it and delivery two-wheelers have skidded twice this week.",
      slug: "road-damage",
      status: "RESOLVED",
      severity: "HIGH",
      localityIdx: 2,
      reporter: PEOPLE[5]!,
      ageDays: 21,
      upvotes: 89,
    },
  ];

  const STATUS_PATHS: Record<string, IssueStatus[]> = {
    SUBMITTED: ["SUBMITTED"],
    UNDER_REVIEW: ["SUBMITTED", "UNDER_REVIEW"],
    VERIFIED: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED"],
    REJECTED: ["SUBMITTED", "UNDER_REVIEW", "REJECTED"],
    WAITING_FOR_INFORMATION: ["SUBMITTED", "UNDER_REVIEW", "WAITING_FOR_INFORMATION"],
    ASSIGNED: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED"],
    IN_PROGRESS: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS"],
    RESOLVED: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"],
    CLOSED: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"],
    REOPENED: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REOPENED"],
    ESCALATED: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "ESCALATED"],
  };

  const EVENT_MESSAGES: Record<IssueStatus, (ctx: { name: string; dept?: string; worker?: string }) => string> = {
    DRAFT: () => "Draft saved",
    SUBMITTED: ({ name }) => `Report submitted by ${name}`,
    UNDER_REVIEW: () => "Authority started reviewing the report",
    VERIFIED: () => "Report verified by the authority after evidence review",
    REJECTED: () => "Report rejected — did not meet verification criteria",
    ASSIGNED: ({ dept, worker }) =>
      worker ? `Assigned to ${worker} (${dept ?? "field team"})` : `Assigned to ${dept ?? "responsible department"}`,
    IN_PROGRESS: ({ worker }) => (worker ? `${worker} started repair work on site` : "Repair work started on site"),
    WAITING_FOR_INFORMATION: () => "Authority requested additional information from the reporter",
    RESOLVED: () => "Work completed and resolution evidence uploaded",
    CLOSED: () => "Issue closed after citizen confirmation",
    REOPENED: () => "Reporter reopened the issue — the problem persists",
    ESCALATED: () => "Issue escalated — SLA deadline exceeded",
  };

  let issueSeq = 0;
  const allIssueIds: string[] = [];
  const resolvedIssueIds: { issueId: string; reporterId: string; resolvedAt: Date }[] = [];

  interface SeededIssuePlan {
    title: string;
    description: string;
    slug: string;
    status: IssueStatus;
    severity: Severity;
    localityIdx: number;
    reporter: SeedUser;
    ageDays: number;
    upvotes: number;
    privacy: "EXACT" | "APPROXIMATE";
    isHero: boolean;
  }

  const plans: SeededIssuePlan[] = [];

  // Hero issues
  for (const h of heroIssues) {
    plans.push({ ...h, privacy: h.privacy ?? "EXACT", isHero: true });
  }

  // Bulk generated issues (~890) with realistic distributions.
  const TOTAL_BULK = 892;
  for (let i = 0; i < TOTAL_BULK; i++) {
    const template = pick(ISSUE_POOL);
    const localityIdx = randInt(0, LOCALITIES.length - 1);
    const loc = LOCALITIES[localityIdx]!;
    // Vary the title slightly so it reads naturally at scale.
    const suffix = pick([
      ` near ${loc.name}`,
      ` at ${loc.name} junction`,
      ` outside ${pick(["the metro station", "the vegetable market", "the bus depot", "the community hall", "the flyover", "the shopping complex"])}`,
      ` on ${loc.name} main road`,
      "",
    ]);
    const roll = rand();
    let status: IssueStatus;
    if (roll < 0.55) status = "RESOLVED";
    else if (roll < 0.62) status = "CLOSED";
    else if (roll < 0.72) status = "IN_PROGRESS";
    else if (roll < 0.79) status = "ASSIGNED";
    else if (roll < 0.85) status = "UNDER_REVIEW";
    else if (roll < 0.9) status = "VERIFIED";
    else if (roll < 0.945) status = "SUBMITTED";
    else if (roll < 0.965) status = "REJECTED";
    else if (roll < 0.98) status = "REOPENED";
    else if (roll < 0.992) status = "ESCALATED";
    else status = "WAITING_FOR_INFORMATION";

    const severity: Severity = pick<Severity>(["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "CRITICAL"]);
    const upvotes =
      severity === "CRITICAL" ? randInt(20, 240) : severity === "HIGH" ? randInt(5, 120) : randInt(0, 40);
    plans.push({
      title: (template.title + suffix).trim(),
      description: template.description,
      slug: template.slug,
      status,
      severity,
      localityIdx,
      reporter: pick(citizens),
      ageDays: randInt(0, 180),
      upvotes,
      privacy: rand() < 0.12 ? "APPROXIMATE" : "EXACT",
      isHero: false,
    });
  }

  // Sort by age (oldest first) so public IDs increment chronologically.
  plans.sort((a, b) => b.ageDays - a.ageDays);

  console.log(`  · seeding ${plans.length} issues…`);
  const authorityUsers = PEOPLE.filter((p) => p.role === "AUTHORITY");
  const adminUser = PEOPLE.find((p) => p.role === "ADMIN")!;
  const workerPool = PEOPLE.filter((p) => p.role === "WORKER");

  for (const plan of plans) {
    issueSeq++;
    const loc = LOCALITIES[plan.localityIdx]!;
    const cat = catIds.get(plan.slug)!;
    const template = CATEGORY_DEFS.find((c) => c.slug === plan.slug)!;
    const createdAt = new Date(NOW - plan.ageDays * 86_400_000 - randInt(0, 82_800_000));
    const issueId = nextId();
    const publicId = `CIV-${YEAR}-${String(issueSeq).padStart(6, "0")}`;

    // Jitter coordinates ~±250m around the locality centre.
    const lat = round6(loc.lat + (rand() - 0.5) * 0.0045);
    const lng = round6(loc.lng + (rand() - 0.5) * 0.0045);

    const priorityResult = computePriority({
      severity: plan.severity,
      categorySlug: plan.slug,
      title: plan.title,
      description: plan.description,
      upvotes: plan.upvotes,
      confirmations: Math.floor(plan.upvotes / 8),
    });

    const path = STATUS_PATHS[plan.status] ?? ["SUBMITTED"];
    const statusDurationHours: number[] = [];
    for (let s = 0; s < path.length; s++) {
      statusDurationHours.push(s === 0 ? 0 : randInt(2, 40));
    }
    // Ensure the whole journey fits within the issue's age.
    let totalHours = statusDurationHours.reduce((a, b) => a + b, 0);
    const ageHours = plan.ageDays * 24;
    if (totalHours > Math.max(ageHours - 4, totalHours)) {
      // nothing to clamp for old issues; young issues compress the path
      if (totalHours > ageHours) {
        const scale = Math.max(0.1, (ageHours - 1) / totalHours);
        for (let s = 1; s < statusDurationHours.length; s++) {
          statusDurationHours[s] = Math.max(1, Math.round(statusDurationHours[s]! * scale));
        }
        totalHours = statusDurationHours.reduce((a, b) => a + b, 0);
      }
    }

    const slaDeadline = computeSlaDeadline(createdAt, priorityResult.priority, {
      slaCriticalHours: template.sla.c,
      slaHighHours: template.sla.h,
      slaMediumHours: template.sla.m,
      slaLowHours: template.sla.l,
    });

    const deptId = cat.deptId;
    const assignedWorker =
      path.includes("ASSIGNED") || path.includes("IN_PROGRESS")
        ? pick(workerPool)
        : null;
    const assignedWorkerId = assignedWorker ? workerIds.get(assignedWorker.id) ?? null : null;

    // Resolve timestamps
    let stepTime = createdAt.getTime();
    const stepTimestamps: Date[] = [createdAt];
    for (let s = 1; s < path.length; s++) {
      stepTime += statusDurationHours[s]! * 3_600_000;
      stepTimestamps.push(new Date(Math.min(stepTime, NOW - 60_000)));
    }
    const resolvedAt = plan.status === "RESOLVED" || plan.status === "CLOSED" ? stepTimestamps[path.indexOf("RESOLVED")] ?? null : null;
    const closedAt = plan.status === "CLOSED" ? stepTimestamps[path.length - 1] ?? null : null;

    const isOpen = !["RESOLVED", "CLOSED", "REJECTED"].includes(plan.status);
    const overdue = isOpen && slaDeadline.getTime() < NOW && plan.status !== "WAITING_FOR_INFORMATION";
    const updatedAt = stepTimestamps[stepTimestamps.length - 1]!;

    await db.insert(issues).values({
      id: issueId,
      publicId,
      title: plan.title,
      description: plan.description,
      categoryId: cat.id,
      status: plan.status,
      severity: plan.severity,
      priority: priorityResult.priority,
      priorityScore: priorityResult.score,
      priorityExplanation: priorityResult.explanation,
      latitude: lat,
      longitude: lng,
      address: `${loc.name}, Pune, Maharashtra`,
      city: "Pune",
      state: "Maharashtra",
      pincode: String(411000 + randInt(1, 60)),
      locality: loc.name,
      zone: loc.zone,
      locationPrivacy: plan.privacy,
      createdById: plan.reporter.id,
      departmentId: path.length > 2 ? deptId : null,
      assignedWorkerId,
      isPublic: true,
      aiCategory: rand() < 0.85 ? plan.slug : null,
      aiConfidence: rand() < 0.85 ? round6(0.72 + rand() * 0.25) : null,
      aiSeverity: rand() < 0.6 ? plan.severity : null,
      aiSummary: null,
      slaDeadline,
      isOverdue: overdue,
      resolvedAt,
      closedAt,
      reopenCount: plan.status === "REOPENED" ? 1 : 0,
      upvotesCount: plan.upvotes,
      commentsCount: 0,
      confirmationsCount: Math.floor(plan.upvotes / 8),
      createdAt,
      updatedAt,
    });
    allIssueIds.push(issueId);
    if (resolvedAt && plan.reporter) {
      resolvedIssueIds.push({ issueId, reporterId: plan.reporter.id, resolvedAt });
    }

    // Status history + timeline events along the path.
    for (let s = 0; s < path.length; s++) {
      const st = path[s]!;
      const ts = stepTimestamps[s]!;
      const actor =
        s === 0
          ? plan.reporter
          : st === "IN_PROGRESS" && assignedWorker
            ? assignedWorker
            : st === "RESOLVED" && assignedWorker
              ? assignedWorker
              : st === "ESCALATED"
                ? adminUser
                : pick(authorityUsers);
      await db.insert(issueStatusHistory).values({
        id: nextId(),
        issueId,
        fromStatus: s === 0 ? null : path[s - 1]!,
        toStatus: st,
        changedById: actor.id,
        reason: st === "REJECTED" ? pick(["Duplicate of an existing report", "Insufficient information", "Not a civic issue"]) : null,
        createdAt: ts,
      });
      await db.insert(issueEvents).values({
        id: nextId(),
        issueId,
        type: st,
        actorId: actor.id,
        actorRole: actor.role,
        message: EVENT_MESSAGES[st]({
          name: plan.reporter.name,
          dept: DEPARTMENTS.find((d) => deptIds.get(d.name) === deptId)?.name,
          worker: assignedWorker?.name,
        }),
        isPublic: !["WAITING_FOR_INFORMATION"].includes(st),
        createdAt: ts,
      });
      if (s === 0 && plan.upvotes > 30) {
        await db.insert(issueEvents).values({
          id: nextId(),
          issueId,
          type: "PRIORITY_COMPUTED",
          actorId: null,
          actorRole: "SYSTEM",
          message: `Priority computed: ${priorityResult.priority} (score ${priorityResult.score}/100)`,
          isPublic: true,
          createdAt: new Date(ts.getTime() + 60_000),
        });
      }
    }

    // Evidence images for ~65% of issues.
    if (rand() < 0.65) {
      const nImages = randInt(1, 3);
      for (let im = 0; im < nImages; im++) {
        await db.insert(issueImages).values({
          id: nextId(),
          issueId,
          url: imageUrls.get(`${plan.slug}-${(im % 2) + 1}`)!,
          type: "BEFORE",
          sortOrder: im,
          uploadedById: plan.reporter.id,
          createdAt,
        });
      }
    }
    // After photos for resolved issues (70%).
    if (resolvedAt && rand() < 0.7) {
      await db.insert(issueImages).values({
        id: nextId(),
        issueId,
        url: imageUrls.get(`${plan.slug}-2`)!,
        type: "AFTER",
        caption: "Resolution evidence",
        sortOrder: 200,
        uploadedById: assignedWorker?.id ?? plan.reporter.id,
        createdAt: resolvedAt,
      });
    }

    // Upvotes from distinct citizens (unique constraint respected).
    const voterCount = Math.min(citizens.length, Math.floor(plan.upvotes / 25));
    for (let v = 0; v < voterCount; v++) {
      const voter = citizens[v]!;
      if (voter.id === plan.reporter.id) continue;
      await db.insert(upvotes).values({
        id: nextId(),
        issueId,
        userId: voter.id,
        createdAt: new Date(createdAt.getTime() + randInt(1, 72) * 3_600_000),
      });
    }
  }

  console.log(`  · ${plans.length} issues with full timelines`);

  // -------------------------------------------------------------------------
  // Comments on popular issues
  // -------------------------------------------------------------------------
  const COMMENT_TEXTS = [
    "I pass this spot daily — it's getting worse every week.",
    "Confirmed, this is exactly as described. Two-wheelers are struggling.",
    "The same thing happened on the parallel lane last month.",
    "Thanks for reporting this. Hopefully it gets fixed quickly this time.",
    "Authority team visited yesterday and took measurements.",
    "Please also look at the streetlight next to this, it's out too.",
    "Rain makes this completely invisible. Very dangerous at night.",
    "We complained verbally to the ward office but nothing happened.",
    "Work has started, saw the crew this morning.",
    "Fixed nicely — the road surface looks new again. Thanks to everyone who supported.",
  ];
  const popular = plans
    .map((p, idx) => ({ p, idx }))
    .filter((x) => x.p.upvotes > 25)
    .slice(0, 60);
  let commentCount = 0;
  for (const { idx } of popular) {
    const n = randInt(1, 4);
    for (let c = 0; c < n; c++) {
      const commenter = rand() < 0.8 ? pick(citizens) : pick(authorityUsers);
      await db.insert(comments).values({
        id: nextId(),
        issueId: allIssueIds[idx]!,
        userId: commenter.id,
        content: pick(COMMENT_TEXTS),
        createdAt: new Date(NOW - randInt(0, 20) * 86_400_000),
      });
      commentCount++;
    }
    await db
      .update(issues)
      .set({ commentsCount: n })
      .where(eq(issues.id, allIssueIds[idx]!));
  }
  console.log(`  · ${commentCount} comments`);

  // Feedback on resolved issues (~35%)
  let fbCount = 0;
  for (const r of resolvedIssueIds) {
    if (rand() < 0.35) {
      const rating = pick([5, 5, 4, 4, 4, 3, 3, 2]);
      await db.insert(feedback).values({
        id: nextId(),
        issueId: r.issueId,
        userId: r.reporterId,
        rating,
        resolutionStatus: rating >= 4 ? "YES" : rating === 3 ? "PARTIALLY" : "NO",
        comment:
          rating >= 4
            ? pick(["Fixed properly, thank you!", "Good work by the team.", "The road is smooth again."])
            : rating === 3
              ? "Partially fixed — the patch is already cracking."
              : "The problem returned within a week.",
        createdAt: new Date(Math.min(NOW - 3_600_000, r.resolvedAt.getTime() + randInt(1, 72) * 3_600_000)),
      });
      fbCount++;
    }
  }
  console.log(`  · ${fbCount} citizen feedback entries`);

  // Follows: demo citizen follows the hero issues.
  const heroIds = allIssueIds.slice(0, heroIssues.length);
  for (const hid of heroIds.slice(0, 4)) {
    for (const c of citizens.slice(1, 4)) {
      await db.insert(follows).values({ id: nextId(), issueId: hid, userId: c.id });
    }
  }
  // Community confirmations on hero issues.
  for (const hid of heroIds.slice(0, 3)) {
    for (const c of citizens.slice(2, 5)) {
      await db.insert(confirmations).values({ id: nextId(), issueId: hid, userId: c.id, note: null });
    }
  }

  // Notifications for the demo citizen about her own issues.
  const ananya = PEOPLE[0]!;
  const ananyaIssues = plans
    .map((p, idx) => ({ p, idx }))
    .filter((x) => x.p.reporter.id === ananya.id)
    .slice(0, 12);
  for (const { p, idx } of ananyaIssues) {
    const link = `/issues/CIV-${YEAR}-${String(idx + 1).padStart(6, "0")}`;
    await db.insert(notifications).values({
      id: nextId(),
      userId: ananya.id,
      type: p.status === "RESOLVED" || p.status === "CLOSED" ? "ISSUE_RESOLVED" : p.status === "IN_PROGRESS" ? "STATUS_CHANGED" : "ISSUE_SUBMITTED",
      title:
        p.status === "RESOLVED" || p.status === "CLOSED"
          ? "Your complaint has been resolved"
          : p.status === "IN_PROGRESS"
            ? "Work has started on your complaint"
            : "Your report has been submitted",
      message: `${p.title} — ${link.split("/")[2]}`,
      issueId: allIssueIds[idx]!,
      link,
      isRead: rand() < 0.5,
      createdAt: new Date(NOW - p.ageDays * 86_400_000 + 3_600_000),
    });
  }
  // A few unread notifications so the bell shows a badge immediately.
  await db.insert(notifications).values([
    {
      id: nextId(),
      userId: ananya.id,
      type: "COMMENT_REPLY",
      title: "New comment on your report",
      message: "Confirmed, this is exactly as described. Two-wheelers are struggling.",
      issueId: allIssueIds[0]!,
      link: `/issues/CIV-${YEAR}-000001`,
      isRead: false,
    },
    {
      id: nextId(),
      userId: ananya.id,
      type: "STATUS_CHANGED",
      title: "An issue you follow was verified",
      message: "Open manhole on school walking route was verified by the authority.",
      issueId: allIssueIds[2]!,
      link: `/issues/CIV-${YEAR}-000003`,
      isRead: false,
    },
    {
      id: nextId(),
      userId: "u-santosh",
      type: "WORKER_ASSIGNED",
      title: "New job assigned: Large pothole near college gate",
      message: "Check the citizen photos and start work when possible.",
      issueId: allIssueIds[0]!,
      link: "/worker",
      isRead: false,
    },
  ]);

  // Abuse report samples for the moderation queue.
  await db.insert(abuseReports).values([
    {
      id: nextId(),
      reporterId: PEOPLE[2]!.id,
      entityType: "COMMENT",
      entityId: "seeded-comment-placeholder",
      reasonType: "SPAM",
      details: "This comment is advertising a private contractor with a phone number.",
      status: "PENDING",
    },
    {
      id: nextId(),
      reporterId: PEOPLE[4]!.id,
      entityType: "ISSUE",
      entityId: allIssueIds[allIssueIds.length - 3]!,
      reasonType: "FALSE_INFO",
      details: "I live on this street and the reported problem does not exist at this location.",
      status: "PENDING",
    },
  ]);

  // Counters — keep publicId generation aligned with seeded data.
  await db.insert(counters).values({ key: `issue_seq_${YEAR}`, value: issueSeq });

  // App settings defaults.
  await db.insert(appSettings).values([
    { key: "priority_weights", value: JSON.stringify({ severity: 40, community: 15, location: 15, safety: 15, duration: 5, category: 10 }) },
    { key: "sla_defaults", value: JSON.stringify({ CRITICAL: 24, HIGH: 48, MEDIUM: 120, LOW: 240 }) },
    { key: "demo_mode", value: JSON.stringify({ enabled: true }) },
  ]);

  // Audit trail sample.
  await db.insert(auditLogs).values({
    id: nextId(),
    actorId: adminUser.id,
    actorEmail: adminUser.email,
    action: "SYSTEM_SEEDED",
    entityType: "PLATFORM",
    entityId: null,
    metadata: JSON.stringify({ issues: plans.length, users: PEOPLE.length }),
  });

  console.log("✔ Seed complete.");
  console.log("");
  console.log("Demo accounts (password from DEMO_SEED_PASSWORD):");
  console.log(`  Citizen   citizen@example.com`);
  console.log(`  Authority authority@example.com`);
  console.log(`  Admin     admin@example.com`);
  console.log(`  Worker    worker@example.com`);
  void isPostgres;
  void obscureCoordinate;
}

/** Runtime platform settings consumed by deterministic domain engines. */
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appSettings } from "@/drizzle/sqlite/schema";
import { DEFAULT_WEIGHTS, type PriorityWeights } from "@/lib/priority/engine";
import { PLATFORM_DEFAULT_SLA_HOURS } from "@/lib/sla/engine";
import type { Priority } from "@/lib/types";

const WEIGHT_KEYS: (keyof PriorityWeights)[] = ["severity", "community", "location", "safety", "duration", "category"];
const PRIORITY_KEYS: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function parseJson(value: string | undefined): unknown {
  if (!value) return undefined;
  try { return JSON.parse(value) as unknown; } catch { return undefined; }
}

function validWeights(value: unknown): value is PriorityWeights {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const values = WEIGHT_KEYS.map((key) => record[key]);
  return values.every((entry) => typeof entry === "number" && Number.isFinite(entry) && entry >= 0 && entry <= 100)
    && values.reduce<number>((sum, entry) => sum + (typeof entry === "number" ? entry : 0), 0) === 100;
}

function validSlaDefaults(value: unknown): value is Record<Priority, number> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return PRIORITY_KEYS.every((key) => Number.isInteger(record[key]) && Number(record[key]) >= 1 && Number(record[key]) <= 4320);
}

async function runtimeSettings() {
  const db = await getDb();
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, ["priority_weights", "sla_defaults"]));
  return new Map(rows.map((row) => [row.key, row.value]));
}

export async function getPriorityWeights(): Promise<PriorityWeights> {
  const settings = await runtimeSettings();
  const configured = parseJson(settings.get("priority_weights"));
  return validWeights(configured) ? configured : DEFAULT_WEIGHTS;
}

export async function getSlaDefaults(): Promise<Record<Priority, number>> {
  const settings = await runtimeSettings();
  const configured = parseJson(settings.get("sla_defaults"));
  return validSlaDefaults(configured) ? configured : PLATFORM_DEFAULT_SLA_HOURS;
}

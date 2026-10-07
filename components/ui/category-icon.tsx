import {
  Building2,
  Cone,
  Construction,
  Droplets,
  Footprints,
  Lamp,
  PawPrint,
  ShieldAlert,
  Toilet,
  TrafficCone,
  Trash2,
  Trees,
  Volume2,
  Waves,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  construction: Construction,
  lamp: Lamp,
  "trash-2": Trash2,
  droplets: Droplets,
  waves: Waves,
  "traffic-cone": TrafficCone,
  "building-2": Building2,
  footprints: Footprints,
  trees: Trees,
  "shield-alert": ShieldAlert,
  toilet: Toilet,
  "volume-2": Volume2,
  "paw-print": PawPrint,
  cone: Cone,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Cone;
  return <Icon className={className} aria-hidden />;
}

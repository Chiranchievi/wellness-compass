import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configured = Boolean(url && key && !url.includes("YOUR_PROJECT"));
export const supabase = configured ? createClient(url!, key!) : null;

export type Profile = {
  id: string;
  display_name: string;
  role: "member" | "admin";
  team_id: string | null;
  protein_target_g: number;
  water_target_ml: number;
  steps_target: number;
};
// export type DailyLog = {
//   log_date: string; protein_g: number; water_ml: number; steps: number;
//   protein_done: boolean; water_done: boolean; steps_done: boolean; xp_earned: number;
// };

export type DailyLog = {
  log_date: string;

  // No Sugar — 21 day challenge
  no_sugar_done: boolean;

  // Protein — 50g/day split across 3 meals
  protein_morning_g: number;
  protein_afternoon_g: number;
  protein_evening_g: number;
  protein_total_g: number;
  protein_done: boolean;

  // Steps — 2,000 after each meal
  breakfast_steps: number;
  lunch_steps: number;
  dinner_steps: number;
  steps_total: number;
  steps_done: boolean;

  // Fiber — 25g/day
  fiber_g: number;
  fiber_done: boolean;

  // Sleep — 6 to 7 hours
  sleep_hours: number;
  sleep_done: boolean;

  // Digital detox — 30 minutes before bed
  digital_detox_minutes: number;
  digital_detox_done: boolean;

  xp_earned: number;
};
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const mondayOf = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const shareWhatsApp = (message: string) => {
  window.open(
    `https://wa.me/?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );
};

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configured = Boolean(url && key && !url.includes("YOUR_PROJECT"));
export const supabase = configured ? createClient(url!, key!) : null;

export type Profile = {
  id: string; display_name: string; role: "member" | "admin"; team_id: string | null;
  protein_target_g: number; water_target_ml: number; steps_target: number;
};
export type DailyLog = {
  log_date: string; protein_g: number; water_ml: number; steps: number;
  protein_done: boolean; water_done: boolean; steps_done: boolean; xp_earned: number;
};
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
export const mondayOf = (date: Date) => {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d;
};
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const shareWhatsApp = (message: string) => {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
};

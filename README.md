# Wellness Compass — PWA starter

A responsive, installable Progressive Web App for your Wellness Compass community. This version includes public self-registration, daily protein/water/steps tracking, server-calculated XP, achievement badges, all-time leaderboard, team leaderboard, weekly report, WhatsApp sharing, and an admin dashboard.

## Stack
- React + TypeScript + Vite
- Supabase Auth + Postgres + Row Level Security
- PWA manifest + service worker
- Vercel deployment

## 1. Prerequisites
Install Node.js 20 LTS or newer and npm. Create a free Supabase project at https://supabase.com.

## 2. Configure Supabase
1. Open your Supabase project → SQL Editor → New query.
2. Paste and run the full `supabase/schema.sql`.
3. In Authentication → Providers, ensure Email is enabled.
4. In Authentication → URL Configuration, set your local URL to `http://localhost:5173` and add your deployed domain after deployment.
5. Copy Project URL and the publishable/anon key from Project Settings → API.

### Promote the first admin
Create your account through the app first. Then in Supabase SQL Editor run:
```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```
Replace `YOUR_EMAIL` with your own login email. Never make public sign-up grant admin role.

### Add starter teams
After you have promoted yourself to admin, sign in and use Admin dashboard → Manage teams. Or run:
```sql
insert into public.teams(name) values ('Sunrise Squad'), ('Healthy Habits'), ('Fit Together')
on conflict (name) do nothing;
```

## 3. Run locally
```bash
npm install
cp .env.example .env
```
Edit `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```
Then:
```bash
npm run dev
```
Open the local URL printed by Vite. For signup, use an email you can verify. For quick development only, you can turn off email confirmation in Supabase Auth settings; turn it back on before public launch.

## 4. Deploy to Vercel
1. Push this project to a GitHub repository.
2. In Vercel, import that repository.
3. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
4. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy.
6. Add the Vercel production URL to Supabase Auth → URL Configuration → Site URL and Redirect URLs.

The app is a PWA; on Android Chrome, open the deployed URL → browser menu → Install app / Add to Home screen.

## 5. How scoring works
The database computes XP. The browser cannot submit points directly:
- Daily check-in: 5 XP
- Protein target reached: +20 XP
- Water target reached: +15 XP
- Steps target reached: +20 XP
- All three targets reached: +15 bonus XP
- Maximum: 75 XP/day

The current UI displays badges for first check-in, 7 water-target days, 7 protein-target days, 7 step-target days and a 7-day streak. This initial SQL awards the 7-day habit badges after seven qualifying logged days; streak calculation in the badge trigger is a rolling seven-day check.

## 6. WhatsApp workflow
The Invite button opens WhatsApp with a prefilled community invite message. The weekly report button shares a summary. Copy your WhatsApp group invite link into the invite message in `src/App.tsx` (search for `Join me:`) before launch if you want to direct people to the actual group. Do not use unofficial WhatsApp automation or bulk messaging. A future integration can use the official WhatsApp Business Platform subject to its current eligibility and messaging rules.

## 7. Important launch checklist
- Promote at least one trusted admin.
- Create teams and assign members to teams. For this MVP, assign a member's `team_id` in Supabase Table Editor → profiles; self-service team joining is not yet exposed.
- Set realistic targets with each participant. Defaults are placeholders, not medical advice.
- Review privacy wording and obtain consent before collecting health-related habit data.
- Configure Supabase Auth rate limits, CAPTCHA/anti-bot protection and email confirmation for public registration.
- Set Supabase database backups and monitor usage.
- Test with a small pilot group before inviting the whole WhatsApp community.

## 8. Current MVP boundaries
- Daily log is editable for today only; historical edits are blocked by the database function.
- Steps are manually entered; phone health-platform integration is not included.
- Protein/water/steps targets use safe configurable bounds but are not medically personalized.
- Team competition uses team-level XP, but the member assignment is currently performed by an admin in Supabase.
- Weekly report summarizes the current Monday–Sunday week.
- Service worker caches the app shell; live Supabase data still requires a connection.
- This is a deployable MVP foundation, not a certified medical product. It is for habit tracking and community motivation, not diagnosis or treatment.

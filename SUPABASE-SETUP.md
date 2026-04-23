# Rideout × Supabase — cross-device sync setup

This is what turns Rideout from a single-device prototype into a real "social network"
where guardians on one phone see riders on another phone in real time.

## 1. Rotate the service_role key

You pasted a service_role JWT in chat. That key bypasses all security. Go to:

Supabase dashboard → **Settings → API → JWT Settings → Generate new JWT secret**

That rotates BOTH the anon and service_role JWTs. Grab the new **anon** key.

## 2. Run the schema

1. Open **SQL Editor** → **New query**.
2. Paste the contents of `supabase-schema.sql` (in this repo).
3. Click **Run**.

This creates three tables (`riders`, `pages`, `links`), enables RLS with open
policies (public app, no auth yet), and adds them to the `supabase_realtime`
publication so row changes stream to subscribed clients.

## 3. Local `.env`

Copy `.env.example` → `.env` and fill in:

```
VITE_SUPABASE_URL=https://iyqqatklwbskxeqkjopb.supabase.co
VITE_SUPABASE_ANON_KEY=<the NEW anon JWT>
```

Then:

```
npm install
npm run dev
```

You should see no "[rideout] Supabase env vars missing" warning in the console.

## 4. Vercel env vars (production)

In the Vercel project dashboard:

**Settings → Environment Variables** → add both for *Production*, *Preview*, and *Development*:

| Key                      | Value                                         |
|--------------------------|-----------------------------------------------|
| `VITE_SUPABASE_URL`      | `https://iyqqatklwbskxeqkjopb.supabase.co`    |
| `VITE_SUPABASE_ANON_KEY` | (the NEW anon JWT)                            |

Then redeploy (or run `.\deploy.ps1`).

## 5. Test cross-device

1. Phone A: rider mode, complete onboarding, allow location, note the 6-char rider code in Profile.
2. Phone B: guardian mode → Link rider → paste the code.
3. Phone B's map pin for that rider should move as Phone A moves.
4. Tap the pager button on Phone B → Phone A's screen goes full-screen pager with beeps + vibration.

## Notes / tradeoffs

- **RLS is wide open.** Any anon key holder can read/write any row. Fine for a
  friends-and-family test app; lock down when you add Supabase Auth.
- **Fallback path.** If env vars are missing, the app still runs — it falls
  back to localStorage for same-origin / same-device behavior. No blank screen.
- **`links` table is defined but not yet wired.** Guardians still store linked
  rider codes in localStorage. When you want multi-device guardian setups
  (same guardian on phone + laptop), wire `linkRider` / `fetchLinksForGuardian`
  from `src/lib/supabase.js`.

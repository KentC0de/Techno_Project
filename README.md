# Preventive Maintenance Scheduler

A cross-platform Preventive Maintenance (PM) Scheduler for solar power plants and industrial systems. Built as **ONE React Native codebase** using **Expo + react-native-web** that serves both mobile apps (Android/iOS) and responsive web browsers with seamless ergonomics.

---

## Features

### Role 1: Administrator (Web & Mobile)
- **Admin Dashboard & Schedule Calendar**:
  - Interactive Month and Work Week (Mon–Sun like the Excel Master Maintenance Schedule) views.
  - Tasks colour-coded by frequency code (`D`, `W`, `M`, `Q`, `SA`).
  - Tap any day to inspect scheduled equipment, edit dates/frequencies, or delete rules.
- **Set Schedule**:
  - Step-by-step wizard: System (A/B/C/D) → Equipment Group → Area Filter → Multi-select equipment list with "Select All".
  - Configure frequency (`d`, `w`, `M`, `Q`, `SA`), start date, optional end date, weekday (1=Mon ... 7=Sun), and procedure notes.
  - Frequency is prefilled from `equipment.default_freq` as an intelligent suggestion.
  - Batch generates `schedule_rules` rows.
- **Manage Equipment**:
  - Add, edit, and toggle active/inactive status for equipment.
  - Create new equipment groups and assign them to categories.
  - Search equipment by name, group, or area.
- **Performance Report**:
  - Computes **"% Performance to Schedule"** = `(completed tasks / total due tasks) * 100` per Work Week and per Month.
  - Visual completion bar chart across work week days.
  - Breakdown table by System (A, B, C, D) and PV Field Areas (Area 1, Area 2, Area 3).
  - Real-time lists of overdue tasks and worker-reported equipment issues.
- **User Roles Management**:
  - View all user profiles and toggle permissions between `admin` and `worker`.

### Role 2: Field Worker (Mobile-First)
- **Choose My Work**:
  - Step 1: Big bold cards for the 4 Systems (A. Inverter Station Area, B. PV Field Area, C. MV & LV System, D. Other System).
  - Step 2: Select Area (Area 1, Area 2, Area 3, or All) when applicable.
  - Remembers the worker's last selection in storage, and allows switching anytime.
- **Today's Tasks**:
  - Shows only tasks due for the chosen System and Area, grouped by Group (e.g. "Grass Cutting", "Inverter", "Drainage System").
  - Date switcher: Yesterday, Today, Tomorrow, and interactive 7-day Mon–Sun Work Week strip.
  - Real-time progress bar: *"8 of 12 done today (67%)"*.
  - Overdue tasks highlighted at the top.
  - Tap any task to mark **Done**, report an **Issue** (with required notes), or **Skip**.
  - Worker entries are upserted into `task_logs` with `done_by = auth.uid()` on `(rule_id, due_date)`.
  - Reversible: workers can undo their own submitted entries.
  - Pull-to-refresh on mobile.

---

## Design & Palette
Designed strictly within **Sky Blue, Black, and White**:
- **Primary Sky Blue (`#0EA5E9`)**: Action buttons, active navigation states, progress highlights.
- **Black (`#0A0A0A`)**: Top navigation bars, dark surfaces, high-contrast titles.
- **White (`#FFFFFF`) & Soft Greys (`#E2E8F0`, `#F8FAFC`)**: Clean card backgrounds, subtle borders.
- **Frequency Badges**: Distinct shades within the palette:
  - `D` (Daily): `#E0F2FE` (Light sky) / `#0369A1` text
  - `W` (Weekly): `#0EA5E9` (Sky blue) / `#FFFFFF` text
  - `M` (Monthly): `#0A0A0A` (Black) / `#FFFFFF` text
  - `Q` (Quarterly): `#38BDF8` (Bright sky) / `#0A0A0A` text
  - `SA` (Semi-Annual): `#0369A1` (Ocean blue) / `#FFFFFF` text

---

## Database Architecture (Supabase)

The backend connects directly to Supabase (`@supabase/supabase-js`) using Supabase Auth (email + password) with Row Level Security (RLS) enabled.

- `profiles(id, full_name, role['admin'|'worker'], created_at)`
- `categories(id, code, name, sort_order)` (A Inverter Station Area, B PV Field Area, C MV & LV System, D Other System)
- `groups(id, category_id, item_no, name)`
- `equipment(id, group_id, name, area, unit_count, default_freq text[], is_active)`
- `schedule_rules(id, equipment_id, frequency['d'|'w'|'M'|'Q'|'SA'], start_date, end_date, weekday, notes, created_by, created_at)`
- `task_logs(id, rule_id, due_date, status['done'|'skipped'|'issue'], notes, done_by, done_at)` with `UNIQUE(rule_id, due_date)`

> Tasks are dynamically computed on the fly by expanding `schedule_rules` with `src/utils/schedule.js`. `task_logs` only stores completions and issue records.

---

## Getting Started

### 1. Environment Variables
Create a `.env` file in the project root (see `.env.example`):
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```
> **Note**: If Supabase keys are not set yet, the app runs in **Demo Mode** with the exact Excel Master Maintenance Schedule seed preloaded in local storage, allowing immediate evaluation of both Admin and Worker roles.

### 2. Run the Web Application
```bash
npx expo start --web
```
Press `w` in terminal or open `http://localhost:8081` in your browser.

### 3. Run on Mobile (Android / iOS with Expo Go SDK 58)
```bash
# Start Expo development server (LAN / Wi-Fi)
npx expo start

# If phone is on mobile data or a different Wi-Fi network, use tunnel mode:
npx expo start --tunnel

# Open on Android emulator or connected device
npx expo start --android

# Open on iOS simulator (macOS only)
npx expo start --ios
```
Scan the displayed QR code with the **Expo Go (SDK 58)** app on your mobile device.

---

## Project Structure
```
├── App.js                         # Root application entry
├── app.json                       # Expo configuration
├── package.json                   # Dependencies & run scripts
├── .env.example                   # Environment variable template
├── .env                           # Local environment config
└── src
    ├── theme.js                   # Sky blue, black & white design tokens
    ├── components                 # Reusable UI components (.js only)
    │   ├── EmptyState.js
    │   ├── ErrorMessage.js
    │   ├── FrequencyBadge.js
    │   ├── Header.js
    │   ├── LoadingSkeleton.js
    │   ├── ProgressBar.js
    │   ├── StatusBadge.js
    │   ├── TaskActionModal.js
    │   ├── TaskCard.js
    │   └── WebSidebar.js
    ├── context                    # Authentication context & session
    │   └── AuthContext.js
    ├── lib                        # Supabase client & unified data services
    │   ├── dataService.js
    │   ├── initialData.js
    │   └── supabase.js
    ├── navigation                 # Responsive navigation & routing
    │   └── AppNavigator.js
    ├── screens
    │   ├── admin                  # Administrator screens
    │   │   ├── ManageEquipmentScreen.js
    │   │   ├── PerformanceScreen.js
    │   │   ├── ScheduleCalendarScreen.js
    │   │   ├── SetScheduleScreen.js
    │   │   └── UsersScreen.js
    │   ├── auth                   # Authentication & user profile
    │   │   ├── LoginScreen.js
    │   │   └── ProfileScreen.js
    │   └── worker                 # Mobile-first field worker screens
    │       ├── ChooseWorkScreen.js
    │       └── TodayScreen.js
    └── utils                      # Recurrence & schedule expansion engine
        └── schedule.js
```

---

## Verification & Hard Rules Compliance
- ✅ **React Native only**: All component and screen files strictly use the `.js` extension (zero `.jsx`, `.ts`, or `.tsx`).
- ✅ **Supabase client**: Connected via `@supabase/supabase-js`, reading `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- ✅ **Schema preservation**: Uses the exact requested tables and columns; no schema generation scripts.
- ✅ **Dynamic schedule calculation**: Due dates expanded dynamically with `src/utils/schedule.js` supporting `d`, `w`, `M`, `Q`, `SA`.
- ✅ **Responsive**: Desktop sidebar on wide screens, ergonomic bottom tab bar on mobile.

---

## Local Testing of Email Confirmation

When testing worker sign-up and email confirmation locally, configure your Supabase Dashboard as follows:

### 1. Supabase Dashboard URL Configuration
Navigate to **Authentication -> URL Configuration**:
- **Site URL**: `http://localhost:8081`
- **Redirect URLs**:
  - `http://localhost:8081/**`
  - `solarpm://**`
  - `exp://**`

### 2. Testing Modes (Confirmation ON vs OFF)
- **Confirm email = ON** (Production & Real Verification Test):
  - In Supabase: **Authentication -> Providers -> Email -> Confirm email: ON**.
  - Worker signs up in mobile app / web -> A "Check your email" screen is displayed with instructions, a 60s cooldown resend button, and a back-to-login button.
  - Clicking the email verification link redirects to `/auth/confirmed` on web or deep links to `solarpm://auth/confirmed` on mobile (or `exp://.../--/auth/confirmed` in Expo Go).
  - The confirmation screen verifies the token, displays "Email confirmed!", signs out any temporary session, and lets the user log in cleanly.
- **Confirm email = OFF** (Fastest Local Development):
  - In Supabase: **Authentication -> Providers -> Email -> Confirm email: OFF**.
  - A mobile device cannot open `localhost` email links without a tunnel/proxy. Turning confirmation OFF causes `signUp` to return an active session immediately, directing the worker straight into their task dashboard without requiring email clicks.
- **Rate Limit Caution**: Supabase's built-in email service limits outgoing emails to ~3–4 per hour on free accounts. If testing repeatedly, use different test emails or turn "Confirm email" OFF to avoid email throttling.

---

## Local Testing for Supabase Auth Emails (Password Reset & Confirmation)

When testing password reset and signup confirmation emails locally with physical devices (phones on Expo Go or mobile browsers):

### 1. Supabase Dashboard URL Configuration
Go to **Supabase Dashboard -> Authentication -> URL Configuration**:
- **Site URL**: `http://localhost:8081`
- **Redirect URLs** (add each of these patterns):
  - `http://localhost:8081/**`
  - `http://192.168.*.*:8081/**` (matches your local Wi-Fi IP address)
  - `exp://**` (for Expo Go deep links)
  - `solarpm://**` (for standalone app builds)

### 2. Physical Phone Access & Wi-Fi
- Ensure your mobile phone and your dev computer are connected to the **same local Wi-Fi network**.
- Ensure your computer firewall allows incoming connections on port `8081` (Metro bundler).
- When you click "Send Reset Link" on mobile or web, `getAuthRedirectUrl` computes the LAN IP (e.g. `http://192.168.1.50:8081/auth/reset-password`). Opening this email on your phone connects directly to your local computer's Expo server instead of failing on "localhost refused to connect".

### 3. Immediate Testing Without Email (Direct Dashboard Override)
If you hit Supabase default SMTP email rate limits (~3 emails/hour on free tier):
1. **Via Dashboard**: Go to **Authentication -> Users** -> Click the three dots (`...`) next to the user -> Select **Auto-confirm** or **Change password**.
2. **Via SQL**: Run in **SQL Editor**:
   ```sql
   UPDATE auth.users
   SET encrypted_password = crypt('YourNewPassword123!', gen_salt('bf'))
   WHERE email = 'worker@solarpm.com';
   ```

---

## Why Password Reset Emails May Not Arrive

If password reset emails do not arrive when clicking "Send Reset Link":

1. **Supabase URL Configuration**:
   - In **Authentication -> URL Configuration**, ensure `http://localhost:8081` is set as **Site URL** and `http://localhost:8081/**`, `solarpm://**`, and `exp://**` are present in **Redirect URLs**.
2. **Built-in Rate Limits & Whitelist**:
   - Supabase's default SMTP provider allows only ~3–4 emails per hour across all project users.
   - For free tier projects, Supabase may restrict email delivery strictly to members of your Supabase organization. Check **Logs -> Auth** in the dashboard for `over_email_send_rate_limit` or delivery errors.
3. **Custom SMTP Setup (Recommended for Full Testing)**:
   - To send to any email address without restrictions, configure a custom SMTP provider in **Authentication -> Emails -> SMTP Settings**:
     - **Sender Email**: Your verified sender (e.g. `support@yourdomain.com` or your Gmail address)
     - **Sender Name**: `Solar PM Hub`
     - **Host**: e.g. `smtp.resend.com` (Resend), `smtp-relay.brevo.com` (Brevo), or `smtp.gmail.com` (Gmail)
     - **Port**: `587` (TLS) or `465` (SSL)
     - **Username**: Your SMTP username / email
     - **Password**: Your SMTP API key or Gmail App Password (never your main Gmail password)
4. **Email Templates**:
   - Verify that **Authentication -> Email Templates -> Reset Password** contains the confirmation tag `{{ .ConfirmationURL }}`.
   - Check the recipient's **Spam / Junk** folder.
5. **Local Manual Password Reset**:
   - While testing locally, you can also update any user's password directly from the Supabase Dashboard: go to **Authentication -> Users**, click the three dots (`...`) next to the user, and select **Send password recovery** or **Auto-confirm / Change password**.

---

## Scaling Notes & Safe Concurrent Data Access

The architecture is hardened for concurrent multi-user environments (multiple admins scheduling while field workers submit task logs):

### 1. Unified Query Caching with `@tanstack/react-query`
- **Schedule and dynamic logs** use `staleTime: 30s` with immediate garbage collection retention `gcTime: 10m` and exponential backoff retry (`retry: 3`).
- **Static reference data** (`categories`, `groups`, `equipment`) uses `staleTime: 10m` to prevent redundant network requests.
- **Request de-duplication**: Identical parallel requests across multiple components or screens are merged into a single network call.
- **Window focus refetching**: Enabled on web so active browser tabs re-synchronize when focused.
- **Date-range filtering**: Queries request only the active visible work week or month range (`gte` and `lte` on `due_date`), avoiding bulk full-table downloads.
- **Joined Selects**: Equipment, groups, and categories are loaded in a single joined select (`equipment(*, group:groups(*, category:categories(*)))`) to eliminate N+1 queries.

### 2. Concurrency Safety & Mutation Guards
- **Atomic Upsert**: Task completions use `upsert` with `onConflict: 'rule_id,due_date'`. If another worker completes the same task concurrently, PostgreSQL constraint `23505` is caught gracefully with a friendly notification (`"Already completed by someone else"`).
- **Optimistic Updates**: Worker completions update the UI immediately with automatic rollback if the network fails.
- **Double-Submit Prevention**: Mutation state flags (`isPending`) disable submit buttons on Set Schedule and Task Modals.
- **Supabase Realtime**: Live Postgres changes on `task_logs` invalidate React Query caches across all connected sessions without aggressive background polling timers.

### 3. Staying within Supabase Free Tier Limits
- **Connection pooling**: Always connect your server or external functions via Supabase connection pooler (`port 6543`, transaction mode with Supavisor) rather than direct `port 5432`.
- **Egress & API limits**: The client limits pagination ranges using `.range(0, 999)` for large datasets and projects only required columns.
- **Realtime connections**: Keep realtime subscriptions focused on specific channel names and ensure channels are unsubscribed on unmount via `supabase.removeChannel(channel)`.
- **Dashboard monitoring**: Periodically monitor database RAM/CPU, egress bandwidth, and Realtime concurrent connections in the Supabase Dashboard under **Project Settings > Usage**.



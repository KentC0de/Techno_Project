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


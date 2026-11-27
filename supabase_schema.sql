-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'worker'::text CHECK (role = ANY (ARRAY['admin'::text, 'worker'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'disabled'::text])),
  disabled_at timestamp with time zone,
  disabled_by uuid,
  disabled_reason text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_disabled_by_fkey FOREIGN KEY (disabled_by) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  item_no integer NOT NULL,
  name text NOT NULL,
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  name text NOT NULL,
  area text CHECK ((area = ANY (ARRAY['Area 1'::text, 'Area 2'::text, 'Area 3'::text])) OR area IS NULL),
  unit_count integer NOT NULL DEFAULT 1,
  default_freq ARRAY NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT equipment_pkey PRIMARY KEY (id),
  CONSTRAINT equipment_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id)
);
CREATE TABLE public.schedule_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL,
  frequency text NOT NULL CHECK (frequency = ANY (ARRAY['d'::text, 'w'::text, 'M'::text, 'Q'::text, 'SA'::text])),
  start_date date NOT NULL,
  end_date date,
  weekday integer CHECK (weekday >= 1 AND weekday <= 7 OR weekday IS NULL),
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  worker_group_id uuid,
  CONSTRAINT schedule_rules_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_rules_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id),
  CONSTRAINT schedule_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT schedule_rules_worker_group_id_fkey FOREIGN KEY (worker_group_id) REFERENCES public.worker_groups(id)
);
CREATE TABLE public.task_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['submitted'::text, 'done'::text, 'rejected'::text, 'issue'::text, 'skipped'::text])),
  notes text,
  done_by uuid,
  done_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_at timestamp with time zone,
  approved_by uuid,
  approved_at timestamp with time zone,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_note text,
  CONSTRAINT task_logs_pkey PRIMARY KEY (id),
  CONSTRAINT task_logs_done_by_fkey FOREIGN KEY (done_by) REFERENCES auth.users(id),
  CONSTRAINT task_logs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id),
  CONSTRAINT task_logs_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id),
  CONSTRAINT task_logs_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.schedule_rules(id)
);
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text,
  user_role text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  location text,
  summary text,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.app_settings (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'The app is under maintenance. Please come back later.'::text,
  support_contact text,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id),
  CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.rule_assignments (
  rule_id uuid NOT NULL,
  user_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rule_assignments_pkey PRIMARY KEY (rule_id, user_id),
  CONSTRAINT rule_assignments_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.schedule_rules(id),
  CONSTRAINT rule_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT rule_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id)
);
CREATE TABLE public.worker_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#0EA5E9'::text,
  shift_label text,
  shift_start time without time zone,
  shift_end time without time zone,
  work_days ARRAY NOT NULL DEFAULT '{1,2,3,4,5}'::integer[] CHECK (work_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT worker_groups_pkey PRIMARY KEY (id),
  CONSTRAINT worker_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.worker_group_members (
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  added_by uuid,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT worker_group_members_pkey PRIMARY KEY (user_id),
  CONSTRAINT worker_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT worker_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.worker_groups(id),
  CONSTRAINT worker_group_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id)
);
CREATE TABLE public._bak_groups (
  id uuid,
  category_id uuid,
  item_no integer,
  name text
);
CREATE TABLE public._bak_equipment (
  id uuid,
  group_id uuid,
  name text,
  area text,
  unit_count integer,
  default_freq ARRAY,
  is_active boolean
);
CREATE TABLE public._bak_rules (
  id uuid,
  equipment_id uuid,
  frequency text,
  start_date date,
  end_date date,
  weekday integer,
  notes text,
  created_by uuid,
  created_at timestamp with time zone,
  worker_group_id uuid
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
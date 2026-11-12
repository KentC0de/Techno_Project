-- ============================================================================
-- PREVENTIVE MAINTENANCE SYSTEM: DEDUPLICATION & MERGE SCRIPT
-- ============================================================================
-- Safe Transaction with ROLLBACK by default for dry run.
-- To apply changes permanently, change the final ROLLBACK to COMMIT.
--
-- This script merges duplicate categories, groups, and equipment:
--   1. Identifies duplicates using normalized names (handling 'x', unit numbers, etc.)
--   2. Picks one keeper per set (preferring rows with active schedule rules or oldest)
--   3. Repoints child foreign keys (groups.category_id, equipment.group_id, schedule_rules.equipment_id)
--   4. Eliminates duplicate schedule rules that would violate (equipment_id, frequency, start_date)
--   5. Deletes orphaned/empty duplicate rows
--   6. Verifies clean state
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: Temp tables for duplicate mapping
-- ----------------------------------------------------------------------------

-- Temporary normalization function in transaction
CREATE OR REPLACE FUNCTION pg_temp.normalize_label(txt text) RETURNS text AS $$
BEGIN
  RETURN lower(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(coalesce(txt, ''), '[\u00D7\u2715]', 'x', 'g'),
            '\s*x\s*\d+', '', 'g'
          ),
          '\bunit\b', '', 'gi'
        ),
        '\s+', ' ', 'g'
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- STEP 2: Category Deduplication (by code)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE temp_category_merge AS
WITH ranked_categories AS (
  SELECT
    id,
    code,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY code
      ORDER BY
        (SELECT count(*) FROM groups g WHERE g.category_id = categories.id) DESC,
        created_at ASC,
        id ASC
    ) AS rnk,
    FIRST_VALUE(id) OVER (
      PARTITION BY code
      ORDER BY
        (SELECT count(*) FROM groups g WHERE g.category_id = categories.id) DESC,
        created_at ASC,
        id ASC
    ) AS keeper_id
  FROM categories
)
SELECT id AS duplicate_id, keeper_id, code, name
FROM ranked_categories
WHERE id != keeper_id;

-- Repoint groups pointing to duplicate categories
UPDATE groups
SET category_id = tcm.keeper_id
FROM temp_category_merge tcm
WHERE groups.category_id = tcm.duplicate_id;

-- Delete duplicate categories
DELETE FROM categories
WHERE id IN (SELECT duplicate_id FROM temp_category_merge);


-- ----------------------------------------------------------------------------
-- STEP 3: Group Deduplication (by category_id, item_no, normalized name)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE temp_group_merge AS
WITH ranked_groups AS (
  SELECT
    g.id,
    g.category_id,
    g.item_no,
    g.name,
    ROW_NUMBER() OVER (
      PARTITION BY g.category_id, g.item_no, pg_temp.normalize_label(g.name)
      ORDER BY
        (SELECT count(*) FROM equipment e WHERE e.group_id = g.id) DESC,
        g.created_at ASC,
        g.id ASC
    ) AS rnk,
    FIRST_VALUE(g.id) OVER (
      PARTITION BY g.category_id, g.item_no, pg_temp.normalize_label(g.name)
      ORDER BY
        (SELECT count(*) FROM equipment e WHERE e.group_id = g.id) DESC,
        g.created_at ASC,
        g.id ASC
    ) AS keeper_id
  FROM groups g
)
SELECT id AS duplicate_id, keeper_id, category_id, item_no, name
FROM ranked_groups
WHERE id != keeper_id;

-- Repoint equipment pointing to duplicate groups
UPDATE equipment
SET group_id = tgm.keeper_id
FROM temp_group_merge tgm
WHERE equipment.group_id = tgm.duplicate_id;

-- Delete duplicate groups
DELETE FROM groups
WHERE id IN (SELECT duplicate_id FROM temp_group_merge);


-- ----------------------------------------------------------------------------
-- STEP 4: Equipment Deduplication (by group_id, normalized name, area)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE temp_equipment_merge AS
WITH ranked_equipment AS (
  SELECT
    e.id,
    e.group_id,
    e.name,
    coalesce(e.area, '') AS area_key,
    ROW_NUMBER() OVER (
      PARTITION BY e.group_id, coalesce(e.area, ''), pg_temp.normalize_label(e.name)
      ORDER BY
        (SELECT count(*) FROM schedule_rules sr WHERE sr.equipment_id = e.id) DESC,
        (SELECT count(*) FROM task_logs tl JOIN schedule_rules sr2 ON tl.rule_id = sr2.id WHERE sr2.equipment_id = e.id) DESC,
        (CASE WHEN e.is_active THEN 0 ELSE 1 END) ASC,
        e.created_at ASC,
        e.id ASC
    ) AS rnk,
    FIRST_VALUE(e.id) OVER (
      PARTITION BY e.group_id, coalesce(e.area, ''), pg_temp.normalize_label(e.name)
      ORDER BY
        (SELECT count(*) FROM schedule_rules sr WHERE sr.equipment_id = e.id) DESC,
        (SELECT count(*) FROM task_logs tl JOIN schedule_rules sr2 ON tl.rule_id = sr2.id WHERE sr2.equipment_id = e.id) DESC,
        (CASE WHEN e.is_active THEN 0 ELSE 1 END) ASC,
        e.created_at ASC,
        e.id ASC
    ) AS keeper_id
  FROM equipment e
)
SELECT id AS duplicate_id, keeper_id, group_id, name, area_key
FROM ranked_equipment
WHERE id != keeper_id;

-- Repoint task_logs for rules that will be merged:
-- If duplicate rule has task_logs, repoint to keeper rule with same (frequency, start_date)
CREATE TEMP TABLE temp_rule_merge AS
WITH duplicate_rules AS (
  SELECT
    sr_dup.id AS dup_rule_id,
    sr_keeper.id AS keeper_rule_id
  FROM schedule_rules sr_dup
  JOIN temp_equipment_merge tem ON sr_dup.equipment_id = tem.duplicate_id
  JOIN schedule_rules sr_keeper
    ON sr_keeper.equipment_id = tem.keeper_id
   AND sr_keeper.frequency = sr_dup.frequency
   AND sr_keeper.start_date = sr_dup.start_date
)
SELECT * FROM duplicate_rules;

-- Repoint logs to keeper rule when matching rule exists
UPDATE task_logs
SET rule_id = trm.keeper_rule_id
FROM temp_rule_merge trm
WHERE task_logs.rule_id = trm.dup_rule_id;

-- Delete duplicate rules that were merged
DELETE FROM schedule_rules
WHERE id IN (SELECT dup_rule_id FROM temp_rule_merge);

-- Repoint remaining rules on duplicate equipment to keeper equipment
UPDATE schedule_rules
SET equipment_id = tem.keeper_id
FROM temp_equipment_merge tem
WHERE schedule_rules.equipment_id = tem.duplicate_id;

-- Delete duplicate equipment rows
DELETE FROM equipment
WHERE id IN (SELECT duplicate_id FROM temp_equipment_merge);


-- ----------------------------------------------------------------------------
-- STEP 5: Verification Queries
-- ----------------------------------------------------------------------------
SELECT 'Categories merged:' AS metric, count(*) AS count FROM temp_category_merge;
SELECT 'Groups merged:' AS metric, count(*) AS count FROM temp_group_merge;
SELECT 'Equipment merged:' AS metric, count(*) AS count FROM temp_equipment_merge;

SELECT 'Active categories remaining:' AS metric, count(*) FROM categories;
SELECT 'Active groups remaining:' AS metric, count(*) FROM groups;
SELECT 'Active equipment remaining:' AS metric, count(*) FROM equipment;


-- ----------------------------------------------------------------------------
-- STEP 6: Commit or Rollback
-- ----------------------------------------------------------------------------
-- Keep ROLLBACK active for dry-run testing.
-- When satisfied with the output counts, change ROLLBACK to COMMIT and re-run.
ROLLBACK;
-- COMMIT;


-- ============================================================================
-- POST-MERGE UNIQUE CONSTRAINTS (Run AFTER applying the COMMIT above)
-- ============================================================================
/*
ALTER TABLE categories
  ADD CONSTRAINT uq_categories_code UNIQUE (code);

ALTER TABLE groups
  ADD CONSTRAINT uq_groups_category_item_name UNIQUE (category_id, item_no, name);

ALTER TABLE equipment
  ADD CONSTRAINT uq_equipment_group_name_area UNIQUE (group_id, name, coalesce(area, ''));
*/


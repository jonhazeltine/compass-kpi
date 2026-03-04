-- 027_journey_invite_links.sql
-- Extend invite system to support per-journey invite links.
-- Each journey can have its own invite code that enrolls a user into
-- the coach's world (coaching_engagement) AND the specific journey.

-- Step 1: Extend invite_type to include 'journey'
ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS invite_codes_invite_type_check;
ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_invite_type_check
  CHECK (invite_type IN ('team', 'coach', 'challenge', 'journey'));

-- Step 2: Journey enrollments table
CREATE TABLE IF NOT EXISTS public.journey_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_by uuid REFERENCES users(id),
  enrolled_via text NOT NULL DEFAULT 'invite'
    CHECK (enrolled_via IN ('invite', 'coach_assign', 'self')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'dropped')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, user_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_journey_enrollments_user ON journey_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_enrollments_journey ON journey_enrollments(journey_id);

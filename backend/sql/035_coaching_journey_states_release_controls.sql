-- Migration 035: Journey states, lesson release controls, enrollment requests
-- Phase B: journey status (draft/active/hidden)
-- Phase C: milestone-level release controls
-- Phase E: enrollment_requests table

-- ── Phase B: Journey status field ──────────────────────────────────────────

ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'hidden'));

-- Back-fill: existing journeys with is_active=false → 'hidden', rest → 'active'
UPDATE journeys SET status = 'hidden' WHERE is_active = false AND status = 'active';

-- ── Phase C: Milestone release controls ────────────────────────────────────

-- release_strategy: immediate (default) | sequential | scheduled
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS release_strategy text NOT NULL DEFAULT 'immediate'
    CHECK (release_strategy IN ('immediate', 'sequential', 'scheduled'));

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS release_date timestamptz;

-- ── Phase E: Enrollment requests ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enrollment_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id     uuid        NOT NULL REFERENCES journeys(id)  ON DELETE CASCADE,
  requester_id   uuid        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  coach_id       uuid        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  status         text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'denied')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_requests_journey_user_uq UNIQUE (journey_id, requester_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_coach_id
  ON enrollment_requests (coach_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_journey_id
  ON enrollment_requests (journey_id);

-- Sprint 13: Expand master KPI catalog used by dashboard/log selection surfaces.
-- Seeds additional PC/GP/VP KPIs so users can manage a broad loggable set.
-- Note: PC timing values are baseline defaults and can be tuned via admin KPI controls.

insert into public.kpis (name, type, requires_direct_value_input, pc_weight, ttc_days, decay_days, is_active)
values
  -- PC catalog expansion
  ('Phone Call Logged', 'PC', false, 0.000250, 90, 180, true),
  ('Sphere Call', 'PC', false, 0.000400, 90, 180, true),
  ('FSBO/Expired Call', 'PC', false, 0.000500, 90, 180, true),
  ('Door Knock Logged', 'PC', false, 0.000300, 90, 180, true),
  ('Appointment Set (Buyer)', 'PC', false, 0.005000, 60, 180, true),
  ('Appointment Set (Seller)', 'PC', false, 0.005000, 60, 180, true),
  ('Coffee/Lunch with Sphere', 'PC', false, 0.001000, 75, 180, true),
  ('Conversations Held', 'PC', false, 0.001000, 75, 180, true),
  ('Buyer Contract Signed', 'PC', false, 0.050000, 45, 180, true),
  ('New Client Logged', 'PC', false, 0.012500, 60, 180, true),
  ('Text/DM Conversation', 'PC', false, 0.000100, 90, 180, true),
  ('Open House Logged', 'PC', false, 0.002000, 60, 180, true),
  ('Cold Calls', 'PC', false, 0.000250, 90, 180, true),
  ('Appointments', 'PC', false, 0.005000, 60, 180, true),
  ('Relationship Building', 'PC', false, 0.001000, 75, 180, true),
  ('Education / Branding', 'PC', false, 0.000500, 90, 180, true),

  -- GP catalog expansion
  ('Time Blocks Honored', 'GP', false, null, null, null, true),
  ('Social Posts Shared', 'GP', false, null, null, null, true),
  ('CRM Tag Applied', 'GP', false, null, null, null, true),
  ('Smart Plan Activated', 'GP', false, null, null, null, true),
  ('Email Subscribers Added', 'GP', false, null, null, null, true),
  ('Listing Video Created', 'GP', false, null, null, null, true),
  ('Listing Presentation Given', 'GP', false, null, null, null, true),
  ('Buyer Consult Held', 'GP', false, null, null, null, true),
  ('Business Book Completed', 'GP', false, null, null, null, true),
  ('Pipeline Cleaned Up', 'GP', false, null, null, null, true),
  ('Automation Rule Added', 'GP', false, null, null, null, true),

  -- VP catalog expansion
  ('Gratitude Entry', 'VP', false, null, null, null, true),
  ('Good Night of Sleep', 'VP', false, null, null, null, true),
  ('Exercise Session', 'VP', false, null, null, null, true),
  ('Prayer/Meditation Time', 'VP', false, null, null, null, true),
  ('Seasonal Check-In Call', 'VP', false, null, null, null, true),
  ('Pop-By Delivered', 'VP', false, null, null, null, true),
  ('Holiday Card Sent', 'VP', false, null, null, null, true)
on conflict (name) do update
set
  type = excluded.type,
  requires_direct_value_input = excluded.requires_direct_value_input,
  pc_weight = excluded.pc_weight,
  ttc_days = excluded.ttc_days,
  decay_days = excluded.decay_days,
  is_active = true,
  updated_at = now();

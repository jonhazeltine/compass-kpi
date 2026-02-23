-- Sprint 14: canonical KPI catalog hardening.
-- Adds stable catalog keys (slugs), explicit GP/VP point specs,
-- and ensures PC timing specs are fully populated per Master Spec.

alter table public.kpis
  add column if not exists slug text,
  add column if not exists gp_value numeric(10,2),
  add column if not exists vp_value numeric(10,2);

-- Backfill slugs for existing rows.
update public.kpis
set slug = lower(regexp_replace(coalesce(name, ''), '[^a-z0-9]+', '_', 'g'))
where (slug is null or btrim(slug) = '')
  and name is not null;

-- Normalize legacy names to canonical Master Spec names where possible.
update public.kpis
set name = 'Buyer Contract Signed',
    slug = 'buyer_contract_signed',
    updated_at = now()
where name = 'Buyers Signed'
  and not exists (
    select 1 from public.kpis k2
    where k2.name = 'Buyer Contract Signed'
      and k2.id <> public.kpis.id
  );

update public.kpis
set name = 'Pipeline Anchor: Listings Pending',
    slug = 'pipeline_anchor_listings_pending',
    updated_at = now()
where name = 'Listings Pending'
  and not exists (
    select 1 from public.kpis k2
    where k2.name = 'Pipeline Anchor: Listings Pending'
      and k2.id <> public.kpis.id
  );

update public.kpis
set name = 'Pipeline Anchor: Buyers UC',
    slug = 'pipeline_anchor_buyers_uc',
    updated_at = now()
where name = 'Buyers UC'
  and not exists (
    select 1 from public.kpis k2
    where k2.name = 'Pipeline Anchor: Buyers UC'
      and k2.id <> public.kpis.id
  );

-- Canonical upsert from Master Spec section 5.1 and seeded GP/VP catalog references.
insert into public.kpis (
  name,
  slug,
  type,
  requires_direct_value_input,
  pc_weight,
  ttc_days,
  ttc_definition,
  delay_days,
  hold_days,
  decay_days,
  gp_value,
  vp_value,
  is_active
)
values
  -- PC KPIs (full timing specs)
  ('Phone Call Logged', 'phone_call_logged', 'PC', false, 0.000250, 120, '90-120 days', 90, 30, 180, null, null, true),
  ('Sphere Call', 'sphere_call', 'PC', false, 0.000400, 90, '60-90 days', 60, 30, 180, null, null, true),
  ('FSBO/Expired Call', 'fsbo_expired_call', 'PC', false, 0.000500, 60, '30-60 days', 30, 30, 180, null, null, true),
  ('Door Knock Logged', 'door_knock_logged', 'PC', false, 0.000300, 150, '90-150 days', 90, 60, 180, null, null, true),
  ('Appointment Set (Buyer)', 'appointment_set_buyer', 'PC', false, 0.005000, 60, '30-60 days', 30, 30, 180, null, null, true),
  ('Appointment Set (Seller)', 'appointment_set_seller', 'PC', false, 0.005000, 60, '30-60 days', 30, 30, 180, null, null, true),
  ('Coffee/Lunch with Sphere', 'coffee_lunch_sphere', 'PC', false, 0.001000, 150, '90-150 days', 90, 60, 180, null, null, true),
  ('Conversations Held', 'conversations_held', 'PC', false, 0.001000, 150, '90-150 days', 90, 60, 180, null, null, true),
  ('Listing Taken', 'listing_taken', 'PC', false, 0.070000, 30, '30 days', 0, 30, 180, null, null, true),
  ('Buyer Contract Signed', 'buyer_contract_signed', 'PC', false, 0.050000, 30, '30 days', 0, 30, 180, null, null, true),
  ('New Client Logged', 'new_client_logged', 'PC', false, 0.012500, 90, '30-90 days', 30, 60, 180, null, null, true),
  ('Text/DM Conversation', 'text_dm_conversation', 'PC', false, 0.000100, 120, '90-120 days', 90, 30, 180, null, null, true),
  ('Open House Logged', 'open_house_logged', 'PC', false, 0.002000, 120, '60-120 days', 60, 60, 180, null, null, true),

  -- Operational / non-selectable in onboarding (still loggable where applicable)
  ('Deal Closed', 'deal_closed', 'Actual', true, null, null, null, null, null, null, null, null, true),
  ('Pipeline Anchor: Listings Pending', 'pipeline_anchor_listings_pending', 'Pipeline_Anchor', true, null, null, null, null, null, null, null, null, true),
  ('Pipeline Anchor: Buyers UC', 'pipeline_anchor_buyers_uc', 'Pipeline_Anchor', true, null, null, null, null, null, null, null, null, true),
  ('Custom KPI', 'custom_kpi', 'Custom', true, null, null, null, null, null, null, null, null, true),

  -- GP KPIs (point specs)
  ('Time Blocks Honored', 'time_blocks_honored', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Social Posts Shared', 'social_posts_shared', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('CRM Tag Applied', 'crm_tag_applied', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Smart Plan Activated', 'smart_plan_activated', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Email Subscribers Added', 'email_subscribers_added', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Listing Video Created', 'listing_video_created', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Listing Presentation Given', 'listing_presentation_given', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Buyer Consult Held', 'buyer_consult_held', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Business Book Completed', 'business_book_completed', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Pipeline Cleaned Up', 'pipeline_cleaned_up', 'GP', false, null, null, null, null, null, null, 1, null, true),
  ('Automation Rule Added', 'automation_rule_added', 'GP', false, null, null, null, null, null, null, 1, null, true),

  -- VP KPIs (point specs)
  ('Gratitude Entry', 'gratitude_entry', 'VP', false, null, null, null, null, null, null, null, 1, true),
  ('Good Night of Sleep', 'good_night_sleep', 'VP', false, null, null, null, null, null, null, null, 1, true),
  ('Exercise Session', 'exercise_session', 'VP', false, null, null, null, null, null, null, null, 1, true),
  ('Prayer/Meditation Time', 'prayer_meditation_time', 'VP', false, null, null, null, null, null, null, null, 1, true),
  ('Seasonal Check-In Call', 'seasonal_check_in_call', 'VP', false, null, null, null, null, null, null, null, 1, true),
  ('Pop-By Delivered', 'pop_by_delivered', 'VP', false, null, null, null, null, null, null, null, 1, true),
  ('Holiday Card Sent', 'holiday_card_sent', 'VP', false, null, null, null, null, null, null, null, 1, true)
on conflict (name) do update
set
  slug = excluded.slug,
  type = excluded.type,
  requires_direct_value_input = excluded.requires_direct_value_input,
  pc_weight = excluded.pc_weight,
  ttc_days = excluded.ttc_days,
  ttc_definition = excluded.ttc_definition,
  delay_days = excluded.delay_days,
  hold_days = excluded.hold_days,
  decay_days = excluded.decay_days,
  gp_value = excluded.gp_value,
  vp_value = excluded.vp_value,
  is_active = excluded.is_active,
  updated_at = now();

-- Ensure GP/VP rows always carry explicit point values.
update public.kpis
set gp_value = coalesce(gp_value, 1),
    vp_value = null,
    updated_at = now()
where type = 'GP';

update public.kpis
set vp_value = coalesce(vp_value, 1),
    gp_value = null,
    updated_at = now()
where type = 'VP';

update public.kpis
set gp_value = null,
    vp_value = null,
    updated_at = now()
where type not in ('GP', 'VP');

-- Backfill missing timing specs for any legacy PC rows.
update public.kpis
set
  ttc_definition = coalesce(nullif(btrim(ttc_definition), ''), concat(coalesce(ttc_days, 30), ' days')),
  delay_days = coalesce(delay_days, 0),
  hold_days = coalesce(hold_days, greatest(0, coalesce(ttc_days, 30) - coalesce(delay_days, 0))),
  decay_days = coalesce(decay_days, 180),
  updated_at = now()
where type = 'PC';

create unique index if not exists kpis_slug_uq on public.kpis(slug);

alter table public.kpis
  drop constraint if exists kpis_points_type_chk;

alter table public.kpis
  add constraint kpis_points_type_chk
  check (
    (type = 'GP' and gp_value is not null and gp_value >= 0 and vp_value is null)
    or (type = 'VP' and vp_value is not null and vp_value >= 0 and gp_value is null)
    or (type not in ('GP', 'VP') and gp_value is null and vp_value is null)
  );

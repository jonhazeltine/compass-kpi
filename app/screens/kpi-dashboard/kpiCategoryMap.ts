/**
 * Activity-based category map for the KPI picker.
 *
 * Groups PC / GP / VP KPIs by activity type (phone, in-person, etc.) rather
 * than by the legacy "pinned priority" index. Each group names a single
 * recommended KPI that gets a ★ corner badge in the picker so new users can
 * spot a good starter pick per category.
 *
 * Slugs are the canonical `kpis.slug` values from the backend catalog
 * (`backend/sql/017_*` and `018_*`). Keep this file in lockstep with those
 * migrations — any new KPI needs a home here or it falls into the "Other"
 * group.
 */

export type KpiTypeId = 'PC' | 'GP' | 'VP';

export type KpiCategory = {
  /** Stable id, used as React key + section id. */
  id: string;
  /** Display label in the picker. */
  label: string;
  /** Short emoji/icon to prefix the label. */
  glyph: string;
  /** Slugs in display order (first → last). */
  slugs: string[];
  /** Slug of the recommended KPI for this category (gets the ★ badge). */
  recommendedSlug: string;
};

// ---------------------------------------------------------------------------
// PC — Pipeline Conversion activities
// ---------------------------------------------------------------------------

export const PC_CATEGORIES: KpiCategory[] = [
  {
    id: 'pc-phone',
    label: 'Phone Calls',
    glyph: '📞',
    recommendedSlug: 'sphere_call',
    slugs: [
      'sphere_call',
      'phone_call_logged',
      'fsbo_expired_call',
      'seasonal_check_in_call',
      'conversations_held',
    ],
  },
  {
    id: 'pc-in-person',
    label: 'In Person',
    glyph: '🤝',
    recommendedSlug: 'coffee_lunch_with_sphere',
    slugs: [
      'coffee_lunch_with_sphere',
      'door_knock_logged',
      'open_house_logged',
      'pop_by_delivered',
      'holiday_card_sent',
    ],
  },
  {
    id: 'pc-digital',
    label: 'Digital Touch',
    glyph: '💬',
    recommendedSlug: 'text_dm_conversation',
    slugs: ['text_dm_conversation', 'biz_post'],
  },
  {
    id: 'pc-milestones',
    label: 'Milestones',
    glyph: '📋',
    recommendedSlug: 'buyer_contract_signed',
    slugs: [
      'buyer_contract_signed',
      'appointment_set_buyer',
      'appointment_set_seller',
      'new_client_logged',
    ],
  },
];

// ---------------------------------------------------------------------------
// GP — Growth Points activities
// ---------------------------------------------------------------------------

export const GP_CATEGORIES: KpiCategory[] = [
  {
    id: 'gp-skill-reps',
    label: 'Skill Reps',
    glyph: '📚',
    recommendedSlug: 'script_practice_session',
    slugs: [
      'script_practice_session',
      'roleplay_session_completed',
      'objection_handling_reps_logged',
      'negotiation_practice_session',
      'business_book_completed',
      'coaching_session_attended',
      'training_module_completed',
    ],
  },
  {
    id: 'gp-systems',
    label: 'Systems',
    glyph: '⚙️',
    recommendedSlug: 'crm_tag_applied',
    slugs: [
      'crm_tag_applied',
      'smart_plan_activated',
      'automation_rule_added',
      'database_segmented_cleaned',
      'sop_created_or_updated',
      'pipeline_cleaned_up',
      'time_blocks_honored',
    ],
  },
  {
    id: 'gp-content',
    label: 'Content',
    glyph: '📣',
    recommendedSlug: 'social_posts_shared',
    slugs: [
      'social_posts_shared',
      'instagram_post_shared',
      'facebook_post_shared',
      'tiktok_post_shared',
      'x_post_shared',
      'linkedin_post_shared',
      'youtube_short_posted',
      'email_subscribers_added',
      'listing_video_created',
      'content_batch_created',
    ],
  },
  {
    id: 'gp-review',
    label: 'Prep & Review',
    glyph: '📊',
    recommendedSlug: 'weekly_scorecard_review',
    slugs: [
      'weekly_scorecard_review',
      'market_stats_review_weekly',
      'offer_strategy_review_completed',
      'deal_review_postmortem_completed',
      'cma_created_practice_or_live',
      'listing_presentation_given',
      'buyer_consult_held',
    ],
  },
];

// ---------------------------------------------------------------------------
// VP — Vitality Points activities
// ---------------------------------------------------------------------------

export const VP_CATEGORIES: KpiCategory[] = [
  {
    id: 'vp-move',
    label: 'Move',
    glyph: '💪',
    recommendedSlug: 'exercise_session',
    slugs: [
      'exercise_session',
      'steps_goal_met_walk_completed',
      'stretching_mobility_session',
      'outdoor_time_logged',
    ],
  },
  {
    id: 'vp-fuel',
    label: 'Fuel',
    glyph: '🥗',
    recommendedSlug: 'hydration_goal_met',
    slugs: ['hydration_goal_met', 'whole_food_meal_logged'],
  },
  {
    id: 'vp-rest',
    label: 'Rest',
    glyph: '😴',
    recommendedSlug: 'good_night_of_sleep',
    slugs: [
      'good_night_of_sleep',
      'sabbath_block_honored_rest',
      'screen_curfew_honored',
    ],
  },
  {
    id: 'vp-mind',
    label: 'Mind',
    glyph: '🧘',
    recommendedSlug: 'gratitude_entry',
    slugs: [
      'gratitude_entry',
      'prayer_meditation_time',
      'mindfulness_breath_reset',
      'journal_entry_non_gratitude',
      'social_connection_non_work',
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup table + helpers
// ---------------------------------------------------------------------------

export const KPI_CATEGORIES_BY_TYPE: Record<KpiTypeId, KpiCategory[]> = {
  PC: PC_CATEGORIES,
  GP: GP_CATEGORIES,
  VP: VP_CATEGORIES,
};

/** Slug → { category, isRecommended } lookup built once. */
const SLUG_TO_INFO = (() => {
  const map = new Map<string, { category: KpiCategory; isRecommended: boolean }>();
  for (const type of ['PC', 'GP', 'VP'] as const) {
    for (const category of KPI_CATEGORIES_BY_TYPE[type]) {
      for (const slug of category.slugs) {
        map.set(slug, {
          category,
          isRecommended: slug === category.recommendedSlug,
        });
      }
    }
  }
  return map;
})();

export function getCategoryForSlug(slug: string): KpiCategory | undefined {
  return SLUG_TO_INFO.get(slug)?.category;
}

export function isRecommendedSlug(slug: string): boolean {
  return SLUG_TO_INFO.get(slug)?.isRecommended === true;
}

/**
 * Group a list of available (unselected) KPIs by category for one type.
 * Any KPI not registered in the map — custom KPIs, newly added KPIs that
 * haven't been categorized yet — lands in an "Other" bucket at the end.
 *
 * The `getSlug` argument lets the caller pass the same slug-normalization
 * used elsewhere (so e.g. missing slug strings fall back to the KPI name).
 */
export function groupKpisByCategory<T extends { id: string; name: string; slug?: string }>(
  type: KpiTypeId,
  kpis: T[],
  getSlug: (kpi: T) => string
): Array<{
  id: string;
  label: string;
  glyph: string;
  kpis: T[];
  recommendedSlug: string | undefined;
}> {
  const bucketById = new Map<string, T[]>();
  const orderedCategoryIds: string[] = [];
  const otherBucket: T[] = [];

  for (const category of KPI_CATEGORIES_BY_TYPE[type]) {
    bucketById.set(category.id, []);
    orderedCategoryIds.push(category.id);
  }

  for (const kpi of kpis) {
    const slug = getSlug(kpi);
    const info = SLUG_TO_INFO.get(slug);
    if (info && info.category && KPI_CATEGORIES_BY_TYPE[type].includes(info.category)) {
      bucketById.get(info.category.id)!.push(kpi);
    } else {
      otherBucket.push(kpi);
    }
  }

  // Sort each category bucket by the slug order in the category definition so
  // the recommended slug (first) and related slugs render in the intended sequence.
  for (const category of KPI_CATEGORIES_BY_TYPE[type]) {
    const bucket = bucketById.get(category.id)!;
    const orderIndex = new Map(category.slugs.map((s, i) => [s, i]));
    bucket.sort((a, b) => {
      const ai = orderIndex.get(getSlug(a)) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.get(getSlug(b)) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }

  type Section = {
    id: string;
    label: string;
    glyph: string;
    kpis: T[];
    recommendedSlug: string | undefined;
  };

  const sections: Section[] = orderedCategoryIds
    .map((id): Section => {
      const category = KPI_CATEGORIES_BY_TYPE[type].find((c) => c.id === id)!;
      return {
        id: category.id,
        label: category.label,
        glyph: category.glyph,
        kpis: bucketById.get(category.id) ?? [],
        recommendedSlug: category.recommendedSlug,
      };
    })
    .filter((s) => s.kpis.length > 0);

  if (otherBucket.length > 0) {
    sections.push({
      id: `${type.toLowerCase()}-other`,
      label: 'Other',
      glyph: '✨',
      kpis: otherBucket,
      recommendedSlug: undefined,
    });
  }

  return sections;
}

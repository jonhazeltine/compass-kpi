"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
const confidenceEngine_1 = require("./engines/confidenceEngine");
const gpVpEngine_1 = require("./engines/gpVpEngine");
const pcTimelineEngine_1 = require("./engines/pcTimelineEngine");
const onboardingBackplotEngine_1 = require("./engines/onboardingBackplotEngine");
const pcTimingEngine_1 = require("./engines/pcTimingEngine");
const dealAttributionEngine_1 = require("./engines/dealAttributionEngine");
const userCalibrationEngine_1 = require("./engines/userCalibrationEngine");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "127.0.0.1";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    // eslint-disable-next-line no-console
    console.warn("SUPABASE_URL or SUPABASE_ANON_KEY not set – auth endpoints will fail.");
}
if (!supabaseServiceRoleKey) {
    // eslint-disable-next-line no-console
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set – write endpoints may fail due to RLS.");
}
const authClient = supabaseUrl && supabaseAnonKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey)
    : null;
const dataClient = supabaseUrl && (supabaseServiceRoleKey || supabaseAnonKey)
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey)
    : null;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)("dev"));
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "compasskpi-backend" });
});
app.get("/me", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        return res.json({
            id: auth.user.id,
            email: auth.user.email,
            user_metadata: auth.user.user_metadata,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /me", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.patch("/me", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        if (!supabaseServiceRoleKey) {
            return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY is required for profile updates" });
        }
        const payloadCheck = validateMeProfileUpdatePayload(req.body);
        if (!payloadCheck.ok) {
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        }
        const payload = payloadCheck.payload;
        await ensureUserRow(auth.user.id);
        const userPatch = {};
        if (payload.average_price_point !== undefined) {
            userPatch.average_price_point = payload.average_price_point;
        }
        if (payload.commission_rate_percent !== undefined) {
            userPatch.commission_rate = payload.commission_rate_percent / 100;
        }
        if (Object.keys(userPatch).length > 0) {
            const { error: updateUserRowError } = await dataClient
                .from("users")
                .update(userPatch)
                .eq("id", auth.user.id);
            if (updateUserRowError) {
                return handleSupabaseError(res, "Failed to update user profile row", updateUserRowError);
            }
        }
        const metadataPatch = {};
        for (const [key, value] of Object.entries(payload)) {
            if (value !== undefined) {
                metadataPatch[key] = value;
            }
        }
        const existingMetadata = auth.user.user_metadata && typeof auth.user.user_metadata === "object"
            ? auth.user.user_metadata
            : {};
        let mergedMetadata = {
            ...existingMetadata,
            ...metadataPatch,
        };
        const seedResult = await maybeSeedInitialProjectionFromOnboarding(auth.user.id, mergedMetadata);
        if (!seedResult.ok) {
            return res.status(seedResult.status).json({ error: seedResult.error });
        }
        mergedMetadata = seedResult.mergedMetadata;
        const { data: updatedAuth, error: updateAuthError } = await dataClient.auth.admin.updateUserById(auth.user.id, { user_metadata: mergedMetadata });
        if (updateAuthError) {
            return handleSupabaseError(res, "Failed to update auth user metadata", updateAuthError);
        }
        return res.json({
            id: auth.user.id,
            email: auth.user.email,
            user_metadata: updatedAuth.user?.user_metadata ?? mergedMetadata,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in PATCH /me", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/kpi-logs", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const payloadCheck = validateKpiLogPayload(req.body);
        if (!payloadCheck.ok) {
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        }
        const write = await writeKpiLogForUser(auth.user.id, payloadCheck.payload);
        if (!write.ok) {
            return res.status(write.status).json({ error: write.error });
        }
        return res.status(write.httpStatus).json(write.body);
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /kpi-logs", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/kpi-logs/batch", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const payloadCheck = validateKpiLogBatchPayload(req.body);
        if (!payloadCheck.ok) {
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        }
        const results = [];
        let created = 0;
        let duplicates = 0;
        let failed = 0;
        for (let i = 0; i < payloadCheck.payload.logs.length; i += 1) {
            const write = await writeKpiLogForUser(auth.user.id, payloadCheck.payload.logs[i]);
            if (!write.ok) {
                failed += 1;
                results.push({ index: i, status: "failed", error: write.error });
                continue;
            }
            if (write.httpStatus === 200) {
                duplicates += 1;
            }
            else {
                created += 1;
            }
            results.push({
                index: i,
                status: write.httpStatus === 200 ? "duplicate" : "created",
                ...write.body,
            });
        }
        return res.status(200).json({
            summary: { total: payloadCheck.payload.logs.length, created, duplicates, failed },
            results,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /kpi-logs/batch", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.delete("/kpi-logs/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const logId = req.params.id;
        if (!logId) {
            return res.status(422).json({ error: "log id is required" });
        }
        const { data: existingLog, error: loadError } = await dataClient
            .from("kpi_logs")
            .select("id,user_id,kpi_id,event_timestamp,logged_value")
            .eq("id", logId)
            .eq("user_id", auth.user.id)
            .maybeSingle();
        if (loadError) {
            return handleSupabaseError(res, "Failed to load KPI log for delete", loadError);
        }
        if (!existingLog) {
            return res.status(404).json({ error: "KPI log not found" });
        }
        const { data: kpiRow, error: kpiError } = await dataClient
            .from("kpis")
            .select("id,type,name")
            .eq("id", String(existingLog.kpi_id ?? ""))
            .maybeSingle();
        if (kpiError) {
            return handleSupabaseError(res, "Failed to load KPI for delete side-effects", kpiError);
        }
        const { error: deleteError } = await dataClient
            .from("kpi_logs")
            .delete()
            .eq("id", logId)
            .eq("user_id", auth.user.id);
        if (deleteError) {
            return handleSupabaseError(res, "Failed to delete KPI log", deleteError);
        }
        if (String(kpiRow?.type ?? "") === "Pipeline_Anchor") {
            const kpiId = String(existingLog.kpi_id ?? "");
            const { data: latestAnchorLog, error: latestAnchorLogError } = await dataClient
                .from("kpi_logs")
                .select("logged_value,event_timestamp")
                .eq("user_id", auth.user.id)
                .eq("kpi_id", kpiId)
                .order("event_timestamp", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (latestAnchorLogError) {
                return handleSupabaseError(res, "Failed to refresh pipeline anchor after delete", latestAnchorLogError);
            }
            if (latestAnchorLog) {
                const { error: upsertAnchorError } = await dataClient
                    .from("pipeline_anchor_status")
                    .upsert({
                    user_id: auth.user.id,
                    kpi_id: kpiId,
                    anchor_type: String(kpiRow?.name ?? "Pipeline Anchor"),
                    anchor_value: toNumberOrZero(latestAnchorLog.logged_value),
                    updated_at: String(latestAnchorLog.event_timestamp ?? new Date().toISOString()),
                }, { onConflict: "user_id,kpi_id" });
                if (upsertAnchorError) {
                    return handleSupabaseError(res, "Failed to upsert pipeline anchor after delete", upsertAnchorError);
                }
            }
            else {
                const { error: deleteAnchorStatusError } = await dataClient
                    .from("pipeline_anchor_status")
                    .delete()
                    .eq("user_id", auth.user.id)
                    .eq("kpi_id", kpiId);
                if (deleteAnchorStatusError) {
                    return handleSupabaseError(res, "Failed to clear pipeline anchor after delete", deleteAnchorStatusError);
                }
            }
        }
        return res.json({
            status: "deleted",
            log_id: logId,
            kpi_id: String(existingLog.kpi_id ?? ""),
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in DELETE /kpi-logs/:id", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/dashboard", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const { data: logs, error: logsError } = await dataClient
            .from("kpi_logs")
            .select("id,event_timestamp,kpi_id,pc_generated,actual_gci_delta,deals_closed_delta,points_generated,payoff_start_date,delay_days_applied,hold_days_applied,decay_days_applied")
            .eq("user_id", auth.user.id)
            .order("event_timestamp", { ascending: false })
            .limit(3000);
        if (logsError) {
            return handleSupabaseError(res, "Failed to fetch dashboard data", logsError);
        }
        const safeLogs = logs ?? [];
        const now = new Date();
        const { data: kpiCatalogRows, error: kpiCatalogError } = await dataClient
            .from("kpis")
            .select("id,name,slug,type,requires_direct_value_input,is_active,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value")
            .eq("is_active", true);
        if (kpiCatalogError) {
            return handleSupabaseError(res, "Failed to fetch dashboard KPI catalog", kpiCatalogError);
        }
        const safeKpiCatalog = kpiCatalogRows ?? [];
        const kpiById = new Map(safeKpiCatalog.map((row) => [
            String(row.id),
            {
                id: String(row.id),
                type: String(row.type),
                name: String(row.name ?? ""),
                slug: String(row.slug ?? ""),
                requires_direct_value_input: Boolean(row.requires_direct_value_input),
                pc_weight: row.pc_weight,
                ttc_days: row.ttc_days,
                ttc_definition: row.ttc_definition,
                delay_days: row.delay_days,
                hold_days: row.hold_days,
                decay_days: row.decay_days,
                gp_value: row.gp_value,
                vp_value: row.vp_value,
            },
        ]));
        const actualGciFromLogs = safeLogs.reduce((sum, log) => sum + toNumberOrZero(log.actual_gci_delta), 0);
        const dealsClosed = safeLogs.reduce((sum, log) => sum + toNumberOrZero(log.deals_closed_delta), 0);
        const nowMs = now.getTime();
        const cutoff365Ms = nowMs - 365 * 24 * 60 * 60 * 1000;
        const startOfUtcYearMs = Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
        const actualGciLast365FromLogs = safeLogs.reduce((sum, log) => {
            const ts = new Date(String(log.event_timestamp ?? "")).getTime();
            if (Number.isNaN(ts) || ts < cutoff365Ms || ts > nowMs)
                return sum;
            return sum + toNumberOrZero(log.actual_gci_delta);
        }, 0);
        const actualGciYtdFromLogs = safeLogs.reduce((sum, log) => {
            const ts = new Date(String(log.event_timestamp ?? "")).getTime();
            if (Number.isNaN(ts) || ts < startOfUtcYearMs || ts > nowMs)
                return sum;
            return sum + toNumberOrZero(log.actual_gci_delta);
        }, 0);
        const gpLogs = safeLogs
            .filter((log) => kpiById.get(String(log.kpi_id))?.type === "GP")
            .map((log) => ({
            event_timestamp: String(log.event_timestamp),
            points_generated: toNumberOrZero(log.points_generated),
        }));
        const vpLogs = safeLogs
            .filter((log) => kpiById.get(String(log.kpi_id))?.type === "VP")
            .map((log) => ({
            event_timestamp: String(log.event_timestamp),
            points_generated: toNumberOrZero(log.points_generated),
        }));
        const gpVpState = (0, gpVpEngine_1.computeGpVpState)({
            now,
            gpLogs,
            vpLogs,
        });
        const { data: anchors, error: anchorError } = await dataClient
            .from("pipeline_anchor_status")
            .select("kpi_id,anchor_type,anchor_value,updated_at")
            .eq("user_id", auth.user.id);
        if (anchorError) {
            return handleSupabaseError(res, "Failed to fetch pipeline anchors", anchorError);
        }
        const meta = getUserMetadata(auth.user.user_metadata);
        const avgPrice = toNumberOrZero(meta.average_price_point);
        const commissionRateDecimal = meta.commission_rate_percent !== undefined
            ? toNumberOrZero(meta.commission_rate_percent) / 100
            : toNumberOrZero(meta.commission_rate_decimal);
        const pcEventsFromLogs = safeLogs.reduce((acc, log) => {
            const kpi = kpiById.get(String(log.kpi_id));
            if (!kpi || kpi.type !== "PC")
                return acc;
            const initialPcGenerated = toNumberOrZero(log.pc_generated);
            if (initialPcGenerated <= 0)
                return acc;
            const logDelay = Number(log.delay_days_applied);
            const logHold = Number(log.hold_days_applied);
            const timingFromLog = (0, pcTimingEngine_1.resolvePcTiming)({
                delay_days: Number.isFinite(logDelay) ? logDelay : kpi.delay_days,
                hold_days: Number.isFinite(logHold) ? logHold : kpi.hold_days,
                ttc_days: kpi.ttc_days,
                ttc_definition: kpi.ttc_definition,
            });
            const appliedDecay = toNumberOrZero(log.decay_days_applied);
            acc.push({
                eventTimestampIso: String(log.event_timestamp),
                initialPcGenerated,
                delayBeforePayoffStartsDays: timingFromLog.delayDays,
                holdDurationDays: timingFromLog.holdDays,
                decayDurationDays: Math.max(1, appliedDecay || toNumberOrZero(kpi.decay_days) || 180),
            });
            return acc;
        }, []);
        const pcConfigById = Object.fromEntries(safeKpiCatalog
            .filter((kpi) => String(kpi.type) === "PC")
            .map((kpi) => [
            String(kpi.id),
            {
                pc_weight: toNumberOrZero(kpi.pc_weight),
                ttc_days: toNumberOrZero(kpi.ttc_days),
                ttc_definition: typeof kpi.ttc_definition === "string" ? kpi.ttc_definition : null,
                delay_days: toNumberOrZero(kpi.delay_days),
                hold_days: toNumberOrZero(kpi.hold_days),
                decay_days: toNumberOrZero(kpi.decay_days) || 180,
            },
        ]));
        const selectedKpiResolution = await resolveKpiSelectionIds(Array.isArray(meta.selected_kpis)
            ? meta.selected_kpis.filter((id) => typeof id === "string")
            : []);
        if (!selectedKpiResolution.ok) {
            return res.status(selectedKpiResolution.status).json({ error: selectedKpiResolution.error });
        }
        const selectedKpis = selectedKpiResolution.ids;
        const rawWeeklyInputs = isRecord(meta.kpi_weekly_inputs) ? meta.kpi_weekly_inputs : {};
        const kpiWeeklyInputs = {};
        for (const [rawKey, value] of Object.entries(rawWeeklyInputs)) {
            const mappedId = selectedKpiResolution.by_input[rawKey] ?? selectedKpiResolution.by_input[normalizeKpiIdentifier(rawKey)];
            const parsed = parseBackplotInput(value);
            if (mappedId && parsed)
                kpiWeeklyInputs[mappedId] = parsed;
        }
        const syntheticOnboardingEvents = (0, onboardingBackplotEngine_1.buildOnboardingBackplotPcEvents)({
            now,
            averagePricePoint: avgPrice,
            commissionRateDecimal,
            selectedKpiIds: selectedKpis,
            kpiWeeklyInputs,
            kpiPcConfigById: pcConfigById,
        });
        const allPcEvents = pcEventsFromLogs.length > 0 ? pcEventsFromLogs : syntheticOnboardingEvents;
        const pipelineProjectionEvent = buildPipelineProjectionEvent({
            now,
            anchors: (anchors ?? []).map((row) => ({
                anchor_value: toNumberOrZero(row.anchor_value),
            })),
            averagePricePoint: avgPrice,
            commissionRateDecimal,
        });
        const projectionPcEvents = pipelineProjectionEvent ? [...allPcEvents, pipelineProjectionEvent] : allPcEvents;
        const pastActualFromLogs = (0, pcTimelineEngine_1.buildPastActual6mSeries)(safeLogs.map((log) => ({
            event_timestamp: String(log.event_timestamp),
            actual_gci_delta: toNumberOrZero(log.actual_gci_delta),
        })), now);
        const fallbackPastActual6m = buildPastActual6mSeriesFromMetadata(now, {
            ytd_gci: meta.ytd_gci,
            last_year_gci: meta.last_year_gci,
        });
        const hasLoggedActuals = pastActualFromLogs.some((row) => toNumberOrZero(row.value) > 0);
        const pastActual6m = hasLoggedActuals ? pastActualFromLogs : fallbackPastActual6m;
        const futureProjected12m = (0, pcTimelineEngine_1.buildFutureProjected12mSeries)(projectionPcEvents, now, gpVpState.total_bump_percent);
        const projectedNext365 = Number(futureProjected12m.reduce((sum, row) => sum + toNumberOrZero(row.value), 0).toFixed(2));
        const projectedRemainingThisYear = Number(futureProjected12m
            .filter((row) => {
            const dt = new Date(String(row.month_start ?? ""));
            return !Number.isNaN(dt.getTime()) && dt.getUTCFullYear() === now.getUTCFullYear();
        })
            .reduce((sum, row) => sum + toNumberOrZero(row.value), 0)
            .toFixed(2));
        const actualGci = hasLoggedActuals
            ? actualGciFromLogs
            : Math.max(0, toNumberOrZero(meta.ytd_gci) || pastActual6m.reduce((sum, row) => sum + toNumberOrZero(row.value), 0));
        const actualGciYtd = hasLoggedActuals ? actualGciYtdFromLogs : Math.max(0, toNumberOrZero(meta.ytd_gci));
        const actualGciLast365 = hasLoggedActuals
            ? actualGciLast365FromLogs
            : Math.max(0, actualGciYtd + toNumberOrZero(meta.last_year_gci) - toNumberOrZero(meta.ytd_gci));
        const projectedGciYtd = Number((actualGciYtd + projectedRemainingThisYear).toFixed(2));
        const confidence = (0, confidenceEngine_1.computeConfidence)({
            now,
            lastActivityTimestampIso: getLastActivityTimestampFromLogsOrMetadata(safeLogs, meta.last_activity_timestamp),
            actualLogs: safeLogs.map((log) => ({
                event_timestamp: String(log.event_timestamp),
                actual_gci_delta: toNumberOrZero(log.actual_gci_delta),
            })),
            pcEvents: allPcEvents,
            anchors: (anchors ?? []).map((row) => ({
                anchor_value: toNumberOrZero(row.anchor_value),
            })),
            averagePricePoint: avgPrice,
            commissionRateDecimal,
        });
        const { data: calibrationRows, error: calibrationError } = await dataClient
            .from("user_kpi_calibration")
            .select("sample_size,rolling_error_ratio,rolling_abs_pct_error")
            .eq("user_id", auth.user.id);
        if (calibrationError) {
            return handleSupabaseError(res, "Failed to fetch calibration diagnostics", calibrationError);
        }
        const calibrationDiagnostics = summarizeCalibrationDiagnostics(calibrationRows ?? []);
        const activeDaySet = new Set(safeLogs
            .map((log) => String(log.event_timestamp))
            .filter(Boolean)
            .map((iso) => iso.slice(0, 10)));
        return res.json({
            projection: {
                pc_90d: (0, pcTimelineEngine_1.derivePc90dFromFutureSeries)(futureProjected12m),
                pc_next_365: projectedNext365,
                projected_gci_ytd: projectedGciYtd,
                confidence: {
                    score: confidence.score,
                    band: confidence.band,
                    components: confidence.components,
                },
                calibration_diagnostics: calibrationDiagnostics,
                bump_context: gpVpState,
                required_pipeline_anchors: anchors ?? [],
            },
            confidence: {
                components: confidence.components,
            },
            chart: {
                past_actual_6m: pastActual6m,
                future_projected_12m: futureProjected12m,
                confidence_band_by_month: futureProjected12m.map(() => confidence.band),
                boundary_index: Math.max(0, pastActual6m.length - 1),
            },
            actuals: {
                actual_gci: actualGci,
                actual_gci_last_365: Number(actualGciLast365.toFixed(2)),
                actual_gci_ytd: Number(actualGciYtd.toFixed(2)),
                deals_closed: dealsClosed,
            },
            points: {
                gp: gpVpState.gp_current,
                vp: gpVpState.vp_current,
            },
            activity: {
                total_logs: safeLogs.length,
                active_days: activeDaySet.size,
            },
            loggable_kpis: safeKpiCatalog.map((row) => ({
                id: String(row.id),
                name: String(row.name ?? ""),
                slug: String(row.slug ?? ""),
                type: String(row.type),
                requires_direct_value_input: Boolean(row.requires_direct_value_input),
                pc_weight: toNumberOrZero(row.pc_weight),
                ttc_definition: String(row.ttc_definition ?? ""),
                delay_days: toNumberOrZero(row.delay_days),
                hold_days: toNumberOrZero(row.hold_days),
                decay_days: toNumberOrZero(row.decay_days),
                gp_value: row.gp_value === null ? null : toNumberOrZero(row.gp_value),
                vp_value: row.vp_value === null ? null : toNumberOrZero(row.vp_value),
            })),
            recent_logs: safeLogs
                .slice()
                .sort((a, b) => {
                const aTs = new Date(String(a.event_timestamp ?? 0)).getTime();
                const bTs = new Date(String(b.event_timestamp ?? 0)).getTime();
                return aTs - bTs;
            })
                .slice(-240)
                .map((log) => ({
                id: String(log.id ?? ""),
                kpi_id: String(log.kpi_id ?? ""),
                kpi_name: String(kpiById.get(String(log.kpi_id))?.name ?? ""),
                event_timestamp: String(log.event_timestamp ?? ""),
                pc_generated: toNumberOrZero(log.pc_generated),
                actual_gci_delta: toNumberOrZero(log.actual_gci_delta),
                points_generated: toNumberOrZero(log.points_generated),
            })),
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /dashboard", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/forecast-confidence/snapshot", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        await ensureUserRow(auth.user.id);
        const [{ data: userRow, error: userError }, { data: logs, error: logsError }, { data: anchors, error: anchorsError }, { data: activeKpis, error: kpiError }] = await Promise.all([
            dataClient.from("users").select("last_activity_timestamp,average_price_point,commission_rate").eq("id", auth.user.id).single(),
            dataClient
                .from("kpi_logs")
                .select("event_timestamp,kpi_id,pc_generated,actual_gci_delta,delay_days_applied,hold_days_applied,decay_days_applied")
                .eq("user_id", auth.user.id)
                .order("event_timestamp", { ascending: false })
                .limit(3000),
            dataClient
                .from("pipeline_anchor_status")
                .select("anchor_value")
                .eq("user_id", auth.user.id),
            dataClient
                .from("kpis")
                .select("id,type,ttc_days,ttc_definition,delay_days,hold_days,decay_days")
                .eq("is_active", true),
        ]);
        if (userError)
            return handleSupabaseError(res, "Failed to load user activity for confidence snapshot", userError);
        if (logsError)
            return handleSupabaseError(res, "Failed to load KPI logs for confidence snapshot", logsError);
        if (anchorsError)
            return handleSupabaseError(res, "Failed to load pipeline anchors for confidence snapshot", anchorsError);
        if (kpiError)
            return handleSupabaseError(res, "Failed to load KPI definitions for confidence snapshot", kpiError);
        const kpiById = new Map((activeKpis ?? []).map((row) => [
            String(row.id),
            {
                id: String(row.id),
                type: String(row.type),
                ttc_days: row.ttc_days,
                ttc_definition: row.ttc_definition,
                delay_days: row.delay_days,
                hold_days: row.hold_days,
                decay_days: row.decay_days,
            },
        ]));
        const pcEvents = (logs ?? []).reduce((acc, row) => {
            const kpi = kpiById.get(String(row.kpi_id ?? ""));
            if (!kpi || kpi.type !== "PC")
                return acc;
            const pc = toNumberOrZero(row.pc_generated);
            if (pc <= 0)
                return acc;
            const rowDelay = Number(row.delay_days_applied);
            const rowHold = Number(row.hold_days_applied);
            const timing = (0, pcTimingEngine_1.resolvePcTiming)({
                delay_days: Number.isFinite(rowDelay) ? rowDelay : kpi.delay_days,
                hold_days: Number.isFinite(rowHold) ? rowHold : kpi.hold_days,
                ttc_days: kpi.ttc_days,
                ttc_definition: kpi.ttc_definition,
            });
            const decayDaysApplied = toNumberOrZero(row.decay_days_applied);
            acc.push({
                eventTimestampIso: String(row.event_timestamp ?? ""),
                initialPcGenerated: pc,
                delayBeforePayoffStartsDays: timing.delayDays,
                holdDurationDays: timing.holdDays,
                decayDurationDays: Math.max(1, decayDaysApplied || toNumberOrZero(kpi.decay_days) || 180),
            });
            return acc;
        }, []);
        const averagePricePoint = toNumberOrZero(userRow?.average_price_point);
        const commissionRateDecimal = toNumberOrZero(userRow?.commission_rate);
        const confidence = (0, confidenceEngine_1.computeConfidence)({
            now: new Date(),
            lastActivityTimestampIso: String(userRow?.last_activity_timestamp ?? ""),
            actualLogs: (logs ?? []).map((row) => ({
                event_timestamp: String(row.event_timestamp ?? ""),
                actual_gci_delta: toNumberOrZero(row.actual_gci_delta),
            })),
            pcEvents,
            anchors: (anchors ?? []).map((row) => ({
                anchor_value: toNumberOrZero(row.anchor_value),
            })),
            averagePricePoint,
            commissionRateDecimal,
        });
        const nowIso = new Date().toISOString();
        const { data: snapshot, error: insertError } = await dataClient
            .from("forecast_confidence_snapshots")
            .insert({
            user_id: auth.user.id,
            recency_score: confidence.components.inactivity_score,
            accuracy_score: confidence.components.historical_accuracy_score,
            anchor_score: confidence.components.pipeline_health_score,
            inactivity_days: confidence.components.inactivity_days,
            confidence_score: confidence.score,
            confidence_band: confidence.band,
            computed_at: nowIso,
        })
            .select("id,user_id,recency_score,accuracy_score,anchor_score,inactivity_days,confidence_score,confidence_band,computed_at")
            .single();
        if (insertError)
            return handleSupabaseError(res, "Failed to persist confidence snapshot", insertError);
        return res.json({
            confidence: {
                score: confidence.score,
                band: confidence.band,
                components: confidence.components,
            },
            snapshot,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/forecast-confidence/snapshot", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/channels", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const { data: memberships, error: membershipError } = await dataClient
            .from("channel_memberships")
            .select("channel_id,role")
            .eq("user_id", auth.user.id);
        if (membershipError) {
            return handleSupabaseError(res, "Failed to fetch channel memberships", membershipError);
        }
        const safeMemberships = memberships ?? [];
        const channelIds = safeMemberships.map((m) => String(m.channel_id));
        if (channelIds.length === 0) {
            return res.json({ channels: [] });
        }
        const { data: channels, error: channelsError } = await dataClient
            .from("channels")
            .select("id,type,name,team_id,context_id,is_active,created_at")
            .in("id", channelIds)
            .eq("is_active", true)
            .order("created_at", { ascending: false });
        if (channelsError) {
            return handleSupabaseError(res, "Failed to fetch channels", channelsError);
        }
        const { data: unreads, error: unreadsError } = await dataClient
            .from("message_unreads")
            .select("channel_id,unread_count,last_seen_at")
            .eq("user_id", auth.user.id)
            .in("channel_id", channelIds);
        if (unreadsError) {
            return handleSupabaseError(res, "Failed to fetch unread counters", unreadsError);
        }
        const membershipByChannel = new Map(safeMemberships.map((m) => [String(m.channel_id), String(m.role)]));
        const unreadByChannel = new Map((unreads ?? []).map((u) => [
            String(u.channel_id),
            { unread_count: toNumberOrZero(u.unread_count), last_seen_at: u.last_seen_at },
        ]));
        return res.json({
            channels: (channels ?? []).map((channel) => ({
                ...channel,
                my_role: membershipByChannel.get(String(channel.id)) ?? "member",
                unread_count: unreadByChannel.get(String(channel.id))?.unread_count ?? 0,
                last_seen_at: unreadByChannel.get(String(channel.id))?.last_seen_at ?? null,
            })),
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /api/channels", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/channels", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const payloadCheck = validateChannelCreatePayload(req.body);
        if (!payloadCheck.ok) {
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        }
        const payload = payloadCheck.payload;
        await ensureUserRow(auth.user.id);
        if (payload.team_id) {
            const teamLeaderCheck = await checkTeamLeader(payload.team_id, auth.user.id);
            if (!teamLeaderCheck.ok) {
                return res.status(teamLeaderCheck.status).json({ error: teamLeaderCheck.error });
            }
            const platformAdmin = await isPlatformAdmin(auth.user.id);
            if (!teamLeaderCheck.isLeader && !platformAdmin) {
                return res.status(403).json({ error: "Only team leaders or admins can create team channels" });
            }
        }
        const { data: channel, error: channelError } = await dataClient
            .from("channels")
            .insert({
            type: payload.type,
            name: payload.name,
            team_id: payload.team_id ?? null,
            context_id: payload.context_id ?? null,
            created_by: auth.user.id,
        })
            .select("id,type,name,team_id,context_id,created_by,created_at")
            .single();
        if (channelError) {
            return handleSupabaseError(res, "Failed to create channel", channelError);
        }
        const { error: membershipError } = await dataClient.from("channel_memberships").insert({
            channel_id: channel.id,
            user_id: auth.user.id,
            role: "admin",
        });
        if (membershipError) {
            return handleSupabaseError(res, "Failed to create channel membership", membershipError);
        }
        const { error: unreadError } = await dataClient.from("message_unreads").upsert({
            channel_id: channel.id,
            user_id: auth.user.id,
            unread_count: 0,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: "channel_id,user_id" });
        if (unreadError) {
            return handleSupabaseError(res, "Failed to initialize unread state", unreadError);
        }
        return res.status(201).json({ channel });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/channels", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/channels/:id/messages", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const channelId = req.params.id;
        if (!channelId)
            return res.status(422).json({ error: "channel id is required" });
        const membership = await checkChannelMembership(channelId, auth.user.id);
        if (!membership.ok)
            return res.status(membership.status).json({ error: membership.error });
        if (!membership.member)
            return res.status(403).json({ error: "Not a channel member" });
        const { data: messages, error: messagesError } = await dataClient
            .from("channel_messages")
            .select("id,channel_id,sender_user_id,body,message_type,created_at")
            .eq("channel_id", channelId)
            .order("created_at", { ascending: true })
            .limit(500);
        if (messagesError) {
            return handleSupabaseError(res, "Failed to fetch channel messages", messagesError);
        }
        return res.json({ messages: messages ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /api/channels/:id/messages", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/channels/:id/messages", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const channelId = req.params.id;
        if (!channelId)
            return res.status(422).json({ error: "channel id is required" });
        const payloadCheck = validateChannelMessagePayload(req.body);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const membership = await checkChannelMembership(channelId, auth.user.id);
        if (!membership.ok)
            return res.status(membership.status).json({ error: membership.error });
        if (!membership.member)
            return res.status(403).json({ error: "Not a channel member" });
        const { data: message, error: messageError } = await dataClient
            .from("channel_messages")
            .insert({
            channel_id: channelId,
            sender_user_id: auth.user.id,
            body: payloadCheck.payload.body,
            message_type: "message",
        })
            .select("id,channel_id,sender_user_id,body,message_type,created_at")
            .single();
        if (messageError) {
            return handleSupabaseError(res, "Failed to create message", messageError);
        }
        await fanOutUnreadCounters(channelId, auth.user.id);
        return res.status(201).json({ message });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/channels/:id/messages", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/messages/unread-count", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const { data: rows, error } = await dataClient
            .from("message_unreads")
            .select("unread_count")
            .eq("user_id", auth.user.id);
        if (error) {
            return handleSupabaseError(res, "Failed to fetch unread count", error);
        }
        const unreadCount = (rows ?? []).reduce((sum, row) => sum + toNumberOrZero(row.unread_count), 0);
        return res.json({ unread_count: unreadCount });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /api/messages/unread-count", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/messages/mark-seen", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const payloadCheck = validateMarkSeenPayload(req.body);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const channelId = payloadCheck.payload.channel_id;
        const membership = await checkChannelMembership(channelId, auth.user.id);
        if (!membership.ok)
            return res.status(membership.status).json({ error: membership.error });
        if (!membership.member)
            return res.status(403).json({ error: "Not a channel member" });
        const nowIso = new Date().toISOString();
        const { data: row, error } = await dataClient
            .from("message_unreads")
            .upsert({
            channel_id: channelId,
            user_id: auth.user.id,
            unread_count: 0,
            last_seen_at: nowIso,
            updated_at: nowIso,
        }, { onConflict: "channel_id,user_id" })
            .select("channel_id,user_id,unread_count,last_seen_at")
            .single();
        if (error) {
            return handleSupabaseError(res, "Failed to mark messages as seen", error);
        }
        return res.json({ seen: row });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/messages/mark-seen", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/channels/:id/broadcast", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const channelId = req.params.id;
        if (!channelId)
            return res.status(422).json({ error: "channel id is required" });
        const payloadCheck = validateChannelMessagePayload(req.body);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const permission = await canBroadcastToChannel(channelId, auth.user.id);
        if (!permission.ok)
            return res.status(permission.status).json({ error: permission.error });
        if (!permission.allowed)
            return res.status(403).json({ error: "Broadcast not permitted" });
        const cap = 10;
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: recentCount, error: countError } = await dataClient
            .from("broadcast_log")
            .select("id", { count: "exact", head: true })
            .eq("actor_user_id", auth.user.id)
            .gte("created_at", since);
        if (countError) {
            return handleSupabaseError(res, "Failed to evaluate broadcast throttle", countError);
        }
        if ((recentCount ?? 0) >= cap) {
            return res.status(429).json({ error: "Broadcast rate limit exceeded for 24h window" });
        }
        const { data: message, error: messageError } = await dataClient
            .from("channel_messages")
            .insert({
            channel_id: channelId,
            sender_user_id: auth.user.id,
            body: payloadCheck.payload.body,
            message_type: "broadcast",
        })
            .select("id,channel_id,sender_user_id,body,message_type,created_at")
            .single();
        if (messageError) {
            return handleSupabaseError(res, "Failed to create broadcast message", messageError);
        }
        const { error: logError } = await dataClient.from("broadcast_log").insert({
            channel_id: channelId,
            actor_user_id: auth.user.id,
            message_id: message.id,
            message_body: payloadCheck.payload.body,
        });
        if (logError) {
            return handleSupabaseError(res, "Failed to write broadcast audit log", logError);
        }
        await fanOutUnreadCounters(channelId, auth.user.id);
        return res.status(201).json({ broadcast: message });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/channels/:id/broadcast", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/push-tokens", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const payloadCheck = validatePushTokenPayload(req.body);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const nowIso = new Date().toISOString();
        const { data, error } = await dataClient
            .from("push_tokens")
            .upsert({
            user_id: auth.user.id,
            token: payloadCheck.payload.token,
            platform: payloadCheck.payload.platform ?? "expo",
            is_active: true,
            updated_at: nowIso,
        }, { onConflict: "user_id,token" })
            .select("id,user_id,platform,token,is_active,created_at,updated_at")
            .single();
        if (error) {
            return handleSupabaseError(res, "Failed to register push token", error);
        }
        return res.status(201).json({ push_token: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/push-tokens", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/coaching/journeys", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const { data: journeys, error: journeysError } = await dataClient
            .from("journeys")
            .select("id,title,description,team_id,is_active,created_at")
            .eq("is_active", true)
            .order("created_at", { ascending: false });
        if (journeysError) {
            return handleSupabaseError(res, "Failed to fetch coaching journeys", journeysError);
        }
        const platformAdmin = await isPlatformAdmin(auth.user.id);
        let visibleJourneys = journeys ?? [];
        if (!platformAdmin) {
            const scopedTeamIds = Array.from(new Set(visibleJourneys
                .map((j) => String(j.team_id ?? ""))
                .filter(Boolean)));
            let memberTeamIds = new Set();
            if (scopedTeamIds.length > 0) {
                const { data: memberships, error: membershipsError } = await dataClient
                    .from("team_memberships")
                    .select("team_id")
                    .eq("user_id", auth.user.id)
                    .in("team_id", scopedTeamIds);
                if (membershipsError) {
                    return handleSupabaseError(res, "Failed to evaluate coaching journey visibility", membershipsError);
                }
                memberTeamIds = new Set((memberships ?? []).map((m) => String(m.team_id)));
            }
            visibleJourneys = visibleJourneys.filter((j) => {
                const teamId = String(j.team_id ?? "");
                return !teamId || memberTeamIds.has(teamId);
            });
        }
        const journeyIds = visibleJourneys.map((j) => String(j.id));
        if (journeyIds.length === 0) {
            return res.json({ journeys: [] });
        }
        const { data: milestones, error: milestonesError } = await dataClient
            .from("milestones")
            .select("id,journey_id")
            .in("journey_id", journeyIds);
        if (milestonesError) {
            return handleSupabaseError(res, "Failed to fetch coaching milestones", milestonesError);
        }
        const milestoneIds = (milestones ?? []).map((m) => String(m.id));
        let lessonRows = [];
        if (milestoneIds.length > 0) {
            const { data: lessons, error: lessonsError } = await dataClient
                .from("lessons")
                .select("id,milestone_id")
                .eq("is_active", true)
                .in("milestone_id", milestoneIds);
            if (lessonsError) {
                return handleSupabaseError(res, "Failed to fetch coaching lessons", lessonsError);
            }
            lessonRows = (lessons ?? []);
        }
        const lessonIds = lessonRows.map((l) => String(l.id));
        let progressRows = [];
        if (lessonIds.length > 0) {
            const { data: progress, error: progressError } = await dataClient
                .from("lesson_progress")
                .select("lesson_id,status")
                .eq("user_id", auth.user.id)
                .in("lesson_id", lessonIds);
            if (progressError) {
                return handleSupabaseError(res, "Failed to fetch lesson progress", progressError);
            }
            progressRows = (progress ?? []);
        }
        const milestoneCountByJourney = new Map();
        for (const m of milestones ?? []) {
            const journeyId = String(m.journey_id);
            milestoneCountByJourney.set(journeyId, (milestoneCountByJourney.get(journeyId) ?? 0) + 1);
        }
        const lessonCountByJourney = new Map();
        const journeyByMilestone = new Map((milestones ?? []).map((m) => [String(m.id), String(m.journey_id)]));
        for (const l of lessonRows) {
            const journeyId = journeyByMilestone.get(String(l.milestone_id));
            if (!journeyId)
                continue;
            lessonCountByJourney.set(journeyId, (lessonCountByJourney.get(journeyId) ?? 0) + 1);
        }
        const progressByLesson = new Map(progressRows.map((p) => [String(p.lesson_id), String(p.status)]));
        const completedLessonsByJourney = new Map();
        for (const l of lessonRows) {
            const journeyId = journeyByMilestone.get(String(l.milestone_id));
            if (!journeyId)
                continue;
            if (progressByLesson.get(String(l.id)) === "completed") {
                completedLessonsByJourney.set(journeyId, (completedLessonsByJourney.get(journeyId) ?? 0) + 1);
            }
        }
        return res.json({
            journeys: visibleJourneys.map((j) => {
                const journeyId = String(j.id);
                const lessonsTotal = lessonCountByJourney.get(journeyId) ?? 0;
                const lessonsCompleted = completedLessonsByJourney.get(journeyId) ?? 0;
                return {
                    ...j,
                    milestones_count: milestoneCountByJourney.get(journeyId) ?? 0,
                    lessons_total: lessonsTotal,
                    lessons_completed: lessonsCompleted,
                    completion_percent: lessonsTotal > 0 ? Number(((lessonsCompleted / lessonsTotal) * 100).toFixed(2)) : 0,
                };
            }),
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /api/coaching/journeys", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/coaching/journeys/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const journeyId = req.params.id;
        if (!journeyId)
            return res.status(422).json({ error: "journey id is required" });
        const { data: journey, error: journeyError } = await dataClient
            .from("journeys")
            .select("id,title,description,team_id,is_active,created_at")
            .eq("id", journeyId)
            .single();
        if (journeyError) {
            return handleSupabaseError(res, "Failed to fetch journey", journeyError);
        }
        const platformAdmin = await isPlatformAdmin(auth.user.id);
        const scopedTeamId = String(journey?.team_id ?? "");
        if (scopedTeamId && !platformAdmin) {
            const membership = await checkTeamMembership(scopedTeamId, auth.user.id);
            if (!membership.ok)
                return res.status(membership.status).json({ error: membership.error });
            if (!membership.member)
                return res.status(403).json({ error: "You are not allowed to view this journey" });
        }
        const { data: milestones, error: milestonesError } = await dataClient
            .from("milestones")
            .select("id,journey_id,title,sort_order")
            .eq("journey_id", journeyId)
            .order("sort_order", { ascending: true });
        if (milestonesError) {
            return handleSupabaseError(res, "Failed to fetch milestones", milestonesError);
        }
        const milestoneIds = (milestones ?? []).map((m) => String(m.id));
        let lessons = [];
        if (milestoneIds.length > 0) {
            const { data: lessonRows, error: lessonError } = await dataClient
                .from("lessons")
                .select("id,milestone_id,title,body,sort_order")
                .eq("is_active", true)
                .in("milestone_id", milestoneIds)
                .order("sort_order", { ascending: true });
            if (lessonError) {
                return handleSupabaseError(res, "Failed to fetch lessons", lessonError);
            }
            lessons = (lessonRows ?? []);
        }
        const lessonIds = lessons.map((l) => String(l.id));
        let progressRows = [];
        if (lessonIds.length > 0) {
            const { data: progress, error: progressError } = await dataClient
                .from("lesson_progress")
                .select("lesson_id,status,completed_at")
                .eq("user_id", auth.user.id)
                .in("lesson_id", lessonIds);
            if (progressError) {
                return handleSupabaseError(res, "Failed to fetch lesson progress", progressError);
            }
            progressRows = (progress ?? []);
        }
        const progressByLesson = new Map(progressRows.map((p) => [String(p.lesson_id), p]));
        const lessonsByMilestone = new Map();
        for (const lesson of lessons) {
            const progress = progressByLesson.get(String(lesson.id));
            const arr = lessonsByMilestone.get(String(lesson.milestone_id)) ?? [];
            arr.push({
                id: lesson.id,
                title: lesson.title,
                body: lesson.body,
                sort_order: lesson.sort_order,
                progress_status: progress?.status ?? "not_started",
                completed_at: progress?.completed_at ?? null,
            });
            lessonsByMilestone.set(String(lesson.milestone_id), arr);
        }
        return res.json({
            journey,
            milestones: (milestones ?? []).map((m) => ({
                ...m,
                lessons: lessonsByMilestone.get(String(m.id)) ?? [],
            })),
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /api/coaching/journeys/:id", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/coaching/lessons/:id/progress", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const lessonId = req.params.id;
        if (!lessonId)
            return res.status(422).json({ error: "lesson id is required" });
        const payloadCheck = validateCoachingLessonProgressPayload(req.body);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const { data: lesson, error: lessonError } = await dataClient
            .from("lessons")
            .select("id,milestone_id")
            .eq("id", lessonId)
            .single();
        if (lessonError) {
            return handleSupabaseError(res, "Failed to fetch lesson", lessonError);
        }
        const { data: milestone, error: milestoneError } = await dataClient
            .from("milestones")
            .select("journey_id")
            .eq("id", String(lesson.milestone_id))
            .single();
        if (milestoneError) {
            return handleSupabaseError(res, "Failed to fetch milestone", milestoneError);
        }
        const { data: journey, error: journeyError } = await dataClient
            .from("journeys")
            .select("team_id")
            .eq("id", String(milestone.journey_id))
            .single();
        if (journeyError) {
            return handleSupabaseError(res, "Failed to fetch journey", journeyError);
        }
        const platformAdmin = await isPlatformAdmin(auth.user.id);
        const scopedTeamId = String(journey?.team_id ?? "");
        if (scopedTeamId && !platformAdmin) {
            const membership = await checkTeamMembership(scopedTeamId, auth.user.id);
            if (!membership.ok)
                return res.status(membership.status).json({ error: membership.error });
            if (!membership.member) {
                return res.status(403).json({ error: "You are not allowed to update progress for this lesson" });
            }
        }
        await ensureUserRow(auth.user.id);
        const completedAt = payloadCheck.payload.status === "completed" ? new Date().toISOString() : null;
        const nowIso = new Date().toISOString();
        const { data: row, error } = await dataClient
            .from("lesson_progress")
            .upsert({
            lesson_id: lessonId,
            user_id: auth.user.id,
            status: payloadCheck.payload.status,
            completed_at: completedAt,
            updated_at: nowIso,
        }, { onConflict: "lesson_id,user_id" })
            .select("lesson_id,user_id,status,completed_at,updated_at")
            .single();
        if (error) {
            return handleSupabaseError(res, "Failed to update lesson progress", error);
        }
        return res.json({ progress: row });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/coaching/lessons/:id/progress", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/coaching/progress", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const { data: rows, error } = await dataClient
            .from("lesson_progress")
            .select("status")
            .eq("user_id", auth.user.id);
        if (error) {
            return handleSupabaseError(res, "Failed to fetch coaching progress summary", error);
        }
        const total = (rows ?? []).length;
        const byStatus = { not_started: 0, in_progress: 0, completed: 0 };
        for (const row of rows ?? []) {
            const status = String(row.status ?? "not_started");
            if (status === "completed" || status === "in_progress" || status === "not_started") {
                byStatus[status] += 1;
            }
        }
        return res.json({
            total_progress_rows: total,
            status_counts: byStatus,
            completion_percent: total > 0 ? Number(((byStatus.completed / total) * 100).toFixed(2)) : 0,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /api/coaching/progress", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/coaching/broadcast", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const payloadCheck = validateCoachingBroadcastPayload(req.body);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const payload = payloadCheck.payload;
        const platformAdmin = await isPlatformAdmin(auth.user.id);
        if (payload.scope_type === "global" && !platformAdmin) {
            return res.status(403).json({ error: "Only platform admins can send global coaching broadcasts" });
        }
        if (payload.scope_type === "team") {
            if (!payload.scope_id) {
                return res.status(422).json({ error: "scope_id is required for team broadcasts" });
            }
            const leaderCheck = await checkTeamLeader(payload.scope_id, auth.user.id);
            if (!leaderCheck.ok)
                return res.status(leaderCheck.status).json({ error: leaderCheck.error });
            if (!leaderCheck.isLeader && !platformAdmin) {
                return res.status(403).json({ error: "Only team leaders or admins can send team coaching broadcasts" });
            }
        }
        if (payload.scope_type === "journey" && !payload.scope_id) {
            return res.status(422).json({ error: "scope_id is required for journey broadcasts" });
        }
        const { data: row, error } = await dataClient
            .from("coach_broadcasts")
            .insert({
            actor_user_id: auth.user.id,
            scope_type: payload.scope_type,
            scope_id: payload.scope_id ?? null,
            message_body: payload.message_body,
        })
            .select("id,actor_user_id,scope_type,scope_id,message_body,created_at")
            .single();
        if (error) {
            return handleSupabaseError(res, "Failed to create coaching broadcast", error);
        }
        return res.status(201).json({ broadcast: row });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/coaching/broadcast", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/ai/suggestions", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const payloadCheck = validateAiSuggestionCreatePayload(req.body);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const payload = payloadCheck.payload;
        const platformAdmin = await isPlatformAdmin(auth.user.id);
        const targetUserId = payload.user_id ?? auth.user.id;
        if (targetUserId !== auth.user.id && !platformAdmin) {
            const leaderScope = await canLeaderTargetUserForAiSuggestion(auth.user.id, targetUserId);
            if (!leaderScope.ok)
                return res.status(leaderScope.status).json({ error: leaderScope.error });
            if (!leaderScope.allowed) {
                return res.status(403).json({ error: "Only platform admins or team leaders can create AI suggestions for other users" });
            }
        }
        await ensureUserRow(auth.user.id);
        await ensureUserRow(targetUserId);
        const { data: row, error } = await dataClient
            .from("ai_suggestions")
            .insert({
            user_id: targetUserId,
            scope: payload.scope,
            proposed_message: payload.proposed_message,
            status: "pending",
            created_by: auth.user.id,
            updated_at: new Date().toISOString(),
        })
            .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,created_at,updated_at")
            .single();
        if (error) {
            return handleSupabaseError(res, "Failed to create AI suggestion", error);
        }
        return res.status(201).json({ suggestion: row });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/ai/suggestions", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/ai/suggestions", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const platformAdmin = await isPlatformAdmin(auth.user.id);
        if (platformAdmin) {
            const { data, error } = await dataClient
                .from("ai_suggestions")
                .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,created_at,updated_at")
                .order("created_at", { ascending: false })
                .limit(500);
            if (error) {
                return handleSupabaseError(res, "Failed to fetch AI suggestions", error);
            }
            return res.json({ suggestions: data ?? [] });
        }
        const { data, error } = await dataClient
            .from("ai_suggestions")
            .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,created_at,updated_at")
            .or(`created_by.eq.${auth.user.id},user_id.eq.${auth.user.id}`)
            .order("created_at", { ascending: false })
            .limit(500);
        if (error) {
            return handleSupabaseError(res, "Failed to fetch AI suggestions", error);
        }
        return res.json({ suggestions: data ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /api/ai/suggestions", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/ai/suggestions/:id/approve", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const suggestionId = req.params.id;
        if (!suggestionId)
            return res.status(422).json({ error: "suggestion id is required" });
        const platformAdmin = await isPlatformAdmin(auth.user.id);
        if (!platformAdmin) {
            return res.status(403).json({ error: "Only platform admins can approve AI suggestions" });
        }
        const { data: existing, error: existingError } = await dataClient
            .from("ai_suggestions")
            .select("id,status")
            .eq("id", suggestionId)
            .single();
        if (existingError) {
            return handleSupabaseError(res, "Failed to fetch AI suggestion", existingError);
        }
        if (String(existing.status) !== "pending") {
            return res.status(422).json({ error: "Only pending suggestions can be approved" });
        }
        const nowIso = new Date().toISOString();
        const { data: updated, error: updateError } = await dataClient
            .from("ai_suggestions")
            .update({
            status: "approved",
            approved_by: auth.user.id,
            rejected_by: null,
            sent_at: nowIso,
            updated_at: nowIso,
        })
            .eq("id", suggestionId)
            .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,sent_at,updated_at")
            .single();
        if (updateError) {
            return handleSupabaseError(res, "Failed to approve AI suggestion", updateError);
        }
        return res.json({ suggestion: updated });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/ai/suggestions/:id/approve", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/ai/suggestions/:id/reject", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const suggestionId = req.params.id;
        if (!suggestionId)
            return res.status(422).json({ error: "suggestion id is required" });
        const platformAdmin = await isPlatformAdmin(auth.user.id);
        if (!platformAdmin) {
            return res.status(403).json({ error: "Only platform admins can reject AI suggestions" });
        }
        const { data: existing, error: existingError } = await dataClient
            .from("ai_suggestions")
            .select("id,status")
            .eq("id", suggestionId)
            .single();
        if (existingError) {
            return handleSupabaseError(res, "Failed to fetch AI suggestion", existingError);
        }
        if (String(existing.status) !== "pending") {
            return res.status(422).json({ error: "Only pending suggestions can be rejected" });
        }
        const nowIso = new Date().toISOString();
        const { data: updated, error: updateError } = await dataClient
            .from("ai_suggestions")
            .update({
            status: "rejected",
            approved_by: null,
            rejected_by: auth.user.id,
            sent_at: null,
            updated_at: nowIso,
        })
            .eq("id", suggestionId)
            .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,sent_at,updated_at")
            .single();
        if (updateError) {
            return handleSupabaseError(res, "Failed to reject AI suggestion", updateError);
        }
        return res.json({ suggestion: updated });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/ai/suggestions/:id/reject", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/ops/summary/sprint1", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const [usersOut, kpisOut, logsOut, anchorsOut, kpiDefsOut, idempotencySelectOut,] = await Promise.all([
            dataClient.from("users").select("id", { count: "exact", head: true }),
            dataClient.from("kpis").select("id", { count: "exact", head: true }),
            dataClient.from("kpi_logs").select("id,user_id,kpi_id,pc_generated,actual_gci_delta,idempotency_key", { count: "exact" }),
            dataClient.from("pipeline_anchor_status").select("id", { count: "exact", head: true }),
            dataClient.from("kpis").select("id,type,name"),
            dataClient.from("kpi_logs").select("idempotency_key").limit(1),
        ]);
        if (usersOut.error || kpisOut.error || logsOut.error || anchorsOut.error || kpiDefsOut.error) {
            return res.status(500).json({ error: "Failed to compute Sprint 1 summary" });
        }
        const logs = logsOut.data ?? [];
        const kpiDefs = kpiDefsOut.data ?? [];
        const kpiTypeById = new Map(kpiDefs.map((k) => [String(k.id), String(k.type)]));
        let gpVpWithPc = 0;
        let actualWithPc = 0;
        let pcWithoutPcValue = 0;
        const idemKeyCounts = new Map();
        for (const log of logs) {
            const kpiType = kpiTypeById.get(String(log.kpi_id));
            const pcGenerated = toNumberOrZero(log.pc_generated);
            const key = String(log.user_id) + "::" + String(log.idempotency_key ?? "");
            if ((kpiType === "GP" || kpiType === "VP") && pcGenerated !== 0) {
                gpVpWithPc += 1;
            }
            if (kpiType === "Actual" && pcGenerated !== 0) {
                actualWithPc += 1;
            }
            if (kpiType === "PC" && pcGenerated <= 0) {
                pcWithoutPcValue += 1;
            }
            if (log.idempotency_key) {
                idemKeyCounts.set(key, (idemKeyCounts.get(key) ?? 0) + 1);
            }
        }
        let duplicateIdemRows = 0;
        for (const cnt of idemKeyCounts.values()) {
            if (cnt > 1)
                duplicateIdemRows += cnt - 1;
        }
        return res.json({
            sprint: "sprint1",
            generated_at: new Date().toISOString(),
            totals: {
                users: usersOut.count ?? 0,
                kpis: kpisOut.count ?? 0,
                kpi_logs: logsOut.count ?? logs.length,
                pipeline_anchor_status: anchorsOut.count ?? 0,
            },
            integrity_checks: {
                gp_vp_logs_with_pc_generated: gpVpWithPc,
                actual_logs_with_pc_generated: actualWithPc,
                pc_logs_with_non_positive_pc_generated: pcWithoutPcValue,
                duplicate_user_idempotency_rows: duplicateIdemRows,
            },
            schema_checks: {
                kpi_logs_has_idempotency_key: !idempotencySelectOut.error,
            },
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /ops/summary/sprint1", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/ops/summary/sprint2", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const [teamsOut, membershipsOut, challengesOut, participantsOut, challengeKpisOut] = await Promise.all([
            dataClient.from("teams").select("id", { count: "exact" }),
            dataClient.from("team_memberships").select("team_id,user_id,role"),
            dataClient.from("challenges").select("id,team_id,mode,is_active,late_join_includes_history"),
            dataClient.from("challenge_participants").select("challenge_id,user_id,team_id,effective_start_at,progress_percent"),
            dataClient.from("challenge_kpis").select("challenge_id,kpi_id"),
        ]);
        if (teamsOut.error ||
            membershipsOut.error ||
            challengesOut.error ||
            participantsOut.error ||
            challengeKpisOut.error) {
            return res.status(500).json({ error: "Failed to compute Sprint 2 summary" });
        }
        const memberships = membershipsOut.data ?? [];
        const challenges = challengesOut.data ?? [];
        const participants = participantsOut.data ?? [];
        const challengeKpis = challengeKpisOut.data ?? [];
        const leadersByTeam = new Map();
        const membershipSet = new Set();
        for (const m of memberships) {
            const teamId = String(m.team_id);
            const userId = String(m.user_id);
            membershipSet.add(`${teamId}::${userId}`);
            if (String(m.role) === "team_leader") {
                leadersByTeam.set(teamId, (leadersByTeam.get(teamId) ?? 0) + 1);
            }
        }
        let teamsWithoutLeader = 0;
        const challengeById = new Map(challenges.map((c) => [String(c.id), c]));
        for (const teamId of new Set((teamsOut.data ?? []).map((t) => String(t.id)))) {
            if ((leadersByTeam.get(teamId) ?? 0) === 0) {
                teamsWithoutLeader += 1;
            }
        }
        const kpiMapCountByChallenge = new Map();
        for (const row of challengeKpis) {
            const challengeId = String(row.challenge_id);
            kpiMapCountByChallenge.set(challengeId, (kpiMapCountByChallenge.get(challengeId) ?? 0) + 1);
        }
        let activeChallengesWithoutKpis = 0;
        for (const c of challenges) {
            const challengeId = String(c.id);
            const isActive = Boolean(c.is_active);
            if (isActive && (kpiMapCountByChallenge.get(challengeId) ?? 0) === 0) {
                activeChallengesWithoutKpis += 1;
            }
        }
        let teamModeParticipantsNotOnTeam = 0;
        for (const p of participants) {
            const challenge = challengeById.get(String(p.challenge_id));
            if (!challenge)
                continue;
            if (String(challenge.mode) !== "team")
                continue;
            const teamId = String(challenge.team_id ?? "");
            const userId = String(p.user_id);
            if (!teamId || !membershipSet.has(`${teamId}::${userId}`)) {
                teamModeParticipantsNotOnTeam += 1;
            }
        }
        const lateJoinPolicy = {
            true_count: challenges.filter((c) => Boolean(c.late_join_includes_history)).length,
            false_count: challenges.filter((c) => !Boolean(c.late_join_includes_history)).length,
        };
        const participantCountByChallenge = new Map();
        for (const p of participants) {
            const challengeId = String(p.challenge_id);
            participantCountByChallenge.set(challengeId, (participantCountByChallenge.get(challengeId) ?? 0) + 1);
        }
        const challengeParticipantRows = challenges.map((c) => ({
            challenge_id: String(c.id),
            participants: participantCountByChallenge.get(String(c.id)) ?? 0,
            mode: String(c.mode),
        }));
        challengeParticipantRows.sort((a, b) => b.participants - a.participants);
        return res.json({
            sprint: "sprint2",
            generated_at: new Date().toISOString(),
            totals: {
                teams: teamsOut.count ?? 0,
                team_memberships: memberships.length,
                challenges: challenges.length,
                challenge_participants: participants.length,
                challenge_kpi_mappings: challengeKpis.length,
            },
            integrity_checks: {
                teams_without_team_leader: teamsWithoutLeader,
                active_challenges_without_kpi_mapping: activeChallengesWithoutKpis,
                team_mode_participants_not_on_team: teamModeParticipantsNotOnTeam,
            },
            policy_distribution: {
                late_join_includes_history: lateJoinPolicy,
            },
            top_challenges_by_participants: challengeParticipantRows.slice(0, 5),
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /ops/summary/sprint2", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/ops/summary/sprint3", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const [channelsOut, channelMembershipsOut, channelMessagesOut, messageUnreadsOut, pushTokensOut, broadcastLogOut,] = await Promise.all([
            dataClient.from("channels").select("id,is_active"),
            dataClient.from("channel_memberships").select("channel_id,user_id,role"),
            dataClient.from("channel_messages").select("id,channel_id,sender_user_id,message_type"),
            dataClient.from("message_unreads").select("channel_id,user_id,unread_count"),
            dataClient.from("push_tokens").select("id,is_active"),
            dataClient.from("broadcast_log").select("id,message_id,channel_id,actor_user_id"),
        ]);
        if (channelsOut.error ||
            channelMembershipsOut.error ||
            channelMessagesOut.error ||
            messageUnreadsOut.error ||
            pushTokensOut.error ||
            broadcastLogOut.error) {
            return res.status(500).json({ error: "Failed to compute Sprint 3 summary" });
        }
        const channels = channelsOut.data ?? [];
        const memberships = channelMembershipsOut.data ?? [];
        const messages = channelMessagesOut.data ?? [];
        const unreads = messageUnreadsOut.data ?? [];
        const pushTokens = pushTokensOut.data ?? [];
        const broadcastLogs = broadcastLogOut.data ?? [];
        const membershipSet = new Set(memberships.map((m) => `${String(m.channel_id)}::${String(m.user_id)}`));
        const adminCountByChannel = new Map();
        for (const m of memberships) {
            if (String(m.role) === "admin") {
                const channelId = String(m.channel_id);
                adminCountByChannel.set(channelId, (adminCountByChannel.get(channelId) ?? 0) + 1);
            }
        }
        let activeChannelsWithoutMembers = 0;
        let activeChannelsWithoutAdmin = 0;
        for (const channel of channels) {
            const channelId = String(channel.id);
            const isActive = Boolean(channel.is_active);
            if (!isActive)
                continue;
            const memberCount = memberships.filter((m) => String(m.channel_id) === channelId).length;
            if (memberCount === 0) {
                activeChannelsWithoutMembers += 1;
            }
            if ((adminCountByChannel.get(channelId) ?? 0) === 0) {
                activeChannelsWithoutAdmin += 1;
            }
        }
        let messagesByNonMembers = 0;
        for (const message of messages) {
            const key = `${String(message.channel_id)}::${String(message.sender_user_id)}`;
            if (!membershipSet.has(key)) {
                messagesByNonMembers += 1;
            }
        }
        let negativeUnreadRows = 0;
        for (const row of unreads) {
            if (toNumberOrZero(row.unread_count) < 0) {
                negativeUnreadRows += 1;
            }
        }
        const broadcastMessageIds = new Set(messages
            .filter((m) => String(m.message_type) === "broadcast")
            .map((m) => String(m.id)));
        const broadcastLogMessageIds = new Set(broadcastLogs
            .map((b) => String(b.message_id ?? ""))
            .filter(Boolean));
        let broadcastMessagesWithoutAudit = 0;
        for (const messageId of broadcastMessageIds) {
            if (!broadcastLogMessageIds.has(messageId)) {
                broadcastMessagesWithoutAudit += 1;
            }
        }
        const topChannelsByMessages = channels
            .map((channel) => {
            const channelId = String(channel.id);
            const messageCount = messages.filter((m) => String(m.channel_id) === channelId).length;
            return { channel_id: channelId, message_count: messageCount };
        })
            .sort((a, b) => b.message_count - a.message_count)
            .slice(0, 5);
        return res.json({
            sprint: "sprint3",
            generated_at: new Date().toISOString(),
            totals: {
                channels: channels.length,
                channel_memberships: memberships.length,
                channel_messages: messages.length,
                message_unreads: unreads.length,
                push_tokens_total: pushTokens.length,
                push_tokens_active: pushTokens.filter((t) => Boolean(t.is_active)).length,
                broadcast_logs: broadcastLogs.length,
            },
            integrity_checks: {
                active_channels_without_members: activeChannelsWithoutMembers,
                active_channels_without_admin: activeChannelsWithoutAdmin,
                channel_messages_by_non_members: messagesByNonMembers,
                negative_unread_rows: negativeUnreadRows,
                broadcast_messages_without_audit_log: broadcastMessagesWithoutAudit,
            },
            top_channels_by_messages: topChannelsByMessages,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /ops/summary/sprint3", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/ops/summary/policy", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const [kpiDefsOut, kpiLogsOut, participantsOut, sponsoredOut, adminAuditOut, usersOut, notificationOut,] = await Promise.all([
            dataClient.from("kpis").select("id,type"),
            dataClient.from("kpi_logs").select("kpi_id,pc_generated"),
            dataClient.from("challenge_participants").select("id,sponsored_challenge_id"),
            dataClient.from("sponsored_challenges").select("id"),
            dataClient.from("admin_activity_log").select("id,admin_user_id"),
            dataClient.from("users").select("id,role,account_status,last_activity_timestamp"),
            dataClient.from("notification_queue").select("id,status,attempts"),
        ]);
        if (kpiDefsOut.error ||
            kpiLogsOut.error ||
            participantsOut.error ||
            sponsoredOut.error ||
            adminAuditOut.error ||
            usersOut.error ||
            notificationOut.error) {
            return res.status(500).json({ error: "Failed to compute policy summary" });
        }
        const kpiTypeById = new Map((kpiDefsOut.data ?? []).map((k) => [String(k.id), String(k.type)]));
        let gpVpWithPc = 0;
        let actualWithPc = 0;
        for (const log of kpiLogsOut.data ?? []) {
            const type = kpiTypeById.get(String(log.kpi_id));
            const pc = toNumberOrZero(log.pc_generated);
            if ((type === "GP" || type === "VP") && pc !== 0)
                gpVpWithPc += 1;
            if (type === "Actual" && pc !== 0)
                actualWithPc += 1;
        }
        const sponsoredIds = new Set((sponsoredOut.data ?? []).map((row) => String(row.id)));
        let participantSponsoredLinkViolations = 0;
        for (const p of participantsOut.data ?? []) {
            const sponsoredId = String(p.sponsored_challenge_id ?? "");
            if (sponsoredId && !sponsoredIds.has(sponsoredId))
                participantSponsoredLinkViolations += 1;
        }
        const userRoleById = new Map((usersOut.data ?? []).map((u) => [String(u.id), String(u.role ?? "")]));
        let adminAuditByNonAdmin = 0;
        for (const row of adminAuditOut.data ?? []) {
            const role = userRoleById.get(String(row.admin_user_id)) ?? "";
            if (role !== "admin" && role !== "super_admin")
                adminAuditByNonAdmin += 1;
        }
        const nowMs = Date.now();
        let deactivatedWithRecentActivity = 0;
        for (const user of usersOut.data ?? []) {
            if (String(user.account_status) !== "deactivated")
                continue;
            const lastActivityMs = new Date(String(user.last_activity_timestamp ?? 0)).getTime();
            if (Number.isFinite(lastActivityMs) && nowMs - lastActivityMs < 7 * 24 * 60 * 60 * 1000) {
                deactivatedWithRecentActivity += 1;
            }
        }
        let failedNotificationsOverRetryThreshold = 0;
        for (const n of notificationOut.data ?? []) {
            if (String(n.status) === "failed" && toNumberOrZero(n.attempts) >= 3) {
                failedNotificationsOverRetryThreshold += 1;
            }
        }
        return res.json({
            summary: {
                generated_at: new Date().toISOString(),
                checks: {
                    gp_vp_logs_with_pc_generated: gpVpWithPc,
                    actual_logs_with_pc_generated: actualWithPc,
                    challenge_participants_with_invalid_sponsored_link: participantSponsoredLinkViolations,
                    admin_activity_rows_by_non_admin_roles: adminAuditByNonAdmin,
                    deactivated_users_with_recent_activity_7d: deactivatedWithRecentActivity,
                    failed_notifications_over_retry_threshold: failedNotificationsOverRetryThreshold,
                },
            },
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /ops/summary/policy", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/teams", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const payloadCheck = validateTeamCreatePayload(req.body);
        if (!payloadCheck.ok) {
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        }
        await ensureUserRow(auth.user.id);
        const { data: team, error: teamError } = await dataClient
            .from("teams")
            .insert({
            name: payloadCheck.payload.name,
            created_by: auth.user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .select("id,name,created_by,created_at")
            .single();
        if (teamError) {
            return handleSupabaseError(res, "Failed to create team", teamError);
        }
        const { error: membershipError } = await dataClient
            .from("team_memberships")
            .insert({
            team_id: team.id,
            user_id: auth.user.id,
            role: "team_leader",
        });
        if (membershipError) {
            return handleSupabaseError(res, "Failed to create team leader membership", membershipError);
        }
        return res.status(201).json({ team });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /teams", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/teams/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const teamId = req.params.id;
        if (!teamId) {
            return res.status(422).json({ error: "team id is required" });
        }
        const isMember = await checkTeamMembership(teamId, auth.user.id);
        if (!isMember.ok) {
            return res.status(isMember.status).json({ error: isMember.error });
        }
        if (!isMember.member) {
            return res.status(403).json({ error: "You are not a member of this team" });
        }
        const { data: team, error: teamError } = await dataClient
            .from("teams")
            .select("id,name,created_by,created_at,updated_at")
            .eq("id", teamId)
            .single();
        if (teamError) {
            return handleSupabaseError(res, "Failed to fetch team", teamError);
        }
        const { data: members, error: membersError } = await dataClient
            .from("team_memberships")
            .select("user_id,role,created_at")
            .eq("team_id", teamId)
            .order("created_at", { ascending: true });
        if (membersError) {
            return handleSupabaseError(res, "Failed to fetch team members", membersError);
        }
        return res.json({ team, members: members ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /teams/:id", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/teams/:id/members", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const teamId = req.params.id;
        if (!teamId) {
            return res.status(422).json({ error: "team id is required" });
        }
        const payloadCheck = validateTeamMemberAddPayload(req.body);
        if (!payloadCheck.ok) {
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        }
        const leaderCheck = await checkTeamLeader(teamId, auth.user.id);
        if (!leaderCheck.ok) {
            return res.status(leaderCheck.status).json({ error: leaderCheck.error });
        }
        if (!leaderCheck.isLeader) {
            return res.status(403).json({ error: "Only team leaders can add members" });
        }
        await ensureUserRow(payloadCheck.payload.user_id);
        const { data: membership, error: membershipError } = await dataClient
            .from("team_memberships")
            .upsert({
            team_id: teamId,
            user_id: payloadCheck.payload.user_id,
            role: payloadCheck.payload.role ?? "member",
        }, { onConflict: "team_id,user_id" })
            .select("team_id,user_id,role,created_at")
            .single();
        if (membershipError) {
            return handleSupabaseError(res, "Failed to add team member", membershipError);
        }
        return res.status(201).json({ membership });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /teams/:id/members", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/challenges", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const nowIso = new Date().toISOString();
        const { data: challenges, error: challengesError } = await dataClient
            .from("challenges")
            .select("id,name,description,mode,team_id,start_at,end_at,late_join_includes_history,is_active,created_at")
            .eq("is_active", true)
            .gte("end_at", nowIso)
            .order("start_at", { ascending: true })
            .limit(200);
        if (challengesError) {
            return handleSupabaseError(res, "Failed to fetch challenges", challengesError);
        }
        const challengeList = challenges ?? [];
        const challengeIds = challengeList.map((c) => String(c.id));
        let participationByChallenge = new Map();
        if (challengeIds.length > 0) {
            const { data: myParticipations, error: myParticipationError } = await dataClient
                .from("challenge_participants")
                .select("challenge_id,user_id,joined_at,effective_start_at,progress_percent")
                .eq("user_id", auth.user.id)
                .in("challenge_id", challengeIds);
            if (myParticipationError) {
                return handleSupabaseError(res, "Failed to fetch user challenge participation", myParticipationError);
            }
            participationByChallenge = new Map((myParticipations ?? []).map((p) => [String(p.challenge_id), p]));
        }
        const enriched = [];
        for (const challenge of challengeList) {
            const challengeId = String(challenge.id);
            const myParticipation = participationByChallenge.get(challengeId);
            let refreshedParticipation = myParticipation ?? null;
            if (myParticipation) {
                const recalculatedProgress = await computeChallengeProgressPercent(challengeId, auth.user.id);
                await dataClient
                    .from("challenge_participants")
                    .update({ progress_percent: recalculatedProgress })
                    .eq("challenge_id", challengeId)
                    .eq("user_id", auth.user.id);
                refreshedParticipation = {
                    ...myParticipation,
                    progress_percent: recalculatedProgress,
                };
            }
            const leaderboard = await buildChallengeLeaderboard(String(challenge.id), 5);
            enriched.push({
                ...challenge,
                my_participation: refreshedParticipation,
                leaderboard_top: leaderboard,
            });
        }
        return res.json({ challenges: enriched });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /challenges", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/sponsored-challenges", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        await ensureUserRow(auth.user.id);
        const { data: userRow, error: userError } = await dataClient
            .from("users")
            .select("tier")
            .eq("id", auth.user.id)
            .single();
        if (userError)
            return handleSupabaseError(res, "Failed to load user tier", userError);
        const userTier = String(userRow.tier ?? "free");
        const nowIso = new Date().toISOString();
        const { data: rows, error } = await dataClient
            .from("sponsored_challenges")
            .select("id,name,description,reward_text,cta_label,cta_url,disclaimer,required_tier,start_at,end_at,is_active,sponsors(id,name,logo_url,brand_color,is_active)")
            .eq("is_active", true)
            .lte("start_at", nowIso)
            .gte("end_at", nowIso)
            .order("start_at", { ascending: false });
        if (error)
            return handleSupabaseError(res, "Failed to fetch sponsored challenges", error);
        const challenges = (rows ?? [])
            .filter((row) => isTierAtLeast(userTier, String(row.required_tier ?? "free")))
            .filter((row) => Boolean(row.sponsors?.is_active))
            .map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            reward_text: row.reward_text,
            cta_label: row.cta_label,
            cta_url: row.cta_url,
            disclaimer: row.disclaimer,
            required_tier: row.required_tier,
            start_at: row.start_at,
            end_at: row.end_at,
            sponsor: row.sponsors ?? null,
        }));
        return res.json({ sponsored_challenges: challenges });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /sponsored-challenges", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/sponsored-challenges/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        const sponsoredChallengeId = req.params.id;
        if (!sponsoredChallengeId)
            return res.status(422).json({ error: "sponsored challenge id is required" });
        await ensureUserRow(auth.user.id);
        const { data: userRow, error: userError } = await dataClient
            .from("users")
            .select("tier")
            .eq("id", auth.user.id)
            .single();
        if (userError)
            return handleSupabaseError(res, "Failed to load user tier", userError);
        const userTier = String(userRow.tier ?? "free");
        const { data: row, error } = await dataClient
            .from("sponsored_challenges")
            .select("id,name,description,reward_text,cta_label,cta_url,disclaimer,required_tier,start_at,end_at,is_active,sponsors(id,name,logo_url,brand_color,is_active)")
            .eq("id", sponsoredChallengeId)
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to fetch sponsored challenge", error);
        const now = Date.now();
        const startMs = new Date(String(row.start_at ?? "")).getTime();
        const endMs = new Date(String(row.end_at ?? "")).getTime();
        const isActiveWindow = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= now && endMs >= now;
        if (!Boolean(row.is_active) || !isActiveWindow) {
            return res.status(404).json({ error: "Sponsored challenge not available" });
        }
        if (!Boolean(row.sponsors?.is_active)) {
            return res.status(404).json({ error: "Sponsored challenge not available" });
        }
        if (!isTierAtLeast(userTier, String(row.required_tier ?? "free"))) {
            return res.status(403).json({ error: "Your subscription tier does not have access to this sponsored challenge" });
        }
        return res.json({
            sponsored_challenge: {
                id: row.id,
                name: row.name,
                description: row.description,
                reward_text: row.reward_text,
                cta_label: row.cta_label,
                cta_url: row.cta_url,
                disclaimer: row.disclaimer,
                required_tier: row.required_tier,
                start_at: row.start_at,
                end_at: row.end_at,
                sponsor: row.sponsors ?? null,
            },
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /sponsored-challenges/:id", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/admin/kpis", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const { data, error } = await dataClient
            .from("kpis")
            .select("id,name,slug,type,requires_direct_value_input,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value,is_active,created_at,updated_at")
            .order("created_at", { ascending: true });
        if (error)
            return handleSupabaseError(res, "Failed to fetch KPI catalog", error);
        return res.json({ kpis: data ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /admin/kpis", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/admin/kpis", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const payloadCheck = validateAdminKpiPayload(req.body, true);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const { data, error } = await dataClient
            .from("kpis")
            .insert(payloadCheck.payload)
            .select("id,name,slug,type,requires_direct_value_input,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value,is_active,created_at,updated_at")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to create KPI", error);
        await logAdminActivity(auth.user.id, "kpis", String(data.id), "create", payloadCheck.payload);
        return res.status(201).json({ kpi: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /admin/kpis", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.put("/admin/kpis/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const kpiId = req.params.id;
        if (!kpiId)
            return res.status(422).json({ error: "kpi id is required" });
        const payloadCheck = validateAdminKpiPayload(req.body, false);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const { data, error } = await dataClient
            .from("kpis")
            .update({ ...payloadCheck.payload, updated_at: new Date().toISOString() })
            .eq("id", kpiId)
            .select("id,name,slug,type,requires_direct_value_input,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value,is_active,created_at,updated_at")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to update KPI", error);
        await logAdminActivity(auth.user.id, "kpis", kpiId, "update", payloadCheck.payload);
        return res.json({ kpi: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in PUT /admin/kpis/:id", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.delete("/admin/kpis/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const kpiId = req.params.id;
        if (!kpiId)
            return res.status(422).json({ error: "kpi id is required" });
        const { data, error } = await dataClient
            .from("kpis")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", kpiId)
            .select("id,name,is_active")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to deactivate KPI", error);
        await logAdminActivity(auth.user.id, "kpis", kpiId, "deactivate", { is_active: false });
        return res.json({ kpi: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in DELETE /admin/kpis/:id", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/admin/challenge-templates", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const { data, error } = await dataClient
            .from("challenge_templates")
            .select("id,name,description,is_active,created_at,updated_at")
            .order("created_at", { ascending: true });
        if (error)
            return handleSupabaseError(res, "Failed to fetch challenge templates", error);
        return res.json({ challenge_templates: data ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /admin/challenge-templates", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/admin/challenge-templates", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const payloadCheck = validateAdminChallengeTemplatePayload(req.body, true);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const { data, error } = await dataClient
            .from("challenge_templates")
            .insert(payloadCheck.payload)
            .select("id,name,description,is_active,created_at,updated_at")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to create challenge template", error);
        await logAdminActivity(auth.user.id, "challenge_templates", String(data.id), "create", payloadCheck.payload);
        return res.status(201).json({ challenge_template: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /admin/challenge-templates", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.put("/admin/challenge-templates/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const templateId = req.params.id;
        if (!templateId)
            return res.status(422).json({ error: "template id is required" });
        const payloadCheck = validateAdminChallengeTemplatePayload(req.body, false);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const { data, error } = await dataClient
            .from("challenge_templates")
            .update({ ...payloadCheck.payload, updated_at: new Date().toISOString() })
            .eq("id", templateId)
            .select("id,name,description,is_active,created_at,updated_at")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to update challenge template", error);
        await logAdminActivity(auth.user.id, "challenge_templates", templateId, "update", payloadCheck.payload);
        return res.json({ challenge_template: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in PUT /admin/challenge-templates/:id", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.delete("/admin/challenge-templates/:id", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const templateId = req.params.id;
        if (!templateId)
            return res.status(422).json({ error: "template id is required" });
        const { data, error } = await dataClient
            .from("challenge_templates")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", templateId)
            .select("id,name,is_active")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to deactivate challenge template", error);
        await logAdminActivity(auth.user.id, "challenge_templates", templateId, "deactivate", { is_active: false });
        return res.json({ challenge_template: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in DELETE /admin/challenge-templates/:id", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/admin/users", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const { data, error } = await dataClient
            .from("users")
            .select("id,role,tier,account_status,last_activity_timestamp,created_at,updated_at")
            .order("created_at", { ascending: false })
            .limit(500);
        if (error)
            return handleSupabaseError(res, "Failed to fetch users", error);
        return res.json({ users: data ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /admin/users", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.put("/admin/users/:id/role", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const userId = req.params.id;
        if (!userId)
            return res.status(422).json({ error: "user id is required" });
        const body = req.body;
        const role = String(body.role ?? "");
        if (!["agent", "team_leader", "admin", "super_admin"].includes(role)) {
            return res.status(422).json({ error: "role must be one of: agent, team_leader, admin, super_admin" });
        }
        const { data, error } = await dataClient
            .from("users")
            .update({ role, updated_at: new Date().toISOString() })
            .eq("id", userId)
            .select("id,role,tier,account_status")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to update user role", error);
        await logAdminActivity(auth.user.id, "users", userId, "update_role", { role });
        return res.json({ user: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in PUT /admin/users/:id/role", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.put("/admin/users/:id/tier", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const userId = req.params.id;
        if (!userId)
            return res.status(422).json({ error: "user id is required" });
        const body = req.body;
        const tier = String(body.tier ?? "");
        if (!["free", "basic", "teams", "enterprise"].includes(tier)) {
            return res.status(422).json({ error: "tier must be one of: free, basic, teams, enterprise" });
        }
        const { data, error } = await dataClient
            .from("users")
            .update({ tier, updated_at: new Date().toISOString() })
            .eq("id", userId)
            .select("id,role,tier,account_status")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to update user tier", error);
        await logAdminActivity(auth.user.id, "users", userId, "update_tier", { tier });
        return res.json({ user: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in PUT /admin/users/:id/tier", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.put("/admin/users/:id/status", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const userId = req.params.id;
        if (!userId)
            return res.status(422).json({ error: "user id is required" });
        const body = req.body;
        const accountStatus = String(body.account_status ?? "");
        if (!["active", "deactivated"].includes(accountStatus)) {
            return res.status(422).json({ error: "account_status must be one of: active, deactivated" });
        }
        const { data, error } = await dataClient
            .from("users")
            .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
            .eq("id", userId)
            .select("id,role,tier,account_status")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to update user status", error);
        await logAdminActivity(auth.user.id, "users", userId, "update_status", { account_status: accountStatus });
        return res.json({ user: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in PUT /admin/users/:id/status", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/admin/users/:id/kpi-calibration", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const userId = req.params.id;
        if (!userId)
            return res.status(422).json({ error: "user id is required" });
        const { data, error } = await dataClient
            .from("user_kpi_calibration")
            .select("user_id,kpi_id,multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error,last_calibrated_at,created_at,updated_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false });
        if (error)
            return handleSupabaseError(res, "Failed to fetch user KPI calibration", error);
        const kpiIds = (data ?? []).map((row) => String(row.kpi_id ?? ""));
        const { data: kpis, error: kpiError } = kpiIds.length
            ? await dataClient.from("kpis").select("id,name,type").in("id", kpiIds)
            : { data: [], error: null };
        if (kpiError)
            return handleSupabaseError(res, "Failed to fetch KPI metadata for calibration", kpiError);
        const kpiById = new Map((kpis ?? []).map((row) => [
            String(row.id ?? ""),
            {
                name: String(row.name ?? ""),
                type: String(row.type ?? ""),
            },
        ]));
        return res.json({
            user_id: userId,
            diagnostics: summarizeCalibrationDiagnostics(data ?? []),
            rows: (data ?? []).map((row) => {
                const kpiId = String(row.kpi_id ?? "");
                const kpiMeta = kpiById.get(kpiId);
                return {
                    ...row,
                    kpi_name: kpiMeta?.name ?? null,
                    kpi_type: kpiMeta?.type ?? null,
                };
            }),
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /admin/users/:id/kpi-calibration", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.patch("/admin/users/:id/kpi-calibration/:kpiId", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const userId = req.params.id;
        const kpiId = req.params.kpiId;
        if (!userId || !kpiId)
            return res.status(422).json({ error: "user id and kpi id are required" });
        const payloadCheck = validateAdminCalibrationUpdatePayload(req.body);
        if (!payloadCheck.ok)
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        const nowIso = new Date().toISOString();
        const { data, error } = await dataClient
            .from("user_kpi_calibration")
            .upsert({
            user_id: userId,
            kpi_id: kpiId,
            multiplier: payloadCheck.payload.multiplier,
            updated_at: nowIso,
        }, { onConflict: "user_id,kpi_id" })
            .select("user_id,kpi_id,multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error,last_calibrated_at,created_at,updated_at")
            .single();
        if (error)
            return handleSupabaseError(res, "Failed to update KPI calibration multiplier", error);
        await logAdminActivity(auth.user.id, "user_kpi_calibration", `${userId}:${kpiId}`, "manual_set_multiplier", payloadCheck.payload);
        return res.json({ row: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in PATCH /admin/users/:id/kpi-calibration/:kpiId", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/admin/users/:id/kpi-calibration/reset", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const userId = req.params.id;
        if (!userId)
            return res.status(422).json({ error: "user id is required" });
        const nowIso = new Date().toISOString();
        const { data, error } = await dataClient
            .from("user_kpi_calibration")
            .update({
            multiplier: 1,
            sample_size: 0,
            rolling_error_ratio: null,
            rolling_abs_pct_error: null,
            last_calibrated_at: null,
            updated_at: nowIso,
        })
            .eq("user_id", userId)
            .select("user_id,kpi_id,multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error,last_calibrated_at,created_at,updated_at");
        if (error)
            return handleSupabaseError(res, "Failed to reset KPI calibration", error);
        await logAdminActivity(auth.user.id, "user_kpi_calibration", userId, "reset_all", {});
        return res.json({ user_id: userId, rows: data ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /admin/users/:id/kpi-calibration/reset", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/admin/users/:id/kpi-calibration/reinitialize-from-onboarding", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const userId = req.params.id;
        if (!userId)
            return res.status(422).json({ error: "user id is required" });
        const authUser = await dataClient.auth.admin.getUserById(userId);
        if (authUser.error)
            return handleSupabaseError(res, "Failed to fetch user auth metadata", authUser.error);
        const metadata = getUserMetadata(authUser.data?.user?.user_metadata ?? {});
        const selectedKpis = Array.isArray(metadata.selected_kpis)
            ? metadata.selected_kpis.filter((id) => typeof id === "string")
            : [];
        const kpiWeeklyInputs = isRecord(metadata.kpi_weekly_inputs) ? metadata.kpi_weekly_inputs : {};
        if (selectedKpis.length === 0 || Object.keys(kpiWeeklyInputs).length === 0) {
            return res.status(422).json({ error: "User onboarding KPI history is missing; cannot reinitialize calibration" });
        }
        const { data: kpiRows, error: kpiError } = await dataClient
            .from("kpis")
            .select("id,type,pc_weight")
            .in("id", selectedKpis);
        if (kpiError)
            return handleSupabaseError(res, "Failed to fetch KPI definitions for calibration reinitialize", kpiError);
        const selectedPcKpiIds = (kpiRows ?? [])
            .filter((row) => String(row.type) === "PC")
            .map((row) => String(row.id ?? ""));
        const historicalWeeklyByKpi = Object.fromEntries(selectedPcKpiIds.map((kpiId) => [
            kpiId,
            toNumberOrZero(kpiWeeklyInputs[kpiId]?.historicalWeeklyAverage),
        ]));
        const baseWeightByKpi = Object.fromEntries((kpiRows ?? [])
            .filter((row) => String(row.type) === "PC")
            .map((row) => [
            String(row.id ?? ""),
            toNumberOrZero(row.pc_weight),
        ]));
        const multipliers = (0, userCalibrationEngine_1.computeInitializationMultipliers)({
            selectedPcKpiIds,
            historicalWeeklyByKpi,
            baseWeightByKpi,
        });
        const nowIso = new Date().toISOString();
        const upserts = selectedPcKpiIds.map((kpiId) => ({
            user_id: userId,
            kpi_id: kpiId,
            multiplier: multipliers[kpiId] ?? 1,
            sample_size: 0,
            rolling_error_ratio: null,
            rolling_abs_pct_error: null,
            last_calibrated_at: null,
            updated_at: nowIso,
        }));
        if (upserts.length > 0) {
            const { error: upsertError } = await dataClient
                .from("user_kpi_calibration")
                .upsert(upserts, { onConflict: "user_id,kpi_id" });
            if (upsertError)
                return handleSupabaseError(res, "Failed to reinitialize KPI calibration", upsertError);
        }
        await logAdminActivity(auth.user.id, "user_kpi_calibration", userId, "reinitialize_from_onboarding", {
            kpi_count: upserts.length,
        });
        return res.json({ user_id: userId, reinitialized_rows: upserts.length });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /admin/users/:id/kpi-calibration/reinitialize-from-onboarding", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/admin/users/:id/kpi-calibration/events", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return res.status(auth.status).json({ error: auth.error });
        if (!dataClient)
            return res.status(500).json({ error: "Supabase data client not configured" });
        if (!(await isPlatformAdmin(auth.user.id)))
            return res.status(403).json({ error: "Admin access required" });
        const userId = req.params.id;
        if (!userId)
            return res.status(422).json({ error: "user id is required" });
        const { data, error } = await dataClient
            .from("user_kpi_calibration_events")
            .select("id,user_id,actual_log_id,close_timestamp,actual_gci,predicted_gci_window,error_ratio,attribution_payload,created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200);
        if (error)
            return handleSupabaseError(res, "Failed to fetch KPI calibration events", error);
        return res.json({ user_id: userId, events: data ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /admin/users/:id/kpi-calibration/events", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/notifications/enqueue", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return errorEnvelopeResponse(res, auth.status, "auth_error", auth.error, req.headers["x-request-id"]);
        if (!dataClient)
            return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
        if (!(await isPlatformAdmin(auth.user.id))) {
            return errorEnvelopeResponse(res, 403, "forbidden", "Admin access required", req.headers["x-request-id"]);
        }
        const payloadCheck = validateNotificationEnqueuePayload(req.body);
        if (!payloadCheck.ok) {
            return errorEnvelopeResponse(res, payloadCheck.status, "validation_error", payloadCheck.error, req.headers["x-request-id"]);
        }
        await ensureUserRow(payloadCheck.payload.user_id);
        const { data, error } = await dataClient
            .from("notification_queue")
            .insert({
            user_id: payloadCheck.payload.user_id,
            category: payloadCheck.payload.category,
            title: payloadCheck.payload.title,
            body: payloadCheck.payload.body,
            payload: payloadCheck.payload.payload ?? {},
            scheduled_for: payloadCheck.payload.scheduled_for ?? new Date().toISOString(),
            created_by: auth.user.id,
            status: "queued",
            updated_at: new Date().toISOString(),
        })
            .select("id,user_id,category,title,body,payload,status,attempts,scheduled_for,sent_at,created_at,updated_at")
            .single();
        if (error)
            return errorEnvelopeResponse(res, 500, "notification_enqueue_failed", "Failed to enqueue notification", req.headers["x-request-id"]);
        await logAdminActivity(auth.user.id, "notification_queue", String(data.id), "enqueue", payloadCheck.payload);
        return res.status(201).json({ notification: data });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/notifications/enqueue", err);
        return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
    }
});
app.get("/api/notifications/queue", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return errorEnvelopeResponse(res, auth.status, "auth_error", auth.error, req.headers["x-request-id"]);
        if (!dataClient)
            return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
        if (!(await isPlatformAdmin(auth.user.id))) {
            return errorEnvelopeResponse(res, 403, "forbidden", "Admin access required", req.headers["x-request-id"]);
        }
        const { data, error } = await dataClient
            .from("notification_queue")
            .select("id,user_id,category,title,body,payload,status,attempts,last_error,scheduled_for,sent_at,created_at,updated_at")
            .order("created_at", { ascending: false })
            .limit(500);
        if (error)
            return errorEnvelopeResponse(res, 500, "notification_queue_fetch_failed", "Failed to fetch notification queue", req.headers["x-request-id"]);
        return res.json({ notifications: data ?? [] });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in GET /api/notifications/queue", err);
        return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
    }
});
app.post("/api/notifications/:id/dispatch", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok)
            return errorEnvelopeResponse(res, auth.status, "auth_error", auth.error, req.headers["x-request-id"]);
        if (!dataClient)
            return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
        if (!(await isPlatformAdmin(auth.user.id))) {
            return errorEnvelopeResponse(res, 403, "forbidden", "Admin access required", req.headers["x-request-id"]);
        }
        const notificationId = req.params.id;
        if (!notificationId) {
            return errorEnvelopeResponse(res, 422, "validation_error", "notification id is required", req.headers["x-request-id"]);
        }
        const { data: existing, error: existingError } = await dataClient
            .from("notification_queue")
            .select("id,status,attempts")
            .eq("id", notificationId)
            .single();
        if (existingError) {
            return errorEnvelopeResponse(res, 404, "not_found", "Notification job not found", req.headers["x-request-id"]);
        }
        const body = req.body;
        const success = body.success === undefined ? true : Boolean(body.success);
        const nextAttempts = toNumberOrZero(existing.attempts) + 1;
        const nowIso = new Date().toISOString();
        if (success) {
            const { data: updated, error: updateError } = await dataClient
                .from("notification_queue")
                .update({
                status: "sent",
                attempts: nextAttempts,
                last_error: null,
                sent_at: nowIso,
                updated_at: nowIso,
            })
                .eq("id", notificationId)
                .select("id,user_id,category,title,body,payload,status,attempts,last_error,scheduled_for,sent_at,created_at,updated_at")
                .single();
            if (updateError) {
                return errorEnvelopeResponse(res, 500, "notification_dispatch_failed", "Failed to update dispatch status", req.headers["x-request-id"]);
            }
            await logAdminActivity(auth.user.id, "notification_queue", notificationId, "dispatch_success", {
                attempts: nextAttempts,
                provider_message_id: body.provider_message_id ?? null,
            });
            return res.json({ notification: updated });
        }
        const lastError = typeof body.error === "string" && body.error.trim() ? body.error.trim() : "dispatch failed";
        const { data: updated, error: updateError } = await dataClient
            .from("notification_queue")
            .update({
            status: "failed",
            attempts: nextAttempts,
            last_error: lastError,
            updated_at: nowIso,
        })
            .eq("id", notificationId)
            .select("id,user_id,category,title,body,payload,status,attempts,last_error,scheduled_for,sent_at,created_at,updated_at")
            .single();
        if (updateError) {
            return errorEnvelopeResponse(res, 500, "notification_dispatch_failed", "Failed to update dispatch status", req.headers["x-request-id"]);
        }
        await logAdminActivity(auth.user.id, "notification_queue", notificationId, "dispatch_failure", {
            attempts: nextAttempts,
            error: lastError,
        });
        return res.json({ notification: updated });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in POST /api/notifications/:id/dispatch", err);
        return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
    }
});
app.post("/challenge-participants", async (req, res) => {
    try {
        const auth = await authenticateRequest(req.headers.authorization);
        if (!auth.ok) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (!dataClient) {
            return res.status(500).json({ error: "Supabase data client not configured" });
        }
        const payloadCheck = validateChallengeJoinPayload(req.body);
        if (!payloadCheck.ok) {
            return res.status(payloadCheck.status).json({ error: payloadCheck.error });
        }
        const payload = payloadCheck.payload;
        if (payload.sponsored_challenge_id) {
            const nowIso = new Date().toISOString();
            const { data: sponsored, error: sponsoredError } = await dataClient
                .from("sponsored_challenges")
                .select("id,is_active,start_at,end_at,required_tier")
                .eq("id", payload.sponsored_challenge_id)
                .single();
            if (sponsoredError) {
                return handleSupabaseError(res, "Failed to fetch sponsored challenge", sponsoredError);
            }
            if (!sponsored || !Boolean(sponsored.is_active)) {
                return res.status(422).json({ error: "Sponsored challenge is not active" });
            }
            if (String(sponsored.start_at) > nowIso || String(sponsored.end_at) < nowIso) {
                return res.status(422).json({ error: "Sponsored challenge is outside its active window" });
            }
            await ensureUserRow(auth.user.id);
            const { data: userTierRow, error: tierError } = await dataClient
                .from("users")
                .select("tier")
                .eq("id", auth.user.id)
                .single();
            if (tierError) {
                return handleSupabaseError(res, "Failed to evaluate sponsored challenge tier access", tierError);
            }
            const userTier = String(userTierRow.tier ?? "free");
            if (!isTierAtLeast(userTier, String(sponsored.required_tier ?? "free"))) {
                return res.status(403).json({ error: "Your subscription tier does not have access to this sponsored challenge" });
            }
        }
        const { data: challenge, error: challengeError } = await dataClient
            .from("challenges")
            .select("id,mode,team_id,start_at,end_at,late_join_includes_history,is_active")
            .eq("id", payload.challenge_id)
            .single();
        if (challengeError) {
            return handleSupabaseError(res, "Failed to fetch challenge", challengeError);
        }
        if (!challenge?.is_active) {
            return res.status(422).json({ error: "Challenge is not active" });
        }
        const targetUserId = payload.user_id ?? auth.user.id;
        if (targetUserId !== auth.user.id) {
            if (!challenge.team_id) {
                return res.status(403).json({ error: "Leader enrollment requires team challenge context" });
            }
            const leaderCheck = await checkTeamLeader(String(challenge.team_id), auth.user.id);
            if (!leaderCheck.ok) {
                return res.status(leaderCheck.status).json({ error: leaderCheck.error });
            }
            if (!leaderCheck.isLeader) {
                return res.status(403).json({ error: "Only team leaders can enroll other users" });
            }
        }
        if (challenge.mode === "team") {
            if (!challenge.team_id) {
                return res.status(500).json({ error: "Team challenge missing team_id" });
            }
            const memberCheck = await checkTeamMembership(String(challenge.team_id), targetUserId);
            if (!memberCheck.ok) {
                return res.status(memberCheck.status).json({ error: memberCheck.error });
            }
            if (!memberCheck.member) {
                return res.status(403).json({ error: "User must be a team member to join this challenge" });
            }
        }
        await ensureUserRow(targetUserId);
        const includeHistory = payload.include_prior_logs ?? Boolean(challenge.late_join_includes_history);
        const effectiveStartAt = includeHistory
            ? new Date(challenge.start_at).toISOString()
            : new Date().toISOString();
        const { data: participant, error: participantError } = await dataClient
            .from("challenge_participants")
            .upsert({
            challenge_id: payload.challenge_id,
            user_id: targetUserId,
            team_id: challenge.team_id ?? null,
            joined_at: new Date().toISOString(),
            effective_start_at: effectiveStartAt,
            sponsored_challenge_id: payload.sponsored_challenge_id ?? null,
        }, { onConflict: "challenge_id,user_id" })
            .select("id,challenge_id,user_id,team_id,joined_at,effective_start_at,progress_percent")
            .single();
        if (participantError) {
            return handleSupabaseError(res, "Failed to join challenge", participantError);
        }
        const progressPercent = await computeChallengeProgressPercent(payload.challenge_id, targetUserId);
        const { data: updatedParticipant, error: updateParticipantError } = await dataClient
            .from("challenge_participants")
            .update({ progress_percent: progressPercent })
            .eq("id", participant.id)
            .select("id,challenge_id,user_id,team_id,joined_at,effective_start_at,progress_percent")
            .single();
        if (updateParticipantError) {
            return handleSupabaseError(res, "Failed to update participant progress", updateParticipantError);
        }
        const leaderboard = await buildChallengeLeaderboard(payload.challenge_id, 5);
        return res.status(201).json({
            participant: updatedParticipant,
            leaderboard_top: leaderboard,
            late_join_policy: {
                include_prior_logs: includeHistory,
            },
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Error in /challenge-participants", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
async function authenticateRequest(authorizationHeader) {
    if (!authClient) {
        return { ok: false, status: 500, error: "Supabase auth client not configured" };
    }
    if (!authorizationHeader?.startsWith("Bearer ")) {
        return { ok: false, status: 401, error: "Missing or invalid Authorization header" };
    }
    const token = authorizationHeader.replace("Bearer ", "").trim();
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) {
        return { ok: false, status: 401, error: "Invalid or expired token" };
    }
    return {
        ok: true,
        user: {
            id: data.user.id,
            email: data.user.email,
            user_metadata: data.user.user_metadata,
        },
    };
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function parseBackplotInput(value) {
    if (!isRecord(value))
        return null;
    const historicalWeeklyAverage = toNumberOrZero(value.historicalWeeklyAverage);
    const targetWeeklyCount = toNumberOrZero(value.targetWeeklyCount);
    return {
        historicalWeeklyAverage: Math.max(0, historicalWeeklyAverage),
        targetWeeklyCount: Math.max(0, targetWeeklyCount),
    };
}
function normalizeKpiIdentifier(raw) {
    return raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
const LEGACY_KPI_IDENTIFIER_ALIASES = {
    coffee_lunch_sphere: "coffee_lunch_with_sphere",
    good_night_sleep: "good_night_of_sleep",
};
async function resolveKpiSelectionIds(rawIdentifiers) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    const candidates = Array.from(new Set(rawIdentifiers
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)));
    if (candidates.length === 0) {
        return { ok: true, ids: [], by_input: {} };
    }
    const { data: rows, error } = await dataClient
        .from("kpis")
        .select("id,name,slug,is_active");
    if (error) {
        return { ok: false, status: 500, error: "Failed to resolve KPI identifiers" };
    }
    const byId = new Map();
    const bySlug = new Map();
    const byNameKey = new Map();
    for (const row of rows ?? []) {
        if (!Boolean(row.is_active))
            continue;
        const id = String(row.id ?? "");
        if (!id)
            continue;
        byId.set(id, id);
        const slug = String(row.slug ?? "").trim();
        if (slug)
            bySlug.set(slug, id);
        const name = String(row.name ?? "").trim();
        if (name)
            byNameKey.set(normalizeKpiIdentifier(name), id);
    }
    const resolved = [];
    const resolvedByInput = {};
    for (const raw of candidates) {
        const normalized = normalizeKpiIdentifier(raw);
        const aliasNormalized = LEGACY_KPI_IDENTIFIER_ALIASES[normalized];
        const found = byId.get(raw) ??
            bySlug.get(normalized) ??
            (aliasNormalized ? bySlug.get(aliasNormalized) : undefined) ??
            byNameKey.get(normalized);
        if (found) {
            resolved.push(found);
            resolvedByInput[raw] = found;
            resolvedByInput[normalized] = found;
            if (aliasNormalized)
                resolvedByInput[aliasNormalized] = found;
        }
    }
    return { ok: true, ids: Array.from(new Set(resolved)), by_input: resolvedByInput };
}
function getUserMetadata(value) {
    if (!isRecord(value))
        return {};
    const selected = Array.isArray(value.selected_kpis) ? value.selected_kpis.filter((v) => typeof v === "string") : undefined;
    const kpiWeekly = isRecord(value.kpi_weekly_inputs)
        ? Object.fromEntries(Object.entries(value.kpi_weekly_inputs).map(([k, v]) => {
            const row = isRecord(v) ? v : {};
            return [
                k,
                {
                    historicalWeeklyAverage: toNumberOrZero(row.historicalWeeklyAverage),
                    targetWeeklyCount: toNumberOrZero(row.targetWeeklyCount),
                },
            ];
        }))
        : undefined;
    return {
        selected_kpis: selected,
        kpi_weekly_inputs: kpiWeekly,
        average_price_point: value.average_price_point !== undefined ? toNumberOrZero(value.average_price_point) : undefined,
        commission_rate_percent: value.commission_rate_percent !== undefined ? toNumberOrZero(value.commission_rate_percent) : undefined,
        commission_rate_decimal: value.commission_rate_decimal !== undefined ? toNumberOrZero(value.commission_rate_decimal) : undefined,
        last_year_gci: value.last_year_gci !== undefined ? toNumberOrZero(value.last_year_gci) : undefined,
        ytd_gci: value.ytd_gci !== undefined ? toNumberOrZero(value.ytd_gci) : undefined,
        last_activity_timestamp: typeof value.last_activity_timestamp === "string" ? value.last_activity_timestamp : undefined,
        pipeline_listings_pending: value.pipeline_listings_pending !== undefined ? toNumberOrZero(value.pipeline_listings_pending) : undefined,
        pipeline_buyers_uc: value.pipeline_buyers_uc !== undefined ? toNumberOrZero(value.pipeline_buyers_uc) : undefined,
        onboarding_projection_seeded_at: typeof value.onboarding_projection_seeded_at === "string" ? value.onboarding_projection_seeded_at : undefined,
    };
}
function getLastActivityTimestampFromLogsOrMetadata(logs, metadataTs) {
    const fromLogs = logs
        .map((row) => String(row.event_timestamp ?? ""))
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    if (fromLogs)
        return fromLogs;
    if (metadataTs && !Number.isNaN(new Date(metadataTs).getTime()))
        return metadataTs;
    return undefined;
}
async function maybeSeedInitialProjectionFromOnboarding(userId, mergedMetadata) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    const metadata = getUserMetadata(mergedMetadata);
    if (metadata.onboarding_projection_seeded_at) {
        return { ok: true, mergedMetadata };
    }
    const selectedResolution = await resolveKpiSelectionIds(Array.isArray(metadata.selected_kpis)
        ? metadata.selected_kpis.filter((id) => typeof id === "string")
        : []);
    if (!selectedResolution.ok) {
        return selectedResolution;
    }
    const selectedKpis = selectedResolution.ids;
    const rawWeeklyInputs = isRecord(metadata.kpi_weekly_inputs) ? metadata.kpi_weekly_inputs : {};
    const kpiWeeklyInputs = {};
    for (const [rawKey, value] of Object.entries(rawWeeklyInputs)) {
        const mappedId = selectedResolution.by_input[rawKey] ?? selectedResolution.by_input[normalizeKpiIdentifier(rawKey)];
        const parsed = parseBackplotInput(value);
        if (mappedId && parsed)
            kpiWeeklyInputs[mappedId] = parsed;
    }
    if (selectedKpis.length === 0 || Object.keys(kpiWeeklyInputs).length === 0) {
        return { ok: true, mergedMetadata };
    }
    const averagePricePoint = toNumberOrZero(metadata.average_price_point);
    const commissionRateDecimal = metadata.commission_rate_percent !== undefined
        ? toNumberOrZero(metadata.commission_rate_percent) / 100
        : toNumberOrZero(metadata.commission_rate_decimal);
    if (averagePricePoint <= 0 || commissionRateDecimal <= 0) {
        return { ok: true, mergedMetadata };
    }
    const { data: kpiRows, error: kpiError } = await dataClient
        .from("kpis")
        .select("id,type,name,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,is_active")
        .in("id", selectedKpis);
    if (kpiError) {
        return { ok: false, status: 500, error: "Failed to load KPI definitions for onboarding projection seed" };
    }
    const pcConfigById = Object.fromEntries((kpiRows ?? [])
        .filter((row) => String(row.type) === "PC")
        .filter((row) => Boolean(row.is_active))
        .map((row) => [
        String(row.id),
        {
            pc_weight: toNumberOrZero(row.pc_weight),
            ttc_days: toNumberOrZero(row.ttc_days),
            ttc_definition: typeof row.ttc_definition === "string"
                ? String(row.ttc_definition)
                : null,
            delay_days: toNumberOrZero(row.delay_days),
            hold_days: toNumberOrZero(row.hold_days),
            decay_days: Math.max(1, toNumberOrZero(row.decay_days) || 180),
        },
    ]));
    const syntheticEvents = (0, onboardingBackplotEngine_1.buildOnboardingBackplotPcEvents)({
        now: new Date(),
        averagePricePoint,
        commissionRateDecimal,
        selectedKpiIds: selectedKpis,
        kpiWeeklyInputs,
        kpiPcConfigById: pcConfigById,
    });
    const selectedPcKpiIds = selectedKpis.filter((id) => !!pcConfigById[id]);
    const historicalWeeklyByKpi = Object.fromEntries(selectedPcKpiIds.map((kpiId) => [
        kpiId,
        toNumberOrZero(kpiWeeklyInputs[kpiId]?.historicalWeeklyAverage),
    ]));
    const baseWeightByKpi = Object.fromEntries(selectedPcKpiIds.map((kpiId) => [kpiId, toNumberOrZero(pcConfigById[kpiId]?.pc_weight)]));
    const initializationMultipliers = (0, userCalibrationEngine_1.computeInitializationMultipliers)({
        selectedPcKpiIds,
        historicalWeeklyByKpi,
        baseWeightByKpi,
    });
    if (syntheticEvents.length > 0) {
        const logsToInsert = syntheticEvents.map((event) => {
            const eventTime = new Date(event.eventTimestampIso);
            const payoffStartDate = addDays(eventTime, event.delayBeforePayoffStartsDays);
            const ttcEndDate = addDays(eventTime, event.delayBeforePayoffStartsDays + event.holdDurationDays);
            const decayEndDate = addDays(ttcEndDate, event.decayDurationDays);
            const weeklyInput = kpiWeeklyInputs[event.kpiId];
            const idempotencyKey = `onboarding_seed:${userId}:${event.kpiId}:${event.eventTimestampIso.slice(0, 10)}`;
            return {
                user_id: userId,
                kpi_id: event.kpiId,
                event_timestamp: event.eventTimestampIso,
                logged_value: toNumberOrZero(weeklyInput?.historicalWeeklyAverage),
                idempotency_key: idempotencyKey,
                pc_generated: Number(event.initialPcGenerated.toFixed(2)),
                payoff_start_date: payoffStartDate.toISOString(),
                ttc_end_date: ttcEndDate.toISOString(),
                decay_end_date: decayEndDate.toISOString(),
                delay_days_applied: event.delayBeforePayoffStartsDays,
                hold_days_applied: event.holdDurationDays,
                decay_days_applied: event.decayDurationDays,
                points_generated: 0,
                actual_gci_delta: 0,
                deals_closed_delta: 0,
                created_at: new Date().toISOString(),
            };
        });
        const { error: seedLogError } = await dataClient
            .from("kpi_logs")
            .upsert(logsToInsert, { onConflict: "user_id,idempotency_key" });
        if (seedLogError) {
            return { ok: false, status: 500, error: "Failed to seed onboarding projection logs" };
        }
    }
    if (selectedPcKpiIds.length > 0) {
        const calibrationRows = selectedPcKpiIds.map((kpiId) => ({
            user_id: userId,
            kpi_id: kpiId,
            multiplier: initializationMultipliers[kpiId] ?? 1,
            sample_size: 0,
            rolling_error_ratio: null,
            rolling_abs_pct_error: null,
            last_calibrated_at: null,
            updated_at: new Date().toISOString(),
        }));
        const { error: calibrationSeedError } = await dataClient
            .from("user_kpi_calibration")
            .upsert(calibrationRows, { onConflict: "user_id,kpi_id" });
        if (calibrationSeedError) {
            return { ok: false, status: 500, error: "Failed to initialize onboarding KPI calibration state" };
        }
    }
    const pipelineListings = toNumberOrZero(metadata.pipeline_listings_pending);
    const pipelineBuyers = toNumberOrZero(metadata.pipeline_buyers_uc);
    if (pipelineListings > 0 || pipelineBuyers > 0) {
        const { data: anchorKpis, error: anchorKpiError } = await dataClient
            .from("kpis")
            .select("id,name,type,is_active")
            .eq("type", "Pipeline_Anchor")
            .eq("is_active", true);
        if (anchorKpiError) {
            return { ok: false, status: 500, error: "Failed to load pipeline anchor KPIs for onboarding seed" };
        }
        const safeAnchors = anchorKpis ?? [];
        const listingsKpi = safeAnchors.find((row) => String(row.name).toLowerCase().includes("listing"));
        const buyersKpi = safeAnchors.find((row) => String(row.name).toLowerCase().includes("buyer"));
        const nowIso = new Date().toISOString();
        const anchorUpserts = [];
        if (listingsKpi && pipelineListings >= 0) {
            anchorUpserts.push({
                user_id: userId,
                kpi_id: String(listingsKpi.id),
                anchor_type: String(listingsKpi.name ?? "Listings Pending"),
                anchor_value: pipelineListings,
                updated_at: nowIso,
            });
        }
        if (buyersKpi && pipelineBuyers >= 0) {
            anchorUpserts.push({
                user_id: userId,
                kpi_id: String(buyersKpi.id),
                anchor_type: String(buyersKpi.name ?? "Buyers UC"),
                anchor_value: pipelineBuyers,
                updated_at: nowIso,
            });
        }
        if (anchorUpserts.length > 0) {
            const { error: anchorUpsertError } = await dataClient
                .from("pipeline_anchor_status")
                .upsert(anchorUpserts, { onConflict: "user_id,kpi_id" });
            if (anchorUpsertError) {
                return { ok: false, status: 500, error: "Failed to seed onboarding pipeline anchors" };
            }
        }
    }
    return {
        ok: true,
        mergedMetadata: {
            ...mergedMetadata,
            onboarding_projection_seeded_at: new Date().toISOString(),
        },
    };
}
function validateTeamCreatePayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.name || typeof candidate.name !== "string") {
        return { ok: false, status: 422, error: "name is required" };
    }
    const name = candidate.name.trim();
    if (!name) {
        return { ok: false, status: 422, error: "name must not be empty" };
    }
    return { ok: true, payload: { name } };
}
function validateTeamMemberAddPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.user_id || typeof candidate.user_id !== "string") {
        return { ok: false, status: 422, error: "user_id is required" };
    }
    if (candidate.role !== undefined &&
        candidate.role !== "member" &&
        candidate.role !== "team_leader") {
        return { ok: false, status: 422, error: "role must be one of: member, team_leader" };
    }
    return {
        ok: true,
        payload: { user_id: candidate.user_id, role: candidate.role },
    };
}
function validateChallengeJoinPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.challenge_id || typeof candidate.challenge_id !== "string") {
        return { ok: false, status: 422, error: "challenge_id is required" };
    }
    if (candidate.user_id !== undefined && typeof candidate.user_id !== "string") {
        return { ok: false, status: 422, error: "user_id must be a string when provided" };
    }
    if (candidate.include_prior_logs !== undefined &&
        typeof candidate.include_prior_logs !== "boolean") {
        return { ok: false, status: 422, error: "include_prior_logs must be boolean when provided" };
    }
    if (candidate.sponsored_challenge_id !== undefined &&
        typeof candidate.sponsored_challenge_id !== "string") {
        return { ok: false, status: 422, error: "sponsored_challenge_id must be a string when provided" };
    }
    return {
        ok: true,
        payload: {
            challenge_id: candidate.challenge_id,
            user_id: candidate.user_id,
            include_prior_logs: candidate.include_prior_logs,
            sponsored_challenge_id: candidate.sponsored_challenge_id,
        },
    };
}
function validateMeProfileUpdatePayload(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    const payload = {};
    if (candidate.full_name !== undefined) {
        if (typeof candidate.full_name !== "string" || !candidate.full_name.trim()) {
            return { ok: false, status: 422, error: "full_name must be a non-empty string when provided" };
        }
        payload.full_name = candidate.full_name.trim();
    }
    const parseNumberField = (field) => {
        const raw = candidate[String(field)];
        if (raw === undefined)
            return;
        if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
            throw new Error(`${String(field)} must be a non-negative number when provided`);
        }
        payload[field] = raw;
    };
    try {
        parseNumberField("average_price_point");
        parseNumberField("commission_rate_percent");
        parseNumberField("goal_gci_365_days");
        parseNumberField("goal_deals_closed_365_days");
        parseNumberField("last_year_gci");
        parseNumberField("ytd_gci");
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid profile update payload";
        return { ok: false, status: 422, error: msg };
    }
    if (candidate.selected_kpis !== undefined) {
        if (!Array.isArray(candidate.selected_kpis)) {
            return { ok: false, status: 422, error: "selected_kpis must be an array of KPI ids when provided" };
        }
        const normalized = candidate.selected_kpis
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean);
        const unique = Array.from(new Set(normalized));
        if (unique.length === 0) {
            return { ok: false, status: 422, error: "selected_kpis must contain at least one KPI id when provided" };
        }
        payload.selected_kpis = unique;
    }
    if (candidate.kpi_weekly_inputs !== undefined) {
        if (!isRecord(candidate.kpi_weekly_inputs)) {
            return { ok: false, status: 422, error: "kpi_weekly_inputs must be an object keyed by KPI id" };
        }
        const parsed = {};
        for (const [kpiId, rawValue] of Object.entries(candidate.kpi_weekly_inputs)) {
            if (!kpiId.trim())
                continue;
            if (!isRecord(rawValue)) {
                return { ok: false, status: 422, error: `kpi_weekly_inputs.${kpiId} must be an object` };
            }
            const historical = rawValue.historicalWeeklyAverage;
            const target = rawValue.targetWeeklyCount;
            if (typeof historical !== "number" || !Number.isFinite(historical) || historical < 0) {
                return { ok: false, status: 422, error: `kpi_weekly_inputs.${kpiId}.historicalWeeklyAverage must be a non-negative number` };
            }
            if (typeof target !== "number" || !Number.isFinite(target) || target < 0) {
                return { ok: false, status: 422, error: `kpi_weekly_inputs.${kpiId}.targetWeeklyCount must be a non-negative number` };
            }
            parsed[kpiId] = {
                historicalWeeklyAverage: historical,
                targetWeeklyCount: target,
            };
        }
        if (Object.keys(parsed).length === 0) {
            return { ok: false, status: 422, error: "kpi_weekly_inputs must include at least one KPI entry when provided" };
        }
        payload.kpi_weekly_inputs = parsed;
    }
    const parseOptionalPipelineField = (field) => {
        const raw = candidate[field];
        if (raw === undefined)
            return;
        if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
            throw new Error(`${field} must be a non-negative number when provided`);
        }
        payload[field] = raw;
    };
    try {
        parseOptionalPipelineField("pipeline_listings_pending");
        parseOptionalPipelineField("pipeline_buyers_uc");
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid profile update payload";
        return { ok: false, status: 422, error: msg };
    }
    if (Object.keys(payload).length === 0) {
        return { ok: false, status: 422, error: "At least one profile field is required" };
    }
    return { ok: true, payload };
}
function validateChannelCreatePayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.type || typeof candidate.type !== "string") {
        return { ok: false, status: 422, error: "type is required" };
    }
    const allowedTypes = ["team", "challenge", "sponsor", "cohort", "direct"];
    if (!allowedTypes.includes(candidate.type)) {
        return { ok: false, status: 422, error: "type must be one of: team, challenge, sponsor, cohort, direct" };
    }
    if (!candidate.name || typeof candidate.name !== "string") {
        return { ok: false, status: 422, error: "name is required" };
    }
    const name = candidate.name.trim();
    if (!name) {
        return { ok: false, status: 422, error: "name must not be empty" };
    }
    if (candidate.team_id !== undefined && typeof candidate.team_id !== "string") {
        return { ok: false, status: 422, error: "team_id must be a string when provided" };
    }
    if (candidate.context_id !== undefined && typeof candidate.context_id !== "string") {
        return { ok: false, status: 422, error: "context_id must be a string when provided" };
    }
    return {
        ok: true,
        payload: {
            type: candidate.type,
            name,
            team_id: candidate.team_id,
            context_id: candidate.context_id,
        },
    };
}
function validateChannelMessagePayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.body || typeof candidate.body !== "string") {
        return { ok: false, status: 422, error: "body is required" };
    }
    const bodyText = candidate.body.trim();
    if (!bodyText) {
        return { ok: false, status: 422, error: "body must not be empty" };
    }
    if (bodyText.length > 4000) {
        return { ok: false, status: 422, error: "body is too long (max 4000 chars)" };
    }
    return { ok: true, payload: { body: bodyText } };
}
function validateMarkSeenPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.channel_id || typeof candidate.channel_id !== "string") {
        return { ok: false, status: 422, error: "channel_id is required" };
    }
    return { ok: true, payload: { channel_id: candidate.channel_id } };
}
function validatePushTokenPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.token || typeof candidate.token !== "string") {
        return { ok: false, status: 422, error: "token is required" };
    }
    if (candidate.platform !== undefined &&
        candidate.platform !== "expo" &&
        candidate.platform !== "ios" &&
        candidate.platform !== "android") {
        return { ok: false, status: 422, error: "platform must be one of: expo, ios, android" };
    }
    return {
        ok: true,
        payload: {
            token: candidate.token,
            platform: candidate.platform,
        },
    };
}
function validateCoachingLessonProgressPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.status || typeof candidate.status !== "string") {
        return { ok: false, status: 422, error: "status is required" };
    }
    if (candidate.status !== "not_started" &&
        candidate.status !== "in_progress" &&
        candidate.status !== "completed") {
        return { ok: false, status: 422, error: "status must be one of: not_started, in_progress, completed" };
    }
    return { ok: true, payload: { status: candidate.status } };
}
function validateCoachingBroadcastPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.scope_type || typeof candidate.scope_type !== "string") {
        return { ok: false, status: 422, error: "scope_type is required" };
    }
    if (candidate.scope_type !== "team" &&
        candidate.scope_type !== "journey" &&
        candidate.scope_type !== "global") {
        return { ok: false, status: 422, error: "scope_type must be one of: team, journey, global" };
    }
    if (candidate.scope_id !== undefined && typeof candidate.scope_id !== "string") {
        return { ok: false, status: 422, error: "scope_id must be a string when provided" };
    }
    if (!candidate.message_body || typeof candidate.message_body !== "string") {
        return { ok: false, status: 422, error: "message_body is required" };
    }
    const messageBody = candidate.message_body.trim();
    if (!messageBody) {
        return { ok: false, status: 422, error: "message_body must not be empty" };
    }
    if (messageBody.length > 4000) {
        return { ok: false, status: 422, error: "message_body is too long (max 4000 chars)" };
    }
    return {
        ok: true,
        payload: {
            scope_type: candidate.scope_type,
            scope_id: candidate.scope_id,
            message_body: messageBody,
        },
    };
}
function validateAiSuggestionCreatePayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (candidate.user_id !== undefined && typeof candidate.user_id !== "string") {
        return { ok: false, status: 422, error: "user_id must be a string when provided" };
    }
    if (!candidate.scope || typeof candidate.scope !== "string") {
        return { ok: false, status: 422, error: "scope is required" };
    }
    const scope = candidate.scope.trim();
    if (!scope) {
        return { ok: false, status: 422, error: "scope must not be empty" };
    }
    if (!candidate.proposed_message || typeof candidate.proposed_message !== "string") {
        return { ok: false, status: 422, error: "proposed_message is required" };
    }
    const proposedMessage = candidate.proposed_message.trim();
    if (!proposedMessage) {
        return { ok: false, status: 422, error: "proposed_message must not be empty" };
    }
    if (proposedMessage.length > 4000) {
        return { ok: false, status: 422, error: "proposed_message is too long (max 4000 chars)" };
    }
    return {
        ok: true,
        payload: {
            user_id: candidate.user_id,
            scope,
            proposed_message: proposedMessage,
        },
    };
}
function validateKpiLogPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.kpi_id || typeof candidate.kpi_id !== "string") {
        return { ok: false, status: 422, error: "kpi_id is required" };
    }
    if (!candidate.event_timestamp || typeof candidate.event_timestamp !== "string") {
        return { ok: false, status: 422, error: "event_timestamp is required" };
    }
    const parsedDate = new Date(candidate.event_timestamp);
    if (Number.isNaN(parsedDate.getTime())) {
        return { ok: false, status: 422, error: "event_timestamp must be a valid ISO date" };
    }
    if (candidate.logged_value !== undefined && typeof candidate.logged_value !== "number") {
        return { ok: false, status: 422, error: "logged_value must be a number when provided" };
    }
    if (candidate.idempotency_key !== undefined &&
        (typeof candidate.idempotency_key !== "string" || candidate.idempotency_key.length === 0)) {
        return { ok: false, status: 422, error: "idempotency_key must be a non-empty string when provided" };
    }
    if (typeof candidate.idempotency_key === "string" && candidate.idempotency_key.length > 128) {
        return { ok: false, status: 422, error: "idempotency_key is too long (max 128 chars)" };
    }
    if (candidate.challenge_instance_id !== undefined &&
        candidate.challenge_instance_id !== null &&
        typeof candidate.challenge_instance_id !== "string") {
        return { ok: false, status: 422, error: "challenge_instance_id must be a string when provided" };
    }
    if (candidate.sponsored_challenge_id !== undefined &&
        candidate.sponsored_challenge_id !== null &&
        typeof candidate.sponsored_challenge_id !== "string") {
        return { ok: false, status: 422, error: "sponsored_challenge_id must be a string when provided" };
    }
    return {
        ok: true,
        payload: {
            kpi_id: candidate.kpi_id,
            event_timestamp: candidate.event_timestamp,
            logged_value: candidate.logged_value,
            idempotency_key: candidate.idempotency_key ?? null,
            challenge_instance_id: candidate.challenge_instance_id ?? null,
            sponsored_challenge_id: candidate.sponsored_challenge_id ?? null,
        },
    };
}
function validateKpiLogBatchPayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!Array.isArray(candidate.logs)) {
        return { ok: false, status: 422, error: "logs must be an array" };
    }
    if (candidate.logs.length === 0) {
        return { ok: false, status: 422, error: "logs must not be empty" };
    }
    if (candidate.logs.length > 200) {
        return { ok: false, status: 422, error: "logs is too large (max 200 entries)" };
    }
    const parsed = [];
    for (let i = 0; i < candidate.logs.length; i += 1) {
        const checked = validateKpiLogPayload(candidate.logs[i]);
        if (!checked.ok) {
            return { ok: false, status: checked.status, error: `logs[${i}]: ${checked.error}` };
        }
        parsed.push(checked.payload);
    }
    return { ok: true, payload: { logs: parsed } };
}
function validateAdminKpiPayload(body, requireNameAndType) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    const payload = {};
    if (requireNameAndType) {
        if (!candidate.name || typeof candidate.name !== "string") {
            return { ok: false, status: 422, error: "name is required" };
        }
        if (!candidate.type || typeof candidate.type !== "string") {
            return { ok: false, status: 422, error: "type is required" };
        }
    }
    if (candidate.name !== undefined) {
        if (typeof candidate.name !== "string" || !candidate.name.trim()) {
            return { ok: false, status: 422, error: "name must be a non-empty string" };
        }
        payload.name = candidate.name.trim();
    }
    if (candidate.slug !== undefined) {
        if (typeof candidate.slug !== "string" || !candidate.slug.trim()) {
            return { ok: false, status: 422, error: "slug must be a non-empty string when provided" };
        }
        payload.slug = normalizeKpiIdentifier(candidate.slug);
        if (!payload.slug) {
            return { ok: false, status: 422, error: "slug must contain at least one alphanumeric character" };
        }
    }
    if (candidate.type !== undefined) {
        const type = candidate.type;
        const allowed = ["PC", "GP", "VP", "Actual", "Pipeline_Anchor", "Custom"];
        if (!allowed.includes(type)) {
            return { ok: false, status: 422, error: "type must be one of: PC, GP, VP, Actual, Pipeline_Anchor, Custom" };
        }
        payload.type = type;
    }
    if (candidate.requires_direct_value_input !== undefined) {
        if (typeof candidate.requires_direct_value_input !== "boolean") {
            return { ok: false, status: 422, error: "requires_direct_value_input must be boolean when provided" };
        }
        payload.requires_direct_value_input = candidate.requires_direct_value_input;
    }
    if (candidate.pc_weight !== undefined && candidate.pc_weight !== null) {
        if (typeof candidate.pc_weight !== "number")
            return { ok: false, status: 422, error: "pc_weight must be numeric when provided" };
        payload.pc_weight = candidate.pc_weight;
    }
    if (candidate.ttc_days !== undefined && candidate.ttc_days !== null) {
        if (typeof candidate.ttc_days !== "number")
            return { ok: false, status: 422, error: "ttc_days must be numeric when provided" };
        payload.ttc_days = candidate.ttc_days;
    }
    if (candidate.ttc_definition !== undefined && candidate.ttc_definition !== null) {
        if (typeof candidate.ttc_definition !== "string" || !candidate.ttc_definition.trim()) {
            return { ok: false, status: 422, error: "ttc_definition must be a non-empty string when provided" };
        }
        const parsed = (0, pcTimingEngine_1.parseTtcDefinition)(candidate.ttc_definition);
        if (!parsed) {
            return { ok: false, status: 422, error: "ttc_definition must be in `X-Y days` or `Z days` format" };
        }
        payload.ttc_definition = candidate.ttc_definition.trim();
        if (candidate.delay_days === undefined || candidate.delay_days === null) {
            payload.delay_days = parsed.delayDays;
        }
        if (candidate.hold_days === undefined || candidate.hold_days === null) {
            payload.hold_days = parsed.holdDays;
        }
        if (candidate.ttc_days === undefined || candidate.ttc_days === null) {
            payload.ttc_days = parsed.totalTtcDays;
        }
    }
    if (candidate.delay_days !== undefined && candidate.delay_days !== null) {
        if (typeof candidate.delay_days !== "number")
            return { ok: false, status: 422, error: "delay_days must be numeric when provided" };
        payload.delay_days = candidate.delay_days;
    }
    if (candidate.hold_days !== undefined && candidate.hold_days !== null) {
        if (typeof candidate.hold_days !== "number")
            return { ok: false, status: 422, error: "hold_days must be numeric when provided" };
        payload.hold_days = candidate.hold_days;
    }
    if (candidate.decay_days !== undefined && candidate.decay_days !== null) {
        if (typeof candidate.decay_days !== "number")
            return { ok: false, status: 422, error: "decay_days must be numeric when provided" };
        payload.decay_days = candidate.decay_days;
    }
    if (candidate.gp_value !== undefined && candidate.gp_value !== null) {
        if (typeof candidate.gp_value !== "number")
            return { ok: false, status: 422, error: "gp_value must be numeric when provided" };
        payload.gp_value = candidate.gp_value;
    }
    if (candidate.vp_value !== undefined && candidate.vp_value !== null) {
        if (typeof candidate.vp_value !== "number")
            return { ok: false, status: 422, error: "vp_value must be numeric when provided" };
        payload.vp_value = candidate.vp_value;
    }
    if (candidate.is_active !== undefined) {
        if (typeof candidate.is_active !== "boolean")
            return { ok: false, status: 422, error: "is_active must be boolean when provided" };
        payload.is_active = candidate.is_active;
    }
    const effectiveType = payload.type ?? candidate.type;
    const effectivePcWeight = payload.pc_weight ?? candidate.pc_weight;
    const effectiveTtcDays = payload.ttc_days ?? candidate.ttc_days;
    const effectiveDelayDays = payload.delay_days ?? candidate.delay_days;
    const effectiveHoldDays = payload.hold_days ?? candidate.hold_days;
    const effectiveDecayDays = payload.decay_days ?? candidate.decay_days;
    const effectiveGpValue = payload.gp_value ?? candidate.gp_value;
    const effectiveVpValue = payload.vp_value ?? candidate.vp_value;
    if (effectiveType === "PC" &&
        (effectivePcWeight === undefined ||
            effectivePcWeight === null ||
            effectiveDecayDays === undefined ||
            effectiveDecayDays === null ||
            ((effectiveTtcDays === undefined || effectiveTtcDays === null) &&
                (effectiveHoldDays === undefined || effectiveHoldDays === null)))) {
        return { ok: false, status: 422, error: "PC KPIs require pc_weight, decay_days, and TTC timing (`ttc_days` or `hold_days`) fields" };
    }
    if (effectiveType === "PC" && effectiveTtcDays === undefined && effectiveHoldDays !== undefined && effectiveHoldDays !== null) {
        const derivedTtc = Number(effectiveDelayDays ?? 0) + Number(effectiveHoldDays);
        if (Number.isFinite(derivedTtc)) {
            payload.ttc_days = Math.max(0, derivedTtc);
        }
    }
    if (effectiveType === "GP" && (effectiveGpValue === undefined || effectiveGpValue === null)) {
        payload.gp_value = 1;
    }
    if (effectiveType === "VP" && (effectiveVpValue === undefined || effectiveVpValue === null)) {
        payload.vp_value = 1;
    }
    if (effectiveType && effectiveType !== "GP") {
        payload.gp_value = null;
    }
    if (effectiveType && effectiveType !== "VP") {
        payload.vp_value = null;
    }
    return { ok: true, payload };
}
function validateAdminChallengeTemplatePayload(body, requireName) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    const payload = {};
    if (requireName) {
        if (!candidate.name || typeof candidate.name !== "string" || !candidate.name.trim()) {
            return { ok: false, status: 422, error: "name is required" };
        }
    }
    if (candidate.name !== undefined) {
        if (typeof candidate.name !== "string" || !candidate.name.trim()) {
            return { ok: false, status: 422, error: "name must be a non-empty string" };
        }
        payload.name = candidate.name.trim();
    }
    if (candidate.description !== undefined) {
        if (typeof candidate.description !== "string") {
            return { ok: false, status: 422, error: "description must be a string when provided" };
        }
        payload.description = candidate.description;
    }
    if (candidate.is_active !== undefined) {
        if (typeof candidate.is_active !== "boolean") {
            return { ok: false, status: 422, error: "is_active must be boolean when provided" };
        }
        payload.is_active = candidate.is_active;
    }
    return { ok: true, payload };
}
function validateAdminCalibrationUpdatePayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (candidate.multiplier === undefined || candidate.multiplier === null) {
        return { ok: false, status: 422, error: "multiplier is required" };
    }
    if (typeof candidate.multiplier !== "number" || !Number.isFinite(candidate.multiplier)) {
        return { ok: false, status: 422, error: "multiplier must be numeric" };
    }
    if (candidate.multiplier < 0.5 || candidate.multiplier > 1.5) {
        return { ok: false, status: 422, error: "multiplier must be between 0.5 and 1.5" };
    }
    return { ok: true, payload: { multiplier: Number(candidate.multiplier.toFixed(6)) } };
}
function validateNotificationEnqueuePayload(body) {
    if (!body || typeof body !== "object") {
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    }
    const candidate = body;
    if (!candidate.user_id || typeof candidate.user_id !== "string") {
        return { ok: false, status: 422, error: "user_id is required" };
    }
    if (!candidate.category || typeof candidate.category !== "string") {
        return { ok: false, status: 422, error: "category is required" };
    }
    if (!["communication", "challenge", "coaching", "system"].includes(candidate.category)) {
        return { ok: false, status: 422, error: "category must be one of: communication, challenge, coaching, system" };
    }
    if (!candidate.title || typeof candidate.title !== "string" || !candidate.title.trim()) {
        return { ok: false, status: 422, error: "title is required" };
    }
    if (!candidate.body || typeof candidate.body !== "string" || !candidate.body.trim()) {
        return { ok: false, status: 422, error: "body is required" };
    }
    if (candidate.payload !== undefined && (typeof candidate.payload !== "object" || candidate.payload === null || Array.isArray(candidate.payload))) {
        return { ok: false, status: 422, error: "payload must be an object when provided" };
    }
    if (candidate.scheduled_for !== undefined) {
        if (typeof candidate.scheduled_for !== "string" || Number.isNaN(new Date(candidate.scheduled_for).getTime())) {
            return { ok: false, status: 422, error: "scheduled_for must be a valid ISO date when provided" };
        }
    }
    return {
        ok: true,
        payload: {
            user_id: candidate.user_id,
            category: candidate.category,
            title: candidate.title.trim(),
            body: candidate.body.trim(),
            payload: candidate.payload,
            scheduled_for: candidate.scheduled_for,
        },
    };
}
async function fetchUserProfileForCalculations(userId) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    const { data, error } = await dataClient
        .from("users")
        .upsert({ id: userId }, { onConflict: "id" })
        .select("average_price_point,commission_rate,account_status")
        .single();
    if (error) {
        return {
            ok: false,
            status: 500,
            error: "Failed to fetch or initialize user profile for KPI calculations",
        };
    }
    return {
        ok: true,
        userProfile: (data ?? {}),
    };
}
function summarizeCalibrationDiagnostics(rows) {
    if (rows.length === 0) {
        return {
            calibration_sample_size: 0,
            rolling_error_ratio: null,
            rolling_abs_pct_error: null,
            calibration_quality_band: "low",
        };
    }
    const sampleTotal = rows.reduce((sum, row) => sum + Math.max(0, toNumberOrZero(row.sample_size)), 0);
    const avgErrorRatio = rows.reduce((sum, row) => sum + toNumberOrZero(row.rolling_error_ratio), 0) / rows.length;
    const avgAbsPctError = rows.reduce((sum, row) => sum + toNumberOrZero(row.rolling_abs_pct_error), 0) / rows.length;
    return {
        calibration_sample_size: Math.round(sampleTotal),
        rolling_error_ratio: Number(avgErrorRatio.toFixed(6)),
        rolling_abs_pct_error: Number(avgAbsPctError.toFixed(6)),
        calibration_quality_band: (0, userCalibrationEngine_1.calibrationQualityBand)(sampleTotal),
    };
}
async function getUserKpiCalibrationRow(userId, kpiId) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    const { data, error } = await dataClient
        .from("user_kpi_calibration")
        .select("multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error")
        .eq("user_id", userId)
        .eq("kpi_id", kpiId)
        .maybeSingle();
    if (error) {
        return { ok: false, status: 500, error: "Failed to fetch user KPI calibration state" };
    }
    if (!data)
        return { ok: true, row: null };
    return {
        ok: true,
        row: {
            multiplier: toNumberOrZero(data.multiplier) || 1,
            sample_size: Math.max(0, toNumberOrZero(data.sample_size)),
            rolling_error_ratio: data.rolling_error_ratio === null
                ? null
                : toNumberOrZero(data.rolling_error_ratio),
            rolling_abs_pct_error: data.rolling_abs_pct_error === null
                ? null
                : toNumberOrZero(data.rolling_abs_pct_error),
        },
    };
}
async function runDealCloseCalibration(input) {
    if (!dataClient)
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    const closeTs = new Date(input.closeTimestampIso);
    if (Number.isNaN(closeTs.getTime()))
        return { ok: true };
    const lookbackStartIso = new Date(closeTs.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: pcKpis, error: pcKpisError }, { data: pcLogs, error: logsError }] = await Promise.all([
        dataClient.from("kpis").select("id,type").eq("type", "PC"),
        dataClient
            .from("kpi_logs")
            .select("kpi_id,event_timestamp,pc_generated,delay_days_applied,hold_days_applied,decay_days_applied")
            .eq("user_id", input.userId)
            .gte("event_timestamp", lookbackStartIso)
            .lte("event_timestamp", input.closeTimestampIso),
    ]);
    if (pcKpisError)
        return { ok: false, status: 500, error: "Failed to load PC KPI definitions for calibration" };
    if (logsError)
        return { ok: false, status: 500, error: "Failed to load KPI logs for calibration" };
    const pcKpiIds = new Set((pcKpis ?? []).map((row) => String(row.id ?? "")));
    const filteredPcLogs = (pcLogs ?? []).filter((row) => pcKpiIds.has(String(row.kpi_id ?? "")));
    const attribution = (0, dealAttributionEngine_1.buildDealCloseAttribution)({
        closeTimestampIso: input.closeTimestampIso,
        pcLogs: filteredPcLogs.map((row) => ({
            kpi_id: String(row.kpi_id ?? ""),
            event_timestamp: String(row.event_timestamp ?? ""),
            pc_generated: toNumberOrZero(row.pc_generated),
            delay_days_applied: toNumberOrZero(row.delay_days_applied),
            hold_days_applied: toNumberOrZero(row.hold_days_applied),
            decay_days_applied: toNumberOrZero(row.decay_days_applied),
        })),
    });
    const predicted = Math.max(0, attribution.predictedGciWindow);
    const actual = Math.max(0, toNumberOrZero(input.actualGci));
    const errorRatio = predicted > 0 ? actual / predicted : null;
    const { error: eventError } = await dataClient.from("user_kpi_calibration_events").insert({
        user_id: input.userId,
        actual_log_id: input.actualLogId,
        close_timestamp: input.closeTimestampIso,
        actual_gci: Number(actual.toFixed(2)),
        predicted_gci_window: Number(predicted.toFixed(2)),
        error_ratio: errorRatio === null ? null : Number(errorRatio.toFixed(6)),
        attribution_payload: attribution,
    });
    if (eventError)
        return { ok: false, status: 500, error: "Failed to write calibration audit event" };
    if (predicted <= 0)
        return { ok: true };
    const kpiIds = Object.keys(attribution.shareByKpiId);
    if (kpiIds.length === 0)
        return { ok: true };
    const { data: existingRows, error: existingError } = await dataClient
        .from("user_kpi_calibration")
        .select("kpi_id,multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error")
        .eq("user_id", input.userId)
        .in("kpi_id", kpiIds);
    if (existingError)
        return { ok: false, status: 500, error: "Failed to load existing calibration rows" };
    const byKpi = new Map((existingRows ?? []).map((row) => [
        String(row.kpi_id ?? ""),
        {
            multiplier: toNumberOrZero(row.multiplier) || 1,
            sample_size: Math.max(0, toNumberOrZero(row.sample_size)),
            rolling_error_ratio: row.rolling_error_ratio === null
                ? null
                : toNumberOrZero(row.rolling_error_ratio),
            rolling_abs_pct_error: row.rolling_abs_pct_error === null
                ? null
                : toNumberOrZero(row.rolling_abs_pct_error),
        },
    ]));
    const safeErrorRatio = actual / Math.max(predicted, 1e-6);
    const safeAbsPctError = Math.abs(safeErrorRatio - 1);
    const nowIso = new Date().toISOString();
    const updates = kpiIds.map((kpiId) => {
        const existing = byKpi.get(kpiId) ?? {
            multiplier: 1,
            sample_size: 0,
            rolling_error_ratio: null,
            rolling_abs_pct_error: null,
        };
        const share = toNumberOrZero(attribution.shareByKpiId[kpiId]);
        const step = (0, userCalibrationEngine_1.computeCalibrationStep)({
            multiplierOld: existing.multiplier,
            sampleSize: existing.sample_size,
            errorRatio: safeErrorRatio,
            attributionShare: share,
        });
        const nextSample = existing.sample_size + 1;
        return {
            user_id: input.userId,
            kpi_id: kpiId,
            multiplier: step.multiplierNew,
            sample_size: nextSample,
            rolling_error_ratio: (0, userCalibrationEngine_1.nextRollingAverage)(existing.rolling_error_ratio, existing.sample_size, safeErrorRatio),
            rolling_abs_pct_error: (0, userCalibrationEngine_1.nextRollingAverage)(existing.rolling_abs_pct_error, existing.sample_size, safeAbsPctError),
            last_calibrated_at: input.closeTimestampIso,
            updated_at: nowIso,
        };
    });
    const { error: upsertError } = await dataClient.from("user_kpi_calibration").upsert(updates, {
        onConflict: "user_id,kpi_id",
    });
    if (upsertError)
        return { ok: false, status: 500, error: "Failed to update user KPI calibration rows" };
    return { ok: true };
}
async function writeKpiLogForUser(userId, payload) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    if (payload.idempotency_key) {
        const { data: existingLog, error: existingLogError } = await dataClient
            .from("kpi_logs")
            .select("id,user_id,kpi_id,event_timestamp,logged_value,idempotency_key,pc_generated,points_generated,actual_gci_delta,deals_closed_delta,payoff_start_date,delay_days_applied,hold_days_applied,decay_days_applied,pc_base_weight_applied,pc_user_multiplier_applied,pc_effective_weight_applied")
            .eq("user_id", userId)
            .eq("idempotency_key", payload.idempotency_key)
            .maybeSingle();
        if (existingLogError) {
            return { ok: false, status: 500, error: "Failed to check idempotency key" };
        }
        if (existingLog) {
            return {
                ok: true,
                httpStatus: 200,
                body: {
                    status: "duplicate",
                    log: existingLog,
                    effects: {
                        projection: { pc_generated: toNumberOrZero(existingLog.pc_generated) },
                        actuals: {
                            actual_gci_delta: toNumberOrZero(existingLog.actual_gci_delta),
                            deals_closed_delta: toNumberOrZero(existingLog.deals_closed_delta),
                        },
                        points: { gp_or_vp_points_delta: toNumberOrZero(existingLog.points_generated) },
                    },
                },
            };
        }
    }
    const { data: kpi, error: kpiError } = await dataClient
        .from("kpis")
        .select("id,type,name,slug,requires_direct_value_input,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value")
        .eq("id", payload.kpi_id)
        .single();
    if (kpiError) {
        return { ok: false, status: 500, error: "Failed to fetch KPI definition" };
    }
    if (!kpi) {
        return { ok: false, status: 404, error: "KPI not found" };
    }
    if (kpi.requires_direct_value_input && payload.logged_value === undefined) {
        return { ok: false, status: 422, error: "logged_value is required for this KPI type" };
    }
    const profile = await fetchUserProfileForCalculations(userId);
    if (!profile.ok) {
        return profile;
    }
    if (profile.userProfile.account_status === "deactivated") {
        return { ok: false, status: 403, error: "Account is deactivated; KPI logging is blocked" };
    }
    const eventTime = new Date(payload.event_timestamp);
    let userPcMultiplier = 1;
    if (kpi.type === "PC") {
        const calibration = await getUserKpiCalibrationRow(userId, kpi.id);
        if (!calibration.ok) {
            return calibration;
        }
        userPcMultiplier = calibration.row ? toNumberOrZero(calibration.row.multiplier) : 1;
    }
    const calc = calculateKpiEffects({
        kpi,
        loggedValue: payload.logged_value,
        eventTime,
        userProfile: profile.userProfile,
        userPcMultiplier,
    });
    const { data: insertedLog, error: insertError } = await dataClient
        .from("kpi_logs")
        .insert({
        user_id: userId,
        kpi_id: payload.kpi_id,
        event_timestamp: eventTime.toISOString(),
        logged_value: payload.logged_value ?? null,
        idempotency_key: payload.idempotency_key ?? null,
        challenge_instance_id: payload.challenge_instance_id ?? null,
        sponsored_challenge_id: payload.sponsored_challenge_id ?? null,
        pc_generated: calc.pcGenerated,
        ttc_end_date: calc.ttcEndDate,
        decay_end_date: calc.decayEndDate,
        payoff_start_date: calc.payoffStartDate,
        delay_days_applied: calc.delayDaysApplied,
        hold_days_applied: calc.holdDaysApplied,
        decay_days_applied: calc.decayDaysApplied,
        points_generated: calc.pointsGenerated,
        actual_gci_delta: calc.actualGciDelta,
        deals_closed_delta: calc.dealsClosedDelta,
        pc_base_weight_applied: calc.pcBaseWeightApplied,
        pc_user_multiplier_applied: calc.pcUserMultiplierApplied,
        pc_effective_weight_applied: calc.pcEffectiveWeightApplied,
        created_at: new Date().toISOString(),
    })
        .select("id,user_id,kpi_id,event_timestamp,logged_value,idempotency_key,pc_generated,points_generated,actual_gci_delta,deals_closed_delta,payoff_start_date,delay_days_applied,hold_days_applied,decay_days_applied,pc_base_weight_applied,pc_user_multiplier_applied,pc_effective_weight_applied")
        .single();
    if (insertError) {
        return { ok: false, status: 500, error: "Failed to write KPI log" };
    }
    const { error: touchError } = await dataClient
        .from("users")
        .update({ last_activity_timestamp: eventTime.toISOString() })
        .eq("id", userId);
    if (touchError) {
        return { ok: false, status: 500, error: "Failed to update user activity timestamp" };
    }
    if (kpi.type === "Pipeline_Anchor") {
        const { error: anchorError } = await dataClient
            .from("pipeline_anchor_status")
            .upsert({
            user_id: userId,
            kpi_id: kpi.id,
            anchor_type: kpi.name ?? kpi.id,
            anchor_value: payload.logged_value ?? 0,
            updated_at: eventTime.toISOString(),
        }, { onConflict: "user_id,kpi_id" });
        if (anchorError) {
            return { ok: false, status: 500, error: "Failed to update pipeline anchor status" };
        }
    }
    if (kpi.type === "Actual" && calc.actualGciDelta > 0) {
        const calibrationRun = await runDealCloseCalibration({
            userId,
            actualLogId: String(insertedLog.id ?? ""),
            closeTimestampIso: eventTime.toISOString(),
            actualGci: calc.actualGciDelta,
        });
        if (!calibrationRun.ok) {
            return { ok: false, status: calibrationRun.status, error: calibrationRun.error };
        }
    }
    return {
        ok: true,
        httpStatus: 201,
        body: {
            status: "ok",
            log: insertedLog,
            effects: {
                projection: { pc_generated: calc.pcGenerated },
                actuals: {
                    actual_gci_delta: calc.actualGciDelta,
                    deals_closed_delta: calc.dealsClosedDelta,
                },
                points: { gp_or_vp_points_delta: calc.pointsGenerated },
            },
        },
    };
}
function isTierAtLeast(userTierRaw, requiredTierRaw) {
    const normalize = (v) => {
        const t = v.toLowerCase();
        if (t === "enterprise")
            return "enterprise";
        if (t === "teams" || t === "team")
            return "teams";
        if (t === "basic")
            return "basic";
        return "free";
    };
    const rank = {
        free: 0,
        basic: 1,
        teams: 2,
        enterprise: 3,
    };
    return rank[normalize(userTierRaw)] >= rank[normalize(requiredTierRaw)];
}
async function logAdminActivity(adminUserId, targetTable, targetId, action, changeSummary) {
    if (!dataClient)
        return;
    await dataClient.from("admin_activity_log").insert({
        admin_user_id: adminUserId,
        target_table: targetTable,
        target_id: targetId,
        action,
        change_summary: changeSummary ?? {},
    });
}
async function ensureUserRow(userId) {
    if (!dataClient) {
        throw new Error("Supabase data client not configured");
    }
    const { error } = await dataClient
        .from("users")
        .upsert({ id: userId }, { onConflict: "id" });
    if (error) {
        throw new Error(`Failed to ensure user row: ${error.message ?? "unknown error"}`);
    }
}
async function checkTeamMembership(teamId, userId) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    const { data, error } = await dataClient
        .from("team_memberships")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .maybeSingle();
    if (error) {
        return { ok: false, status: 500, error: "Failed to read team membership" };
    }
    if (!data) {
        return { ok: true, member: false };
    }
    return { ok: true, member: true, role: data.role };
}
async function checkTeamLeader(teamId, userId) {
    const membership = await checkTeamMembership(teamId, userId);
    if (!membership.ok) {
        return membership;
    }
    return { ok: true, isLeader: membership.member && membership.role === "team_leader" };
}
async function checkChannelMembership(channelId, userId) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    const { data, error } = await dataClient
        .from("channel_memberships")
        .select("role")
        .eq("channel_id", channelId)
        .eq("user_id", userId)
        .maybeSingle();
    if (error) {
        return { ok: false, status: 500, error: "Failed to read channel membership" };
    }
    if (!data) {
        return { ok: true, member: false };
    }
    return { ok: true, member: true, role: String(data.role) };
}
async function isPlatformAdmin(userId) {
    if (!dataClient)
        return false;
    const { data, error } = await dataClient
        .from("users")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
    if (error || !data)
        return false;
    const role = String(data.role ?? "");
    return role === "admin" || role === "super_admin";
}
async function canBroadcastToChannel(channelId, userId) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    const membership = await checkChannelMembership(channelId, userId);
    if (!membership.ok)
        return membership;
    if (!membership.member)
        return { ok: true, allowed: false };
    if (membership.role === "admin")
        return { ok: true, allowed: true };
    const platformAdmin = await isPlatformAdmin(userId);
    if (platformAdmin)
        return { ok: true, allowed: true };
    const { data: channel, error: channelError } = await dataClient
        .from("channels")
        .select("team_id")
        .eq("id", channelId)
        .maybeSingle();
    if (channelError) {
        return { ok: false, status: 500, error: "Failed to load channel for broadcast permission" };
    }
    const teamId = String(channel?.team_id ?? "");
    if (!teamId)
        return { ok: true, allowed: false };
    const teamLeader = await checkTeamLeader(teamId, userId);
    if (!teamLeader.ok)
        return teamLeader;
    return { ok: true, allowed: teamLeader.isLeader };
}
async function canLeaderTargetUserForAiSuggestion(actorUserId, targetUserId) {
    if (!dataClient) {
        return { ok: false, status: 500, error: "Supabase data client not configured" };
    }
    const { data: actorLeaderTeams, error: actorError } = await dataClient
        .from("team_memberships")
        .select("team_id")
        .eq("user_id", actorUserId)
        .eq("role", "team_leader");
    if (actorError) {
        return { ok: false, status: 500, error: "Failed to load team leader scope" };
    }
    const teamIds = (actorLeaderTeams ?? []).map((row) => String(row.team_id));
    if (teamIds.length === 0) {
        return { ok: true, allowed: false };
    }
    const { data: targetMembership, error: targetError } = await dataClient
        .from("team_memberships")
        .select("team_id")
        .eq("user_id", targetUserId)
        .in("team_id", teamIds)
        .limit(1)
        .maybeSingle();
    if (targetError) {
        return { ok: false, status: 500, error: "Failed to evaluate target team scope" };
    }
    return { ok: true, allowed: Boolean(targetMembership) };
}
async function fanOutUnreadCounters(channelId, senderUserId) {
    if (!dataClient) {
        throw new Error("Supabase data client not configured");
    }
    const { data: members, error: membersError } = await dataClient
        .from("channel_memberships")
        .select("user_id")
        .eq("channel_id", channelId);
    if (membersError) {
        throw new Error(`Failed to load channel members for unread fan-out: ${membersError.message ?? "unknown"}`);
    }
    const memberIds = (members ?? []).map((m) => String(m.user_id));
    if (memberIds.length === 0)
        return;
    const { data: existingRows, error: existingRowsError } = await dataClient
        .from("message_unreads")
        .select("channel_id,user_id,unread_count")
        .eq("channel_id", channelId)
        .in("user_id", memberIds);
    if (existingRowsError) {
        throw new Error(`Failed to load existing unread rows: ${existingRowsError.message ?? "unknown"}`);
    }
    const existingByUser = new Map((existingRows ?? []).map((row) => [
        String(row.user_id),
        toNumberOrZero(row.unread_count),
    ]));
    const nowIso = new Date().toISOString();
    for (const userId of memberIds) {
        if (userId === senderUserId) {
            const { error } = await dataClient
                .from("message_unreads")
                .upsert({
                channel_id: channelId,
                user_id: userId,
                unread_count: 0,
                last_seen_at: nowIso,
                updated_at: nowIso,
            }, { onConflict: "channel_id,user_id" });
            if (error) {
                throw new Error(`Failed to update sender unread row: ${error.message ?? "unknown"}`);
            }
            continue;
        }
        const nextUnread = (existingByUser.get(userId) ?? 0) + 1;
        const { error } = await dataClient
            .from("message_unreads")
            .upsert({
            channel_id: channelId,
            user_id: userId,
            unread_count: nextUnread,
            updated_at: nowIso,
        }, { onConflict: "channel_id,user_id" });
        if (error) {
            throw new Error(`Failed to update member unread row: ${error.message ?? "unknown"}`);
        }
    }
}
async function computeChallengeProgressPercent(challengeId, userId) {
    if (!dataClient) {
        throw new Error("Supabase data client not configured");
    }
    const { data: participant, error: participantError } = await dataClient
        .from("challenge_participants")
        .select("effective_start_at")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .single();
    if (participantError || !participant) {
        throw new Error("Failed to load challenge participant");
    }
    const { data: challenge, error: challengeError } = await dataClient
        .from("challenges")
        .select("end_at")
        .eq("id", challengeId)
        .single();
    if (challengeError || !challenge) {
        throw new Error("Failed to load challenge");
    }
    const { data: challengeKpis, error: challengeKpisError } = await dataClient
        .from("challenge_kpis")
        .select("kpi_id")
        .eq("challenge_id", challengeId);
    if (challengeKpisError) {
        throw new Error("Failed to load challenge KPI mapping");
    }
    const kpiIds = (challengeKpis ?? []).map((row) => String(row.kpi_id));
    if (kpiIds.length === 0) {
        return 0;
    }
    const { data: logs, error: logsError } = await dataClient
        .from("kpi_logs")
        .select("id,kpi_id,event_timestamp")
        .eq("user_id", userId)
        .in("kpi_id", kpiIds)
        .gte("event_timestamp", participant.effective_start_at)
        .lte("event_timestamp", challenge.end_at);
    if (logsError) {
        throw new Error("Failed to load challenge logs");
    }
    const logCount = (logs ?? []).length;
    const denominator = Math.max(1, kpiIds.length);
    const progress = Math.min(100, (logCount / denominator) * 100);
    return Number(progress.toFixed(2));
}
async function buildChallengeLeaderboard(challengeId, limit) {
    if (!dataClient) {
        throw new Error("Supabase data client not configured");
    }
    const { data: challenge, error: challengeError } = await dataClient
        .from("challenges")
        .select("end_at")
        .eq("id", challengeId)
        .single();
    if (challengeError || !challenge) {
        throw new Error("Failed to load challenge for leaderboard");
    }
    const { data: participants, error: participantsError } = await dataClient
        .from("challenge_participants")
        .select("user_id,effective_start_at,progress_percent")
        .eq("challenge_id", challengeId);
    if (participantsError) {
        throw new Error("Failed to load challenge participants");
    }
    const safeParticipants = participants ?? [];
    if (safeParticipants.length === 0) {
        return [];
    }
    const { data: challengeKpis, error: challengeKpisError } = await dataClient
        .from("challenge_kpis")
        .select("kpi_id")
        .eq("challenge_id", challengeId);
    if (challengeKpisError) {
        throw new Error("Failed to load challenge KPI mapping");
    }
    const kpiIds = (challengeKpis ?? []).map((row) => String(row.kpi_id));
    if (kpiIds.length === 0) {
        return safeParticipants
            .map((p) => ({
            user_id: String(p.user_id),
            activity_count: 0,
            progress_percent: toNumberOrZero(p.progress_percent),
        }))
            .slice(0, limit);
    }
    const userIds = safeParticipants.map((p) => String(p.user_id));
    const earliestStart = safeParticipants
        .map((p) => new Date(String(p.effective_start_at)).getTime())
        .reduce((min, t) => Math.min(min, t), Number.MAX_SAFE_INTEGER);
    const { data: logs, error: logsError } = await dataClient
        .from("kpi_logs")
        .select("user_id,kpi_id,event_timestamp")
        .in("user_id", userIds)
        .in("kpi_id", kpiIds)
        .gte("event_timestamp", new Date(earliestStart).toISOString())
        .lte("event_timestamp", challenge.end_at);
    if (logsError) {
        throw new Error("Failed to load logs for leaderboard");
    }
    const logsByUser = new Map();
    for (const row of logs ?? []) {
        const key = String(row.user_id);
        const arr = logsByUser.get(key) ?? [];
        arr.push({ event_timestamp: String(row.event_timestamp) });
        logsByUser.set(key, arr);
    }
    const rows = safeParticipants.map((participant) => {
        const userId = String(participant.user_id);
        const effectiveStart = new Date(String(participant.effective_start_at)).getTime();
        const activity = (logsByUser.get(userId) ?? []).filter((log) => new Date(log.event_timestamp).getTime() >= effectiveStart).length;
        return {
            user_id: userId,
            activity_count: activity,
            progress_percent: toNumberOrZero(participant.progress_percent),
        };
    });
    rows.sort((a, b) => {
        if (b.activity_count !== a.activity_count) {
            return b.activity_count - a.activity_count;
        }
        return b.progress_percent - a.progress_percent;
    });
    return rows.slice(0, limit);
}
function calculateKpiEffects(input) {
    const { kpi, loggedValue, eventTime, userProfile, userPcMultiplier } = input;
    if (kpi.type === "GP" || kpi.type === "VP") {
        const unitPoints = Math.max(0, toNumberOrZero(kpi.type === "GP" ? kpi.gp_value : kpi.vp_value) || 1);
        const quantity = Math.max(0, loggedValue ?? 1);
        return {
            pcGenerated: 0,
            payoffStartDate: null,
            ttcEndDate: null,
            decayEndDate: null,
            delayDaysApplied: 0,
            holdDaysApplied: 0,
            decayDaysApplied: 0,
            pointsGenerated: Number((unitPoints * quantity).toFixed(2)),
            actualGciDelta: 0,
            dealsClosedDelta: 0,
            pcBaseWeightApplied: null,
            pcUserMultiplierApplied: null,
            pcEffectiveWeightApplied: null,
        };
    }
    if (kpi.type === "Actual") {
        return {
            pcGenerated: 0,
            payoffStartDate: null,
            ttcEndDate: null,
            decayEndDate: null,
            delayDaysApplied: 0,
            holdDaysApplied: 0,
            decayDaysApplied: 0,
            pointsGenerated: 0,
            actualGciDelta: loggedValue ?? 0,
            dealsClosedDelta: 1,
            pcBaseWeightApplied: null,
            pcUserMultiplierApplied: null,
            pcEffectiveWeightApplied: null,
        };
    }
    if (kpi.type === "PC") {
        const averagePricePoint = toNumberOrZero(userProfile.average_price_point);
        const commissionRate = toNumberOrZero(userProfile.commission_rate);
        const pcWeight = toNumberOrZero(kpi.pc_weight);
        const multiplier = toNumberOrZero(userPcMultiplier || 1) || 1;
        const effectiveWeight = pcWeight * multiplier;
        const timing = (0, pcTimingEngine_1.resolvePcTiming)({
            ttc_days: kpi.ttc_days,
            ttc_definition: kpi.ttc_definition,
            delay_days: kpi.delay_days,
            hold_days: kpi.hold_days,
        });
        const decayDays = Math.max(1, toNumberOrZero(kpi.decay_days) || 180);
        const payoffStartDate = addDays(eventTime, timing.delayDays).toISOString();
        const ttcEndDate = addDays(eventTime, timing.delayDays + timing.holdDays).toISOString();
        const decayEndDate = addDays(eventTime, timing.delayDays + timing.holdDays + decayDays).toISOString();
        return {
            pcGenerated: averagePricePoint * commissionRate * effectiveWeight,
            payoffStartDate,
            ttcEndDate,
            decayEndDate,
            delayDaysApplied: timing.delayDays,
            holdDaysApplied: timing.holdDays,
            decayDaysApplied: decayDays,
            pointsGenerated: 0,
            actualGciDelta: 0,
            dealsClosedDelta: 0,
            pcBaseWeightApplied: Number(pcWeight.toFixed(6)),
            pcUserMultiplierApplied: Number(multiplier.toFixed(6)),
            pcEffectiveWeightApplied: Number(effectiveWeight.toFixed(6)),
        };
    }
    return {
        pcGenerated: 0,
        payoffStartDate: null,
        ttcEndDate: null,
        decayEndDate: null,
        delayDaysApplied: 0,
        holdDaysApplied: 0,
        decayDaysApplied: 0,
        pointsGenerated: 0,
        actualGciDelta: 0,
        dealsClosedDelta: 0,
        pcBaseWeightApplied: null,
        pcUserMultiplierApplied: null,
        pcEffectiveWeightApplied: null,
    };
}
function buildPipelineProjectionEvent(input) {
    const totalAnchorCount = input.anchors.reduce((sum, row) => sum + Math.max(0, toNumberOrZero(row.anchor_value)), 0);
    if (totalAnchorCount <= 0)
        return null;
    const avgPrice = Math.max(0, toNumberOrZero(input.averagePricePoint));
    const commission = Math.max(0, toNumberOrZero(input.commissionRateDecimal));
    const potentialGci = totalAnchorCount * avgPrice * commission;
    if (potentialGci <= 0)
        return null;
    return {
        eventTimestampIso: input.now.toISOString(),
        initialPcGenerated: Number(potentialGci.toFixed(2)),
        delayBeforePayoffStartsDays: 0,
        holdDurationDays: 30,
        decayDurationDays: 1,
    };
}
function buildPastActual6mSeriesFromMetadata(now, input) {
    const safeYtd = Math.max(0, toNumberOrZero(input.ytd_gci));
    const safeLastYear = Math.max(0, toNumberOrZero(input.last_year_gci));
    const currentYear = now.getUTCFullYear();
    const currentMonthIndex = now.getUTCMonth();
    const monthlyYtd = safeYtd > 0 ? safeYtd / Math.max(1, currentMonthIndex + 1) : 0;
    const monthlyLastYear = safeLastYear > 0 ? safeLastYear / 12 : 0;
    return Array.from({ length: 6 }).map((_, i) => {
        const monthDate = new Date(Date.UTC(currentYear, currentMonthIndex - (5 - i), 1));
        const year = monthDate.getUTCFullYear();
        const value = year === currentYear
            ? monthlyYtd || monthlyLastYear
            : monthlyLastYear;
        return {
            month_start: monthDate.toISOString(),
            value: Number(Math.max(0, value).toFixed(2)),
        };
    });
}
function confidenceBand(score) {
    if (score >= 75)
        return "green";
    if (score >= 50)
        return "yellow";
    return "red";
}
function addDays(date, days) {
    const cloned = new Date(date.getTime());
    cloned.setUTCDate(cloned.getUTCDate() + days);
    return cloned;
}
function toNumberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function errorEnvelopeResponse(res, status, code, message, requestIdHeader) {
    const request_id = typeof requestIdHeader === "string" && requestIdHeader.trim()
        ? requestIdHeader.trim()
        : `req_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    return res.status(status).json({ error: { code, message, request_id } });
}
function handleSupabaseError(res, contextMessage, error) {
    // eslint-disable-next-line no-console
    console.error(contextMessage, error);
    if (error?.code === "PGRST116") {
        return res.status(404).json({ error: `${contextMessage}: resource not found` });
    }
    return res.status(500).json({ error: contextMessage });
}
if (host === "0.0.0.0") {
    // eslint-disable-next-line no-console
    console.warn("Backend is exposed on your LAN (HOST=0.0.0.0). Use only for local device testing.");
}
app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`CompassKPI backend listening on http://${host}:${port}`);
});

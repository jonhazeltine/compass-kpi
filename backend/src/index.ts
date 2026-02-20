import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn("SUPABASE_URL or SUPABASE_ANON_KEY not set – auth endpoints will fail.");
}

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "compasskpi-backend" });
});

app.get("/me", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase client not configured" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    return res.json({
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /me", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`CompassKPI backend listening on port ${port} (0.0.0.0)`);
});


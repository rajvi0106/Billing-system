import "dotenv/config";
import express from "express";
import pool from "./db.js";
import events from "./routes/events.js";

const app = express();
app.use(express.json());
app.use('/usage-events',events)

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

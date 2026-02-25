const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ---------------- EVENT STATE ---------------- */

let question = {
  text: "",
  schema: "",
  duration: 300,      // seconds
  startTime: null,
  round: "round1"     // 🔥 NEW (round1 | round2)
};

/* ---------------- ADMIN CONTROLS ---------------- */

// Start / update question
app.post("/start", (req, res) => {
  question.text = req.body.text;
  question.schema = req.body.schema;
  question.duration = req.body.duration;
  question.round = req.body.round || "round1";   // 🔥 NEW
  question.startTime = Date.now();

  res.json({ status: "started" });
});

// Send question + remaining time to students
app.get("/question", (req, res) => {
  if (!question.startTime) {
    return res.json({ active: false });
  }

  const elapsed = Math.floor((Date.now() - question.startTime) / 1000);
  const remaining = Math.max(question.duration - elapsed, 0);

  res.json({
    active: true,
    text: question.text,
    schema: question.schema,
    remaining,
    round: question.round        // 🔥 NEW
  });
});

/* ---------------- CLEAR SUBMISSIONS (COORDINATOR) ---------------- */

app.post("/clear-submissions", (req, res) => {
  fs.writeFileSync("submissions.json", JSON.stringify([], null, 2));
  res.json({ status: "cleared" });
});

/* ---------------- STUDENT SUBMISSION ---------------- */

app.post("/submit", (req, res) => {
  if (!question.startTime) {
    return res.status(403).json({ error: "No active round" });
  }

  const elapsed = Math.floor((Date.now() - question.startTime) / 1000);
  if (elapsed > question.duration) {
    return res.status(403).json({ error: "Time over" });
  }

  const time = new Date().toLocaleTimeString("en-GB");

  // 🔥 NEW: attach round info to submission
  const entry = {
    roll: req.body.roll,
    answer: req.body.answer,
    round: question.round,
    time
  };

  let data = [];
  if (fs.existsSync("submissions.json")) {
    data = JSON.parse(fs.readFileSync("submissions.json"));
  }

  data.push(entry);
  fs.writeFileSync("submissions.json", JSON.stringify(data, null, 2));

  res.json({ status: "submitted" });
});

/* ---------------- LIVE ADMIN VIEW ---------------- */

app.get("/submissions", (req, res) => {
  if (!fs.existsSync("submissions.json")) return res.json([]);
  res.json(JSON.parse(fs.readFileSync("submissions.json")));
});

/* ---------------- SERVER START ---------------- */

app.listen(3000, "0.0.0.0", () => {
  console.log("✅ Server running on all networks at port 3000");
});
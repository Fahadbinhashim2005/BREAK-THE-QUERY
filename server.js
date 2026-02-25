const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ---------------- EVENT STATE ---------------- */

let question = {
  text: "",
  schema: "",
  duration: 300,
  startTime: null,
  round: "round1"
};

let showLeaderboard = false;
let leaderboardRound = null;

/* ---------------- ADMIN / COORDINATOR ---------------- */

app.post("/start", (req, res) => {
  question = {
    text: req.body.text,
    schema: req.body.schema,
    duration: Number(req.body.duration),
    round: req.body.round || "round1",
    startTime: Date.now()
  };

  showLeaderboard = false;
  leaderboardRound = null;

  res.json({ status: "started" });
});

app.post("/clear-submissions", (req, res) => {
  fs.writeFileSync("submissions.json", JSON.stringify([], null, 2));
  res.json({ status: "cleared" });
});

/* ---------------- LEADERBOARD CONTROLS ---------------- */

app.post("/show-leaderboard", (req, res) => {
  leaderboardRound = req.body.round || question.round;
  showLeaderboard = true;
  res.json({ status: "shown", round: leaderboardRound });
});

app.post("/hide-leaderboard", (req, res) => {
  showLeaderboard = false;
  leaderboardRound = null;
  res.json({ status: "hidden" });
});

/* ---------------- STUDENT VIEW ---------------- */

app.get("/question", (req, res) => {
  if (showLeaderboard && leaderboardRound) {
    return res.json({ leaderboard: true, round: leaderboardRound });
  }

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
    round: question.round
  });
});

/* ---------------- SUBMISSION (SECURE + TIMED + ID) ---------------- */

app.post("/submit", (req, res) => {
  const { roll, answer } = req.body;

  if (!question.startTime) {
    return res.status(403).json({ error: "No active round" });
  }

  const elapsed = Math.floor((Date.now() - question.startTime) / 1000);
  if (elapsed > question.duration) {
    return res.status(403).json({ error: "Time is over" });
  }

  if (!fs.existsSync("teams.json")) {
    return res.status(400).json({ error: "No teams registered" });
  }

  const teams = JSON.parse(fs.readFileSync("teams.json"));
  const team = teams.find(t => t.outlawNo === roll);

  if (!team) {
    return res.status(400).json({ error: "Invalid Outlaw No" });
  }

  const submittedAt = Date.now();

  const entry = {
    id: crypto.randomUUID(), // 🔥 STABLE UNIQUE ID
    roll,
    teamName: team.teamName,
    leader: team.leader,
    college: team.college,
    answer,
    round: question.round,
    submittedAt,
    timeTaken: Math.floor((submittedAt - question.startTime) / 1000),
    time: new Date(submittedAt).toLocaleTimeString("en-GB"),
    marks: null
  };

  const data = fs.existsSync("submissions.json")
    ? JSON.parse(fs.readFileSync("submissions.json"))
    : [];

  data.push(entry);
  fs.writeFileSync("submissions.json", JSON.stringify(data, null, 2));

  res.json({ status: "submitted" });
});

/* ---------------- JUDGE / ADMIN ---------------- */

app.get("/submissions", (req, res) => {
  if (!fs.existsSync("submissions.json")) return res.json([]);
  res.json(JSON.parse(fs.readFileSync("submissions.json")));
});

app.post("/update-marks", (req, res) => {
  const { id, marks } = req.body;

  if (!fs.existsSync("submissions.json")) {
    return res.status(400).json({ error: "No submissions" });
  }

  const data = JSON.parse(fs.readFileSync("submissions.json"));
  const submission = data.find(s => s.id === id);

  if (!submission) {
    return res.status(400).json({ error: "Submission not found" });
  }

  // ✅ ensure marks is a number
  submission.marks = Number(marks);

  fs.writeFileSync("submissions.json", JSON.stringify(data, null, 2));
  res.json({ status: "updated" });
});

/* ---------------- TEAM REGISTRY ---------------- */

app.post("/register-team", (req, res) => {
  const teams = fs.existsSync("teams.json")
    ? JSON.parse(fs.readFileSync("teams.json"))
    : [];

  if (teams.find(t => t.outlawNo === req.body.outlawNo)) {
    return res.status(400).json({ error: "Outlaw No already exists" });
  }

  teams.push(req.body);
  fs.writeFileSync("teams.json", JSON.stringify(teams, null, 2));

  res.json({ status: "registered" });
});

app.get("/teams", (req, res) => {
  if (!fs.existsSync("teams.json")) return res.json([]);
  res.json(JSON.parse(fs.readFileSync("teams.json")));
});

/* ---------------- ROUND-WISE LEADERBOARD ---------------- */

app.get("/leaderboard/:round", (req, res) => {
  const round = req.params.round;

  if (!fs.existsSync("submissions.json")) return res.json([]);

  const submissions = JSON.parse(fs.readFileSync("submissions.json"))
    .filter(s => s.round === round && s.marks !== null)
    .sort((a, b) => {
      if (b.marks !== a.marks) return b.marks - a.marks;
      return a.submittedAt - b.submittedAt; // ⏱ tie-break
    });

  res.json(submissions.map(s => ({
    teamName: s.teamName,
    leader: s.leader,
    college: s.college,
    marks: s.marks,
    timeTaken: s.timeTaken
  })));
});

/* ---------------- SERVER ---------------- */

app.listen(3000, "0.0.0.0", () => {
  console.log("✅ Server running on port 3000");
});
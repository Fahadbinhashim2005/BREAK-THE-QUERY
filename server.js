const express = require("express");
const fs = require("fs");
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

/* ---------------- ADMIN / COORDINATOR ---------------- */

app.post("/start", (req, res) => {
  question.text = req.body.text;
  question.schema = req.body.schema;
  question.duration = req.body.duration;
  question.round = req.body.round || "round1";
  question.startTime = Date.now();

  showLeaderboard = false;
  res.json({ status: "started" });
});

app.post("/clear-submissions", (req, res) => {
  fs.writeFileSync("submissions.json", JSON.stringify([], null, 2));
  res.json({ status: "cleared" });
});

/* ---------------- LEADERBOARD CONTROLS ---------------- */

app.post("/show-leaderboard", (req, res) => {
  showLeaderboard = true;
  res.json({ status: "shown" });
});

app.post("/hide-leaderboard", (req, res) => {
  showLeaderboard = false;
  res.json({ status: "hidden" });
});

/* ---------------- STUDENT VIEW ---------------- */

app.get("/question", (req, res) => {
  if (showLeaderboard) {
    return res.json({ leaderboard: true });
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

/* ---------------- SUBMISSION (SECURE) ---------------- */

app.post("/submit", (req, res) => {
  const { roll, answer } = req.body;

  // 🔒 Validate teams
  if (!fs.existsSync("teams.json")) {
    return res.status(400).json({ error: "No teams registered" });
  }

  const teams = JSON.parse(fs.readFileSync("teams.json"));
  const team = teams.find(t => t.outlawNo === roll);

  if (!team) {
    return res.status(400).json({ error: "Invalid Outlaw No" });
  }

  const time = new Date().toLocaleTimeString("en-GB");

  const entry = {
    roll,
    teamName: team.teamName,
    leader: team.leader,
    college: team.college,
    answer,
    round: question.round,
    time,
    marks: null
  };

  let data = [];
  if (fs.existsSync("submissions.json")) {
    data = JSON.parse(fs.readFileSync("submissions.json"));
  }

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
  const { index, marks } = req.body;

  let data = JSON.parse(fs.readFileSync("submissions.json"));
  if (!data[index]) {
    return res.status(400).json({ error: "Invalid submission index" });
  }

  data[index].marks = Number(marks);
  fs.writeFileSync("submissions.json", JSON.stringify(data, null, 2));

  res.json({ status: "updated" });
});

/* ---------------- TEAM REGISTRY ---------------- */

app.post("/register-team", (req, res) => {
  let teams = [];
  if (fs.existsSync("teams.json")) {
    teams = JSON.parse(fs.readFileSync("teams.json"));
  }

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

/* ---------------- LEADERBOARD ---------------- */

app.get("/leaderboard", (req, res) => {
  if (!fs.existsSync("submissions.json")) return res.json([]);

  const submissions = JSON.parse(fs.readFileSync("submissions.json"))
    .filter(s => s.marks !== null)
    .sort((a, b) => b.marks - a.marks);

  res.json(submissions.map(s => ({
    teamName: s.teamName,
    leader: s.leader,
    college: s.college,
    marks: s.marks
  })));
});

/* ---------------- SERVER ---------------- */

app.listen(3000, "0.0.0.0", () => {
  console.log("✅ Server running on port 3000");
});
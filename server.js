/**
 * IslamicSchool Node.js API
 * Route-compatible starter for the Android app in the supplied ZIP.
 *
 * IMPORTANT:
 * - This starter uses in-memory storage. Data resets on server restart.
 * - Verification codes are logged to the server console (development only).
 * - Configure a persistent database and real email provider before production use.
 */
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET_BEFORE_DEPLOYMENT";
const TOKEN_EXPIRES_IN = "7d";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Temporary in-memory stores. Replace with PostgreSQL before production.
const users = [];
const classes = [];
const requests = [];
const announcements = [];
const tasks = [];
const sources = [];
const submissions = [];

let nextUserId = 1;
let nextClassId = 1;
let nextRequestId = 1;
let nextAnnouncementId = 1;
let nextTaskId = 1;
let nextSourceId = 1;
let nextSubmissionId = 1;

const ok = (res, data = null, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message, data: null });

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, verificationCode, resetCode, ...safe } = user;
  return {
    ...safe,
    username: safe.email,
    authorities: [{ name: safe.role }],
    accountNonExpired: true,
    accountNonLocked: true,
    credentialsNonExpired: true,
    enabled: !!safe.emailVerified
  };
}

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return fail(res, 401, "Authorization token is required");
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    req.user = users.find(u => u.id === Number(req.auth.id));
    if (!req.user) return fail(res, 401, "User not found");
    next();
  } catch {
    return fail(res, 401, "Invalid or expired token");
  }
}

function roles(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.role)) return fail(res, 403, "You do not have permission");
    next();
  };
}

function findClass(id) {
  return classes.find(c => c.id === Number(id));
}
function memberOf(classId, userId) {
  const c = findClass(classId);
  return !!c && c.memberIds.includes(Number(userId));
}
function classView(c) {
  return {
    id: c.id, name: c.name, description: c.description,
    numberOfUsers: c.memberIds.length
  };
}
function taskView(t) {
  return {
    id: t.id, title: t.title, description: t.description, due: t.due,
    sources: sources.filter(s => s.taskId === t.id).map(s => ({ id: s.id, source: s.source })),
    targetedClass: classView(findClass(t.classId))
  };
}
function requestView(r) {
  return {
    id: r.id,
    user: publicUser(users.find(u => u.id === r.userId)),
    requestedClass: classView(findClass(r.classId)),
    status: r.status,
    timestamp: r.timestamp
  };
}
function announcementView(a) {
  return {
    id: a.id, title: a.title, content: a.content,
    targetedClass: classView(findClass(a.classId))
  };
}
function submissionView(s) {
  return {
    id: s.id,
    task: taskView(tasks.find(t => t.id === s.taskId)),
    user: publicUser(users.find(u => u.id === s.userId)),
    grade: s.grade, additional: s.additional, link: s.link
  };
}

app.get("/", (req, res) => ok(res, { service: "IslamicSchool API", status: "running" }, "IslamicSchool Server is running!"));
app.get("/health", (req, res) => ok(res, { status: "ok" }, "Healthy"));

// AUTH: signup
async function signup(req, res, role) {
  const { email, password, firstName, lastName } = req.body || {};
  if (!email || !password || String(password).length < 8) {
    return fail(res, 400, "Email and password (at least 8 characters) are required");
  }
  const normalized = String(email).trim().toLowerCase();
  if (users.some(u => u.email === normalized)) return fail(res, 409, "Email is already registered");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const user = {
    id: nextUserId++, email: normalized,
    passwordHash: await bcrypt.hash(String(password), 12),
    firstName: firstName || "", lastName: lastName || "",
    dob: null, imageUrl: null, role, emailVerified: false,
    verificationCode: code, verificationExpiresAt: Date.now() + 15 * 60 * 1000,
    createdAt: new Date().toISOString()
  };
  users.push(user);

  // Development only until an email provider is configured.
  console.log(`[IslamicSchool DEV] Verification code for ${normalized}: ${code}`);
  return ok(res, publicUser(user), "Registration successful. Check server logs for the development verification code.", 201);
}
app.post("/api/auth/student/signup", (req, res) => signup(req, res, "STUDENT"));
app.post("/api/auth/teacher/signup", (req, res) => signup(req, res, "TEACHER"));

app.post("/api/auth/verify-code", (req, res) => {
  const { email, code } = req.body || {};
  const user = users.find(u => u.email === String(email || "").trim().toLowerCase());
  if (!user) return fail(res, 404, "User not found");
  if (user.emailVerified) return ok(res, null, "Email already verified");
  if (!user.verificationCode || Date.now() > user.verificationExpiresAt ||
      String(user.verificationCode) !== String(code)) return fail(res, 400, "Invalid or expired verification code");
  user.emailVerified = true;
  user.verificationCode = null;
  return ok(res, null, "Email verified successfully");
});

app.post("/api/auth/regenerate-code", (req, res) => {
  const { email } = req.body || {};
  const user = users.find(u => u.email === String(email || "").trim().toLowerCase());
  if (!user) return fail(res, 404, "User not found");
  if (user.emailVerified) return fail(res, 400, "Email is already verified");
  user.verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  user.verificationExpiresAt = Date.now() + 15 * 60 * 1000;
  console.log(`[IslamicSchool DEV] New verification code for ${user.email}: ${user.verificationCode}`);
  return ok(res, null, "A new verification code was generated. Check server logs.");
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find(u => u.email === String(email || "").trim().toLowerCase());
  if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
    return fail(res, 401, "Invalid email or password");
  }
  if (!user.emailVerified) return fail(res, 403, "Please verify your email first");
  return ok(res, { token: tokenFor(user), user: publicUser(user) }, "Login successful");
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, password, code } = req.body || {};
  const user = users.find(u => u.email === String(email || "").trim().toLowerCase());
  if (!user) return fail(res, 404, "User not found");
  if (!user.resetCode || Date.now() > user.resetExpiresAt || String(code) !== user.resetCode) {
    return fail(res, 400, "Invalid or expired reset code");
  }
  if (!password || String(password).length < 8) return fail(res, 400, "Password must be at least 8 characters");
  user.passwordHash = await bcrypt.hash(String(password), 12);
  user.resetCode = null;
  return ok(res, null, "Password reset successfully");
});

// No reset-code request route exists in the supplied Android source.
// This route is provided so a future reset screen can request a code.
app.post("/api/auth/request-reset-code", (req, res) => {
  const { email } = req.body || {};
  const user = users.find(u => u.email === String(email || "").trim().toLowerCase());
  if (!user) return fail(res, 404, "User not found");
  user.resetCode = String(Math.floor(100000 + Math.random() * 900000));
  user.resetExpiresAt = Date.now() + 15 * 60 * 1000;
  console.log(`[IslamicSchool DEV] Password reset code for ${user.email}: ${user.resetCode}`);
  return ok(res, null, "Reset code generated. Check server logs.");
});

// Classes / browse
app.get("/api/classes", auth, (req, res) => ok(res, classes.map(classView)));
app.post("/api/admin/create-class", auth, roles("ADMIN"), (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return fail(res, 400, "Class name is required");
  const c = { id: nextClassId++, name, description: description || "", memberIds: [req.user.id] };
  classes.push(c);
  return ok(res, classView(c), "Class created", 201);
});

app.post("/api/users/request/:userId/to/:classId", auth, (req, res) => {
  const userId = Number(req.params.userId), classId = Number(req.params.classId);
  if (req.user.id !== userId && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  if (!findClass(classId)) return fail(res, 404, "Class not found");
  if (requests.some(r => r.userId === userId && r.classId === classId && r.status === "PENDING")) {
    return fail(res, 409, "Request already pending");
  }
  const r = { id: nextRequestId++, userId, classId, status: "PENDING", timestamp: new Date().toISOString() };
  requests.push(r);
  return ok(res, requestView(r), "Request submitted", 201);
});

app.get("/api/users/:userId/classes", auth, (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  return ok(res, classes.filter(c => c.memberIds.includes(id)).map(classView));
});
app.get("/api/users/:userId/requests", auth, (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  return ok(res, requests.filter(r => r.userId === id).map(requestView));
});
app.get("/api/classes/:classId/users", auth, (req, res) => {
  const c = findClass(req.params.classId);
  if (!c) return fail(res, 404, "Class not found");
  if (!memberOf(c.id, req.user.id) && req.user.role !== "ADMIN") return fail(res, 403, "Not a class member");
  return ok(res, c.memberIds.map(id => publicUser(users.find(u => u.id === id))).filter(Boolean));
});
app.get("/api/classes/:classId/announcements", auth, (req, res) => {
  const c = findClass(req.params.classId);
  if (!c) return fail(res, 404, "Class not found");
  if (!memberOf(c.id, req.user.id) && req.user.role !== "ADMIN") return fail(res, 403, "Not a class member");
  return ok(res, announcements.filter(a => a.classId === c.id).map(announcementView));
});
app.get("/api/classes/:classId/tasks", auth, (req, res) => {
  const c = findClass(req.params.classId);
  if (!c) return fail(res, 404, "Class not found");
  if (!memberOf(c.id, req.user.id) && req.user.role !== "ADMIN") return fail(res, 403, "Not a class member");
  return ok(res, tasks.filter(t => t.classId === c.id).map(taskView));
});
app.get("/api/classes/:classId/requests", auth, roles("ADMIN", "TEACHER"), (req, res) => {
  const c = findClass(req.params.classId);
  if (!c) return fail(res, 404, "Class not found");
  return ok(res, requests.filter(r => r.classId === c.id).map(requestView));
});

app.put("/api/admin/approve-request/:requestId", auth, roles("ADMIN"), (req, res) => {
  const r = requests.find(x => x.id === Number(req.params.requestId));
  if (!r) return fail(res, 404, "Request not found");
  r.status = "APPROVED";
  const c = findClass(r.classId);
  if (c && !c.memberIds.includes(r.userId)) c.memberIds.push(r.userId);
  return ok(res, requestView(r), "Request approved");
});
app.put("/api/admin/decline-request/:requestId", auth, roles("ADMIN"), (req, res) => {
  const r = requests.find(x => x.id === Number(req.params.requestId));
  if (!r) return fail(res, 404, "Request not found");
  r.status = "DECLINED";
  return ok(res, requestView(r), "Request declined");
});

// Teachers: tasks, announcements, sources
app.post("/api/teachers/class/:classId/create-task", auth, roles("ADMIN", "TEACHER"), (req, res) => {
  const c = findClass(req.params.classId);
  if (!c) return fail(res, 404, "Class not found");
  const { title, description, due } = req.body || {};
  if (!title) return fail(res, 400, "Task title is required");
  const t = { id: nextTaskId++, classId: c.id, title, description: description || "", due: due || null };
  tasks.push(t);
  return ok(res, taskView(t), "Task created", 201);
});
app.post("/api/teachers/create-announcement/:classId", auth, roles("ADMIN", "TEACHER"), (req, res) => {
  const c = findClass(req.params.classId);
  if (!c) return fail(res, 404, "Class not found");
  const { title, content } = req.body || {};
  if (!title || !content) return fail(res, 400, "Title and content are required");
  const a = { id: nextAnnouncementId++, classId: c.id, title, content };
  announcements.push(a);
  return ok(res, announcementView(a), "Announcement created", 201);
});
app.post("/api/teachers/task/:taskId/create-source", auth, roles("ADMIN", "TEACHER"), (req, res) => {
  const t = tasks.find(x => x.id === Number(req.params.taskId));
  if (!t) return fail(res, 404, "Task not found");
  const { source } = req.body || {};
  if (!source) return fail(res, 400, "Source is required");
  const item = { id: nextSourceId++, taskId: t.id, source };
  sources.push(item);
  return ok(res, item, "Source added", 201);
});
app.get("/api/users/task/:taskId", auth, (req, res) => {
  const t = tasks.find(x => x.id === Number(req.params.taskId));
  if (!t) return fail(res, 404, "Task not found");
  if (!memberOf(t.classId, req.user.id) && req.user.role !== "ADMIN") return fail(res, 403, "Not a class member");
  return ok(res, taskView(t));
});

// Submissions
app.post("/api/students/submit/:userId/:taskId", auth, (req, res) => {
  const userId = Number(req.params.userId), taskId = Number(req.params.taskId);
  if (req.user.id !== userId && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  const task = tasks.find(t => t.id === taskId);
  if (!task) return fail(res, 404, "Task not found");
  if (!memberOf(task.classId, userId)) return fail(res, 403, "Not a class member");
  const { link, additional } = req.body || {};
  const existing = submissions.find(s => s.userId === userId && s.taskId === taskId);
  if (existing) {
    existing.link = link || null; existing.additional = additional || null;
    return ok(res, submissionView(existing), "Submission updated");
  }
  const s = { id: nextSubmissionId++, userId, taskId, link: link || null, additional: additional || null, grade: null };
  submissions.push(s);
  return ok(res, submissionView(s), "Submission created", 201);
});
app.get("/api/students/submissions/:taskId/:userId", auth, (req, res) => {
  const userId = Number(req.params.userId);
  if (req.user.id !== userId && req.user.role !== "ADMIN" && req.user.role !== "TEACHER") return fail(res, 403, "Not allowed");
  return ok(res, submissions.filter(s => s.taskId === Number(req.params.taskId) && s.userId === userId).map(submissionView));
});
app.get("/api/teachers/task/:taskId/submissions", auth, roles("ADMIN", "TEACHER"), (req, res) => {
  const taskId = Number(req.params.taskId);
  if (!tasks.some(t => t.id === taskId)) return fail(res, 404, "Task not found");
  return ok(res, submissions.filter(s => s.taskId === taskId).map(submissionView));
});
app.put("/api/teachers/update-submission/:submissionId", auth, roles("ADMIN", "TEACHER"), (req, res) => {
  const s = submissions.find(x => x.id === Number(req.params.submissionId));
  if (!s) return fail(res, 404, "Submission not found");
  const { grade, additional, link } = req.body || {};
  if (grade !== undefined) s.grade = Number(grade);
  if (additional !== undefined) s.additional = additional;
  if (link !== undefined) s.link = link;
  return ok(res, submissionView(s), "Submission updated");
});

// User profile
app.get("/api/users/:userId", auth, (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  return ok(res, publicUser(req.user.id === id ? req.user : users.find(u => u.id === id)));
});
app.put("/api/users/update-user/:userId", auth, (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  const user = users.find(u => u.id === id);
  if (!user) return fail(res, 404, "User not found");
  const { firstName, lastName, dob } = req.body || {};
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (dob !== undefined) user.dob = dob;
  return ok(res, publicUser(user), "Profile updated");
});
app.post("/api/users/:userId/upload-image", auth, upload.single("file"), (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  if (!req.file) return fail(res, 400, "Image file is required");
  // This starter acknowledges upload but does not persist image bytes.
  return ok(res, { fileName: req.file.originalname, size: req.file.size }, "Image received. Configure object storage to persist it.");
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) return fail(res, 400, err.message);
  return fail(res, 500, "Internal server error");
});

app.listen(PORT, () => console.log(`IslamicSchool API listening on port ${PORT}`));

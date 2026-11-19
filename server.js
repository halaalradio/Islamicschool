/**
 * IslamicSchool Node.js API (PostgreSQL / Supabase)
 */
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET_BEFORE_DEPLOYMENT";
const TOKEN_EXPIRES_IN = "7d";

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL environment variable is not set.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const ok = (res, data = null, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message, data: null });

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    dob: row.dob || null,
    imageUrl: row.image_url || null,
    role: row.role,
    emailVerified: !!row.email_verified,
    createdAt: row.created_at,
    username: row.email,
    authorities: [{ name: row.role }],
    accountNonExpired: true,
    accountNonLocked: true,
    credentialsNonExpired: true,
    enabled: !!row.email_verified
  };
}

function tokenFor(userRow) {
  return jwt.sign(
    { id: userRow.id, email: userRow.email, role: userRow.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

const auth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return fail(res, 401, "Authorization token is required");
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
  } catch {
    return fail(res, 401, "Invalid or expired token");
  }
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [Number(req.auth.id)]);
  if (!rows[0]) return fail(res, 401, "User not found");
  req.user = rows[0];
  next();
});

function roles(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.role)) return fail(res, 403, "You do not have permission");
    next();
  };
}

async function getClassWithCount(classId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.description, COUNT(cm.user_id)::int AS number_of_users
     FROM classes c
     LEFT JOIN class_members cm ON cm.class_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [Number(classId)]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    name: rows[0].name,
    description: rows[0].description,
    numberOfUsers: rows[0].number_of_users
  };
}

async function listClassesWithCount(whereSql = "", params = []) {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.description, COUNT(cm.user_id)::int AS number_of_users
     FROM classes c
     LEFT JOIN class_members cm ON cm.class_id = c.id
     ${whereSql}
     GROUP BY c.id
     ORDER BY c.id ASC`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    numberOfUsers: r.number_of_users
  }));
}

async function isMemberOf(classId, userId) {
  const { rows } = await pool.query(
    "SELECT 1 FROM class_members WHERE class_id = $1 AND user_id = $2",
    [Number(classId), Number(userId)]
  );
  return rows.length > 0;
}

async function buildTaskView(taskRow) {
  const { rows: srcRows } = await pool.query(
    "SELECT id, source FROM sources WHERE task_id = $1 ORDER BY id ASC",
    [taskRow.id]
  );
  const targetedClass = await getClassWithCount(taskRow.class_id);
  return {
    id: taskRow.id,
    title: taskRow.title,
    description: taskRow.description,
    due: taskRow.due,
    sources: srcRows,
    targetedClass
  };
}

async function buildRequestView(reqRow) {
  const { rows: uRows } = await pool.query("SELECT * FROM users WHERE id = $1", [reqRow.user_id]);
  const targetedClass = await getClassWithCount(reqRow.class_id);
  return {
    id: reqRow.id,
    user: publicUser(uRows[0]),
    requestedClass: targetedClass,
    status: reqRow.status,
    timestamp: reqRow.timestamp
  };
}

async function buildAnnouncementView(annRow) {
  const targetedClass = await getClassWithCount(annRow.class_id);
  return {
    id: annRow.id,
    title: annRow.title,
    content: annRow.content,
    targetedClass
  };
}

async function buildSubmissionView(subRow) {
  const { rows: tRows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [subRow.task_id]);
  const { rows: uRows } = await pool.query("SELECT * FROM users WHERE id = $1", [subRow.user_id]);
  return {
    id: subRow.id,
    task: tRows[0] ? await buildTaskView(tRows[0]) : null,
    user: publicUser(uRows[0]),
    grade: subRow.grade,
    additional: subRow.additional,
    link: subRow.link
  };
}

app.get("/", (req, res) =>
  ok(res, { service: "IslamicSchool API", status: "running" }, "IslamicSchool Server is running!")
);
app.get("/health", asyncHandler(async (req, res) => {
  await pool.query("SELECT 1");
  return ok(res, { status: "ok", database: "connected" }, "Healthy");
}));

// AUTH
async function handleSignup(req, res, role) {
  const { email, password, firstName, lastName } = req.body || {};
  if (!email || !password || String(password).length < 8) {
    return fail(res, 400, "Email and password (at least 8 characters) are required");
  }
  const normalized = String(email).trim().toLowerCase();
  const exists = await pool.query("SELECT id FROM users WHERE email = $1", [normalized]);
  if (exists.rows.length > 0) return fail(res, 409, "Email is already registered");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const passwordHash = await bcrypt.hash(String(password), 12);
  const expiresAt = Date.now() + 15 * 60 * 1000;

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified, verification_code, verification_expires_at)
     VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)
     RETURNING *`,
    [normalized, passwordHash, firstName || "", lastName || "", role, code, expiresAt]
  );

  console.log(`[IslamicSchool DEV] Verification code for ${normalized}: ${code}`);
  return ok(
    res,
    publicUser(rows[0]),
    "Registration successful. Check server logs for the development verification code.",
    201
  );
}

app.post("/api/auth/student/signup", asyncHandler((req, res) => handleSignup(req, res, "STUDENT")));
app.post("/api/auth/teacher/signup", asyncHandler((req, res) => handleSignup(req, res, "TEACHER")));

app.post("/api/auth/verify-code", asyncHandler(async (req, res) => {
  const { email, code } = req.body || {};
  const normalized = String(email || "").trim().toLowerCase();
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [normalized]);
  const user = rows[0];
  if (!user) return fail(res, 404, "User not found");
  if (user.email_verified) return ok(res, null, "Email already verified");
  if (
    !user.verification_code ||
    Date.now() > Number(user.verification_expires_at) ||
    String(user.verification_code) !== String(code)
  ) {
    return fail(res, 400, "Invalid or expired verification code");
  }
  await pool.query(
    "UPDATE users SET email_verified = TRUE, verification_code = NULL WHERE id = $1",
    [user.id]
  );
  return ok(res, null, "Email verified successfully");
}));

app.post("/api/auth/regenerate-code", asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  const normalized = String(email || "").trim().toLowerCase();
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [normalized]);
  const user = rows[0];
  if (!user) return fail(res, 404, "User not found");
  if (user.email_verified) return fail(res, 400, "Email is already verified");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 15 * 60 * 1000;
  await pool.query(
    "UPDATE users SET verification_code = $1, verification_expires_at = $2 WHERE id = $3",
    [code, expiresAt, user.id]
  );
  console.log(`[IslamicSchool DEV] New verification code for ${user.email}: ${code}`);
  return ok(res, null, "A new verification code was generated. Check server logs.");
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const normalized = String(email || "").trim().toLowerCase();
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [normalized]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password || ""), user.password_hash))) {
    return fail(res, 401, "Invalid email or password");
  }
  if (!user.email_verified) return fail(res, 403, "Please verify your email first");
  return ok(res, { token: tokenFor(user), user: publicUser(user) }, "Login successful");
}));

app.post("/api/auth/reset-password", asyncHandler(async (req, res) => {
  const { email, password, code } = req.body || {};
  const normalized = String(email || "").trim().toLowerCase();
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [normalized]);
  const user = rows[0];
  if (!user) return fail(res, 404, "User not found");
  if (
    !user.reset_code ||
    Date.now() > Number(user.reset_expires_at) ||
    String(code) !== String(user.reset_code)
  ) {
    return fail(res, 400, "Invalid or expired reset code");
  }
  if (!password || String(password).length < 8) {
    return fail(res, 400, "Password must be at least 8 characters");
  }
  const passwordHash = await bcrypt.hash(String(password), 12);
  await pool.query(
    "UPDATE users SET password_hash = $1, reset_code = NULL WHERE id = $2",
    [passwordHash, user.id]
  );
  return ok(res, null, "Password reset successfully");
}));

app.post("/api/auth/request-reset-code", asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  const normalized = String(email || "").trim().toLowerCase();
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [normalized]);
  const user = rows[0];
  if (!user) return fail(res, 404, "User not found");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 15 * 60 * 1000;
  await pool.query(
    "UPDATE users SET reset_code = $1, reset_expires_at = $2 WHERE id = $3",
    [code, expiresAt, user.id]
  );
  console.log(`[IslamicSchool DEV] Password reset code for ${user.email}: ${code}`);
  return ok(res, null, "Reset code generated. Check server logs.");
}));

// CLASSES
app.get("/api/classes", auth, asyncHandler(async (req, res) => {
  return ok(res, await listClassesWithCount());
}));

app.post("/api/admin/create-class", auth, roles("ADMIN"), asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return fail(res, 400, "Class name is required");
  const { rows } = await pool.query(
    "INSERT INTO classes (name, description) VALUES ($1, $2) RETURNING id",
    [name, description || ""]
  );
  const classId = rows[0].id;
  await pool.query(
    "INSERT INTO class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [classId, req.user.id]
  );
  return ok(res, await getClassWithCount(classId), "Class created", 201);
}));

app.post("/api/users/request/:userId/to/:classId", auth, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const classId = Number(req.params.classId);
  if (req.user.id !== userId && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  const cls = await getClassWithCount(classId);
  if (!cls) return fail(res, 404, "Class not found");

  const pending = await pool.query(
    "SELECT id FROM requests WHERE user_id = $1 AND class_id = $2 AND status = 'PENDING'",
    [userId, classId]
  );
  if (pending.rows.length > 0) return fail(res, 409, "Request already pending");

  const { rows } = await pool.query(
    "INSERT INTO requests (user_id, class_id, status) VALUES ($1, $2, 'PENDING') RETURNING *",
    [userId, classId]
  );
  return ok(res, await buildRequestView(rows[0]), "Request submitted", 201);
}));

app.get("/api/users/:userId/classes", auth, asyncHandler(async (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  return ok(
    res,
    await listClassesWithCount(
      "WHERE c.id IN (SELECT class_id FROM class_members WHERE user_id = $1)",
      [id]
    )
  );
}));

app.get("/api/users/:userId/requests", auth, asyncHandler(async (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  const { rows } = await pool.query("SELECT * FROM requests WHERE user_id = $1 ORDER BY id DESC", [id]);
  const views = await Promise.all(rows.map(buildRequestView));
  return ok(res, views);
}));

app.get("/api/classes/:classId/users", auth, asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const cls = await getClassWithCount(classId);
  if (!cls) return fail(res, 404, "Class not found");
  if (!(await isMemberOf(classId, req.user.id)) && req.user.role !== "ADMIN") {
    return fail(res, 403, "Not a class member");
  }
  const { rows } = await pool.query(
    `SELECT u.* FROM users u
     INNER JOIN class_members cm ON cm.user_id = u.id
     WHERE cm.class_id = $1
     ORDER BY u.id ASC`,
    [classId]
  );
  return ok(res, rows.map(publicUser));
}));

app.get("/api/classes/:classId/announcements", auth, asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const cls = await getClassWithCount(classId);
  if (!cls) return fail(res, 404, "Class not found");
  if (!(await isMemberOf(classId, req.user.id)) && req.user.role !== "ADMIN") {
    return fail(res, 403, "Not a class member");
  }
  const { rows } = await pool.query("SELECT * FROM announcements WHERE class_id = $1 ORDER BY id DESC", [classId]);
  return ok(res, await Promise.all(rows.map(buildAnnouncementView)));
}));

app.get("/api/classes/:classId/tasks", auth, asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const cls = await getClassWithCount(classId);
  if (!cls) return fail(res, 404, "Class not found");
  if (!(await isMemberOf(classId, req.user.id)) && req.user.role !== "ADMIN") {
    return fail(res, 403, "Not a class member");
  }
  const { rows } = await pool.query("SELECT * FROM tasks WHERE class_id = $1 ORDER BY id DESC", [classId]);
  return ok(res, await Promise.all(rows.map(buildTaskView)));
}));

app.get("/api/classes/:classId/requests", auth, roles("ADMIN", "TEACHER"), asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const cls = await getClassWithCount(classId);
  if (!cls) return fail(res, 404, "Class not found");
  const { rows } = await pool.query("SELECT * FROM requests WHERE class_id = $1 ORDER BY id DESC", [classId]);
  return ok(res, await Promise.all(rows.map(buildRequestView)));
}));

app.put("/api/admin/approve-request/:requestId", auth, roles("ADMIN"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE requests SET status = 'APPROVED' WHERE id = $1 RETURNING *",
    [Number(req.params.requestId)]
  );
  if (!rows[0]) return fail(res, 404, "Request not found");
  await pool.query(
    "INSERT INTO class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [rows[0].class_id, rows[0].user_id]
  );
  return ok(res, await buildRequestView(rows[0]), "Request approved");
}));

app.put("/api/admin/decline-request/:requestId", auth, roles("ADMIN"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE requests SET status = 'DECLINED' WHERE id = $1 RETURNING *",
    [Number(req.params.requestId)]
  );
  if (!rows[0]) return fail(res, 404, "Request not found");
  return ok(res, await buildRequestView(rows[0]), "Request declined");
}));

// TEACHERS
app.post("/api/teachers/class/:classId/create-task", auth, roles("ADMIN", "TEACHER"), asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const cls = await getClassWithCount(classId);
  if (!cls) return fail(res, 404, "Class not found");
  const { title, description, due } = req.body || {};
  if (!title) return fail(res, 400, "Task title is required");
  const { rows } = await pool.query(
    "INSERT INTO tasks (class_id, title, description, due) VALUES ($1, $2, $3, $4) RETURNING *",
    [classId, title, description || "", due || null]
  );
  return ok(res, await buildTaskView(rows[0]), "Task created", 201);
}));

app.post("/api/teachers/create-announcement/:classId", auth, roles("ADMIN", "TEACHER"), asyncHandler(async (req, res) => {
  const classId = Number(req.params.classId);
  const cls = await getClassWithCount(classId);
  if (!cls) return fail(res, 404, "Class not found");
  const { title, content } = req.body || {};
  if (!title || !content) return fail(res, 400, "Title and content are required");
  const { rows } = await pool.query(
    "INSERT INTO announcements (class_id, title, content) VALUES ($1, $2, $3) RETURNING *",
    [classId, title, content]
  );
  return ok(res, await buildAnnouncementView(rows[0]), "Announcement created", 201);
}));

app.post("/api/teachers/task/:taskId/create-source", auth, roles("ADMIN", "TEACHER"), asyncHandler(async (req, res) => {
  const taskId = Number(req.params.taskId);
  const tRes = await pool.query("SELECT id FROM tasks WHERE id = $1", [taskId]);
  if (!tRes.rows[0]) return fail(res, 404, "Task not found");
  const { source } = req.body || {};
  if (!source) return fail(res, 400, "Source is required");
  const { rows } = await pool.query(
    "INSERT INTO sources (task_id, source) VALUES ($1, $2) RETURNING id, source",
    [taskId, source]
  );
  return ok(res, rows[0], "Source added", 201);
}));

app.get("/api/users/task/:taskId", auth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [Number(req.params.taskId)]);
  const task = rows[0];
  if (!task) return fail(res, 404, "Task not found");
  if (!(await isMemberOf(task.class_id, req.user.id)) && req.user.role !== "ADMIN") {
    return fail(res, 403, "Not a class member");
  }
  return ok(res, await buildTaskView(task));
}));

// SUBMISSIONS
app.post("/api/students/submit/:userId/:taskId", auth, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const taskId = Number(req.params.taskId);
  if (req.user.id !== userId && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  const tRes = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
  const task = tRes.rows[0];
  if (!task) return fail(res, 404, "Task not found");
  if (!(await isMemberOf(task.class_id, userId))) return fail(res, 403, "Not a class member");

  const { link, additional } = req.body || {};
  const { rows } = await pool.query(
    `INSERT INTO submissions (task_id, user_id, link, additional, grade)
     VALUES ($1, $2, $3, $4, NULL)
     ON CONFLICT (task_id, user_id)
     DO UPDATE SET link = EXCLUDED.link, additional = EXCLUDED.additional
     RETURNING *`,
    [taskId, userId, link || null, additional || null]
  );
  return ok(res, await buildSubmissionView(rows[0]), "Submission saved", 201);
}));

app.get("/api/students/submissions/:taskId/:userId", auth, asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const taskId = Number(req.params.taskId);
  if (req.user.id !== userId && req.user.role !== "ADMIN" && req.user.role !== "TEACHER") {
    return fail(res, 403, "Not allowed");
  }
  const { rows } = await pool.query(
    "SELECT * FROM submissions WHERE task_id = $1 AND user_id = $2",
    [taskId, userId]
  );
  return ok(res, await Promise.all(rows.map(buildSubmissionView)));
}));

app.get("/api/teachers/task/:taskId/submissions", auth, roles("ADMIN", "TEACHER"), asyncHandler(async (req, res) => {
  const taskId = Number(req.params.taskId);
  const tRes = await pool.query("SELECT id FROM tasks WHERE id = $1", [taskId]);
  if (!tRes.rows[0]) return fail(res, 404, "Task not found");
  const { rows } = await pool.query("SELECT * FROM submissions WHERE task_id = $1 ORDER BY id ASC", [taskId]);
  return ok(res, await Promise.all(rows.map(buildSubmissionView)));
}));

app.put("/api/teachers/update-submission/:submissionId", auth, roles("ADMIN", "TEACHER"), asyncHandler(async (req, res) => {
  const subId = Number(req.params.submissionId);
  const { rows: existingRows } = await pool.query("SELECT * FROM submissions WHERE id = $1", [subId]);
  const existing = existingRows[0];
  if (!existing) return fail(res, 404, "Submission not found");

  const { grade, additional, link } = req.body || {};
  const nextGrade = grade !== undefined ? Number(grade) : existing.grade;
  const nextAdditional = additional !== undefined ? additional : existing.additional;
  const nextLink = link !== undefined ? link : existing.link;

  const { rows } = await pool.query(
    "UPDATE submissions SET grade = $1, additional = $2, link = $3 WHERE id = $4 RETURNING *",
    [nextGrade, nextAdditional, nextLink, subId]
  );
  return ok(res, await buildSubmissionView(rows[0]), "Submission updated");
}));

// USER PROFILE
app.get("/api/users/:userId", auth, asyncHandler(async (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return ok(res, publicUser(rows[0]));
}));

app.put("/api/users/update-user/:userId", auth, asyncHandler(async (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  const { rows: existingRows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return fail(res, 404, "User not found");

  const { firstName, lastName, dob } = req.body || {};
  const nextFirst = firstName !== undefined ? firstName : existing.first_name;
  const nextLast = lastName !== undefined ? lastName : existing.last_name;
  const nextDob = dob !== undefined ? dob : existing.dob;

  const { rows } = await pool.query(
    "UPDATE users SET first_name = $1, last_name = $2, dob = $3 WHERE id = $4 RETURNING *",
    [nextFirst, nextLast, nextDob, id]
  );
  return ok(res, publicUser(rows[0]), "Profile updated");
}));

app.post("/api/users/:userId/upload-image", auth, upload.single("file"), asyncHandler(async (req, res) => {
  const id = Number(req.params.userId);
  if (req.user.id !== id && req.user.role !== "ADMIN") return fail(res, 403, "Not allowed");
  if (!req.file) return fail(res, 400, "Image file is required");
  return ok(
    res,
    { fileName: req.file.originalname, size: req.file.size },
    "Image received. Configure object storage to persist it."
  );
}));

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError) return fail(res, 400, err.message);
  return fail(res, 500, "Internal server error");
});

app.listen(PORT, () => console.log(`IslamicSchool API listening on port ${PORT}`));

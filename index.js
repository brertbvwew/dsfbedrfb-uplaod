
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 4000;

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// === File Upload Endpoint ===
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ ok: true, fileUrl });
});

// === Serve Uploaded Files ===
app.use("/uploads", express.static(uploadDir));

// === Start Server ===
app.listen(port, () => {
  console.log(`✅ File uploader running at http://localhost:${port}`);
  console.log(`📂 Uploaded files available at http://localhost:${port}/uploads/`);
});

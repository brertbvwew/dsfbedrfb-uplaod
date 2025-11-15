const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");

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


// --------------------------------------------------
// 📁 FILE UPLOAD ENDPOINT
// --------------------------------------------------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ ok: true, fileUrl });
});

app.use("/uploads", express.static(uploadDir));


// --------------------------------------------------
// 🎬 IMAGE → VIDEO ENDPOINT 
// --------------------------------------------------
app.get("/image-to-video", async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send("Please provide ?url=IMAGE_URL");

    const ext = path.extname(imageUrl).split("?")[0] || ".jpg";
    const filename = `remote_${Date.now()}${ext}`;
    const imagePath = path.join(uploadDir, filename);

    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(imagePath, response.data);

    const outputFile = path.join(uploadDir, `video_${Date.now()}.mp4`);

    const cmd = `ffmpeg -loop 1 -i "${imagePath}" -t 2 -vf "fps=30,format=yuv420p,scale=1280:720" -pix_fmt yuv420p "${outputFile}" -y`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        return res.status(500).send("Video generation failed");
      }

      const videoUrl = `${req.protocol}://${req.get("host")}/uploads/${path.basename(outputFile)}`;
      res.send(`<p>✅ Video created! <a href="${videoUrl}" target="_blank">Click here to view/download</a></p>`);
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});


// --------------------------------------------------
// 🔥 MOVIE DOWNLOAD PROXY (HIDE REAL URL)
// --------------------------------------------------
// ---------------------------
// STEP 1: Generate hidden link
// ---------------------------
app.get("/api/download/:id", async (req, res) => {
  try {
    const movieId = req.params.id;
    const movieUrl = `https://cineverse.name.ng/movie/${movieId}`;

    // Fetch the movie page HTML
    const { data: html } = await axios.get(movieUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    // Find first mp4 or mkv link
    const match = html.match(/https:\/\/[^\s"'<>]+?\.(mp4|mkv)/);
    if (!match) return res.status(404).send("Download link not found");

    const realUrl = match[0];

    // Redirect directly to proxy with token
    const token = Buffer.from(realUrl).toString("base64");
    res.redirect(`/api/proxy/${token}`);

  } catch (err) {
    console.error("Download link error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------------------
// STEP 2: Proxy the actual download
// ---------------------------
app.get("/api/proxy/:token", async (req, res) => {
  try {
    const realUrl = Buffer.from(req.params.token, "base64").toString("utf8");

    // Stream file from the real URL
    const response = await axios.get(realUrl, { responseType: "stream" });

    // Set headers to force browser download
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(realUrl)}"`
    );

    response.data.pipe(res);

  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).send("Proxy Error");
  }
});



// --------------------------------------------------
// 🚀 START SERVER
// --------------------------------------------------
app.listen(port, () => {
  console.log(`Server running http://localhost:${port}`);
});

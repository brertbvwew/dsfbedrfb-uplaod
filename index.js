
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");22
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

// === File Upload Endpoint ===
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ ok: true, fileUrl });
});

// === Serve Uploaded Files ===
app.use("/uploads", express.static(uploadDir));


// === Image → Video Endpoint (File or URL) ===
app.get("/image-to-video", async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send("Please provide ?url=IMAGE_URL");

    const ext = path.extname(imageUrl).split("?")[0] || ".jpg";
    const filename = `remote_${Date.now()}${ext}`;
    const imagePath = path.join(uploadDir, filename);

    // Download image
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


// === Start Server ===
app.listen(port, () => {
  console.log(`✅ File uploader running at http://localhost:${port}`);
  console.log(`📂 Uploaded files available at http://localhost:${port}/uploads/`);
});

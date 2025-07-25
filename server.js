// server.js (FINAL - Combining Proven Verification and Correct Key Formatting)

import 'dotenv/config';
import express from 'express';
import { App } from 'octokit';
import crypto from 'crypto';
import fs from 'fs';
const app = express();
const PORT = 3000;

console.log("--- Initializing Server ---");

// --- CORRECT KEY FORMATTING, AS REQUIRED BY THE LIBRARY ---

const ghApp = new App({
  appId: process.env.APP_ID,
  privateKey: fs.readFileSync('./private-key.pem', 'utf8'),
  webhooks: {
    secret: process.env.WEBHOOK_SECRET
  },
});
let latestReadmeContent = "## README not fetched yet.";

ghApp.webhooks.on("push", async ({ octokit, payload }) => {
  console.log(`✅ Webhook event logic triggered for ${payload.repository.full_name}`);
  if (payload.ref === `refs/heads/${payload.repository.master_branch}`) {
    console.log("Fetching README.md...");
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        path: "README.md",
      });
      latestReadmeContent = Buffer.from(data.content, 'base64').toString('utf8');
      console.log("✅ Successfully fetched and updated README content.");
    } catch (error) {
      // This error should now be gone
      console.error("❌ Error fetching README:", error.message);
    }
  }
});

// Save the raw body, which is essential for our manual verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// --- MANUAL VERIFICATION HANDLER (PROVEN TO WORK) ---
app.post('/api/github/events', async (req, res) => {
  const githubSignature = req.headers["x-hub-signature-256"];
  const secret = process.env.WEBHOOK_SECRET;
  
  const hmac = crypto.createHmac("sha256", secret);
  const ourCalculatedSignature = `sha256=${hmac.update(req.rawBody).digest("hex")}`;
  
  if (githubSignature === ourCalculatedSignature) {
    console.log("✅ Manual signature verification successful!");
    
    try {
      await ghApp.webhooks.receive({
        id: req.headers["x-github-delivery"],
        name: req.headers["x-github-event"],
        payload: JSON.parse(req.rawBody.toString('utf8')),
      });
      res.status(200).send('OK');
    } catch(error) {
        console.error("❌ Error during Octokit .receive() call:", error);
        res.status(500).send("Error after successful verification.");
    }

  } else {
    console.log("❌ Manual signature verification failed!");
    res.status(400).send('Signature verification failed');
  }
});

// --- REST OF THE SERVER ---
app.get('/api/readme', (req, res) => {
  res.json({ content: latestReadmeContent });
});

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
// server.js (Final, corrected version using the modern webhook handler)

import 'dotenv/config';
import express from 'express';
import { App } from 'octokit';

const app = express();
const PORT = 3000;

// --- Octokit App Setup ---
const ghApp = new App({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  webhooks: {
    secret: process.env.WEBHOOK_SECRET
  },
});

// --- In-Memory "Database" ---
let latestReadmeContent = "## README not fetched yet.\n\nPush to the `main` branch to load it here.";

// --- Main Webhook Event Listener ---
// This part does NOT change. It's the logic that runs *after* a webhook is successfully received.
ghApp.webhooks.on("push", async ({ octokit, payload }) => {
  console.log(`--- Received a push event for repo: ${payload.repository.full_name} ---`);

  if (payload.ref === `refs/heads/${payload.repository.master_branch}`) {
    console.log(`Push to main branch detected. Fetching README.md...`);
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        path: "README.md",
      });
      const decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
      latestReadmeContent = decodedContent;
      console.log("Successfully fetched and updated README content.");
    } catch (error) {
      if (error.status === 404) {
        console.log("No README.md file found in the repository.");
        latestReadmeContent = "## No README.md file found in this repository.";
      } else {
        console.error("Error fetching README:", error);
        latestReadmeContent = "## Error fetching README file.";
      }
    }
  }
});

// --- Middleware ---
// We need express.json() to parse the request body before it reaches our route handler.
app.use(express.json());

// --- THE NEW, CORRECT WEBHOOK ROUTE HANDLER ---
// This is the endpoint that GitHub will call.
app.post('/api/github/events', async (req, res) => {
  try {
    // We manually pass the request details to Octokit for verification.
    // This method will verify the signature and then trigger the .on("push", ...)
    // listener we defined above if the event matches.
    await ghApp.webhooks.verifyAndReceive({
      id: req.headers["x-github-delivery"],
      name: req.headers["x-github-event"],
      signature: req.headers["x-hub-signature-256"],
      payload: req.body,
    });

    // If we get here, the webhook was processed successfully.
    res.status(200).send('OK');

  } catch (error) {
    // If the signature is invalid or another error occurs, we catch it here.
    console.error("Webhook verification failed:", error);
    res.status(400).send('Error processing webhook');
  }
});


// --- API Endpoint for the Frontend ---
app.get('/api/readme', (req, res) => {
  res.json({ content: latestReadmeContent });
});

// Serve our static frontend file
app.use(express.static('public'));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
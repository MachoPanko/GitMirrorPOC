// server.js

// 1. Import the Express library
const express = require('express');

// 2. Create our Express application
const app = express();
const PORT = 3000;

// This is a "middleware" that tells Express to automatically parse JSON request bodies.
// GitHub sends its webhook payload as JSON.
app.use(express.json());


// 3. A simple "in-memory database".
// In a real app, you would save this to a real database (like PostgreSQL, MongoDB, etc.).
// For our demo, we'll just use a variable to store the latest info.
let latestMergedPR = {
  title: "No PRs merged yet.",
  number: null,
  url: "#"
};


// 4. THE GITHUB WEBHOOK ENDPOINT
// This is the endpoint you will give to your GitHub App.
app.post('/api/github/events', (req, res) => {
  // IMPORTANT: In a real app, you would verify the webhook secret here!
  // We're skipping it for this simple demo to keep it focused.

  const eventType = req.headers['x-github-event'];
  const payload = req.body;

  console.log(`--- Received a webhook! Event: ${eventType} ---`);

  // Check if it's a pull request that was just closed and merged
  if (eventType === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
    console.log('A PR was merged!');
    
    // Update our "database" with the new information
    latestMergedPR = {
      title: payload.pull_request.title,
      number: payload.pull_request.number,
      url: payload.pull_request.html_url
    };

    console.log(`New status: Now showing PR #${latestMergedPR.number}`);
  }

  // Tell GitHub we received the event successfully.
  res.status(200).send('Event received.');
});


// 5. THE FRONTEND API ENDPOINT
// This is the endpoint that our HTML page will call to get the latest status.
app.get('/api/status', (req, res) => {
  console.log('Frontend requested an update. Sending latest PR info.');
  // Simply send back the data from our "database".
  res.json(latestMergedPR);
});


// 6. Serve our HTML file
// This tells the server to also host our frontend file.
app.use(express.static('public'));


// 7. Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log('Listening for GitHub webhooks at /api/github/events');
  console.log('Frontend can fetch updates from /api/status');
});
// The corrected server.js that handles both PRs and Pushes

const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

// --- CHANGE #1: The variable is now more generic ---
let latestActivity = {
  type: 'Initial',
  title: "Awaiting first event from GitHub...",
  number: null,
  url: "#"
};

app.post('/api/github/events', (req, res) => {
  const eventType = req.headers['x-github-event'];
  const payload = req.body;

  console.log(`--- Received a webhook! Event: ${eventType} ---`);

  // This part handles the Pull Request
  if (eventType === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
    console.log('A PR was merged!');
    
    latestActivity = {
      type: 'Pull Request',
      title: payload.pull_request.title,
      number: `PR #${payload.pull_request.number}`,
      url: payload.pull_request.html_url
    };
    console.log(`New status set by: ${latestActivity.number}`);
  }
  
  // --- CHANGE #2: ADDED THIS "ELSE IF" BLOCK FOR PUSHES ---
  // It checks if the event is a 'push' and if it's on the 'main' branch.
  else if (eventType === 'push' && payload.ref === 'refs/heads/main') {
    console.log('A push to main was detected!');

    const commit = payload.head_commit;
    if (commit) {
        latestActivity = {
            type: 'Push to Main',
            title: commit.message, // Use the commit message
            number: `Commit ${commit.id.substring(0, 7)}`, // Use the short commit ID
            url: commit.url
        };
        console.log(`New status set by: ${latestActivity.number}`);
    }
  }

  res.status(200).send('Event received.');
});

// This endpoint now sends the generic `latestActivity` object
app.get('/api/status', (req, res) => {
  console.log('Frontend requested an update. Sending latest activity info.');
  res.json(latestActivity);
});

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
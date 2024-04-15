const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const sharp = require('sharp'); //
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3001;
function weightedRandomIndex(weights, totalWeight) {
  let threshold = Math.random() * totalWeight;
  for (let i = 0, sum = 0; i < weights.length; i++) {
    sum += weights[i];
    if (sum >= threshold) {
      return i;
    }
  }
  return -1; // Should not be reached if weights and totalWeight are calculated correctly
}
function shuffleWithRecencyPreference(articles) {
  // Clone the articles array to avoid mutating the original data
  let articlesCopy = [...articles];

  // Sort articles by date to ensure recency
  articlesCopy.sort((a, b) => new Date(b.date) - new Date(a.date));

  let shuffledArticles = [];
  while (articlesCopy.length) {
    // Calculate weights, giving higher weight to more recent articles
    let totalWeight = 0;
    const weights = articlesCopy.map((_, index) => {
      const weight = Math.pow((articlesCopy.length - index) / articlesCopy.length, 2);
      totalWeight += weight;
      return weight;
    });

    // Select an article based on weights
    let randomIndex = weightedRandomIndex(weights, totalWeight);
    shuffledArticles.push(articlesCopy[randomIndex]);
    articlesCopy.splice(randomIndex, 1);
  }

  return shuffledArticles;
}

// Enable CORS for all routes
app.use(cors());
app.get('/api/images/:imageName', async (req, res) => {
    const { imageName } = req.params;
    const widthStr = req.query.width;
    let width = parseInt(widthStr, 10);
    if (!width || isNaN(width)) {
      width = 500; // Default width
    }
  
    const imagePath = path.join(__dirname, 'data/articles/images', imageName);
  
    try {
      if (fs.existsSync(imagePath)) {
        // Resize image using sharp with either requested or default width
        res.type(`image/${path.extname(imageName).slice(1)}`);
        sharp(imagePath)
          .resize(width)
          .pipe(res);
      } else {
        // If the image does not exist
        res.status(404).send('Image not found');
      }
    } catch (error) {
      console.log(error);
      res.status(500).send('Server error');
    }
  });
// Use morgan for logging
app.use(morgan('combined'));

app.use(express.json());



// Add this block to your existing code

// API endpoint to get the data for "issue_10" from issues.json
app.get('/api/current_issue', (req, res) => {
  // Define the path to the issues JSON file
  const issuesPath = path.join(__dirname, 'data/articles/issues.json');

  try {
    // Check if the issues file exists
    if (fs.existsSync(issuesPath)) {
      // Read the content of the issues JSON file
      const issuesData = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));

      // Find the issue with the highest number
      const issueNumbers = Object.keys(issuesData)
        .map(key => key.match(/^issue(\d+)$/)) // Extract numbers from keys like 'issue10', 'issue20', etc.
        .filter(result => result !== null) // Remove any keys that do not match
        .map(result => parseInt(result[1])) // Convert the numbers to integers
        .sort((a, b) => b - a); // Sort the numbers in descending order

      if (issueNumbers.length > 0) {
        const currentIssueKey = `issue${issueNumbers[0]}`; // Construct the key for the most recent issue
        // Send the most recent issue data as JSON
        res.json(issuesData[currentIssueKey]);
      } else {
        // If no issues are found in the data, send a 404 response
        res.status(404).send('No issues found');
      }
    } else {
      // If the issues file does not exist, send a 404 response
      res.status(404).send('Issues file not found');
    }
  } catch (error) {
    console.error(error);
    // In case of any server error, send a 500 response
    res.status(500).send('Server error');
  }
});

app.get('/api/current_crossword', (req, res) => {
  // Define the path to the crosswords JSON file
  const crosswordsPath = path.join(__dirname, 'data/crosswords/crosswords.json');

  try {
    // Check if the crosswords file exists
    if (fs.existsSync(crosswordsPath)) {
      // Read the content of the crosswords JSON file
      const crosswordsData = JSON.parse(fs.readFileSync(crosswordsPath, 'utf8'));

      // Find the crossword with the highest issue number
      const issueNumbers = Object.keys(crosswordsData)
        .map(key => key.match(/^issue(\d+)$/)) // Extract numbers from keys like 'issue10', 'issue20', etc.
        .filter(result => result !== null) // Remove any keys that do not match
        .map(result => parseInt(result[1])) // Convert the numbers to integers
        .sort((a, b) => b - a); // Sort the numbers in descending order

      if (issueNumbers.length > 0) {
        const currentCrosswordKey = `issue${issueNumbers[0]}`; // Construct the key for the most recent crossword
        // Send the most recent crossword data as JSON
        res.json(crosswordsData[currentCrosswordKey]);
      } else {
        // If no crosswords are found in the data, send a 404 response
        res.status(404).send('No crosswords found');
      }
    } else {
      // If the crosswords file does not exist, send a 404 response
      res.status(404).send('Crosswords file not found');
    }
  } catch (error) {
    console.error(error);
    // In case of any server error, send a 500 response
    res.status(500).send('Server error');
  }
});


app.get('/api/search', async (req, res) => {
  // Retrieve the search query parameter
  const { query } = req.query;

  // Check if the query parameter is provided
  if (!query) {
      return res.status(400).send('Search query is required');
  }

  // Define the path to the issues JSON file
  const issuesPath = path.join(__dirname, 'data/articles/issues.json');

  try {
    if (fs.existsSync(issuesPath)) {
      // Read the content of the issues JSON file
      const issuesData = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
      let allArticles = [];

      // Iterate through each issue
      for (const issueKey in issuesData) {
        // Iterate through each section within the issue
        for (const sectionKey in issuesData[issueKey]) {
          const articles = issuesData[issueKey][sectionKey]; // Assuming each section is an array of articles
          allArticles.push(...articles);
        }
      }

      // Log to see if allArticles is populated correctly
      console.log("allArticles Length:", allArticles.length);

      // Filter articles by checking if the title, summary, or author contains the search query
      const filteredArticles = allArticles.filter(article => {
        const titleText = article.title?.text?.toLowerCase() || ""; // Safely access title.text
        const summaryContent = article.summary?.content?.toLowerCase() || ""; 
        const authorName = article.author?.toLowerCase() || ""; // Safely access the author's name
        const queryLower = query.toLowerCase();

        return titleText.includes(queryLower) || summaryContent.includes(queryLower) || authorName.includes(queryLower);
      });

      // Return the filtered articles as JSON
      res.json(filteredArticles);
    } else {
      // If the issues file does not exist, send a 404 response
      res.status(404).send('Issues file not found');
    }
  } catch (error) {
    console.error(error);
    // In case of any server error, send a 500 response
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});


const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const sharp = require('sharp'); //

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

// Read the data file
const dataPath = path.join(__dirname, 'data/articles/articles.json');
let articlesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

app.use(express.json());

// API endpoint to get recent articles from 'new'
app.get('/api/recent', (req, res) => {
    const sortedArticles = shuffleWithRecencyPreference(articlesData.new);
    const recentArticles = sortedArticles.slice(0, 20);
    res.json(recentArticles);
});


// Add this block to your existing code

// API endpoint to get the data for "issue_10" from issues.json
app.get('/api/issues/issue_10', (req, res) => {
  // Define the path to the issues JSON file
  const issuesPath = path.join(__dirname, 'data/articles/issues.json');

  try {
    // Check if the issues file exists
    if (fs.existsSync(issuesPath)) {
      // Read the content of the issues JSON file
      const issuesData = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
      // Check if "issue_10" exists in the data
      if (issuesData.hasOwnProperty('issue_10')) {
        // Send the "issue_10" data as JSON
        res.json(issuesData['issue_10']);
      } else {
        // If "issue_10" is not found in the data, send a 404 response
        res.status(404).send('"issue_10" not found');
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


// API endpoint to get recent articles from 'athletics'
app.get('/api/sports', (req, res) => {
    const sortedArticles = shuffleWithRecencyPreference(articlesData.athletics);
    const recentArticles = sortedArticles.slice(0, 20);
    res.json(recentArticles);
});

const spellingDataPath = path.join(__dirname, 'data/spelling/spelling.json');

app.get('/api/spelling/', (req, res) => {
  res.json(spellingDataPath);
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
      let allSections = [];

      // Iterate through each issue in the issues JSON
      for (const key in issuesData) {
        if (issuesData.hasOwnProperty(key) && issuesData[key].sections) {
          // Flatten sections into a single array for easier searching
          allSections.push(...issuesData[key].sections);
        }
      }

      // Log to see if allSections is populated correctly
      console.log("allSections Length:", allSections.length);

      // Filter sections by checking if the title, summary, or other fields contain the search query
      const filteredSections = allSections.filter(section => {
        const titleText = section.title?.toLowerCase() || ""; // Safely access title
        const summaryText = section.summary?.toLowerCase() || ""; // Safely access summary
        const contentText = section.content?.toLowerCase() || ""; // Safely access content if applicable
        const queryLower = query.toLowerCase();

        return titleText.includes(queryLower) || summaryText.includes(queryLower) || contentText.includes(queryLower);
      });

      // Return the filtered sections as JSON
      res.json(filteredSections);
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



// API endpoint to get crossword puzzle
app.get('/api/crossword', (req, res) => {
    // Define the path to the crossword JSON file
    const crosswordPath = path.join(__dirname, 'data/crosswords/crossword.json');
  
    try {
      // Check if the crossword file exists
      if (fs.existsSync(crosswordPath)) {
        // Read the content of the crossword JSON file
        const crosswordData = JSON.parse(fs.readFileSync(crosswordPath, 'utf8'));
        // Send the crossword data as JSON
        res.json(crosswordData);
      } else {
        // If the crossword file does not exist, send a 404 response
        res.status(404).send('Crossword not found');
      }
    } catch (error) {
      console.error(error);
      // In case of any server error, send a 500 response
      res.status(500).send('Server error');
    }
});

// API endpoint to get an article by ID without specifying a category
app.get('/api/articles/:id', (req, res) => {
    const { id } = req.params;

    // Search for the article in both 'new' and 'athletics' categories
    let article = null;
    for (const category of ['new', 'athletics']) {
        article = articlesData[category].find(article => article.id === id);
        if (article) break; // If found, break out of the loop
    }

    if (article) {
        res.json(article);
    } else {
        res.status(404).send('Article not found');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});


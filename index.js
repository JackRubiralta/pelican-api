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

// API endpoint to get recent articles from 'athletics'
app.get('/api/sports', (req, res) => {
    const sortedArticles = shuffleWithRecencyPreference(articlesData.athletics);
    const recentArticles = sortedArticles.slice(0, 20);
    res.json(recentArticles);
});



app.get('/api/search', (req, res) => {
    // Retrieve the search query parameter
    const { query } = req.query;

    // Check if the query parameter is provided
    if (!query) {
        return res.status(400).send('Search query is required');
    }

    // Combine articles from 'new' and 'athletics' into a single array
    const allArticles = [...articlesData.new, ...articlesData.athletics];

    // Log to see if allArticles is populated correctly
    console.log("allArticles Length:", allArticles.length);

    // Filter articles by checking if the title or summary contains the search query
    // Note: This is case-insensitive search with added safety checks
    const filteredArticles = allArticles.filter(article => {
      const titleText = article.title?.text?.toLowerCase() || ""; // Safely access title.text
      // Ensure summary is a string before converting to lowercase
      const summaryText = typeof article.summary === 'string' ? article.summary.toLowerCase() : ""; 
      const queryLower = query.toLowerCase();
  
      return titleText.includes(queryLower) || summaryText.includes(queryLower);
  });

    // Return the filtered articles as JSON
    res.json(filteredArticles);
});


// API endpoint to get crossword puzzle
app.get('/api/crossword', (req, res) => {
    // Define the path to the crossword JSON file
    const crosswordPath = path.join(__dirname, 'data/crosswords/crossword1.json');
  
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


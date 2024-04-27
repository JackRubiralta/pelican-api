const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const sharp = require("sharp");
const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(morgan("combined"));

function loadCurrentIssueNumber() {
  try {
    const filePath = path.join(__dirname, "data", "current_issue_number.txt");
    return parseInt(fs.readFileSync(filePath, "utf8").trim(), 10);
  } catch (error) {
    console.error("Error reading current issue number from file:", error);
    return 10; // Default to 10 if the file is not readable
  }
}

const CURRENT_ISSUE_NUMBER = loadCurrentIssueNumber();

function weightedRandomIndex(weights, totalWeight) {
  let threshold = Math.random() * totalWeight;
  for (let i = 0, sum = 0; i < weights.length; i++) {
    sum += weights[i];
    if (sum >= threshold) {
      return i;
    }
  }
  return -1; // Should not be reached if weights are correct
}

function shuffleWithRecencyPreference(articles) {
  let articlesCopy = [...articles];
  articlesCopy.sort((a, b) => new Date(b.date) - new Date(a.date));
  let shuffledArticles = [];
  while (articlesCopy.length) {
    let totalWeight = 0;
    const weights = articlesCopy.map((_, index) => {
      const weight = Math.pow((articlesCopy.length - index) / articlesCopy.length, 2);
      totalWeight += weight;
      return weight;
    });
    let randomIndex = weightedRandomIndex(weights, totalWeight);
    shuffledArticles.push(articlesCopy[randomIndex]);
    articlesCopy.splice(randomIndex, 1);
  }
  return shuffledArticles;
}

app.get("/api/images/:imageName", async (req, res) => {
  const { imageName } = req.params;
  const widthStr = req.query.width;
  let width = parseInt(widthStr, 10);
  width = isNaN(width) ? 500 : width; // Default width to 500 if not specified or invalid

  const imagePath = path.join(__dirname, "data", "images", imageName); // Updated path

  try {
    if (fs.existsSync(imagePath)) {
      res.type(`image/${path.extname(imageName).slice(1)}`); // Set the content type based on file extension
      sharp(imagePath).resize(width).pipe(res); // Resize image using Sharp and stream to response
    } else {
      res.status(404).send("Image not found"); // Image not found
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error"); // Handle server errors
  }
});


app.get("/api/current_issue_number", (req, res) => {
  res.json({ currentIssueNumber: CURRENT_ISSUE_NUMBER });
});

app.get("/api/current_issue", (req, res) => {
  const issueDirectory = `issue${CURRENT_ISSUE_NUMBER}`;
  const issuesPath = path.join(__dirname, "data", issueDirectory, "articles.json");

  try {
    if (fs.existsSync(issuesPath)) {
      const currentIssueData = JSON.parse(fs.readFileSync(issuesPath, "utf8"));
      res.json(currentIssueData);
    } else {
      res.status(404).send("Issues file not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.get("/api/current_connections", (req, res) => {
  const issueDirectory = `issue${CURRENT_ISSUE_NUMBER}`;
  const connectionsPath = path.join(__dirname, "data", issueDirectory, "connections.json");

  try {
    if (fs.existsSync(connectionsPath)) {
      const connectionsData = JSON.parse(fs.readFileSync(connectionsPath, "utf8"));
      res.json(connectionsData);
    } else {
      res.status(404).send("Connections file not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

app.get("/api/current_crossword", (req, res) => {
  const issueDirectory = `issue${CURRENT_ISSUE_NUMBER}`;
  const crosswordsPath = path.join(__dirname, "data", issueDirectory, "crossword.json");

  try {
    if (fs.existsSync(crosswordsPath)) {
      const crosswordData = JSON.parse(fs.readFileSync(crosswordsPath, "utf8"));
      res.json(crosswordData);
    } else {
      res.status(404).send("Crosswords file not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});


// Helper function to read all articles from all issues
async function getAllArticles() {
  const issuesDir = path.join(__dirname, 'data');
  const directories = fs.readdirSync(issuesDir).filter(file => fs.statSync(path.join(issuesDir, file)).isDirectory());

  let allArticles = [];
  directories.forEach(dir => {
      const articlesPath = path.join(issuesDir, dir, 'articles.json');
      if (fs.existsSync(articlesPath)) {
          const data = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
          Object.values(data).forEach(section => allArticles = allArticles.concat(section));
      }
  });
  return allArticles;
}

// Search function to filter articles by search terms
function searchArticles(articles, terms) {
  const searchTerm = terms.toLowerCase();
  return articles.filter(article => {
      return article.title.text.toLowerCase().includes(searchTerm) ||
             (article.summary && article.summary.content.toLowerCase().includes(searchTerm)) ||
             article.author.toLowerCase().includes(searchTerm);
  });
}

// API endpoint for searching articles
app.get('/api/search/:searchTerms', async (req, res) => {
  try {
      const allArticles = await getAllArticles();
      const searchResults = searchArticles(allArticles, req.params.searchTerms);
      res.json(searchResults);
  } catch (error) {
      console.error('Error during search:', error);
      res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

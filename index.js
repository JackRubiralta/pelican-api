const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const sharp = require('sharp'); //

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.get('/api/images/:imageName', async (req, res) => {
    const { imageName } = req.params;
    const widthStr = req.query.width;
    let width = parseInt(widthStr, 10);
    if (!width || isNaN(width)) {
      width = 500; // Default width
    }
  
    const imagePath = path.join(__dirname, 'images', imageName);
  
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
const dataPath = path.join(__dirname, 'data.json');
let articlesData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

app.use(express.json());

// API endpoint to get recent articles from 'new'
app.get('/api/recent', (req, res) => {
    const sortedArticles = articlesData.new.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentArticles = sortedArticles.slice(0, 20);
    res.json(recentArticles);
});

// API endpoint to get recent articles from 'athletics'
app.get('/api/sports', (req, res) => {
    const sortedArticles = articlesData.athletics.sort((a, b) => new Date(b.date) - new Date(a.date));
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

/*
app.post('/api/addArticle', (req, res) => {
    const { category, article } = req.body; // Expect category and article in the body

    if (!category || !article) {
        return res.status(400).send('Category and article data are required');
    }

    if (!['new', 'athletics'].includes(category)) {
        return res.status(400).send('Invalid category');
    }

    // Generate a unique ID for the new article
    const newId = Date.now().toString(); // Example ID generation strategy
    const newArticle = { id: newId, ...article };

    articlesData[category].push(newArticle);

    // Write the updated articlesData back to data.json
    fs.writeFileSync(dataPath, JSON.stringify(articlesData, null, 2));

    res.status(201).send('Article added successfully');
});

const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

app.post('/api/uploadImage', (req, res) => {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, 'images');
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(500).send('Server error during image upload');
        }

        const oldPath = files.image.filepath;
        const newPath = path.join(form.uploadDir, files.image.originalFilename);

        fs.rename(oldPath, newPath, (err) => {
            if (err) return res.status(500).send('Server error during file saving');

            res.status(200).send('Image uploaded successfully');
        });
    });
});
*/

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});


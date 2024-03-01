// index.js
const APP        = require("./routes");
const BODY_PARSER = require('body-parser');
const EJS        = require("ejs");
const USER       = require("./schema");
const RECIPE     = require("./recipeSchema");
const PORT       = 3000;


APP.listen(PORT);
console.log('See where it all happens at http://localhost:'+PORT);
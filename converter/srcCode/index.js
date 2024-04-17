// index.js
const APP        = require("../srcCode/routes/routes");
const BODY_PARSER = require('body-parser');
const EJS        = require("ejs");
const USER       = require("./src/models/schema");
const RECIPE     = require("./src/models/recipeSchema");
const PORT       = 3000;


APP.listen(PORT);
console.log('See where it all happens at http://localhost:'+PORT);

//module.exports = EXECUTION_APP;
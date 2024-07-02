const MONGOOSE              = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate          = require("mongoose-findorcreate");
const { faker }             = require('@faker-js/faker');
const {User, insertUsersToMongoDB}= require("./schema");
const { default: mongoose } = require("mongoose");

// Connect to MongoDB
const uri = 'mongodb://127.0.0.1:27017/RecipesUsers';

async function connectToDatabase() {
  try {
    await MONGOOSE.connect(uri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

// Define Recipe schema
const recipeSchema = new MONGOOSE.Schema({
  email_id        : { type: String, required: true, unique : false },
  username        : { type: String, required: true, unique : false },
  title           : { type: String, required: true, unique : false },
  description     : { type: String, required: true, unique : false },
  prep_time       : { type: String, required: true, unique : false },
  cook_time       : { type: String, required: true, unique : false },
  difficulty_level: { type: Number, required: true, unique : false },
  cuisine         : { type: String, required: true, unique : false },
  visibility      : { type: String, required: true, unique : false },
  ingredients     : { type: String, required: true, unique : false },
  instructions    : { type: String, required: true, unique : false },
  added_image_url : { type: String, required: false, unique: true },
  average_rating  : { type: Number, required: false, unique: false },
});

recipeSchema.index({ title: 'text', ingredients: 'text' });

recipeSchema.plugin(passportLocalMongoose);
recipeSchema.plugin(findOrCreate);

// Create Recipe model
const Recipe = MONGOOSE.model('Recipe', recipeSchema);

// Function to create a random recipe
function createRandomRecipe(username, email) {
  return {
    email_id: email,
    username: username,
    title: faker.lorem.words(3),
    description: faker.lorem.sentences(2),
    prep_time: `${faker.number.int({ min: 10, max: 60 })} minutes`,
    cook_time: `${faker.number.int({ min: 10, max: 120 })} minutes`,
    difficulty_level: faker.number.int({ min: 1, max: 5 }),
    cuisine: faker.lorem.word(),
    visibility: 'public',
    ingredients: faker.lorem.sentences(3),
    instructions: faker.lorem.paragraphs(2),
    added_image_url: faker.image.urlLoremFlickr({ category: 'food' }) + '?' + faker.string.uuid(),
    average_rating: faker.number.float({ min: 1, max: 5, multipleOf: 0.1 }),
  };
}

// Generate an array of 5 random recipes
const RECIPES = Array.from({ length: 500 }, createRandomRecipe);

async function insertRecipesToMongoDB() {
  try {
    await connectToDatabase();
    const users = await User.find();
    const userPairs = users.map(user => ({
      username: user.username,
      email: user.email
  }));
    
    // Generate random recipes with matching usernames
    const RECIPES = userPairs.map(({username, email}) => createRandomRecipe(username, email));
    const result = await Recipe.insertMany(RECIPES);

    console.log(`${result.length} recipes were inserted`);
  } catch (error) {
    console.error("Error inserting recipes:", error);
  } finally {
    await MONGOOSE.connection.close();
  }
}

//insertUsersToMongoDB().catch(console.error);
//insertRecipesToMongoDB().catch(console.error);

module.exports = Recipe;
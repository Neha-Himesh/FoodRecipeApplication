const MONGOOSE                = require("mongoose");
const PASSPORT_LOCAL_MONGOOSE = require("passport-local-mongoose");
var findOrCreate              = require("mongoose-findorcreate");
const { faker }             = require('@faker-js/faker');
//db.users.dropIndex("username_1");
const uri = "mongodb://127.0.0.1:27017/RecipesUsers";

async function connectToDatabase() {
    try {
      await MONGOOSE.connect(uri);
      console.log("Connected to MongoDB");
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      process.exit(1);
    }
  }

// Define User schema
const userSchema = new MONGOOSE.Schema({
    username    : {type: String, required: true, unique: true},
    first_name  : {type : String, required: true, unique : false },
    last_name   : { type: String, required: true, unique : false },
    country_name: {type : String, required: true, unique : false},
    city_name   : {type : String, required: true, unique : false},
    dob         : {type : Date, required  : true, unique : false},
    email       : { type: String, required: true, unique : true },
    password    : { type: String, required: true },
    token       : {type : String, required: false, unique: true},
    token_expiry: {type : Date, required: false, unique: false},
 
});
userSchema.plugin(PASSPORT_LOCAL_MONGOOSE);
userSchema.plugin(findOrCreate);
// Create User model
const User = MONGOOSE.model('User', userSchema);

function generatePassword() {
    const length = 20;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$%^&*()~_`/?><.,";
    let password = "";
    let hasUpper = false;
    let hasLower = false;
    let hasSpecial = false;
  
    while (password.length < length || !hasUpper || !hasLower || !hasSpecial) {
      const char = charset[Math.floor(Math.random() * charset.length)];
      password += char;
      if (/[A-Z]/.test(char)) hasUpper = true;
      if (/[a-z]/.test(char)) hasLower = true;
      if (/[^a-zA-Z0-9]/.test(char)) hasSpecial = true;
    }
    return password;
  }

// Function to create a random recipe
function createRandomUsers() {
    return {
      username: faker.internet.userName(),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      country_name: faker.location.country(),
      city_name: faker.location.city(),
      dob: faker.date.past({years: 30, refDate: '2001-01-01T00:00:00.000Z' }),
      email: faker.internet.email(),
      password: generatePassword(),
      token: faker.string.uuid(),
      token_expiry: faker.date.future(),
    };
  }
  
  // Generate an array of 5 random recipes
  const USERS = Array.from({ length: 250 }, createRandomUsers);
  
  async function insertUsersToMongoDB() {
    try {
      await connectToDatabase();
      const result = await User.insertMany(USERS);
      console.log(`${result.length} users were inserted`);
    }  catch (error) {
      console.error("Error inserting users:", error);
    } 
  }
  
module.exports = {User, insertUsersToMongoDB};
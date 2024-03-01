const MONGOOSE                = require("mongoose");
const PASSPORT_LOCAL_MONGOOSE = require("passport-local-mongoose");
var findOrCreate              = require("mongoose-findorcreate");

//db.users.dropIndex("username_1");
MONGOOSE.connect("mongodb://127.0.0.1:27017/RecipesUsers");

// Define User schema
const RECIPE_SCHEMA = new MONGOOSE.Schema({
    email_id        : {type: String, required: true, unique : false },
    username        : {type: String, required: true, unique : false },
    title           : {type: String, required: true, unique : false },
    description     : {type: String, required: true, unique : false },
    prep_time       : {type: String, required: true, unique : false },
    cook_time       : {type: String, required: true, unique : false },
    difficulty_level: {type: Number, required: true, unique : false },
    cuisine         : {type: String, required: true, unique : false },
    visibility      : {type: String, required: true, unique : false },
    ingredients     : {type: String, required: true, unique : false },
    instructions    : {type: String, required: true, unique : false },
    //added_image_url : {type: String, required: false, unique : true },
    average_rating  : {type: Number, required: false, unique : false },
    
});
RECIPE_SCHEMA.plugin(PASSPORT_LOCAL_MONGOOSE);
RECIPE_SCHEMA.plugin(findOrCreate);
// Create User model
const RECIPE = MONGOOSE.model('Recipe', RECIPE_SCHEMA);

module.exports = RECIPE;
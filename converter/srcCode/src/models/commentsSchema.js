const MONGOOSE                = require("mongoose");
const PASSPORT_LOCAL_MONGOOSE = require("passport-local-mongoose");
var findOrCreate              = require("mongoose-findorcreate");


MONGOOSE.connect("mongodb://127.0.0.1:27017/RecipesUsers");

const REPLY_SCHEMA = new MONGOOSE.Schema({
    content          : {type: String, required    : true, unique : false },
    timestamp        : {type: Date, required      : true, unique : false },
    parent_comment_id: {type: String, required    : false, unique: false },
    recipe_id        : {type: String, required    : true, unique : false },
    username         : {type: String, required    : true, unique : false },
    child_comment_id : {type: String, required    : false, unique: false },
    likes            : {type: Number, required    : true, unique : false },
    replies          : {type: [this], default: []},
});

// Define User schema
const COMMENTS_SCHEMA = new MONGOOSE.Schema({
    content          : {type: String, required    : true, unique : false },
    timestamp        : {type: Date, required      : true, unique : false },
    parent_comment_id: {type: String, required    : false, unique: false },
    recipe_id        : {type: String, required    : true, unique : false },
    username         : {type: String, required    : true, unique : false },
    child_comment_id : {type: String, required    : false, unique: false },
    likes            : {type: Number, required    : true, unique : false },
    replies          : { type: [REPLY_SCHEMA], default: [] }
});

COMMENTS_SCHEMA.plugin(PASSPORT_LOCAL_MONGOOSE);
COMMENTS_SCHEMA.plugin(findOrCreate);
// Create User model
const COMMENTS = MONGOOSE.model('Comments', COMMENTS_SCHEMA);

module.exports = COMMENTS;
const MONGOOSE                = require("mongoose");
const PASSPORT_LOCAL_MONGOOSE = require("passport-local-mongoose");
var findOrCreate              = require("mongoose-findorcreate");

//db.users.dropIndex("username_1");
MONGOOSE.connect("mongodb://127.0.0.1:27017/RecipesUsers");

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
const USER = MONGOOSE.model('User', userSchema);

module.exports = USER;
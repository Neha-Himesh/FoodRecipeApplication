
const EXPRESS                    = require('express');
const APP                        = EXPRESS();
const SESSION                    = require('express-session');
const PASSPORT                   = require('passport');
const LOCAL_STRATEGY             = require('passport-local').Strategy;
const BODY_PARSER                 = require('body-parser');
const USER                       = require("./schema");
const RECIPE                     = require("./recipeSchema");
const { body, VALIDATION_RESULT } = require('express-validator');
const BCRYPT                     = require('bcrypt');
const { GENERATE_TOKEN }          = require('./cryptoGenerateToken');
const { SEND_EMAIL }              = require('./reminderService');
const { STORAGE }                = require('@google-cloud/storage');
const PATH                       = require('path');
const MULTER                     = require('multer');
const STORAGE                    = MULTER.memoryStorage();
const UPLOAD                     = MULTER({ storage: STORAGE });
const FLASH                      = require('express-flash');
const STORAGE_CLIENT              = new STORAGE({
    projectId                    : process.env.projectId,
    keyFilename                  : process.env.keyFilename // Replace with your service account key file
  });
const BUCKET                     = STORAGE_CLIENT.BUCKET('food_recipe_bucket');

APP.use(EXPRESS.static("public"));
APP.use(BODY_PARSER.urlencoded({ extended: false }));
APP.use(BODY_PARSER.json());

// Set up session middleware
APP.use(SESSION({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false
}));

// Initialize Passport
APP.use(PASSPORT.initialize());
APP.use(PASSPORT.SESSION());


// Configure the local strategy for Passport
PASSPORT.use(new LocalStrategy({
    usernameField: 'login_email', // Assuming email is used for login
    passwordField: 'login_password'
}, async (email, password, done) => {
    try {
        const user = await USER.findOne({ email: email });
        if (!user) {
            return done(null, false, { message: 'Invalid email' });
        }
        const isValidPassword = await BCRYPT.compare(password, user.password);
        if (!isValidPassword) {
            return done(null, false, { message: 'Invalid password' });
        }
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

// Serialize and deserialize user for session management
PASSPORT.serializeUser((user, done) => {
    done(null, user.id);
});

PASSPORT.deserializeUser(async (id, done) => {
    try {
        const user = await USER.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

APP.get("/",function(req,res){
	res.render("home.ejs");
});



APP.get("/register", function(req,res){
    res.render("register.ejs");
}); 

APP.get("/login", function(req, res){
    res.render("login.ejs");
});

APP.get("/forgotPasswordPage", function(req, res){
    res.render("forgotPasswordPage.ejs");
});

APP.get("/homepageAfterLogin", function(req,res){
    if (req.isAuthenticated()){
        req.SESSION.user = req.user;
        res.render("homePageAfterLogin.ejs");
    } else{
        res.render("login.ejs");
    }
   
});

APP.get("/addANewRecipePage", function(req, res){
    if(req.isAuthenticated()){
        res.render("addANewRecipePage.ejs");
    } else {
        res.render("login.ejs");
    }
    
});

APP.get("/myRecipes", async function(req, res){
    if(req.isAuthenticated()){
        const myRecipes = await RECIPE.find({email_id : req.SESSION.user.email});
        const recipeDetails = [];
        if (myRecipes){
            //declare variable and see what to be done 
            for(var i = 0; i < myRecipes.length; i ++){
                const recipe ={
                    id: myRecipes[i]._id,
                    imageURL: myRecipes[i].added_image_url,
                    title: myRecipes[i].title
                };
               recipeDetails.push(recipe);
            }
        }
        //console.log(myRecipes[0]);
        res.render("myRecipes.ejs",{recipeDetails});
    } else {
        res.render("login.ejs");
    }
    
});


APP.post('/register',

    body('first_name').notEmpty().withMessage('First name is required'),

    body('last_name').notEmpty().withMessage('Last name is required'),

    body('country_name').notEmpty().withMessage('Country is required'),

    body('city_name').notEmpty().withMessage('City is required'),

    body('dob').isDate().withMessage('Invalid date of birth'),

    body('email').isEmail().normalizeEmail({gmail_remove_dots: false}).custom(async value => {
        const user = await USER.find({
            email: value
        });
        if (user.length > 0) {
            return Promise.reject("Email already in use");
        }
    }),

    body('username').notEmpty().withMessage('Username is required').custom(async value => {
        const hasCapitalAlphabet = /[A-Z]/.test(value);
        const hasMentionedSpecialCharacter = /[ `!@#$%^&*()+\-=\[\]{};':"\\|,<>\/?~]/.test(value);
        const isValidLength = value.length >= 4;
        const user = await USER.find({
            username: value
        });
        if (hasMentionedSpecialCharacter){
            throw new Error ('Username should have only _ or . as special characters');
        } else if (!isValidLength) {
            throw new Error ('Username should have min. of 4 characters');
        } else if (hasCapitalAlphabet){
            throw new Error ('Username should have only small letters');
        } else if (user.length > 0){
            return Promise.reject("Username already in use. Please enter different username");
        }
        else {
            return true;
        }
    }),

    body('password').notEmpty().withMessage('New password is required').custom((value, {req}) => {
        const hasNumber = /\d/.test(value);
        const hasAlphabet = /[a-zA-Z]/.test(value);
        const hasSpecialCharacter = /[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(value);
        const isValidLength = value.length >= 8;
        if (hasNumber && hasAlphabet && hasSpecialCharacter && isValidLength) {
            return true;
        } else {
            throw new Error('Password should have min. 8 characters and should have min. 1 alphabet, 1 number and 1 special character');
        }
    }),

    body('password-repeat').custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
    }),

    async (req, res) => {
        // Validate incoming input
        const errors = VALIDATION_RESULT(req);
        if (!errors.isEmpty()) {
            return res.send({ error: errors.array() }); 
        }

        try {
            // Registration is successful, handle it here
            const { first_name, last_name, country_name, city_name, dob, email, username, password } = req.body;
            const saltRounds = 10;

            // Hash the password
            const hashedPassword = await BCRYPT.hash(password, saltRounds);

            // Create a new user with the hashed password
            const newUser = new USER({
                first_name,
                last_name, 
                country_name, 
                city_name, 
                dob,
                email,
                username,
                password: hashedPassword,
                 // Set the hashed password
            });

            // Save the new user to the database
            await newUser.save();
            //const findTheAboveUser = await USER.findOne({email : email });
            // Send a success response
            res.status(200).send("Registration successful. Please login with the registered email id");
        } catch (error) {
            // Handle any errors that occur during registration
            console.error("Error during registration:", error.message);
            res.status(500).send("Internal Server Error");
        }
    });

APP.post("/login",
    body('login_email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage("Please enter valid email address"),
    body('login_password').notEmpty().withMessage('Password is required'),

    PASSPORT.authenticate('local', {
        successRedirect: '/homePageAfterLogin', // Redirect to home page on successful login
        failureRedirect: '/login', // Redirect back to login page on failure
        //failureFlash: true // Enable flash messages for failed login attempts
    }), 
    (req, res) =>{
        req.SESSION.user = req.user; // Store user details in session
        res.redirect('/homePageAfterLogin'); // Redirect to home page
    }
); 
APP.post("/forgotPassword", async function(req,res){
    const enteredEmailId = req.body.forgot_password_page_email;
    const userEnteredEmailidVerification = await USER.findOne({email: enteredEmailId});
    if (userEnteredEmailidVerification){
        const token = GENERATE_TOKEN();
        const message = 'Hi, this is system generated email. Please enter the below token in the Create New Password page to reset the password (The token is only valid for 10 minutes):  '+ token;
        const emailSent = await SEND_EMAIL(enteredEmailId, message, token);
        if (emailSent){
            console.log('Password reset token has been sent to the email address.')
            const userUpdatedData = await USER.updateOne( 
                { email: enteredEmailId},
                {$set: {
                    token: token,
                    token_expiry: new  Date(Date.now() + (0.167 * 60 * 60 * 1000)),
                   }
                }    
            );
            if (userUpdatedData){
                console.log('Token and token_expiry updated successfully');
                res.render("createnewPasswordPage.ejs",{userEnteredEmailId: enteredEmailId} );
            } else {
                console.log('The token and token_expiry could not be updated in the database');
                res.render("forgotPasswordPage.ejs");
            }
        } else {
            console.error('Error occurred: Email could not be sent, try again');
            res.render("forgotPasswordPage.ejs");
        }
    } else{
        console.error('The entered email Id doesnt exist. Please enter valid email id');
        res.render("forgotPasswordPage.ejs");
    }
   

});


APP.post("/createNewPassword",
    body('create_new_password_page_token').notEmpty().withMessage('Token is required'),

    body('create_new_password_page_new_password').notEmpty().withMessage('New password is required').custom((value, {req}) => {
        const hasNumber = /\d/.test(value);
        const hasAlphabet = /[a-zA-Z]/.test(value);
        const hasSpecialCharacter = /[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(value);
        const isValidLength = value.length >= 8;
        if (hasNumber && hasAlphabet && hasSpecialCharacter && isValidLength) {
            return true;
        } else {
            throw new Error('Password should have min. 8 characters and should have min. 1 alphabet, 1 number and 1 special character');
        }
    }),

    body('create_new_password_page_confirm_password').custom((value, { req }) => {
        if (value !== req.body.create_new_password_page_new_password) {
          throw new Error('Passwords do not match');
        }
        return true;
    }), 
    async function(req,res){
        const errors = VALIDATION_RESULT(req);
        if (!errors.isEmpty()) {
            return res.send({ error: errors.array() }); 
        } else {
            console.log(req.body.create_new_password_page_token);
            const enteredToken = req.body.create_new_password_page_token;
            const verificationOfEnteredToken = await USER.findOne({token: enteredToken});
            console.log(verificationOfEnteredToken);
            if(verificationOfEnteredToken){
                console.log('Document: ' + verificationOfEnteredToken);
                //console.log(new  Date(Date.now() + (0.83 * 60 * 60 * 1000)));
                if (verificationOfEnteredToken.token_expiry > new Date()){
                    const saltRounds = 10;
                    const hashedPassword = await BCRYPT.hash(req.body.create_new_password_page_new_password, saltRounds);
                    const updatedPassword = await USER.updateOne({ token: enteredToken }, {password: hashedPassword});
                    if(updatedPassword){
                        console.log("Password updated successfully.Login with new password");
                        //res.json({success: true, message:"Password updated successfully. Login with new password"});
                        verificationOfEnteredToken.token = null;
                        verificationOfEnteredToken.token_expiry = null;
                        res.render("login.ejs");
                    }else{
                        console.log("Error in password updation");
                        console.error("Error in password updation");
                    }
                } else {
                    console.error("Token expired. Please create generate a new token");
                    verificationOfEnteredToken.token = null;
                    verificationOfEnteredToken.token_expiry = null;
                    res.render("forgotPasswordPage.ejs");
                }
            } else{
                console.error("Token entered doesnt exist. Please re-generate the token.");
                res.render("forgotpasswordPage.ejs");
            }
        }
        
});

APP.post("/addNewRecipe",

  UPLOAD.single('new_recipe_image_upload'),

  body('new_recipe_name').notEmpty().withMessage('Recipe name is required'),

  body('new_recipe_description').notEmpty().withMessage('Recipe description is required'),

  body('new_recipe_preparation_time').notEmpty().withMessage("Recipe's preparation time is required"),

  body('new_recipe_cooking_time').notEmpty().withMessage("Recipe's cooking time is required"),

  body('new_recipe_difficulty_level').notEmpty().withMessage("Recipe's difficulty level is required"),

  body('new_recipe_cuisine').notEmpty().withMessage("Recipe's cuisine name is required"),

  body('new_recipe_visibility').notEmpty().withMessage("Recipe's visibility details is required"),

  body('new_recipe_ingredients').notEmpty().withMessage("Recipe's ingredients are required"),

  body('new_recipe_instructions').notEmpty().withMessage("Recipe's instructions are required"),
 
  async function(req, res){
    
    const errors = VALIDATION_RESULT(req);
    if (!errors.isEmpty()) {
        return res.send({ error: errors.array() }); 
    }
    try{
        console.log(req.body);
        console.log("uploaded file", req.file);
        const file = req.file;
        const fileName = Date.now() + '-' + file.originalname;
        const blob = BUCKET.file(fileName);
        const blobStream = blob.createWriteStream();
            
        blobStream.on('error', (err) => {
            console.error(err);
            res.status(500).send('Error uploading file to GCS');
        });
            
        blobStream.on('finish', async () => {
              // Store image URL in MongoDB
            const added_image_url = `https://storage.googleapis.com/${BUCKET.name}/${blob.name}`;
            console.log("Url of stored image in GCP is added successfully");
            console.log("Req.user", req.SESSION.user);  
              // Save recipe data to MongoDB
            const newRecipe = new RECIPE({
                title : req.body.new_recipe_name,
                description : req.body.new_recipe_description,
                prep_time : req.body.new_recipe_preparation_time,
                cook_time : req.body.new_recipe_cooking_time,
                difficulty_level : req.body.new_recipe_difficulty_level,
                cuisine : req.body.new_recipe_cuisine,
                visibility : req.body.new_recipe_visibility, 
                ingredients : req.body.new_recipe_ingredients,
                instructions : req.body.new_recipe_instructions,
                added_image_url : added_image_url,
                email_id : req.SESSION.user.email,
                username : req.SESSION.user.username,
            });
            
            try{
                const savedRecipeDetails = await newRecipe.save();
                if (savedRecipeDetails){
                res.status(200).send('File uploaded successfully and data stored in MongoDB');
                }
            }
            catch(err){
                console.error(err);
                await deleteImageFromGCS(BUCKET, fileName);
                res.status(500).send('Internal server error')
            }
               
        });  
            
            blobStream.end(file.buffer);
        } catch(err){
            console.error(err);
          
            res.status(500).send('Internal server error');

          }   
    });

async function deleteImageFromGCS(BUCKET, fileName) {
    try {
        await BUCKET.file(fileName).delete();
        console.log(`Image ${fileName} deleted successfully from GCS`);
    } catch(err) {
        console.error(`Error deleting image ${fileName} from GCS:`, err);
    }
}   


/*APP.post("/login",
    body('login_email').isEmail().normalizeEmail({gmail_remove_dots: false}).withMessage("Please enter valid email address"),
    body('login_password').notEmpty().withMessage('Password is required'),
    
    async(req,res) =>{
        const errors = VALIDATION_RESULT(req);
        if (!errors.isEmpty()) {
            return res.send({error: errors.array()}); 
        }
        console.log(req.body);
        const {login_email, login_password} = req.body;
        
        try {
            const user = await USER.findOne({ email: login_email});
            console.log(user);
            if (!user) {
              // No user found with provided email and password
              res.status(401).send('Invalid email');
              return;
            }
            else{
                BCRYPT.compare(login_password, user.password, function(err, result) {
                    if (err) {
                        console.error('Error comparing passwords:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }
            
                    if (result) {
                        // Passwords match, proceed with login
                        // Example: generateJWTToken(user.id)
                        //res.status(200).json({ message: 'Login successful' });
                        res.render("homePageAfterLogin.ejs");
                    } else {
                        // Passwords don't match, deny login
                        res.status(401).json({ error: 'Invalid credentials' });
                    }
                });
            }    
          } catch (error) {
            console.error('Error finding user:', error);
            res.status(500).send('Internal Server Error');
          }
    
    }); */
          

module.exports = APP;    

const EXPRESS                      = require('express');
const APP                          = EXPRESS();
const SESSION                      = require('express-session');
const PASSPORT                     = require('passport');
const sanitizeHtml                 = require('sanitize-html');
const LOCAL_STRATEGY               = require('passport-local').Strategy;
const BODY_PARSER                  = require('body-parser');
const {User, insertUsersToMongoDB} = require("../src/models/schema");
const RECIPE                       = require("../src/models/recipeSchema");
const COMMENTS                     = require('../src/models/commentsSchema')
const { body, validationResult }   = require('express-validator');
const BCRYPT                       = require('bcrypt');
const { generateToken }            = require('../cryptoGenerateToken');
const { faker }                    = require('@faker-js/faker');
const { sendEmail }                = require('../emailGenerationService');
const { Storage }                  = require('@google-cloud/storage');
const PATH                         = require('path');
const MULTER                       = require('multer');
const STORAGE                      = MULTER.memoryStorage();
const UPLOAD                       = MULTER({ storage: STORAGE });
const FLASH                        = require('express-flash');
const STORAGE_CLIENT               = new Storage({
    projectId                      : process.env.projectId,
    keyFilename                    : process.env.keyFilename // Replace with your service account key file
  });
const BUCKET                       = STORAGE_CLIENT.bucket('food_recipe_bucket');

APP.set('views', 'D:\\D\\Food Recipes Project\\converter\\srcCode\\src\\views');

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
APP.use(PASSPORT.session());


// Configure the local strategy for Passport
PASSPORT.use(new LOCAL_STRATEGY({
    usernameField: 'login_email', // Assuming email is used for login
    passwordField: 'login_password'
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ email: email });
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
        const user = await User.findById(id);
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

APP.get('/logout', function(req, res){
    req.logout((err) => {
        if (err) {
          console.error("Error logging out:", err);
          return next(err);
        }
        res.redirect('/');
     // Redirect to home page or login page
    }); 
});

APP.get("/forgot-password-page", function(req, res){
    res.render("forgotPasswordPage.ejs");
});

APP.get("/home-page-after-login", function(req,res){
    if (req.isAuthenticated()){
        req.session.user = req.user;
        res.render("homePageAfterLogin.ejs", {loggedInUsername : req.session.user.username});
    } else{
        res.render("login.ejs");
    }
   
});

APP.get("/add-a-new-recipe-page", function(req, res){
    if(req.isAuthenticated()){
        res.render("addANewRecipePage.ejs");
    } else {
        res.render("login.ejs");
    }
    
});

APP.get("/my-recipes", async function(req, res){
    if(req.isAuthenticated()){
        const myRecipes = await RECIPE.find({email_id : req.session.user.email});
        const recipeDetails = [];
        if (myRecipes){
            //declare variable and see what to be done 
            for(var i = 0; i < myRecipes.length; i ++){
                const recipe ={
                    id: myRecipes[i]._id,
                    imageURL: myRecipes[i].added_image_url,
                    title: myRecipes[i].title,
                };
               recipeDetails.push(recipe);
               console.log(myRecipes[i].added_image_url);
               //console.log(myRecipes[i].title);
            }
            console.log(recipeDetails);
        }
        //console.log(myRecipes[0]);
        res.render("myRecipes.ejs",{recipeDetails : recipeDetails});
    } else {
        res.render("login.ejs");
    }
    
});

APP.get('/clicked-recipe/:id', async function(req,res){
    if (req.isAuthenticated()) {
        try {
            const usernameDetailsOfLoggedInUser = req.session.user.username;
            const clickedRecipeDetails = await RECIPE.findById(req.params.id);
            const commentsDetails = await COMMENTS.find({recipe_id: req.params.id});
            if (clickedRecipeDetails) {
                if (commentsDetails){
                    function countReplies(replies){
                        if (!Array.isArray(replies)) {
                            return 0;
                        }
                        let totalCount = replies.length;
                        commentsDetails.replies.forEach(reply =>{
                        totalCount = totalCount + countReplies(reply.replies);
                    });
                    return totalCount;
                    }
                    function countLikes(likes){
                        if (!Array.isArray(likes)) {
                            return 0;
                        }
                        var totalCount = likes.length;
                        return totalCount;
                    }
                    
                    const totalRepliesCount = countReplies(commentsDetails.replies);
                    //console.log(totalRepliesCount);
                    const totalLikesCount = countLikes(commentsDetails.likes);
                    res.render("clickedRecipeDetails.ejs", { clickedRecipeDetails: clickedRecipeDetails, commentsDetails: commentsDetails, commentTotalRepliesCount: totalRepliesCount, commentTotalLikesCount: totalLikesCount, loggedInUsernameDetails: usernameDetailsOfLoggedInUser });
                }
                else{
                    console.log("No comments to display");
                    res.render("clickedRecipeDetails.ejs", { clickedRecipeDetails: clickedRecipeDetails, loggedInUsernameDetails: usernameDetailsOfLoggedInUser });
                }
            } else {
                res.status(404).send("Recipe Details not found");
            }
        } catch (error) {
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        // Handle authentication failure
        res.status(401).send("Unauthorized");
    }
});

APP.post('/home-page-after-login/search', async function (req, res) {
    if (req.isAuthenticated()) {
        const keywordsTyped = req.body.home_page_after_login_search_box;
        const stopwords = new Set(["a", "an", "the", "in", "is", "for", "be", "but"]);

        // Tokenize and remove stopwords
        function tokenize(text) {
            return text.toLowerCase().split(/\W+/).filter(token => token.length > 0);
        }

        function removeStopwords(tokens) {
            return tokens.filter(token => !stopwords.has(token));
        }

        const tokenizedText = tokenize(keywordsTyped);
        const stopWordsRemovedTokens = removeStopwords(tokenizedText);

        // Join the tokens to form a search string
        const searchString = stopWordsRemovedTokens.join(" ");

        // Ensure proper use of aggregate function
       
        try {
            const results = await RECIPE.find(
                { $text: { $search: searchString } },
                { score: { $meta: "textScore" }, title: 1, ingredients: 1}
            )
            .sort({ score: { $meta: "textScore" } })
            .limit(20)
            .exec();
            console.log("results length:", results.length);
            console.log("result: ", results);
            res.json(results); // Send results back to client or render a page with results
        } catch (err) {
            console.error(err);
            res.status(500).send("Internal server error");
        }
           
    } else {
        res.render("login.ejs");
    }
});


APP.post('/clicked-recipe-comments/:id', async function(req,res){
    if (req.isAuthenticated()) {
        try {
            const recipeDetails = await RECIPE.findById(req.params.id);
            if (recipeDetails){
                const sanitizedContent = sanitizeHtml(req.body.CommentText, {
                    allowedTags: [ 'b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'img','li','ul', 'ol','u' ], // Add other allowed tags as needed
                    allowedAttributes: {
                        'a': [ 'href' ]
                    },
                });
                const recipeComment = new COMMENTS({
                    content: sanitizedContent,
                    timestamp: new Date(),
                    recipe_id: req.params.id,
                    username:  req.session.user.username,
                    likes: [],
                });
                const savedCommentDetails = await recipeComment.save();
                if (savedCommentDetails){
                    res.status(200).send("Comment added successfully");
                } else{
                    res.status(404).send("Error in adding comment");
                }
                
            } else {
                res.status(404).send("Recipe Details not found");
            }
           
        } catch (error) {
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        // Handle authentication failure
        res.status(401).send("Unauthorized");
    } 
});

APP.post('/clicked-recipe-comment-like/:id', async function(req,res){
    if (req.isAuthenticated()){
        try {
       
            const commentDetails = await COMMENTS.findById(req.params.id);
            const usernameDetailsOfUserWhoLikedTheComment = req.session.user.username;
             /*var commentsWhichHaveLikeAsNonArrayDataType = await COMMENTS.find({ likes: { $not: { $type: "array" } } });
            console.log(commentsWhichHaveLikeAsNonArrayDataType);
            var i = 0;
            const commentsWithNonArrayLikes = await COMMENTS.find({ likes: { $not: { $type: "array" } } });
            for (const doc of commentsWithNonArrayLikes) {
                let newLikes;
                if (doc.likes === 0 || (Array.isArray(doc.likes) && (doc.likes[0] === 0 || doc.likes[0] === null))) {
                    newLikes = [];
                } else {
                    newLikes = [doc.likes];
                }

                // Convert 'likes' to an array
                /*
                let newLikes;
                if (doc.likes !== undefined && doc.likes === 0) {
                    newLikes = [];
                } else if(doc.likes !== undefined && doc.likes[0] === 0){
                    console.log(doc);
                    newLikes = [];
                } else {
                    newLikes = [doc.likes];
                } */ 

            /* Update the document
                await COMMENTS.updateOne(
                    { _id: doc._id },
                    { $set: { likes: newLikes } }
                );
            } */
            if (commentDetails){
                if (!commentDetails.likes.includes(usernameDetailsOfUserWhoLikedTheComment)) {
                    commentDetails.likes.push(usernameDetailsOfUserWhoLikedTheComment);
                    await commentDetails.save();
                    res.status(200).send("Like added to comment successfully");
                } else {
                    res.status(403).send("Like already added");
                }
                  
            } else{
                res.status(404).send("Comment not found");
            }
            } catch(error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
    } else {
            // Handle authentication failure
        res.status(401).send("Unauthorized");
    }     
});

APP.post('/clicked-recipe-comment-unlike/:id', async function(req, res){
    if (req.isAuthenticated()){
        try {
            const commentDetails = await COMMENTS.findById(req.params.id);
            const usernameDetailsOfUserWhoLikedTheComment = req.session.user.username;
            if (commentDetails){
                var originalCommentLikesLength = commentDetails.likes.length;
                const index = commentDetails.likes.indexOf(usernameDetailsOfUserWhoLikedTheComment)
                if (index !== -1){
                    commentDetails.likes.splice(index,1);
                    await commentDetails.save();

                    res.status(200).send("Like removed from comment successfully");
                } else {
                    res.status(404).send("Like not found");
                }
                   
            } else{
                res.status(404).send("Comment not found");
            }
        }catch (error){
            console.error(error);
            res.status(500).send("Internal Server Error");
        }   
    } else {
        res.status(401).send("Unauthorized");
    }     
});

APP.post('/clicked-recipe-comment-reply/:id', async function(req,res){
    if (req.isAuthenticated()) {
        try {
            const commentDetails = await COMMENTS.findById(req.params.id);
            const usernameDetailsOfTypedComment = req.session.user.username;
            if (commentDetails){
                const sanitizedReplyContent = sanitizeHtml(req.body.commentReplyText, {
                    allowedTags: [ 'b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'img','li','ul', 'ol','u' ], // Add other allowed tags as needed
                    allowedAttributes: {
                        'a': [ 'href' ]
                    },
                });
                const replyDetails = {
                    likes: [],
                    username: usernameDetailsOfTypedComment,
                    recipe_id: req.body.clickedRecipeDetailsIdSplit,
                    timestamp: new Date(),
                    content: sanitizedReplyContent,
                };
                commentDetails.replies.push(replyDetails);
                await commentDetails.save(); 
                
                res.status(200).send("Comment added successfully");
                
            } else {
                res.status(404).send("Comment not found");
            }
           
        } catch (error) {
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        // Handle authentication failure
        res.status(401).send("Unauthorized");
    } 
   
});

APP.post('/register',

    body('first_name').notEmpty().withMessage('First name is required'),

    body('last_name').notEmpty().withMessage('Last name is required'),

    body('country_name').notEmpty().withMessage('Country is required'),

    body('city_name').notEmpty().withMessage('City is required'),

    body('dob').isDate().withMessage('Invalid date of birth'),

    body('email').isEmail().normalizeEmail({gmail_remove_dots: false}).custom(async value => {
        const user = await User.find({
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
        const user = await User.find({
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
        const errors = validationResult(req);
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
            const newUser = new User({
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
            //const findTheAboveUser = await User.findOne({email : email });
            // Send a success response
            res.status(200).send("Registration successful. Please login with the registered email id");
        } catch (error) {
            // Handle any errors that occur during registration
            console.error("Error during registration:", error.message);
            res.status(500).send("Internal Server Error");
        }
    });
// Login route
APP.post('/login',
  body('login_email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Please enter a valid email address'),
  body('login_password').notEmpty().withMessage('Password is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Validation error', errors: errors.array() });
    }

    PASSPORT.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
      }

      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        // Custom handling for successful login
        //res.status(200).json({ status: 'success', message: 'Login successful', redirectTo: '/homePageAfterLogin' });

        else{
            req.session.user = req.user;
            res.render("homePageAfterLogin.ejs", {loggedInUsername : req.session.user.username});
        }
        
      });
    })(req, res, next);
  }
);
APP.post("/forgot-password", async function(req,res){
    const enteredEmailId = req.body.forgot_password_page_email;
    const userEnteredEmailidVerification = await User.find({email: enteredEmailId});
    if (userEnteredEmailidVerification){
        const token = generateToken();
        const message = 'Hi, this is system generated email. Please enter the below token in the Create New Password page to reset the password (The token is only valid for 10 minutes):  '+ token;
        const emailSent = await sendEmail(enteredEmailId, message, token);
        if (emailSent){
            console.log('Password reset token has been sent to the email address.')
            const userUpdatedData = await User.updateOne( 
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


APP.post("/create-new-password",
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
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.send({ error: errors.array() }); 
        } else {
            console.log(req.body.create_new_password_page_token);
            const enteredToken = req.body.create_new_password_page_token;
            const verificationOfEnteredToken = await User.findOne({token: enteredToken});
            console.log(verificationOfEnteredToken);
            if(verificationOfEnteredToken){
                console.log('Document: ' + verificationOfEnteredToken);
                //console.log(new  Date(Date.now() + (0.83 * 60 * 60 * 1000)));
                if (verificationOfEnteredToken.token_expiry > new Date()){
                    const saltRounds = 10;
                    const hashedPassword = await BCRYPT.hash(req.body.create_new_password_page_new_password, saltRounds);
                    const updatedPassword = await User.updateOne({ token: enteredToken }, {password: hashedPassword});
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

APP.post("/add-new-recipe",

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
    
    const errors = validationResult(req);
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
            console.log("Req.user", req.session.user);  
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
                email_id : req.session.user.email,
                username : req.session.user.username,
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
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.send({error: errors.array()}); 
        }
        console.log(req.body);
        const {login_email, login_password} = req.body;
        
        try {
            const user = await User.findOne({ email: login_email});
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
import * as CHAI from 'chai';
import CHAI_HTTP from 'chai-http';
//import { request } from 'chai' ;
//import { EXPECT } from 'chai';
import APP from '../srcCode/routes/routes.js'; // Assuming your Express APP file is named APP.js
import User from '../srcCode/src/models/schema.js'; // Adjust the path as per your project structure
import BCRYPT from 'bcrypt';
import { generateToken } from '../srcCode/cryptoGenerateToken.js';

CHAI.use(CHAI_HTTP);
const { EXPECT } = CHAI.expect;

describe('Authentication Module', () => {
  beforeEach(async () => {
    // Set up a test user for login tests
    const saltRounds = 10;
    const hashedPassword = await BCRYPT.hash('V_anish123$$', saltRounds);
    const dateOfBirth = new Date("1995-08-09");
    await User.create({
      first_name: 'Venkat',
      last_name: 'Anish',
      email: 'vanish@gmail.com',
      username: 'v_anish',
      country_name: 'India',
      city_name: 'Bangalore',
      dob: dateOfBirth ,
      password: hashedPassword,
      token: generateToken(),
    });
  });

  afterEach(async () => {
    // Clean up test data after each test
    await User.deleteMany({ email: 'vanish@gmail.com' });
  });

  describe('POST /login', () => {
    it('should return 200 and redirect to home page on successful login', (done) => {
      CHAI.request(APP)
        .post('/login')
        .send({ login_email: 'vanish@gmail.com', login_password: 'V_anish123$$' })
        .end((err, res) => {
          EXPECT(res).to.have.status(200);
          EXPECT(res).to.redirectTo('../srcCode/views/homePageAfterLogin');
          done();
        });
    });

    it('should return 401 for invalid credentials', (done) => {
      CHAI.request(APP)
        .post('/login')
        .send({ login_email: 'vanish@gmail.com', login_password: 'V_anish123$' })
        .end((err, res) => {
          EXPECT(res).to.have.status(401);
          done();
        });
    });

    // Add more test cases for login functionality as needed
  });

  // Add more describe blocks for other authentication endpoints like /logout, /register, etc.
});
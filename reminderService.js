// reminderService.js

const TRANSPORTER = require('./emailConfig');


async function sendEmail(receiverEmail, message, token) {
  // Set up the scheduled reminder
    
    // Send the email
    const mailOptions = {
      from   : 'nehahimesh.10@gmail.com',
      to     : receiverEmail,
      subject: 'Password Reset Link',
      text   : message,
    };
    let info = await TRANSPORTER.sendMail(mailOptions);

    console.log('Message sent: %s', info.messageId);

    return true;
  
}

module.exports = { sendEmail };
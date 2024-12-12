require('dotenv').config(); // Load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
const admin = require('firebase-admin');
const cors = require('cors'); // Import the CORS middleware

const PORT = process.env.PORT || 3000;

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const app = express();

// Enable CORS for all routes
app.use(cors());

app.use(bodyParser.json());
app.use(express.json());

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

app.get('/get-data', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();

    if (snapshot.empty) {
      return res.status(404).send({ message: 'No documents found' });
    }

    const validEmails = [];
    snapshot.forEach((doc) => {
      const { email, name } = doc.data();
      if (email && name && isValidEmail(email)) {
        validEmails.push({ email, name });
      }
    });

    if (validEmails.length === 0) {
      return res.status(404).send({ message: 'No valid emails found' });
    }

    const emailPromises = validEmails.map(({ email, name }) => {
      const msg = {
        to: email,
        from: 'no-reply@narr8ar.com', 
        subject: `Hello, ${name}!`,
        text: `Hi ${name}, we're excited to have you here!`,
        html: `<strong>Hi ${name}, we're excited to have you here!</strong>`,
      };

      return sgMail
        .send(msg)
        .then(() => ({ email, status: 'success' }))
        .catch((error) => {
          console.error(`Error sending email to ${email}:`, error);
          return { email, status: 'failed', error: error.message };
        });
    });

    const emailResults = await Promise.all(emailPromises);
    res.status(200).send({ message: 'Email sending completed.', results: emailResults });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send({ error: 'Failed to fetch data or send emails' });
  }
});

app.post('/send-email', async (req, res) => {
  const { email, name, treeId } = req.body;
  console.log({email , name , treeId})

  // Validate input
  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required.' });
  }

  const msg = {
    to: email,
    from: 'no-reply@narr8ar.com',
    subject: `Hello, ${name}!`,
    text: `Hi ${name}, we're excited to have you here! Hope you are fine! Here is your ID to access your tree: ${treeId}`,
    html: `<strong>Hi ${name}, we're excited to have you here! Hope you are fine! Here is your ID to access your tree: ${treeId}</strong>`,
  };

  try {
    await sgMail.send(msg);
    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);

    if (error.response) {
      console.error('SendGrid response error:', error.response.body);
    }

    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

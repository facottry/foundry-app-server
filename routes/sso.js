const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth'); // Existing middleware

// Routes
router.post('/login/otp/request', AuthController.requestOtp);
router.post('/login/otp/verify', AuthController.verifyOtp);
router.post('/login/password', AuthController.loginPassword);
router.post('/login/provider', AuthController.providerLogin); // Generic provider login

// Secure Routes
// router.use(authMiddleware()); // Depending on middleware signature
// Assuming 'auth' middleware populates req.user
const protected = require('../middleware/auth')();

router.get('/identities', protected, AuthController.getIdentities);
router.delete('/identities/:id', protected, AuthController.detachIdentity);


// Real OAuth Routes
router.get('/:provider', AuthController.socialRedirect);
router.get('/:provider/callback', AuthController.socialCallback); // Legacy/Redirect
router.post('/:provider/callback', AuthController.socialExchange); // SPA/JSON

// Google SDK Verification Route
router.post('/google', AuthController.verifyGoogleToken);

module.exports = router;

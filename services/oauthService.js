const axios = require('axios');
const querystring = require('querystring');

class OAuthService {
    static getRedirectUrl(provider) {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';
        switch (provider) {
            case 'google':
                return `https://accounts.google.com/o/oauth2/v2/auth?` + querystring.stringify({
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    redirect_uri: `${clientUrl}/auth/google/callback`,
                    response_type: 'code',
                    scope: 'email profile',
                    access_type: 'offline',
                    prompt: 'consent'
                });
            case 'github':
                return `https://github.com/login/oauth/authorize?` + querystring.stringify({
                    client_id: process.env.GITHUB_CLIENT_ID,
                    redirect_uri: `${clientUrl}/auth/github/callback`,
                    scope: 'user:email'
                });
            case 'linkedin':
                return `https://www.linkedin.com/oauth/v2/authorization?` + querystring.stringify({
                    response_type: 'code',
                    client_id: process.env.LINKEDIN_CLIENT_ID,
                    redirect_uri: `${clientUrl}/auth/linkedin/callback`,
                    scope: 'r_liteprofile r_emailaddress'
                });
            default:
                throw new Error('Unknown provider');
        }
    }

    static async exchangeCode(provider, code) {
        switch (provider) {
            case 'google':
                return await this.getGoogleProfile(code);
            case 'github':
                return await this.getGithubProfile(code);
            case 'linkedin':
                return await this.getLinkedinProfile(code);
            default:
                throw new Error('Unknown provider');
        }
    }

    static async getGoogleProfile(code) {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';
        const { data } = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${clientUrl}/auth/google/callback`
        });

        const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });

        return profile;
    }

    static async getGithubProfile(code) {
        // GitHub doesn't require redirect_uri in the access_token step usually, but strict mode might.
        // It uses client_id/secret.
        const { data } = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
        }, { headers: { Accept: 'application/json' } });

        if (data.error) throw new Error(data.error_description);

        const { data: userProfile } = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });

        // Github email might be private
        const { data: emails } = await axios.get('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });
        const primaryEmail = emails.find(e => e.primary && e.verified)?.email || emails[0].email;

        return {
            ...userProfile,
            email: primaryEmail
        };
    }

    static async getLinkedinProfile(code) {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3001';
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', `${clientUrl}/auth/linkedin/callback`);
        params.append('client_id', process.env.LINKEDIN_CLIENT_ID);
        params.append('client_secret', process.env.LINKEDIN_CLIENT_SECRET);

        const { data } = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { data: me } = await axios.get('https://api.linkedin.com/v2/me', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });

        const { data: emailData } = await axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });

        const email = emailData.elements[0]['handle~'].emailAddress;

        return {
            id: me.id,
            name: `${me.localizedFirstName} ${me.localizedLastName}`,
            email: email,
            email_verified: true, // LinkedIn emails are verified
        };
    }
}

module.exports = OAuthService;

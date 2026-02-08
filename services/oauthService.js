const axios = require('axios');
const querystring = require('querystring');

class OAuthService {
    static getBaseUrls(req) {
        // Dynamic discovery of protocol and host
        const protocol = req ? (req.headers['x-forwarded-proto'] || req.protocol) : 'http';
        const host = req ? req.get('host') : 'localhost:5000';

        // serverBase: where the API is running (e.g. api.clicktory.in or localhost:5000)
        const serverBase = req ? `${protocol}://${host}` : (process.env.APP_SERVER_URL || 'http://localhost:5000');

        // clientBase: where the Frontend is running (e.g. clicktory.in or localhost:3000)
        let clientBase = process.env.CLIENT_URL || 'https://foundry-app-client.onrender.com';
        if (req && !process.env.CLIENT_URL) {
            if (host.startsWith('api.')) {
                clientBase = `${protocol}://${host.substring(4)}`;
            } else if (host.includes('localhost:5000')) {
                clientBase = 'http://localhost:3000';
            }
        }
        return { serverBase, clientBase };
    }

    static getRedirectUrl(provider, req) {
        const { serverBase, clientBase } = this.getBaseUrls(req);

        switch (provider) {
            case 'google':
                return `https://accounts.google.com/o/oauth2/v2/auth?` + querystring.stringify({
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    redirect_uri: `${clientBase}/auth/google/callback`,
                    response_type: 'code',
                    scope: 'email profile',
                    access_type: 'offline',
                    prompt: 'consent'
                });
            case 'github':
                return `https://github.com/login/oauth/authorize?` + querystring.stringify({
                    client_id: process.env.GITHUB_CLIENT_ID,
                    redirect_uri: `${serverBase}/api/auth/sso/github/callback`,
                    scope: 'user:email'
                });
            case 'linkedin':
                return `https://www.linkedin.com/oauth/v2/authorization?` + querystring.stringify({
                    response_type: 'code',
                    client_id: process.env.LINKEDIN_CLIENT_ID,
                    redirect_uri: `${clientBase}/auth/linkedin/callback`,
                    scope: 'r_liteprofile r_emailaddress'
                });
            default:
                throw new Error('Unknown provider');
        }
    }

    static async exchangeCode(provider, code, req) {
        switch (provider) {
            case 'google':
                return await this.getGoogleProfile(code, req);
            case 'github':
                return await this.getGithubProfile(code, req);
            case 'linkedin':
                return await this.getLinkedinProfile(code, req);
            default:
                throw new Error('Unknown provider');
        }
    }

    static async getGoogleProfile(code, req) {
        const { clientBase } = this.getBaseUrls(req);
        const { data } = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${clientBase}/auth/google/callback`
        });

        const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });

        return profile;
    }

    static async getGithubProfile(code, req) {
        const { serverBase } = this.getBaseUrls(req);
        try {
            const { data } = await axios.post('https://github.com/login/oauth/access_token', {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: `${serverBase}/api/auth/sso/github/callback`
            }, { headers: { Accept: 'application/json' } });

            if (data.error) throw new Error(data.error_description);

            const { data: userProfile } = await axios.get('https://api.github.com/user', {
                headers: { Authorization: `Bearer ${data.access_token}` }
            });

            const { data: emails } = await axios.get('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${data.access_token}` }
            });

            const primaryEmail = emails.find(e => e.primary && e.verified)?.email || emails[0].email;

            return { ...userProfile, email: primaryEmail };
        } catch (error) {
            console.error('[OAuth Debug] GitHub Exchange Failed:', error.response?.data || error.message);
            throw error;
        }
    }

    static async getLinkedinProfile(code, req) {
        const { clientBase } = this.getBaseUrls(req);
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', `${clientBase}/auth/linkedin/callback`);
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
            email_verified: true,
        };
    }
}

module.exports = OAuthService;

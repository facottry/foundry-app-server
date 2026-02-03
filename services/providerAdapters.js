class ProviderAdapters {
    static google(profile) {
        return {
            id: profile.sub || profile.id,
            email: profile.email,
            verified: profile.email_verified || false,
        };
    }

    static github(profile) {
        return {
            id: String(profile.id),
            email: profile.email,
            verified: true // Assume verified if returned from API
        };
    }

    static linkedin(profile) {
        return {
            id: profile.sub || profile.id,
            email: profile.email,
            verified: profile.email_verified || true
        };
    }
}

module.exports = ProviderAdapters;

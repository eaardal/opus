package auth

// GoogleDesktopOAuthClientID is the Google Cloud OAuth 2.0 Client ID of
// type "Desktop app" associated with the Firebase project.
//
// This value is public by design. Desktop OAuth clients use PKCE rather
// than a client secret, and Google's consent screen will show the user
// this client so they can verify what is requesting access.
//
// TODO: replace with the client ID from Google Cloud Console →
// APIs & Services → Credentials (Application type: Desktop app).
const GoogleDesktopOAuthClientID = ""

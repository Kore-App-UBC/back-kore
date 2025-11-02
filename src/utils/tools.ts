const loadGCSCredentialsJson = () => {
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (!credentials) {
        throw new Error('Google Cloud Storage credentials not found');
    }

    return JSON.parse(credentials);
}

export {
    loadGCSCredentialsJson
};
# Google APIs Authenticator

Google APIs Authentication made simple, just export your service account via `GOOGLE_APPLICATION_CREDENTIALS` environment variable and it's done.

This package knows when you are working on local environment or if you are using any Google service like Cloud Run, Cloud Functions,... Using a custom service account in those service is very convenient, but user impersonation is hard to achieve via googleapis nodeJS library, this library aims to unlock that block.

### Requirements:

Enable iAM API [here](https://console.cloud.google.com/apis/api/iam.googleapis.com/overview).

Service Account needed roles:

```
- Service Account Token Creator
```

### Example:

```typescript
import { GoogleApisAuthenticator } from 'google-apis-authenticator'
import { google } from 'googleapis'

const scopes = []
const impersonationEmail = 'impersoname@me.com'

const googleApisAuthenticator = new GoogleApisAuthenticator(scopes, impersonationEmail)

const auth = googleApisAuthenticator.getCredentials()
auth.then(async (crendentials) => {
  const res = await google.gmail({ version: 'v1', auth: credentials }).users.messages.list()
  console.log(res)
})
```

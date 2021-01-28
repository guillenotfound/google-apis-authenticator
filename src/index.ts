import { Compute, GoogleAuth, JWT, JWTOptions, OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import fetch from 'node-fetch'
import * as querystring from 'querystring'

export class GoogleApisAuthenticator {
  private subject: string | undefined
  private scopes: string[]
  private expirityTimestamp = 0
  private accessToken: string | null = null

  constructor(scopes: string | string[], subject?: string) {
    this.scopes = this.parseScopes(scopes)
    this.subject = subject
  }

  private get getClientOptions(): JWTOptions {
    let clientOptions: JWTOptions = {}
    if (this.subject) {
      clientOptions = {
        subject: this.subject,
      }
    }

    return clientOptions
  }

  public async getCredentials(): Promise<JWT | OAuth2Client> {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
    const authClient = await auth.getClient()

    if (authClient instanceof JWT) {
      return this.authenticateDevelopment()
    } else if (authClient instanceof Compute) {
      const now = Math.floor(new Date().getTime() / 1000)
      const tokenHasNotExpired = now < this.expirityTimestamp - 60

      if (this.accessToken && tokenHasNotExpired) {
        return this.generateClient(this.accessToken)
      }

      return this.authenticateGCP(auth)
    } else {
      throw new Error('Unexpected authentication type')
    }
  }

  private parseScopes(scopes: string | string[]): string[] {
    return Array.isArray(scopes) ? scopes : [scopes]
  }

  private unpaddedBase64encode(input: string): string {
    return Buffer.from(input).toString('base64').replace(/=*$/, '')
  }

  private async authenticateDevelopment(): Promise<JWT> {
    const auth = new GoogleAuth({ scopes: this.scopes, clientOptions: this.getClientOptions })
    return (await auth.getClient()) as JWT
  }

  private async authenticateGCP(auth: GoogleAuth): Promise<OAuth2Client> {
    const DEFAULT_TOKEN_EXPIRITY = 3600

    const serviceAccountEmail = (await auth.getCredentials()).client_email

    const now = Math.floor(new Date().getTime() / 1000)
    this.expirityTimestamp = now + DEFAULT_TOKEN_EXPIRITY

    const payload = JSON.stringify({
      aud: 'https://accounts.google.com/o/oauth2/token',
      exp: this.expirityTimestamp,
      iat: now,
      iss: serviceAccountEmail,
      scope: this.scopes.join(' '),
      sub: this.subject || serviceAccountEmail,
    })

    const header = JSON.stringify({
      alg: 'RS256',
      typ: 'JWT',
    })

    const iamPayload = `${this.unpaddedBase64encode(header)}.${this.unpaddedBase64encode(payload)}`
    const { data } = await google.iamcredentials({ version: 'v1', auth: await auth.getClient() }).projects.serviceAccounts.signBlob({
      name: `projects/-/serviceAccounts/${serviceAccountEmail}`,
      requestBody: {
        payload: this.unpaddedBase64encode(iamPayload),
      },
    })
    const assertion = `${iamPayload}.${data.signedBlob?.replace(/=*$/, '')}`

    const headers = { 'content-type': 'application/x-www-form-urlencoded' }
    const body = querystring.encode({ assertion, grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer' })
    const response = await fetch('https://accounts.google.com/o/oauth2/token', { method: 'POST', headers, body }).then((r) => r.json())
    this.accessToken = response.access_token
    return this.generateClient(response.access_token)
  }

  private generateClient(accessToken: string): OAuth2Client {
    const authClient = new OAuth2Client()
    authClient.setCredentials({ access_token: accessToken })
    return authClient
  }
}

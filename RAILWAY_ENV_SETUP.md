# Railway Environment Variables Setup for Paycom SFTP

## Required Environment Variables

To enable Paycom SFTP sync on Railway, you need to add the following environment variables in your Railway service settings:

### Required Variables

1. **PAYCOM_SFTP_HOST**
   - Description: The SFTP hostname for Paycom
   - Example: `sftp.paycom.com` or `your-paycom-sftp-host.com`
   - **Required**: Yes

2. **PAYCOM_SFTP_USERNAME**
   - Description: Your Paycom SFTP username
   - Example: `your-username`
   - **Required**: Yes

3. **PAYCOM_SFTP_PASSWORD** (or use **PAYCOM_SFTP_PRIVATE_KEY_PATH**)
   - Description: Your Paycom SFTP password OR path to private key file
   - Example: `your-password`
   - **Required**: Yes (one of password or private key)

### Optional Variables (with defaults)

4. **PAYCOM_SFTP_PORT**
   - Default: `22`
   - Description: SFTP port number
   - Example: `22`

5. **PAYCOM_SFTP_REMOTE_DIRECTORY**
   - Default: `/` (but Paycom typically uses `/Outbound` for time tracking files)
   - Description: Remote directory on SFTP server where files are stored
   - **Recommended**: `/Outbound` for Paycom time tracking files
   - Example: `/Outbound` or `/` or `/reports`

6. **PAYCOM_SFTP_LOCAL_DIRECTORY**
   - Default: Uses `MEDIA_ROOT/paycom_reports/`
   - Description: Local directory to store downloaded files (leave empty to use default)
   - Example: `/app/media/paycom_reports`

7. **PAYCOM_SFTP_PRIVATE_KEY_PATH** (alternative to password)
   - Default: `None`
   - Description: Path to private key file for SSH key authentication
   - Example: `/app/keys/paycom_rsa_key`
   - Note: If using this, you don't need PAYCOM_SFTP_PASSWORD

## How to Add Environment Variables in Railway

1. **Go to your Railway project dashboard**
   - Navigate to: https://railway.app/dashboard
   - Select your project: `scheduler-abst`
   - Select your backend service

2. **Open Variables tab**
   - Click on the service
   - Click on the "Variables" tab (or look for "Environment Variables" / "Env" tab)

3. **Add each variable**
   - Click "New Variable" or "+" button
   - Enter the variable name (e.g., `PAYCOM_SFTP_HOST`)
   - Enter the variable value (get this from your local `.env` file)
   - Click "Add" or "Save"

4. **Verify your local values**
   - Check your local `backend/.env` file for the Paycom SFTP credentials
   - Copy those exact values to Railway

## Verification

After adding the environment variables:

1. **Redeploy your service** (or Railway will auto-redeploy)
   - Railway automatically redeploys when environment variables change

2. **Test the sync**
   - Go to your frontend: `scheduler-abst.vercel.app`
   - Navigate to Paycom → Sync Controls
   - Click "Sync Now"
   - You should no longer see the "Error proc.se set PAYCOM_SFTP_HOST..." error

## Quick Checklist

- [ ] PAYCOM_SFTP_HOST is set
- [ ] PAYCOM_SFTP_USERNAME is set
- [ ] PAYCOM_SFTP_PASSWORD is set (OR PAYCOM_SFTP_PRIVATE_KEY_PATH)
- [ ] Service has been redeployed after adding variables
- [ ] Test sync works without errors

## Troubleshooting

If you still get errors after setting the variables:

1. **Check variable names**: Make sure they're exactly as listed (case-sensitive)
2. **Check for typos**: Verify the values match your local `.env` file
3. **Redeploy**: Make sure the service has been redeployed
4. **Check logs**: View Railway service logs to see detailed error messages
   - Go to your service → "Deployments" → Click on latest deployment → View logs

## Security Notes

- **Never commit** your `.env` file with real credentials
- Railway environment variables are encrypted and secure
- Each service has its own isolated environment variables
- You can use Railway's variable references if you have shared values


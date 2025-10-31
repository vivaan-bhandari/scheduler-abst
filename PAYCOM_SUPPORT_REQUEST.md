# Paycom SFTP Support Request

## Issue Summary
SFTP authentication works perfectly on localhost and FileZilla, but fails when connecting from Railway (cloud deployment) with the exact same credentials.

## Connection Details
- **SFTP Host:** `push.paycomonline.net`
- **Port:** `22`
- **Username:** `000_10a54_internalad`
- **Password:** `Q{f3H}bG` (8 characters, contains special characters `{` and `}`)
- **SFTP Server:** GoAnywhere 7.7.1 (SSH-2.0)

## What Works
✅ Connection from localhost (Django app) - **SUCCESS**
✅ Connection from FileZilla - **SUCCESS**
✅ Connection from Railway - **CONNECTION SUCCEEDS** but **AUTHENTICATION FAILS**

## What Fails
❌ Authentication from Railway deployment
- SSH handshake succeeds
- Key exchange succeeds  
- Auth banner received: "Welcome! Please login."
- Password authentication fails immediately

## Technical Details
- **SSH Client:** paramiko 3.4.0
- **Connection Method:** Password authentication
- **Password Verification:** Confirmed correct (verified character-by-character)
- **Error:** `Authentication (password) failed` from GoAnywhere server

## What We've Verified
1. ✅ Password is correct (`Q{f3H}bG`)
2. ✅ All character codes match expected values
3. ✅ Password matches exactly (verified with comparison)
4. ✅ Connection and SSH handshake succeed
5. ✅ Auth banner is received
6. ✅ Credentials work from localhost and FileZilla

## Questions for Paycom Support
1. **Are there IP-based restrictions?** Railway uses dynamic IPs - do these need to be whitelisted?
2. **Are there account restrictions?** Does the SFTP account `000_10a54_internalad` have any restrictions on cloud/VPS connections?
3. **Can you check connection logs?** Can you see our authentication attempts from Railway and identify why they're failing?
4. **Are there SSH client restrictions?** Are there restrictions on which SSH clients can connect (paramiko vs others)?
5. **Is the account locked/restricted?** Could the account be temporarily locked or restricted for some reason?

## Logs from Railway
```
Connected (version 2.0, client GoAnywhere7.7.1)
Auth banner: b'Welcome! Please login.\n'
Authentication (password) failed.
```

## Next Steps Requested
1. Please verify the SFTP account is active and has no restrictions
2. Please check connection logs to see why Railway connections are being rejected
3. Please advise if IP whitelisting is required or if there are other restrictions
4. Please confirm if there are any account-level settings that need to be adjusted

## Contact Information
- **Project:** scheduler-abst (LTCFP)
- **Environment:** Production deployment on Railway
- **Issue Date:** October 31, 2025


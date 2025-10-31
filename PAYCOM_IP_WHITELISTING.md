# Paycom SFTP IP Whitelisting Guide

## Problem
SFTP sync works perfectly on localhost and FileZilla, but fails on Railway with "Authentication failed" error.

## Root Cause
**IP Whitelisting** - Paycom's SFTP server requires source IP addresses to be whitelisted. Railway's IP addresses are likely not whitelisted in Paycom's system.

## Solution Options

### Option 1: Whitelist Railway IP Addresses (Recommended)

1. **Get Railway's IP Addresses**
   - Railway deployments use dynamic IPs
   - You can check your Railway service logs to see the outbound IP
   - Or contact Railway support for their IP ranges

2. **Contact Paycom Support**
   - Request to whitelist Railway's IP addresses
   - Provide them with Railway's IP range if available
   - Or ask for their IP whitelisting process

3. **Alternative: Use Railway's Static IP** (if available)
   - Railway may offer static IP options
   - Check Railway's documentation or support

### Option 2: Use a Proxy/VPN Service

If whitelisting Railway IPs isn't possible:

1. **Set up a proxy server** with a whitelisted IP
2. **Route SFTP connections through the proxy**
3. This adds complexity but can work

### Option 3: Use Railway's Ingress IP (if available)

1. **Check Railway documentation** for static egress IPs
2. **Get the specific IP** from Railway dashboard/logs
3. **Whitelist that IP** with Paycom

## How to Get Railway's Outbound IP

### Method 1: Check Railway Logs
After a sync attempt fails, check Railway logs for connection details.

### Method 2: Use a Test Endpoint
Create a simple endpoint to check the outbound IP:

```python
# Add to a view
import requests

def get_outbound_ip(request):
    response = requests.get('https://api.ipify.org?format=json')
    return JsonResponse({'ip': response.json()['ip']})
```

### Method 3: Check During SFTP Connection
The improved error logging now shows the source IP when connection fails.

## Steps to Resolve

### Immediate Steps:
1. ✅ **Check Railway deployment logs** after a failed sync attempt
2. ✅ **Look for the connection source IP** in error logs
3. ✅ **Contact Paycom support** with:
   - Your SFTP username: `000_10a54_internalad`
   - Railway's outbound IP address (from logs)
   - Request to whitelist the IP for SFTP access

### Long-term Steps:
1. **Document the IP whitelisting process** with Paycom
2. **Set up monitoring** to detect if Railway IPs change
3. **Consider using a static IP** if Railway supports it

## Testing

After IP is whitelisted:
1. Wait for whitelist to take effect (usually immediate, sometimes up to 15 minutes)
2. Try the sync again on Railway
3. Check logs to confirm successful connection

## Notes

- Railway's IP addresses may change when services redeploy
- You may need to whitelist multiple IPs or an IP range
- Some Paycom accounts have automatic whitelisting for common cloud providers - check if Railway is included

## Alternative Workarounds

If IP whitelisting isn't possible:
1. **Scheduled local sync** - Run a sync script on a whitelisted server
2. **Webhook/API alternative** - Check if Paycom offers API alternatives to SFTP
3. **Email-based reports** - Some Paycom setups support email delivery instead of SFTP

